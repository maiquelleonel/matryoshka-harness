# 📋 PRD: Non-Destructive Legacy AGENTS.md Migration Engine (`baba agents migrate`)

**Feature Name:** Non-Destructive Legacy AGENTS.md Migration & Modular Extraction Engine  
**CLI Invocations:** `baba agents migrate [path]`, `bbyg agents migrate [path]`, `matryoshka agents migrate [path]`  
**Target Repository:** `maiquelleonel/matryoshka-harness` (`@maiquelleonel/matryoshka`)  
**Language / Standards:** Strict English (Global OSS standard)  
**Status:** Approved / Ready for Implementation  
**Phase:** Phase 3.6 (Agentic Governance & Legacy Context Migration)  
**Associated Issues:** #23  

---

## 🎯 1. Executive Summary & Problem Statement

### 1.1 The Legacy Context Destruction Hazard
Repositories adopting modern agentic governance frameworks like Matryoshka-Harness frequently already possess legacy instruction files accumulated over months of practical development:
- Monolithic `AGENTS.md` files (often 800 to 2,500 tokens).
- IDE-specific rule files such as `.cursorrules`, `CLAUDE.md`, `.windsurfrules`, or `.github/copilot-instructions.md`.

Historically, running a fresh governance generator (like `baba agents generate --force`) created an emergency backup (`AGENTS.md.bak`) and overwrote the root file with a clean scaffold. While this protected files from complete deletion, it produced a catastrophic operational failure:
1. **Lost Domain Knowledge:** Custom prompt engineering, proprietary business invariants, database schema nuances, internal team conventions, and tribal architectural quirks were abruptly evicted from the agent's active reasoning context.
2. **Adoption Friction & Hesitation:** Engineering teams strongly resist adopting new tooling if the migration requires destructive overwrites or hours of manual slicing to split legacy instructions into modular skill files.
3. **Manual Slicing Burden:** Extracting sprawling monolithic rules into modular `.agents/skills/` manually is tedious, error-prone, and leads to missing YAML frontmatter or orphaned instructions.

### 1.2 The Matryoshka Solution: `baba agents migrate`
The `baba agents migrate` command provides an automated, non-destructive migration engine that:
1. **Safely Parses Monolithic Instructions:** Ingests legacy instruction files (`AGENTS.md` by default, or arbitrary files via `--from=<file>`).
2. **Converts Legacy Content into Active Modular Skills (Zero-Loss):** Encapsulates 100% of historical domain rules, conventions, and architectural context into active modular skills (primary: `.agents/skills/legacy-knowledge.md`, plus structured sub-skills if distinct markdown headings exist).
3. **Stamps Standard YAML Frontmatter:** Injects compliant YAML frontmatter (`name: legacy-knowledge`, `description: ...`, `origin: legacy_migration`, `migrated_at: "..."`) ensuring modern AI coding agents (Claude Code, Cursor, Gemini CLI, Zed) index metadata and load the full body strictly on-demand.
4. **Preserves Rollback Safety Snapshot:** Creates a byte-for-byte snapshot in `AGENTS.md.bak` (or `<file>.bak`) as an immediate safety net.
5. **Compiles a Lean Root `AGENTS.md` (< 200 tokens):** Emits a pristine, canonical root index that registers the legacy skill in its modular catalog, retaining full access to historical project knowledge without turn-zero context bloat.
6. **Provides Non-Destructive Simulation (`--dry-run`):** Allows teams to preview the proposed extraction diff, target skill paths, and token reduction metrics without mutating a single byte on disk.

---

## 🏗️ 2. Architectural Design & Pipeline

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   baba agents migrate [path] [flags]                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. DISCOVERY & SOURCE RESOLUTION                                       │
│    - Resolve project root directory                                    │
│    - Locate source file (--from=<file> or default AGENTS.md)           │
│    - Validate file presence and non-empty content                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. CONTENT ANALYSIS & SLICING ENGINE                                   │
│    - Detect existing Matryoshka frontmatter (idempotency check)        │
│    - Parse markdown sections, headers, and code fences                 │
│    - Formulate primary legacy skill (.agents/skills/legacy-knowledge)  │
│    - Segment sub-skills if distinct top-level H1/H2 boundaries exist   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. YAML FRONTMATTER STAMPING & SKILL PACKAGING                         │
│    - Inject name, description, origin: legacy_migration, migrated_at   │
│    - Calculate token estimates for each extracted skill module         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. LEAN ROOT AGENTS.md COMPILATION                                     │
│    - Profile stack & archetype via StackDetector                      │
│    - Assemble canonical root directives strictly under 200 tokens      │
│    - Register .agents/skills/legacy-knowledge.md in on-demand catalog  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. ATOMIC DISK PERSISTENCE (or DRY-RUN SIMULATION)                     │
│    - If --dry-run: emit planned file tree and token savings to stdout  │
│    - If write mode:                                                    │
│        a) Snapshot original file to AGENTS.md.bak                      │
│        b) Ensure .agents/skills/ directory exists                      │
│        c) Write .agents/skills/legacy-knowledge.md atomically          │
│        d) Write lean root AGENTS.md atomically                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 6. TELEMETRY & EMISSION                                                │
│    - Structured JSON (--json) with before/after token metrics          │
│    - Formatted terminal report with token reduction gauge              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ 3. Slicing Strategy & Zero-Loss Domain Preservation

### 3.1 The Zero-Loss Invariant
Under no circumstances may the migration engine discard developer-authored rules, custom conventions, prompt constraints, or architectural notes. 100% of the content extracted from the legacy file must be preserved across either:
1. The active modular skill (`.agents/skills/legacy-knowledge.md`), or
2. The emergency backup snapshot (`AGENTS.md.bak`).

### 3.2 Primary Modular Skill: `.agents/skills/legacy-knowledge.md`
The consolidated historical instructions are encapsulated in `.agents/skills/legacy-knowledge.md`.
Every migrated skill is stamped with standard Matryoshka YAML Frontmatter:

```markdown
---
name: legacy-knowledge
description: Preserved historical domain knowledge, architecture quirks, and legacy conventions migrated from existing project rules.
origin: legacy_migration
migrated_at: "2026-10-26T18:00:00Z"
---

# 📜 Legacy Project Knowledge & Historical Conventions

The following directives were migrated from the previous monolithic instruction file.
Load and adhere to these guidelines when modifying legacy modules or domain-specific workflows:

{PRESERVED_LEGACY_CONTENT}
```

### 3.3 Domain Sub-Skill Segmentation (Optional Granular Slicing)
When the legacy file contains clear, distinct H1/H2 markdown sections dedicated to specific domains (e.g., `# Database Guidelines`, `# Frontend Styling Conventions`), the migration engine may additionally extract focused sub-skills:
- `.agents/skills/legacy-conventions.md`
- `.agents/skills/legacy-database.md`
Each generated sub-skill receives appropriate YAML frontmatter stamped with `origin: legacy_migration`.

---

## 📜 4. Lean Root `AGENTS.md` Compilation & Linking

The newly compiled root `AGENTS.md` replaces the monolithic file with an ultra-lean (< 200 tokens) master index.
It explicitly references and registers the extracted legacy skill in its on-demand modular skills catalog:

```markdown
# 🤖 Project Operational Directives

## 🌐 Stack & Identity
* **Archetype:** {archetype}
* **Runtime:** {runtime} ({package_manager})
* **Test Runner:** `{test_command}`
* **Build / Lint:** `{build_command}` | `{lint_command}`

## 🛡️ Anti-Slop Core Invariants
* **YAGNI & DRY First:** Prefer simple composable functions over speculative class hierarchies.
* **No Unprompted Refactoring:** Preserve existing working patterns; surgical edits only.
* **Verification First:** Never declare completion without executing test suite evidence.

## 🧭 On-Demand Specialized Skills
Load specialized guidelines only when touching respective domains:
* Preserved Legacy Knowledge: `.agents/skills/legacy-knowledge.md`
* Backend & ORM: `.agents/skills/skill-backend.md`
* Database & Migrations: `.agents/skills/skill-database.md`
* Security & DLP: `.agents/skills/skill-security.md`
* Testing & TDD: `.agents/skills/skill-testing.md`
```

---

## 🛡️ 5. The 9 Production Dimensions Audit

| # | Dimension | Engineering Invariant |
|---|---|---|
| 1 | **Input Validation** | Validate project and source file paths against directory traversal (`..`). Check that the specified `--from` file exists and contains readable content. Emit clear, structured error envelopes if source file is missing. |
| 2 | **Failure Modes & Timeout** | Fast, synchronous or lightweight asynchronous execution completing in < 30ms locally. If writing fails midway, original files remain untouched and atomic rollback is guaranteed via temporary staging files (`.tmp`). |
| 3 | **Idempotency & Retry** | Running `baba agents migrate` repeatedly detects the `origin: legacy_migration` frontmatter signature or existing canonical root structure, preventing infinite re-wrapping or duplicate skill files. |
| 4 | **Authorization & Scopes** | Operates strictly within the target repository workspace. File writes preserve original POSIX file mode permissions (`0o644`). |
| 5 | **Concurrency & Performance** | Pure CPU-bound text parsing and atomic file writes. Safe for concurrent workspace invocations. Execution completes in < 30ms with < 15MB peak memory. |
| 6 | **Data Lifecycle & In-Memory** | Content buffers and intermediate AST/token representations are immediately eligible for garbage collection following migration completion. |
| 7 | **External Fallbacks** | 100% local execution. Operates without network access, zero third-party cloud LLM API calls, and fully compliant with airgap security mandates. |
| 8 | **State Transitions** | Linear deterministic state pipeline: `DISCOVER` -> `VALIDATE` -> `SLICE` -> `STAMP_METADATA` -> `SNAPSHOT_BACKUP` -> `PERSIST_SKILLS` -> `EMIT_ROOT` -> `VERIFY_BUDGET`. |
| 9 | **Observability & Telemetry** | Emits detailed metrics in `--json` mode: source file path, backup path, token counts before vs after, percentage reduction, and list of created skill modules. |

---

## 💻 6. CLI Ergonomics, Flags & Aliases

### 6.1 CLI Invocations
```bash
baba agents migrate [path] [flags]
bbyg agents migrate [path] [flags]
matryoshka agents migrate [path] [flags]
```

### 6.2 Supported Flags
- `[path]`: Optional directory path to target repository (defaults to current working directory `.`).
- `--from=<file>`: Custom source instruction file path relative to project root (e.g., `--from=.cursorrules`, `--from=CLAUDE.md`, `--from=.windsurfrules`). Defaults to `AGENTS.md`.
- `--dry-run`: Simulation mode. Analyzes legacy content, displays proposed skill extractions and token reduction metrics, without writing to disk.
- `--force` (`-f`): Overwrite target files even if `AGENTS.md.bak` or `.agents/skills/legacy-knowledge.md` already exists.
- `--json`: Emit machine-readable JSON for CI/CD pipelines, agentic orchestrators, and automated audits.
- `--max-tokens=<num>`: Custom token ceiling for the compiled root `AGENTS.md` (default: 200, hard ceiling: 250).

---

## 🔒 7. Invariants & Guardrails

1. **Zero-Loss Domain Preservation Invariant:** No historical knowledge is discarded. 100% of the legacy instruction text is preserved in `.agents/skills/legacy-knowledge.md` and `AGENTS.md.bak`.
2. **Token Ceiling Guard:** The resulting migrated root `AGENTS.md` must strictly remain under **200 tokens** (hard threshold: 250 tokens).
3. **Rollback Safety Snapshot:** An exact byte-for-byte copy of the source legacy file is preserved in `AGENTS.md.bak` prior to root overwrites.
4. **Idempotence Guard:** Re-running the migration engine on an already migrated codebase detects the frontmatter metadata and avoids redundant duplicate extractions.
5. **Strict CLI Alias Parity:** The command behaves identically with matching exit codes, terminal output, and JSON payloads across `baba`, `bbyg`, and `matryoshka`.

---

## 🧪 8. BDD Acceptance Criteria (Gherkin Scenarios)

```gherkin
Feature: baba agents migrate command
  As an AI engineer adopting Matryoshka-Harness
  I want to migrate my existing monolithic rules file into modular skills
  So that historical domain knowledge is preserved with zero loss and root context remains lean

  Scenario: Subtask 1 - Detailed PRD: docs/prds/PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md
    Given the Matryoshka repository workspace is operational
    When the architectural documentation is inspected
    Then "docs/prds/PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md" exists and is substantive
    And it details problem statement, 9 production dimensions, and BDD criteria
    And "docs/specs/SPEC-23.md" defines complete TypeScript I/O contracts

  Scenario: Subtask 2 - Zero-Loss Skill Conversion into .agents/skills/legacy-knowledge.md
    Given an existing legacy AGENTS.md of 1,200 tokens containing domain rules and conventions
    When the user runs "baba agents migrate"
    Then ".agents/skills/legacy-knowledge.md" is created
    And 100% of the original domain rules are preserved in the skill body

  Scenario: Subtask 3 - YAML Frontmatter Stamping on Migrated Skills
    Given a migrated legacy skill file in ".agents/skills/legacy-knowledge.md"
    When the file header is parsed
    Then it contains valid YAML frontmatter delimiters "---"
    And "origin" is set to "legacy_migration"
    And "name" is set to "legacy-knowledge"
    And a concise descriptive "description" is present

  Scenario: Subtask 4 - Lean Root Compilation (< 200 tokens)
    Given an existing monolithic AGENTS.md of 1,200 tokens
    When the user runs "baba agents migrate"
    Then a new root "AGENTS.md" is generated
    And its token count is strictly under 200 tokens
    And it explicitly references and registers ".agents/skills/legacy-knowledge.md"

  Scenario: Subtask 5 - Rollback Safety Snapshot in AGENTS.md.bak
    Given an existing legacy AGENTS.md with proprietary prompt guidelines
    When the user runs "baba agents migrate"
    Then "AGENTS.md.bak" is created
    And "AGENTS.md.bak" is byte-for-byte identical to the original pre-migration file

  Scenario: Subtask 6 - CLI Options: --dry-run and --from=<file>
    Given a custom legacy instruction file named ".cursorrules"
    When the user runs "baba agents migrate --from=.cursorrules --dry-run"
    Then no files on disk are modified or created
    And stdout displays planned skill extractions and token reduction metrics
    When the user runs "baba agents migrate --from=.cursorrules"
    Then ".agents/skills/legacy-knowledge.md" is extracted from ".cursorrules"
    And ".cursorrules.bak" is created

  Scenario: Subtask 7 - Full BDD Test Suite Verification
    Given the BDD test harness in "tests/legacy_migration.test.ts"
    When "bun test tests/legacy_migration.test.ts" is executed
    Then all acceptance scenarios pass with 0 failures

  Scenario: Subtask 8 - Strict CLI Alias Parity
    Given the three canonical CLI aliases "baba", "bbyg", and "matryoshka"
    When each alias executes "agents migrate --dry-run --json"
    Then all three produce identical exit codes (0) and matching JSON output schemas
```
