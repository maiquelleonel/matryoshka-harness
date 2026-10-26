# 📋 PRD: Non-Destructive Legacy AGENTS.md Migration Engine (`baba agents migrate`)

- **Feature Name:** Non-Destructive Legacy AGENTS.md Migration & Modular Extraction
- **CLI Invocations:** `baba agents migrate [path]`, `bbyg agents migrate [path]`, `matryoshka agents migrate [path]`
- **Target Repository:** `maiquelleonel/matryoshka-harness`
- **Language / Standards:** Strict English (Global OSS standard)
- **Status:** Approved / Ready for Issue Creation

---

## 🎯 1. Problem Statement & Motivation
Teams and repositories adopting Matryoshka-Harness frequently already possess legacy instruction files (`AGENTS.md`, `.cursorrules`, `CLAUDE.md`, `.windsurfrules`).
Currently, generating a new `AGENTS.md` via `baba agents generate` backs up the existing file to `AGENTS.md.bak` and overwrites it. However:
1. **Lost Domain Context:** Developers lose custom prompt engineering, internal team conventions, domain quirks, and project-specific instructions that were accumulated over months.
2. **Adoption Friction:** Users hesitate to use `baba agents generate` out of fear of clobbering their working team setup.
3. **Manual Slicing Burden:** Extracting legacy rules into modular `.agents/skills/` manually is tedious and error-prone.

---

## 🏛️ 2. Proposed Architecture & Feature Scope

### 2.1. Intelligent Section Slicing & Extraction
The migration engine parses existing legacy files using Markdown AST heading analysis (`#`, `##`, `###`):
1. **Header Identification:** Detects domain blocks (e.g., `# Code Conventions`, `# Database Rules`, `# Deployment / Release`, `# Testing Standards`).
2. **Modular Skill Slicing:** Extracts identified domain sections into dedicated files in `.agents/skills/`:
   - `custom-instructions.md` (for miscellaneous project rules)
   - `legacy-conventions.md` (for coding standards)
   - `domain-knowledge.md` (for business/domain context)
3. **YAML Frontmatter Preservation:** Every extracted skill is stamped with metadata:
   ```yaml
   ---
   name: legacy-custom-instructions
   description: Preserved custom instructions migrated from legacy AGENTS.md
   origin: legacy_migration
   migrated_at: "2026-10-26T18:00:00Z"
   ---
   ```
4. **Lean Root Assembly:** Compiles a pristine, canonical Matryoshka `AGENTS.md` (< 200 tokens) that preserves the core identity, stack archetype, and automatically registers and links the newly extracted legacy skills.

### 2.2. CLI Flags & Safety Guarantees
- `baba agents migrate` -> Analyzes legacy instructions, creates backups, extracts modular skills, and compiles clean root `AGENTS.md`.
- `baba agents migrate --dry-run` -> Prints proposed skill extractions and token savings without writing to disk.
- `baba agents migrate --from=<file>` -> Allows migrating from non-standard files (e.g., `.cursorrules`, `CLAUDE.md`, `.github/copilot-instructions.md`).

---

## 🔒 3. Invariants & Guardrails
- **Zero Loss Invariant:** 100% of the original content is preserved either in `.agents/skills/` or in `AGENTS.md.bak`. No developer instructions are discarded.
- **Token Ceiling Guard:** The resulting migrated root `AGENTS.md` must strictly remain under **200 tokens**.
- **Idempotence:** Running `migrate` multiple times on an already migrated codebase detects the frontmatter signatures and produces no redundant duplicate skills.

---

## 🧪 4. BDD Acceptance Criteria (Gherkin)

```gherkin
Feature: baba agents migrate command
  Scenario: Migrating monolithic legacy AGENTS.md into modular skills
    Given an existing legacy AGENTS.md of 1,200 tokens with database and style guidelines
    When the user runs "baba agents migrate"
    Then an "AGENTS.md.bak" is created with exact original content
    And ".agents/skills/custom-instructions.md" is created with YAML frontmatter
    And the new root "AGENTS.md" is generated with under 200 tokens
    And the new root links to the migrated skill

  Scenario: Dry-run simulation produces zero disk mutations
    Given a legacy instructions file
    When the user runs "baba agents migrate --dry-run"
    Then no files in ".agents/skills/" are created or modified
    And stdout displays the planned extraction diff and token reduction metrics
```
