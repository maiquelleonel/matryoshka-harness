# 🏛️ Matryoshka-Harness — System Architecture & Intent Blueprint

**Project:** Matryoshka-Harness (Canonical Aliases: `baba` / `bbyg` / `matryoshka`)  
**Core Purpose:** Adaptive context-fencing, anti-slop AGENTS.md generation, and deterministic maturity remediation (L0 ➔ L4) for autonomous AI coding agents.  
**Primary Runtime:** [Bun](https://bun.com) (Strict TypeScript, native execution < 15ms, standalone binary compilation).  
**License:** Open-Source MIT.  

---

## 🎯 1. Architectural Vision & Core Principles

1. **Pragmatic Context-Fencing (Zero-Slop):**
   - Modern AI agents (Claude, Gemini, Codex) fail due to unconstrained freedom or abstract textbook patterns that clash with the repository's real architecture.
   - Matryoshka fences the codebase before any agent touches code: it establishes genuine conventions, forbids gratuitous abstractions (Zero forced SOLID in WordPress/Drupal!), and strictly bounds blast radius.
2. **External Maturity Oracle (Zero Reinvention):**
   - Consumes `paladini/harness-score` as a direct dependency and canonical governance oracle (L0 to L4).
3. **Semantic AST Reconnaissance via MCP:**
   - Integrates with `codebase-memory-mcp` to query codebase knowledge graphs, reconciling **what is missing** (diagnostics) with **what actually exists** (models, routes, database entities).
4. **Ergonomic Terminal Footprint:**
   - Triple binary aliases: `baba` (4 letters, zero typos), `bbyg` (Baba-Yaga mythology), and `matryoshka` (formal).

---

## 📂 2. Canonical Directory & File Structure

```text
matryoshka-harness/
├── ARCHITECTURE.md              # 🏛️ [THIS DOCUMENT] Architecture blueprint
├── ROADMAP.md                   # 🗺️ 5 Autonomous development phases
├── README.md                    # 📖 Open-source showcase & quickstart
├── package.json                 # 📦 Bun scripts, binary aliases (baba/bbyg/matryoshka), and deps
├── tsconfig.json                # ⚙️ Strict TypeScript configuration
├── gemini-extension.json        # ♊ Native manifest for Gemini CLI
├── .claude-plugin/              # 🦊 Native manifest for Claude Code
│   └── plugin.json
│
├── src/                         # 💻 Core Engine (Pure TypeScript / Bun)
│   ├── cli.ts                   # CLI entrypoint with flag parsing and subcommands
│   ├── detector.ts              # Polyglot stack & test runner detector
│   ├── scanner.ts               # harness-score + codebase-memory-mcp orchestrator
│   ├── wrapper.ts               # Adaptive AGENTS.md & context fence generator
│   ├── ast.ts                   # Syntax AST engine (Tree-sitter WASM / SQL AST)
│   ├── mcp.ts                   # Native stdio MCP server for Claude, Cursor, and Gemini
│   └── types.ts                 # Shared TypeScript interfaces and contracts
│
├── skills/                      # 🪆 Native Agent Skills (Universal Schema)
│   └── matryoshka/
│       └── SKILL.md             # Skill definition with progressive disclosure
│
├── commands/                    # ⚡ Universal slash commands
│   ├── wrap.md                  # Claude Code slash command
│   └── wrap.toml                # Gemini CLI slash command
│
├── docs/                        # 📚 Living documentation
│   ├── EXPERIENCE.md            # Harness² Meta-Learning Library
│   └── prds/                    # Atomic Product Requirement Documents (PRDs)
│       ├── PRD_STACK_DETECTOR_AND_CLI_BASE.md
│       └── PRD_HARNESS_SCORE_ORACLE_INTEGRATION.md
│
└── tests/                       # 🧪 Test Suite (RED-to-GREEN verification)
    ├── detector.test.ts         # Polyglot stack detection tests
    ├── scanner.test.ts          # harness-score integration tests
    └── cli.test.ts              # Command alias parity tests (baba/bbyg/matryoshka)
```

---

## 🧩 3. Core Module Responsibilities

### `src/detector.ts` (Stack & Runner)
* Inspects repository file tree and package manifests (`pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`).
* Exports the `ProjectStack` interface:
  ```typescript
  export interface ProjectStack {
    primary: 'python' | 'typescript' | 'go' | 'rust' | 'ruby' | 'php' | 'unknown';
    frameworks: string[];
    testRunner: string | null;
    archetype: 'procedural-cms' | 'reactive-frontend' | 'opinionated-framework' | 'distributed-systems' | 'generic';
  }
  ```

### `src/scanner.ts` (Diagnostic & Reconciliation)
* Programmatically invokes `harness-score` to retrieve L0..L4 maturity level and gap lists.
* Queries `codebase-memory-mcp` graph to map real existing models and endpoints.
* Emits a reconciled report: **Missing Governance vs Existing Codebase Reality**.

### `src/wrapper.ts` (Adaptive Remediation)
* Injects tailored `AGENTS.md` matching the project's genuine architectural archetype.
* Scaffolds modular skill directories (`skill-backend.md`, `skill-api.md`, `skill-security.md`).
* Configures local MCP manifests (`.cursor/mcp.json`, `.gemini/settings.json`).

---

## 🧪 4. Quality Standards & Verifiability
* **Sub-15ms Overhead:** The CLI must respond to `baba detect` in under 15 milliseconds.
* **Strict Red-to-Green TDD:** All features are introduced via deterministic tests in `tests/*.test.ts` using Bun's native test runner (`bun test`).
* **Zero Runtime Dependencies:** End-user distribution via `npx` or compiled standalone Bun binaries requires zero host compilers or background daemons.
* **Language Policy:** Source code, tests, commit messages, PRDs, and documentation must be authored strictly in English.
