# 📋 PRD: Cognitive Context Linter & Turn-Zero Prompt Simulator (`baba agents audit`)

- **Feature Name:** Cognitive Context Linter & Turn-Zero Prompt Simulator
- **CLI Invocations:** `baba agents audit [path]`, `bbyg agents audit [path]`, `matryoshka agents audit [path]`
- **Target Repository:** `maiquelleonel/matryoshka-harness`
- **Language / Standards:** Strict English (Global OSS standard)
- **Status:** Approved / Ready for Issue Creation

---

## 🎯 1. Problem Statement & Motivation
Modern AI coding agents suffer from severe attention dilution and regression traps caused by poorly structured root instruction files (`AGENTS.md`, `.cursorrules`, `CLAUDE.md`). Common anti-patterns include:
1. **Turn-Zero Token Bloat:** Monolithic instruction files exceeding 1,000+ tokens loaded into every turn regardless of relevance.
2. **Dead Skill References:** Broken hyperlinks or non-existent file paths in markdown pointing to missing skill modules.
3. **Negative Phrasing Trap:** Overuse of prohibitive instructions ("DO NOT do X", "NEVER use Y") which triggers the "Pink Elephant Paradox", actively drawing autoregressive attention toward the forbidden tokens.
4. **Permissive Linguistic Leaks:** Soft, ambiguous wording ("try to", "if possible", "consider", "we usually prefer") that causes models to ignore engineering invariants under load.
5. **Greedy Preload Smells:** Embedding raw documentation, entire database schemas, or package files directly in the root context file instead of using scoped, on-demand skills.

---

## 🏛️ 2. Proposed Architecture & Feature Scope

### 2.1. Invariant Metrics & Heuristic Rules
The `baba agents audit` engine performs static analysis and Shannon entropy checks on `AGENTS.md` and related `.agents/skills/*.md` files:

1. **Rule 1: Budget Ceiling (`token-budget`):**
   - Warns if root `AGENTS.md` exceeds **200 tokens**.
   - Fails (`--strict` mode) if root `AGENTS.md` exceeds **250 tokens**.
2. **Rule 2: Broken Reference Detector (`dead-skills`):**
   - Validates all markdown links matching `.agents/skills/<name>.md`.
   - Fails if a declared skill path does not exist on disk.
3. **Rule 3: Negative Phrasing Trap (`negative-phrasing-trap`):**
   - Flags paragraphs with repetitive negative constructions (`DO NOT`, `NEVER`, `DON'T`, `PROHIBITED`) exceeding configurable threshold (default: > 3 per section) and suggests positive behavioral anchors (`PREFER`, `USE`, `ENFORCE`).
4. **Rule 4: Permissive Leak Detector (`permissive-leak`):**
   - Identifies wishy-washy language (`try to`, `if possible`, `maybe`, `consider`, `ideally`) inside imperative sections and demands strict, unambiguous directives.
5. **Rule 5: Greedy Preload Guard (`greedy-preload`):**
   - Detects code blocks exceeding 25 lines or raw schema dumps embedded in the root instruction file that should reside in modular skills.

### 2.2. CLI Flags & Outputs
- `baba agents audit [path]` -> Human-readable terminal output with severity badges (`WARN`, `FAIL`, `PASS`), diagnostic advice, and overall Context Health Score (0–100).
- `baba agents audit --json` -> Machine-readable JSON output for CI pipelines and agent consumption.
- `baba agents audit --strict` -> Exits with code `1` if any `FAIL` rule or critical threshold is violated.

---

## 🔒 3. Invariants & Guardrails
- **100% Deterministic & Local:** Pure static inspection (no LLM calls, zero network egress, sub-25ms execution).
- **Strict Alias Parity:** Identical functionality and flags across `baba`, `bbyg`, and `matryoshka`.
- **Zero-Mutation Safety:** `audit` is strictly a read-only command; it never alters any files on disk.

---

## 🧪 4. BDD Acceptance Criteria (Gherkin)

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
```
