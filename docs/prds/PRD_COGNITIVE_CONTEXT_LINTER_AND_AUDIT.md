# 📋 PRD: Cognitive Context Linter & Turn-Zero Prompt Simulator (`baba agents audit`)

**Feature Name:** Cognitive Context Linter & Turn-Zero Prompt Simulator  
**CLI Invocations:** `baba agents audit [path]`, `bbyg agents audit [path]`, `matryoshka agents audit [path]`  
**Target Repository:** `maiquelleonel/matryoshka-harness` (`@maiquelleonel/matryoshka`)  
**Language / Standards:** Strict English (Global OSS standard)  
**Status:** Approved / Ready for Implementation  
**Phase:** Phase 3.5 (Agentic Governance & Cognitive Context Remediation)  
**Associated Issues:** #22  

---

## 🎯 1. Executive Summary & Problem Statement

### 1.1 The Root Instruction Degradation Crisis
Modern AI coding agents (Claude Code, Cursor, Zed, Gemini CLI, Aider) operate on autoregressive attention mechanisms that are acutely vulnerable to context degradation in turn-zero instructions (`AGENTS.md`, `.cursorrules`, `CLAUDE.md`). When developers or naive generators construct root context files, repositories frequently suffer from five cognitive failure modes:

1. **Turn-Zero Token Bloat:** Monolithic instruction files exceeding 250 tokens (often running into 1,000+ tokens) loaded into every single prompt turn. This burns excessive input tokens across every interaction (FinOps penalty) while systematically diluting the model's primary attention window.
2. **Dead Skill References:** Hyperlinks or path citations in markdown pointing to missing or non-existent files in `.agents/skills/<name>.md`. When an agent attempts to follow a broken skill pointer, it hallucinated rules or fails silently.
3. **Negative Phrasing Trap:** Overuse of prohibitive instructions ("DO NOT do X", "NEVER use Y", "DON'T create Z"). In transformer models, repetitive negative tokens trigger the **Pink Elephant Paradox**: autoregressive probability mass concentrates on the forbidden terms, actively drawing the model's generation toward the very anti-patterns being prohibited.
4. **Permissive Linguistic Leaks:** Soft, ambiguous wording ("try to", "if possible", "maybe", "consider", "ideally", "we usually prefer") inside imperative directives. Under complex task load, models interpret permissive language as optional suggestions, dropping non-negotiable architectural and security invariants.
5. **Greedy Preload Smells:** Embedding raw documentation dumps, huge inline database schemas, or lengthy code examples (> 25 lines) directly into the root instruction file instead of isolating them into scoped, on-demand skills.

### 1.2 The Matryoshka Solution: `baba agents audit`
The `baba agents audit` command provides a sub-25ms, 100% deterministic, zero-network static cognitive context linter that audits root instructions and skill modules, calculates a unified **Context Health Score (0–100)**, and outputs actionable human-readable diagnostics or machine-readable JSON for CI/CD gates.

---

## 🏗️ 2. Architectural Design & Pipeline

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        baba agents audit [path]                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   File System & Context Inspector                      │
│   - Locate root AGENTS.md / .cursorrules / CLAUDE.md                   │
│   - Catalog declared modular skills (.agents/skills/*.md)              │
│   - Tokenize content with FinOps heuristic estimator                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Cognitive Antipattern Rule Suite                    │
│   1. Rule 1: token-budget            (Ceiling: warn >200, fail >250)   │
│   2. Rule 2: dead-skills             (Missing .agents/skills/ links)   │
│   3. Rule 3: negative-phrasing-trap  (Pink Elephant Paradox guard)     │
│   4. Rule 4: permissive-leak         (Wishy-washy language detector)   │
│   5. Rule 5: greedy-preload          (Code/schema dumps > 25 lines)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Context Health Scoring Engine (0-100)                  │
│   - Base Score: 100                                                    │
│   - Deductions: FAIL (-15 pts) | WARN (-5 pts)                         │
│   - Strict Mode Quality Gate: exit 1 on any FAIL violation             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│     Human-Readable Terminal       │ │    Machine-Readable JSON         │
│  - Severity badges (PASS/WARN/FAIL)│ │    (--json flag for CI/CD)       │
│  - Health Score Gauge             │ │    - Double keying (camel/snake) │
│  - Positive anchor suggestions    │ │    - Strict mode validation      │
└───────────────────────────────────┘ └──────────────────────────────────┘
```

---

## 🏛️ 3. Invariant Metrics & Heuristic Rules

### 3.1. Rule 1: Budget Ceiling (`token-budget`)
- **Metric:** Token count of root instruction file (using character/word heuristic: `Math.ceil(words * 1.33)` or whitespace tokenization).
- **Thresholds:**
  - `WARN`: Token count > 200 tokens (approaching threshold).
  - `FAIL`: Token count > 250 tokens (hard ceiling violation).
- **Remediation:** Offload detailed instructions into modular skills in `.agents/skills/`.

### 3.2. Rule 2: Broken Reference Detector (`dead-skills`)
- **Metric:** Regex extraction of markdown links matching `(?:\.agents\/skills\/|skills\/)([a-zA-Z0-9_\-\.]+)\.md`.
- **Validation:** Verifies each declared skill file exists on disk relative to the repository root.
- **Severity:** `FAIL` if any declared skill file does not exist on disk.
- **Remediation:** Remove obsolete links or run `baba agents generate` to scaffold missing skills.

### 3.3. Rule 3: Negative Phrasing Trap (`negative-phrasing-trap`)
- **Metric:** Identifies high-density clusters of negative prohibitive phrasing (`DO NOT`, `NEVER`, `DON'T`, `PROHIBITED`, `MUST NOT`, `CANNOT`).
- **Threshold:** > 3 prohibitive phrases within a single section or paragraph.
- **Severity:** `WARN`.
- **Cognitive Science Rationale:** Pink Elephant Paradox in transformer attention; instructions should provide positive behavioral anchors (`PREFER`, `USE`, `ENFORCE`, `ALWAYS`).
- **Remediation:** Reformulate negative prohibitions into positive behavioral constraints.

### 3.4. Rule 4: Permissive Leak Detector (`permissive-leak`)
- **Metric:** Detects wishy-washy language (`try to`, `if possible`, `maybe`, `consider`, `ideally`, `we usually prefer`) in imperative directive contexts.
- **Severity:** `WARN`.
- **Remediation:** Replace soft requests with definitive imperatives or explicit conditional contracts.

### 3.5. Rule 5: Greedy Preload Guard (`greedy-preload`)
- **Metric:** Counts contiguous lines in fenced code blocks (` ``` `) or raw schema/table dumps in the root instruction file.
- **Threshold:** Any single code block or schema dump > 25 lines.
- **Severity:** `WARN` (or `FAIL` in strict mode if > 50 lines).
- **Remediation:** Move raw schemas and multi-line code examples into dedicated on-demand skills.

---

## 🛡️ 4. The 9 Production Dimensions Audit

| # | Dimension | Engineering Invariant |
|---|---|---|
| 1 | **Input Validation** | Validate target paths against directory traversal (`..`). Gracefully handle missing target directories or missing `AGENTS.md` by reporting clean diagnostics without unhandled exceptions. |
| 2 | **Failure Modes & Timeout** | Pure static synchronous or micro-async parsing bounded by a 500ms timeout. Memory ceiling < 10MB during inspection. Execution completes in < 25ms locally. |
| 3 | **Idempotency & Retry** | Running `baba agents audit` repeatedly produces byte-for-byte identical output and JSON structures. Zero side effects. |
| 4 | **Authorization & Scopes** | Strictly read-only operations. Zero writes, zero mutations, zero file touching on disk. |
| 5 | **Concurrency & Performance** | Pure CPU-bound string scanning and file-system stat operations. No locks required; safe for concurrent CI jobs. |
| 6 | **Data Lifecycle & In-Memory** | All extracted token AST representations and regex match arrays are discarded after report formatting. |
| 7 | **External Fallbacks** | Operates 100% locally with zero external network egress and zero third-party LLM dependencies. Airgap-safe. |
| 8 | **State Transitions** | Deterministic pipeline: `DISCOVER` -> `TOKENIZE` -> `EVALUATE_RULES` -> `COMPUTE_SCORE` -> `FORMAT_OUTPUT` -> `EXIT(0|1)`. |
| 9 | **Observability & Telemetry** | Emits structured JSON (`--json`) with execution duration, scanned file list, rule breakdown, and context health score. |

---

## 💻 5. CLI Flags, Ergonomics & Outputs

### 5.1 CLI Invocations
```bash
baba agents audit [path] [options]
bbyg agents audit [path] [options]
matryoshka agents audit [path] [options]
```

### 5.2 Flags
- `[path]`: Optional directory path to audit (defaults to current working directory `.`).
- `--json`: Output machine-readable JSON for CI/CD ingestion and agent telemetry.
- `--strict`: Exit with code `1` if any `FAIL` rule is triggered or if overall Health Score is below 80.

### 5.3 Health Score Formulation
$$\text{Health Score} = \max\left(0, 100 - \sum \text{Penalties}\right)$$
- `FAIL` severity violation: **-15 points**
- `WARN` severity violation: **-5 points**
- Score classification:
  - `90–100`: Optimal (PASS)
  - `75–89`: Acceptable with warnings (WARN)
  - `< 75`: Diluted attention risk (FAIL)

---

## 🧪 6. BDD Acceptance Criteria (Gherkin)

```gherkin
Feature: baba agents audit command
  Scenario: Healthy root AGENTS.md passes audit
    Given a repository with an AGENTS.md under 200 tokens and valid skill references
    When the user runs "baba agents audit"
    Then the process exits with code 0
    And the health score is above 90
    And no critical violations are reported

  Scenario: Bloated AGENTS.md fails in strict mode
    Given an AGENTS.md containing 600 tokens
    When the user runs "baba agents audit --strict"
    Then the process exits with code 1
    And reports a "token-budget" violation

  Scenario: Dead skill link is detected
    Given an AGENTS.md referencing ".agents/skills/nonexistent.md"
    When the user runs "baba agents audit --json"
    Then the output JSON contains a "dead-skills" rule violation

  Scenario: Negative phrasing trap triggers warning
    Given an AGENTS.md containing repetitive "DO NOT", "NEVER", "DON'T" instructions
    When the user runs "baba agents audit --json"
    Then the output JSON contains a "negative-phrasing-trap" warning
    And provides positive anchor suggestions

  Scenario: Permissive linguistic leaks are flagged
    Given an AGENTS.md containing "try to verify" and "if possible write tests"
    When the user runs "baba agents audit --json"
    Then the output JSON contains a "permissive-leak" warning

  Scenario: Large raw code block triggers greedy preload guard
    Given an AGENTS.md containing a code block of 35 lines
    When the user runs "baba agents audit --json"
    Then the output JSON contains a "greedy-preload" warning
```
