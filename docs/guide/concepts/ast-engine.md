# Polyglot AST Engine (Composite Remediation)

Static code analysis in modern AI-assisted engineering requires far deeper structural understanding than superficial regex matching or basic file-existence linters. Large Language Models (LLMs) frequently generate syntactically correct code that masks critical architectural and security flaws:

* **Unparameterized Dynamic SQL (CWE-89):** LLMs assemble queries via string template interpolation (`db.query("SELECT * FROM users WHERE id = " + userId)`), introducing critical SQL injection vulnerabilities.
* **Assertionless "False-Green" Tests (Optional / Opt-in via `--include-tests`):** AI agents write tests that execute functions and mock everything, but assert zero behavioral invariants (`expect`, `assert`, `t.Fatal`), producing green CI runs with zero real verification. *(Note: Test directories are excluded by default for scan latency; pass `--include-tests` to inspect)*.
* **Hardcoded Credentials & Leaked Seams:** Secrets, staging tokens, and high-entropy keys are placed directly into source literals, bypassing naive regex pattern filters.

To eradicate these hazards in sub-200ms without imposing complex host build toolchains, Matryoshka-Harness incorporates the **Polyglot AST Engine** invoked via the canonical **`baba wrap`** (`matryoshka wrap`, `bbyg wrap`) command.

---

## ⚡ 1. Zero-Host-Dependency WebAssembly (WASM) Architecture

Traditional AST linters (like ESLint, PyAST, or language-specific compiler plugins) require dedicated language runtimes, C++ native build headers, or host Python/Rust toolchains. This creates brittle dependency matrices in automated agent sandboxes and CI runners.

Matryoshka solves this with portable **Tree-sitter WebAssembly (WASM)** runtimes:

```text
┌────────────────────────────────────────────────────────────────┐
│                       baba wrap Engine                         │
└───────────────────────────────┬────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     Harness-Score Oracle      │       │     Polyglot AST Walker       │
│    (Base Hygiene 0 to 100)    │       │     (Tree-sitter WASM)        │
└───────────────┬───────────────┘       └───────────────┬───────────────┘
                │                                       │
                │     Contextual AST Antipatterns:      │
                │     • raw-sql (CWE-89)                │
                │     • assertionless-test              │
                │     • hardcoded-credential            │
                │                                       │
                └───────────────────────┬───────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │       Composite Scorer        │
                        │   Score: 0.4 Base + 0.6 AST   │
                        └───────────────┬───────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │    Deterministic Compilers    │
                        │    • DIAGNOSTIC.md (<1,500 t) │
                        │    • Structured JSON (--json) │
                        └───────────────────────────────┘
```

### Architectural Guarantees:

* **Zero Host Toolchains:** Executes natively inside the Bun JavaScript runtime without requiring GCC, Clang, Python, or Cargo on the host machine.
* **Sub-200ms Execution:** In-memory AST construction and tree-walking inspects polyglot repositories in milliseconds.
* **Resilient Walking Guards:**
  * **Vendor Exclusion:** Automatically ignores `node_modules`, `.venv`, `target`, `vendor`, `.git`, `dist`, and `build`.
  * **Binary Detection:** Inspects the first 8KB of each candidate file for null bytes (`\0`) to skip binary blobs.
  * **File Size Bounding:** Enforces `--max-file-size 500` (500KB default) to prevent memory spikes on bundled assets.
  * **Per-File Timeout:** Bounds AST evaluation to 2,000ms per file, gracefully isolating malformed syntax without crashing the scan.

---

## 🔬 2. The 3 Canonical AST Antipattern Rules

Matryoshka enforces three high-signal, zero-noise contextual AST rules across **TypeScript/JavaScript**, **Python**, **Go**, and **Rust**:

### Rule 1: `raw-sql` (CWE-89: SQL Injection Hazard)
Flags dynamic string interpolations, template literals, and runtime string concatenation passed to database query methods.

* **Target Method Identifiers:** `query`, `execute`, `raw`, `exec`, `Query`, `Exec`.
* **Structural AST Pattern:**
  * TypeScript/JavaScript: `TemplateLiteral` with `expressions.length > 0` or binary `+` concatenation inside `CallExpression`.
  * Python: `JoinedStr` (f-strings) or `%` / `.format()` interpolation inside `Call` nodes.
  * Go: `fmt.Sprintf` calls passed into `db.Query` or `db.Exec`.
* **Remediation Blueprint:**
  ```typescript
  // ❌ VULNERABLE: Dynamic template interpolation
  const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);

  // ✅ REMEDIATED: Parameterized query with bound parameters
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  ```

### Rule 2: `assertionless-test` (False-Green Hazard)
> ⚠️ **Flag Requirement:** Test directories (`tests/`, `__tests__/`, `*_test.go`) are excluded from default AST passes to ensure sub-200ms speed. You **must pass `--include-tests`** to activate this rule (e.g., `baba wrap --include-tests`).
LLMs frequently hallucinate tests that invoke application logic and mock return values, but never assert that anything actually succeeded. These tests pass trivially even when core business logic breaks.

* **Target Function Identifiers:**
  * TypeScript/JavaScript: `it(...)`, `test(...)`
  * Python: `def test_*`
  * Go: `func Test*(t *testing.T)`
  * Rust: `#[test] fn *`
* **Structural AST Pattern:** Traverses the body of the test function. If zero assertion calls (`expect`, `assert`, `t.Fatal`, `t.Error`, `assert_eq!`) are discovered, the rule flags the test as a critical false-green hazard.
* **Remediation Blueprint:**
  ```typescript
  // ❌ VULNERABLE: Assertionless test (Passes trivially with false-green)
  it("calculates monthly billing total", async () => {
    const billing = new BillingService();
    await billing.calculateTotal(mockAccount);
    // No assertions!
  });

  // ✅ REMEDIATED: Explicit behavioral assertion
  it("calculates monthly billing total", async () => {
    const billing = new BillingService();
    const total = await billing.calculateTotal(mockAccount);
    expect(total).toBe(129.99);
  });
  ```

### Rule 3: `hardcoded-credential` (Secret Leakage Hazard)
Identifies plaintext credentials, tokens, and private keys embedded in source code nodes.

* **Structural AST Pattern:**
  1. **Known Token Prefixes:** Identifies strings beginning with canonical secret signatures (`sk_live_`, `ghp_`, `AKIA`, `AIza`, `xoxb-`, `bearer `).
  2. **Sensitive Variable Names:** Variables matching `api_key`, `secret`, `token`, `password`, `auth_token` assigned to string literals.
  3. **Shannon Entropy Analysis:** Computes the mathematical Shannon entropy of the literal:
     > `H(S) = - ∑ p(x) * log₂ p(x)`
     > Strings with entropy **H > 3.0** and length **≥ 16 characters** are flagged as potential high-entropy credentials/tokens.
* **Exempt Patterns:** Environment variable readings (`process.env.KEY`, `os.environ.get("KEY")`, `os.Getenv("KEY")`) and trivial configuration placeholders are exempt.



---

## 📝 3. Actionable Remediation: `DIAGNOSTIC.md`

When violations are detected, developers and AI agents do not need to parse obscure terminal logs. `baba wrap` compiles an anti-slop, human- and machine-readable remediation plan to **`DIAGNOSTIC.md`**:

### FinOps Token Budget (< 1,500 Tokens)
To prevent downstream context window exhaustion when feeding the diagnostic report back into an LLM, the compiler strictly enforces a hard ceiling of **1,500 tokens**. If a project contains hundreds of violations, the compiler presents the most critical findings first and truncates remaining items with an actionable pointer to `--json`.

### Sample Generated `DIAGNOSTIC.md`:

```markdown
# 🛡️ Matryoshka Diagnostic & Harness² Remediation Report

**Target:** `/workspace/my-project`  
**Status:** [NEEDS REMEDIATION]

---

## 📊 Score Breakdown
- **Base Repository Hygiene (Oracle):** 85 / 100
- **AST Context-Fencing Health:** 73 / 100
- **Analyzed Files:** 34 files (18 TypeScript, 12 Python, 4 Go)
- **Violations:** 1 Critical, 2 High, 0 Medium

---

## 🚨 Actionable Remediation Plan

### 1. [CRITICAL] `raw-sql` (CWE-89)
* **Location:** `src/users/repository.ts:42`
* **Node Type:** `TemplateLiteral` inside `CallExpression` (`db.query`)
* **Remediation:** Replace dynamic template literal with parameterized query:
  ```typescript
  // Before:
  db.query(`SELECT * FROM users WHERE tenant_id = '${tenantId}'`);
  // After:
  db.query('SELECT * FROM users WHERE tenant_id = $1', [tenantId]);
  ```

### 2. [HIGH] `assertionless-test`
* **Location:** `tests/auth.test.ts:18`
* **Node Type:** `CallExpression` (`it("handles token refresh")`)
* **Remediation:** Add explicit assertions (`expect(res.status).toBe(200)`).
```

---

## 🛠️ 5. CLI Invocation & CI/CD Quality Gates

`baba wrap` operates with identical ergonomics across all three binary aliases (`baba`, `bbyg`, `matryoshka`):

```bash
# Standard interactive execution:
baba wrap

# CI/CD Quality Gate (Strict mode with custom threshold):
baba wrap --strict --threshold 80

# Machine-readable output for automated pipelines:
baba wrap --json

# Custom report output destination:
baba wrap --output ./reports/HARNESS_AUDIT.md

# Simulation mode (Evaluates AST without writing to disk):
baba wrap --dry-run
```

### CLI Flags Reference

| Flag | Shorthand | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `--strict` | `-s` | Boolean | `false` | Exits with code `1` if score is below threshold or critical violations exist. |
| `--threshold` | `-t` | Number | `80` | Minimum passing score for strict CI gates. |
| `--output` | `-o` | String | `./DIAGNOSTIC.md` | Destination file for the markdown remediation report. |
| `--dry-run` | `-d` | Boolean | `false` | Evaluates rules without writing `DIAGNOSTIC.md` to disk. |
| `--json` | `-j` | Boolean | `false` | Emits structured JSON telemetry to stdout. |
| `--max-file-size` | | Number | `500` | Maximum file size (KB) to parse in AST walker. |

---

## ⏭️ Next Reading

* [Concentric Layers](concentric-layers.md) — The Russian Doll mental model (Layers 1 to 5).
* [Adaptive Agents & Skills](adaptive-agents.md) — Compiling ultra-lean `AGENTS.md` boundaries (< 200 tokens).
* [CI/CD Quality Gates](../integrations/ci-cd-gates.md) — Blocking PR regressions with automated GitHub Actions gates.
