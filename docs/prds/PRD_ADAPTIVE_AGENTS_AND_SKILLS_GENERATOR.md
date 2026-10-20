# 📄 PRD: Adaptive Context-Aware AGENTS.md & Modular Skills Engine

**Status:** Draft / Ready for Review  
**Author:** @maiquelleonel (Tech Lead Co-Pilot)  
**Project:** Matryoshka-Harness (`@maiquelleonel/matryoshka`)  
**Phase:** Phase 3 (Pragmatic Remediation & Graph-Powered Agents)  
**Associated Issues:** #8, #9  

---

## 🎯 1. Executive Summary & Problem Statement

### 1.1 The "AI-Slop & Prompt Bloat" Crisis
Modern AI coding agents suffer from two systemic failures when operating in real-world repositories:
1. **Context Pollution (Token Bloat):** Dumping a 1,500-line monolithic rules file on every single prompt burns thousands of unnecessary input tokens per turn (FinOps disaster) and dilutes the model's attention, causing it to disregard critical directives.
2. **Generic AI Slop & Unidiomatic Abstractions:** Naive agents default to textbook, unidiomatic abstractions—such as inventing unnecessary abstract base classes, complex factory patterns, and excessive inheritance in functional or declarative frameworks (e.g., trying to write Java in a FastAPI or Next.js project).

### 1.2 The Matryoshka Solution
The **Matryoshka Adaptive Engine** generates an unbloated, high-signal governance layer:
* **Lean Root `AGENTS.md`:** A hyper-compressed (<200 tokens) master index defining project identity, canonical test/build commands, and non-negotiable anti-slop invariants.
* **On-Demand Scoped Skills (`.agents/skills/`):** Deep, specialized instructions (Backend, Frontend, Database, Security, Testing) loaded **only when the task touches that specific layer**, preserving context window efficiency and FinOps sanity.

---

## 🏗️ 2. Architectural Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ADAPTIVE AGENTS GENERATION ENGINE                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. INSPECT: StackDetector (Phase 1) + codebase-memory-mcp (Phase 2)    │
│ 2. PROFILE: Classify archetype & detect architectural layers (seams)   │
│ 3. COMPILE ROOT: Generate ultralight AGENTS.md index with invariants   │
│ 4. COMPILE SKILLS: Generate specialized, stack-calibrated SKILLS.md    │
│ 5. VERIFY: Assert token budget (<200 tokens root) & idempotency        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Archetype Taxonomy
The engine deterministically classifies repositories into canonical archetypes:

| Archetype | Indicators | Active Skill Modules |
| :--- | :--- | :--- |
| **`api_backend`** | FastAPI, Django Ninja, Express, Actix, Gin | `backend`, `database`, `security`, `testing` |
| **`opinionated_monolith`** | Django, Laravel, Ruby on Rails, NestJS | `backend`, `database`, `security`, `testing`, `frontend` (if templates/assets exist) |
| **`reactive_frontend`** | React, Vue, Svelte, Next.js, Nuxt | `frontend`, `security`, `testing` |
| **`systems_microservice`** | Rust (Cargo), Go (go.mod) without Web UI | `backend`, `concurrency`, `testing`, `security` |
| **`fullstack_hybrid`** | Monorepo (Next.js + Python/Go backend) | Full suite mapped to subtrees |

---

## 📂 3. Target File Topology

```text
<workspace_root>/
├── AGENTS.md                          # Ultra-lean index (<200 tokens)
└── .agents/
    └── skills/
        ├── skill-backend.md           # ORM, transactional boundaries, anti-N+1
        ├── skill-frontend.md          # Reactivity, A11y, layout shifts, state
        ├── skill-database.md          # Zero-downtime migrations, lock safety
        ├── skill-security.md          # OWASP, input sanitization, zero-leak
        └── skill-testing.md           # Red-to-Green TDD, mock boundaries
```

### 3.2 Modular Skills YAML Frontmatter Invariant
**Mandatory Guardrail:** To prevent AI coding agents (Gemini CLI, Cursor, Claude Code) from prematurely dumping entire instruction bodies into the context window, **all generated skills MUST include YAML frontmatter** with `name` and a concise `description`:

```markdown
---
name: skill-backend
description: Framework-idiomatic ORM patterns, transactional boundaries, anti-N+1 query prevention, and async persistence rules. Use when modifying models, controllers, repositories, or database queries.
---

# 🛠️ Backend Engineering Guidelines
...
```
*Without frontmatter, agents load instructions globally. With frontmatter, only metadata is indexed, loading the body strictly on-demand (saving 90%+ context tokens).*
The generated root file must strictly fit into:
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
* Backend & ORM: `.agents/skills/skill-backend.md`
* Frontend & UI: `.agents/skills/skill-frontend.md`
* Database & Migrations: `.agents/skills/skill-database.md`
* Security & DLP: `.agents/skills/skill-security.md`
* Testing & TDD: `.agents/skills/skill-testing.md`
```

---

## 🛠️ 4. CLI Ergonomics

### Commands & Aliases
```bash
baba agents generate [path] [flags]
bbyg agents generate [path] [flags]
matryoshka agents generate [path] [flags]
```

### Flags
* `--force` (`-f`): Overwrite existing files (creates `.bak` of pre-existing custom `AGENTS.md`).
* `--dry-run`: Output planned file tree and token cost estimations to stdout without writing to disk.
* `--json`: Emit structured JSON report containing archetype, generated paths, and token counts.

---

## 🧩 5. Subtasks Decomposition (Iterative BDD Delivery)

### 🔹 Subtask 1: Archetype Profiler & Seam Discovery
* Map detected language and frameworks to the canonical archetype.
* Inspect project layout to confirm which skills are relevant (e.g., skip `skill-frontend.md` if no UI assets or frontend frameworks exist).

### 🔹 Subtask 2: Root `AGENTS.md` Template Engine & Token Guard
* Implement lean root generator with strict budget enforcement: **max 250 tokens**.
* Inject exact test and lint commands detected in Phase 1.

### 🔹 Subtask 3: Backend & Database Skill Compilers
* Generate `skill-backend.md`: Framework-idiomatic rules (e.g., SQLAlchemy/Django ORM/Prisma/Diesel), avoiding N+1 queries, async safety.
* Generate `skill-database.md`: Zero-downtime migrations, lock prevention, indexing before `WHERE` filters.

### 🔹 Subtask 4: Frontend & Security Skill Compilers
* Generate `skill-frontend.md`: Component colocation, pure rendering, accessibility standards, bundle size protection.
* Generate `skill-security.md`: OWASP Top 10, SQL injection prevention, secret redacting, path sanitization.

### 🔹 Subtask 5: Testing & Verification Skill Compiler
* Generate `skill-testing.md`: The Seam contract (reproduce RED test before code edits), deterministic fixtures, mocking boundaries.

### 🔹 Subtask 6: CLI Integration, Backup Safety & Idempotency
* Wire subcommands in `src/cli.ts` (`baba agents generate`).
* Implement non-destructive merge: if user-customized `AGENTS.md` exists, backup to `AGENTS.md.bak` or merge custom sections.

---

## 📋 6. BDD Acceptance Criteria (Gherkin)

```gherkin
Scenario 1: Generating governance for a FastAPI + PostgreSQL repository
Given a repository containing 'pyproject.toml' with 'fastapi' and 'asyncpg'
When the user executes 'baba agents generate ./'
Then the root 'AGENTS.md' must be created with archetype 'api_backend'
And 'AGENTS.md' token count must be less than 250 tokens
And directory '.agents/skills/' must contain 'skill-backend.md', 'skill-database.md', 'skill-security.md', 'skill-testing.md'
And 'skill-frontend.md' must NOT be generated.

Scenario 2: Generating governance for a Next.js fullstack repository
Given a repository containing 'package.json' with 'next' and 'prisma'
When the user executes 'baba agents generate ./'
Then the root 'AGENTS.md' must be created with archetype 'fullstack_hybrid'
And '.agents/skills/' must contain both 'skill-frontend.md' and 'skill-backend.md'.

Scenario 3: Non-destructive overwrite protection
Given an existing 'AGENTS.md' with custom user instructions
When the user executes 'baba agents generate ./ --force'
Then the original file must be backed up to 'AGENTS.md.bak'
And the new 'AGENTS.md' must be generated cleanly
And return exit code 0.

Scenario 4: Dry-run structured execution
Given any supported repository
When the user executes 'baba agents generate ./ --dry-run --json'
Then no files must be written to disk
And stdout must be a valid JSON payload listing planned files and estimated token savings.
```

---

## ⚡ 7. Performance & FinOps Guardrails
* **Sub-50ms Execution:** Pure Bun execution; zero heavy AST parsing for template expansion.
* **Token ROI Target:** Reduce LLM prompt ingestion costs by **65% to 75%** on subsequent turns by eliminating monolithic instruction bloat.
