# baba wrap

Polyglot AST anti-pattern scanner and remediation report compiler powered by Tree-sitter WebAssembly (WASM).

---

## 🚀 Synopsis

```bash
baba wrap [path] [options]
```

### Command Aliases
`baba wrap` guarantees strict behavioral parity across all aliases:
* `baba wrap` — Fast 4-letter shortcut
* `bbyg wrap` — Baba-Yaga alias
* `matryoshka wrap` — Formal package executable

---

## 📖 Description

The `wrap` command executes contextual Abstract Syntax Tree (AST) analysis across polyglot source trees to detect subtle security vulnerabilities and code smells introduced by LLM coding agents.

Unlike superficial regex matchers, `baba wrap` utilizes **Tree-sitter WebAssembly (WASM)** runtimes to parse syntax trees directly in memory in sub-200ms. It calculates the **Harness² Composite Score** combining repository hygiene with deep AST findings, and compiles a token-bounded **`DIAGNOSTIC.md`** remediation report.

---

## ⚙️ Arguments & Options

### Positional Arguments
* `[path]` — Target repository directory to audit. Defaults to current directory (`.`).

### Options
* `--output <file>, -o` — Custom path for the remediation report. Defaults to `./DIAGNOSTIC.md`.
* `--strict` — Enforce strict CI quality gate. Exits with **exit code 1** if the composite score falls below the threshold or if any critical violations are discovered.
* `--threshold <num>` — Minimum acceptable Harness² composite score for the strict quality gate. Defaults to `80`.
* `--max-file-size <kb>` — Maximum individual file size in kilobytes to parse during AST tree-walking. Defaults to `500` (500KB).
* `--dry-run` — Simulate execution and output report to stdout without writing files to disk.
* `--json` — Output strictly valid JSON with complete violation details, node positions, and scoring breakdowns.
* `-h, --help` — Display command help and usage examples.

---

## 🔬 The 3 Core AST Antipattern Rules

Matryoshka enforces three high-signal, zero-noise contextual AST rules:

### 1. `raw-sql` (CWE-89: SQL Injection Hazard)
Identifies unparameterized string interpolations, template literals, and concatenated strings passed to database query methods (`query`, `execute`, `raw`, `Exec`, `Query`).
* **Severity:** Critical (-15 points)
* **Remediation:** Replace dynamic string interpolation with parameterized queries and bound variables.

### 2. `assertionless-test` (False-Green Hazard)
Identifies automated test functions (`it`, `test`, `def test_*`, `func Test*`) that invoke production code but lack behavioral assertions (`expect`, `assert`, `t.Fatal`).
* **Requirement:** Requires `--include-tests` flag, since test suites are excluded by default during production AST walks.
* **Severity:** High (-8 points)
* **Remediation:** Introduce deterministic assertions validating returned data and state invariants.

### 3. `hardcoded-credential` (Secret Leakage Hazard)
Detects plaintext API keys, private certificates, and staging tokens assigned in source literals using Shannon entropy calculation and known token prefixes (`sk_live_`, `ghp_`, `AKIA`).
* **Severity:** Critical (-15 points)
* **Remediation:** Migrate secrets to environment variables (`process.env`, `os.environ`) and secrets managers.

---

## 🧮 Harness² Composite Scoring Model

The Harness² composite score synthesizes external repository hygiene with deep internal AST health:

$$\text{Composite Score} = (\text{Oracle Hygiene} \times 0.4) + (\text{AST Health} \times 0.6)$$

* **Oracle Hygiene (0–100):** Evaluated against the 5 governance axes via `paladini/harness-score`.
* **AST Health (0–100):** Starts at 100 with deterministic point deductions for detected violations:
  * Critical: -15 pts
  * High: -8 pts
  * Medium: -4 pts
  * Low: -2 pts

---

## 📄 Token-Bounded Remediation Report (`DIAGNOSTIC.md`)

When executing `baba wrap`, Matryoshka compiles a deterministic remediation report written atomically (`.tmp` → rename) to `./DIAGNOSTIC.md`.

* **FinOps Context Guard:** The generated markdown report is strictly bounded under **1,500 tokens** to prevent context window explosion when consumed by downstream AI agents.
* **Path Traversal Protection:** Output paths passed to `--output` are sanitized against directory traversal attacks.

---

## 🚦 CI/CD Quality Gate Integration (`--strict`)

In automated CI pipelines, invoke `baba wrap` with `--strict` to prevent merging code with security regressions:

```bash
baba wrap --strict --threshold 85
```

### Exit Codes:
* `0` — Clean scan. Composite score $\ge$ threshold, and zero critical AST violations.
* `1` — Quality gate failed. Either composite score $<$ threshold or at least one critical violation was detected.

---

## 📋 Examples

### Standard Remediation Audit
```bash
baba wrap
```

### Strict CI Execution with Custom Threshold
```bash
baba wrap --strict --threshold 85
```

### Dry Run with Structured JSON
```bash
baba wrap --dry-run --json
```

Output:
```json
{
  "status": "remediation_needed",
  "command": "wrap",
  "harnessScore": 76,
  "passedStrict": false,
  "summary": {
    "totalViolations": 2,
    "criticalCount": 1,
    "highCount": 1
  },
  "violations": [
    {
      "ruleId": "raw-sql",
      "severity": "critical",
      "file": "src/db/users.ts",
      "line": 14,
      "message": "Unparameterized dynamic SQL interpolation detected (CWE-89)"
    }
  ]
}
```
