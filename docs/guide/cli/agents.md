# baba agents

Adaptive context-fencing compiler, token budget auditor, and modular skills generator for AI coding agents.

---

## 🚀 Synopsis

```bash
baba agents <command> [path] [options]
```

### Command Aliases
`baba agents` guarantees strict behavioral parity across all aliases:
* `baba agents` — Short CLI entry point
* `bbyg agents` — Baba-Yaga alias
* `matryoshka agents` — Canonical package name

---

## 📖 Description

The `agents` command suite eliminates the "AI-Slop" and context bloat crisis. Monolithic 500-line prompt files waste expensive API tokens and dilute model attention, leading to hallucinations and poor adherence to guidelines.

Matryoshka solves this by enforcing **adaptive context-fencing**:
1. An ultra-lean root **`AGENTS.md`** strictly bounded under **200 tokens** (hard limit: **250 tokens**).
2. Modular, specialized skills housed in **`.agents/skills/`** loaded only on demand using mandatory **YAML frontmatter**.
3. Non-negotiable software engineering invariants rooted in **YAGNI** and **DRY**.

---

## 🛠️ Subcommands

### 1. `baba agents generate`
Compile the root `AGENTS.md` directive boundary and modular skills tailored to the detected repository archetype.

```bash
baba agents generate [path] [options]
```

#### Options:
* `--force, -f` — Overwrite existing `AGENTS.md`. Automatically creates an `AGENTS.md.bak` backup to prevent loss of custom instructions.
* `--dry-run` — Preview planned generation and token savings without writing files to disk.
* `--json` — Output result as structured JSON.

---

### 2. `baba agents profile`
Inspect repository structure and output archetype governance classification.

```bash
baba agents profile [path] [options]
```

Discovers architectural seams (routes, controllers, models, services) and classifies projects into:
* `api_backend`
* `opinionated_monolith`
* `reactive_frontend`
* `systems_microservice`
* `fullstack_hybrid`

---

### 3. `baba agents check`
Audit the token budget of the active `AGENTS.md` to prevent prompt bloat.

```bash
baba agents check [path] [options]
```

#### Options:
* `--max-tokens <num>` — Maximum token threshold for compliance (defaults to `250`).
* `--json` — Emit token metrics and pass/fail status as JSON.

---

### 4. `baba agents skill <name>`
Render and inspect the compiled content of a specific on-demand skill.

```bash
baba agents skill <name> [path] [options]
```

#### Available Skill Names:
* `backend` — ORM query optimization, anti-N+1 strategies, and routing conventions.
* `frontend` — Core Web Vitals, CLS prevention, image sizing, and semantic accessibility.
* `database` — Migration safety, non-blocking indexing (`CONCURRENTLY`), and transaction boundaries.
* `security` — OWASP Top 10 mitigation, parameter sanitization, and secret prevention.
* `testing` — The Seam Contract, Red-to-Green TDD discipline, and assertion verification.

---

## 🛡️ Modular Skills & Mandatory YAML Frontmatter

Skills generated in `.agents/skills/` are guarded by strict YAML frontmatter metadata so agents only load them when working on corresponding file globs:

```markdown
---
name: backend
description: Framework-specific database queries, ORM patterns, and routing guidelines
globs:
  - "src/api/**"
  - "src/services/**"
alwaysApply: false
---

# Backend Engineering Directives
...
```

---

## 📋 Examples

### Simulating Generation (Dry Run)
Preview generated files and token consumption without modifying disk:
```bash
baba agents generate --dry-run
```

### Overwriting with Safe Backup Guardrail
Regenerate instructions while preserving previous configuration in `AGENTS.md.bak`:
```bash
baba agents generate --force
```

### Checking Token Compliance in CI
Validate that root instructions stay under the 250-token threshold:
```bash
baba agents check --max-tokens 250
```

### Profiling Archetype Governance
Inspect detected archetype and architectural boundaries:
```bash
baba agents profile --json
```

Output:
```json
{
  "status": "success",
  "command": "agents:profile",
  "archetype": "api_backend",
  "seams": [
    "routes",
    "controllers",
    "models"
  ],
  "governance": {
    "principles": [
      "YAGNI",
      "DRY"
    ]
  }
}
```
