# 🪄 `bbyg fix` — One-Shot Autonomous Remediation

The `bbyg fix` command (also aliased as `baba fix` and `matryoshka fix`) is the primary turn-zero entrypoint for unharnessed repositories. In a single sub-second execution, it executes full-stack discovery, scaffolds lean operational context, isolates modular skills, generates baseline CI, and auto-wires IDE toolsets.

---

### Command Aliases
`bbyg fix` guarantees strict behavioral parity across all aliases:

* `bbyg fix` — Baba-Yaga alias (recommended 4-letter shortcut)
* `baba fix` — Slavic matriarch alias
* `matryoshka fix` — Canonical package executable

---

## ⚡ Quickstart

```bash
# Upgrade current repository to L4 maturity:
bunx @maiquelleonel/matryoshka fix

# Or using the global CLI alias:
bbyg fix --yes
```

---

## 🏗️ What `bbyg fix` Does Automatically

1. **Stack & Archetype Discovery:** Identifies the primary language (Python, TypeScript, Go, Rust, Ruby), testing frameworks, and architecture archetype.
2. **Lean Context-Fencing (`AGENTS.md`):** Generates an ultra-lean root index (~170 tokens) defining core operational invariants.
3. **Modular Agent Skills:** Scaffolds `.agents/skills/<domain>/SKILL.md` subdirectories according to the Anthropic Agent Skills specification.
4. **Adaptive Architecture Blueprint (`ARCHITECTURE.md`):** Discovers routes, models, and controllers, generating an initial system boundary blueprint with AI-expansion prompts.
5. **CI/CD Quality Gate:** Generates a baseline, non-restrictive `.github/workflows/ci.yml` tailored to the detected test runner (`pytest`, `bun test`, etc.).
6. **IDE Toolset Auto-Wiring:** Configures `.cursor/mcp.json`, `.gemini/settings.json`, and `.claude/mcp.json` connecting `codebase-memory-mcp`.

---

## 📋 Command Syntax & Flags

```bash
bbyg fix [path] [options]
```

### Options:

* `--ci`: Scaffold baseline GitHub Actions CI workflow (enabled by default).
* `--no-ci`: Skip `.github/workflows/ci.yml` scaffolding.
* `--force, -f`: Overwrite pre-existing files while creating backups.
* `--dry-run`: Simulate all changes without writing to disk.
* `--yes, -y`: Accept all defaults non-interactively.
* `--json`: Emit strictly structured JSON output for automated pipelines.

---

## 🔍 Verification

After running `bbyg fix`, verify continuous compliance and AST health by running:

```bash
baba wrap --strict
```
