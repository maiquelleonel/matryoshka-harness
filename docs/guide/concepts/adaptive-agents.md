# Adaptive Agents & Modular Skills

When software engineering organizations introduce AI coding assistants (Claude Code, Cursor, Zed, Gemini CLI) into their developer workflows, the initial instinct is almost always to create a massive instruction file. Teams assemble a single monolithic markdown file containing 1,000 to 2,000 lines of coding guidelines, styling rules, and architectural mandates, injecting it at the root of their repository.

This approach universally triggers two critical failure modes:

* **The Context Bloat & FinOps Tax:** Dumping a 1,500-line monolithic rules file on every single prompt burns thousands of unnecessary input tokens per turn (costing hundreds of dollars per developer every week) while diluting the model's attention window, causing it to disregard critical architectural directives.
* **Generic AI Slop & Unidiomatic Abstractions:** Naive agents default to speculative textbook abstractions—such as inventing unnecessary abstract base classes, complex factory patterns, and excessive inheritance in functional or declarative frameworks (e.g. trying to write Java Enterprise patterns in a lightweight FastAPI or Next.js project).

**Matryoshka-Harness** solves this with **Adaptive Context-Fencing**: an ultra-lean root `AGENTS.md` strictly under 200 tokens, combined with modular on-demand skills stored in `.agents/skills/`.

---

## 🏛️ 1. The Dual-Tier Architecture

Rather than overwhelming the model's context window upfront, Matryoshka decouples repository governance into two distinct tiers:

```text
<workspace_root>/
├── AGENTS.md                          # Ultra-lean root context fence (< 200 tokens)
└── .agents/
    └── skills/                        # Loaded strictly on-demand via YAML frontmatter index
        ├── backend/SKILL.md           # ORM patterns, transaction boundaries, anti-N+1 rules
        ├── frontend/SKILL.md          # Reactivity, A11y, layout shift (CLS) prevention
        ├── database/SKILL.md          # Zero-downtime migrations, concurrent index safety
        ├── security/SKILL.md          # OWASP Top 10, sanitization, zero secret leakage
        ├── testing/SKILL.md           # The Seam Contract: Red-to-Green TDD discipline
        └── <project-name>/SKILL.md    # Encapsulated institutional legacy memory
```

---

## ⚡ 2. Tier 1: The Hyper-Lean Root `AGENTS.md` (< 200 Tokens)

The root `AGENTS.md` is the only file injected on every prompt turn. It serves as an ultra-compact master index and enforces non-negotiable anti-slop invariants.

### Token Guard Hard Ceiling (< 250 Tokens)
Matryoshka's compiler enforces a mathematical token budget:
* **Target Budget:** `< 200 tokens`
* **Hard Token Guard Ceiling:** `< 250 tokens`

If a customized root `AGENTS.md` exceeds 250 tokens, `baba agents check` fails immediately, preventing context inflation from entering the repository.

### Canonical Root `AGENTS.md` Structure:

```markdown
# 🤖 Project Operational Directives

## 🌐 Stack & Identity
* **Archetype:** api_backend
* **Runtime:** Python 3.12 (uv)
* **Test Runner:** `pytest tests/ -q`
* **Build / Lint:** `ruff check .` | `ruff format --check .`

## 🛡️ Anti-Slop Core Invariants
* **YAGNI & DRY First:** Prefer simple composable functions over speculative class hierarchies.
* **No Unprompted Refactoring:** Preserve existing working patterns; surgical edits only.
* **Verification First:** Never declare completion without executing test suite evidence.

## 🧭 On-Demand Specialized Skills
Load specialized guidelines only when touching respective domains:
* Backend & ORM: `.agents/skills/backend/SKILL.md`
* Frontend & UI: `.agents/skills/frontend/SKILL.md`
* Database & Migrations: `.agents/skills/database/SKILL.md`
* Security & DLP: `.agents/skills/security/SKILL.md`
* Testing & TDD: `.agents/skills/testing/SKILL.md`
```

---

## 🧩 3. Tier 2: Modular Skills with YAML Frontmatter

When an agent needs deep domain guidance—such as writing an ORM migration or preventing layout shifts in React—it consults the specialized skill file inside `.agents/skills/`.

### Mandatory YAML Frontmatter Invariant
**Crucial FinOps Guardrail:** Without frontmatter, modern AI agents (Gemini CLI, Cursor, Claude Code) eagerly pre-fetch all file contents into memory at session startup. Matryoshka enforces **mandatory YAML frontmatter** containing `name` and a concise `description` on every skill:

```markdown
---
name: skill-backend
description: Framework-idiomatic ORM patterns, transactional boundaries, anti-N+1 query prevention, and async persistence rules. Use when modifying models, controllers, repositories, or database queries.
---

# 🛠️ Backend Engineering Guidelines
...
```

By indexing only the frontmatter metadata (under 40 tokens per skill), the agent understands **what skills exist and when to invoke them**, loading the comprehensive instruction body **strictly on demand**. This architecture delivers **more than 85% token savings** per conversational turn.

### The Canonical Skill Modules (`.agents/skills/<domain>/SKILL.md`):
Adhering to the official Anthropic and Cursor Agent Skills specification, domain guidelines reside in dedicated subdirectories under `.agents/skills/` (with automatic compatibility aliases `skill-<domain>.md` generated during transitions):

1. **`backend/SKILL.md` (`skill-backend.md`):** Framework-specific ORM patterns (Prisma, SQLAlchemy, Django ORM, Diesel, GORM), repository seams, and transactional boundaries.
2. **`frontend/SKILL.md` (`skill-frontend.md`):** Core Web Vitals optimization, Cumulative Layout Shift (CLS) prevention, pure state rendering, and semantic Accessibility (A11y).
3. **`database/SKILL.md` (`skill-database.md`):** Zero-downtime migration patterns, concurrent index creation (`CREATE INDEX CONCURRENTLY`), lock timeouts, and connection pool sizing.
4. **`security/SKILL.md` (`skill-security.md`):** OWASP Top 10 defenses, input sanitization, safe parameter binding, and zero secret leakage prevention.
5. **`testing/SKILL.md` (`skill-testing.md`):** The Seam Contract—enforcing Red-to-Green Test-Driven Development (RED acceptance tests before touching production code) and strict mock boundaries.
6. **`<project-name>/SKILL.md` (`legacy-knowledge.md`):** Encapsulated institutional legacy instructions and project-specific human rules extracted without loss during migration.

---

## 🧭 4. Archetype Taxonomy & Seam Profiling

Repositories differ fundamentally across domains. Forcing Java-style object-oriented patterns onto procedural WordPress or reactive Next.js code creates AI slop.

Matryoshka's **Archetype Profiler** inspects manifests, package configurations, and directory seams to categorize repositories into five canonical archetypes:

| Archetype | Detection Signals | Active Skill Set |
| :--- | :--- | :--- |
| **`api_backend`** | FastAPI, Django Ninja, Express, Actix-web, Gin, Rails API | `backend`, `database`, `security`, `testing` |
| **`opinionated_monolith`** | Full Django, Laravel, Ruby on Rails, NestJS | `backend`, `database`, `security`, `testing`, `frontend` (if views exist) |
| **`reactive_frontend`** | Next.js, Nuxt, React, Vue, Svelte, Astro, Angular | `frontend`, `security`, `testing` |
| **`systems_microservice`** | Rust (Cargo), Go (go.mod) worker/daemon without UI | `backend`, `security`, `testing` |
| **`fullstack_hybrid`** | Monorepos with `apps/web` and `apps/api` subtrees | Full suite across respective subtrees |

---

## 🛠️ 5. CLI Ergonomics & Commands

Matryoshka provides a full suite of commands for compiling, auditing, and profiling adaptive agent configurations:

### 1. Generating Adaptive Directives (`baba agents generate`)
Compiles the root `AGENTS.md` and active skills tailored to your repository archetype:

```bash
# Preview generation and estimated token savings without modifying disk:
baba agents generate --dry-run

# Compile production directives into your workspace:
baba agents generate

# Force overwrite of existing instructions (safely creates AGENTS.md.bak backup):
baba agents generate --force

# Emit structured JSON for CI/CD automation:
baba agents generate --json
```

### 2. Auditing Token Budgets (`baba agents check`)
Verifies that your root `AGENTS.md` complies with the 250 token limit:

```bash
# Check compliance (exits with 0 on pass, 1 on fail):
baba agents check

# Structured JSON report:
baba agents check --json
```

### 3. Profiling Archetypes & Seams (`baba agents profile`)
Inspects detected architectural seams (routes, models, controllers, services, tests):

```bash
baba agents profile
```

### 4. Inspecting Individual Skills (`baba agents skill`)
Renders the compiled, framework-adapted body of a specific skill:

```bash
baba agents skill backend
baba agents skill database --json
```

---

## 🛡️ Non-Destructive Overwrite Guardrails

To protect custom instructions created by human engineers from accidental deletion:
* Running `baba agents generate` against an existing `AGENTS.md` without `--force` **refuses to overwrite** and exits with code `1`.
* When `--force` is provided, Matryoshka automatically copies the pre-existing file to **`AGENTS.md.bak`** before writing the new directives.
* In `--dry-run` mode, zero filesystem mutations occur.

---

## 🏛️ Specialized Repository Agent Skill (`.agents/skills/<project-name>/SKILL.md`)

When Matryoshka initializes or migrates an existing codebase, it does **not** discard pre-existing human rules, conventions, or domain knowledge (`AGENTS.md`, `.cursorrules`, `CLAUDE.md`).

Instead of polluting the root instruction prompt, Matryoshka encapsulates the entire institutional memory into a dedicated **Repository Specialist Skill**:

```text
.agents/skills/<project-name>/SKILL.md
```

### Architectural Properties:
1. **Canonical Directory Naming:** Subdirectory is derived directly from the project directory name (e.g., `.agents/skills/wpp-agent-checker/SKILL.md` or `.agents/skills/billing-api/SKILL.md`).
2. **On-Demand Activation:** The root `AGENTS.md` indexes this skill under its operational directives. Coding agents load the comprehensive project-specific rules *strictly on-demand*, saving over 85% of token budget during general tasks.
3. **Anthropic & Cursor Canonical Standards:** Conforms to the standard Agent Skills specification with YAML frontmatter metadata (`name`, `description`, `origin: legacy_migration`).

---

## ⏭️ Next Reading

* [Concentric Layers](concentric-layers.md) — The 5-layer nesting doll architecture.
* [Polyglot AST Engine](ast-engine.md) — Tree-sitter WASM antipattern detection in < 200ms.
* [CLI Reference: baba agents](../cli/agents.md) — Complete parameter and flag reference.

---
