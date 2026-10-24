# 📐 SPEC-14: docs(branding): launch-grade README, actionable CLI help & Ouroboros heritage

**Módulo:** Developer Experience / Branding / Documentation  
**Status:** in-progress  
**Gatilho:** Issue #14 (PR #19)  
**Target:** Bun + TypeScript + Markdown + HTML  

---

## 🎯 1. Objetivo & Escopo
Implement a launch-grade developer experience and brand identity for **Matryoshka-Harness** (`baba` / `bbyg` / `matryoshka`):
1. **Showcase `README.md` (Subtask 1):** Craft a world-class, launch-grade README featuring badging, executive value proposition, concentric Russian-doll mental model, dual architecture diagrams (Mermaid.js + ASCII), zero-install quickstart (`bunx`/`npx`), standalone binary usage, complete CLI reference, and FinOps metrics.
2. **Actionable CLI Help Menus (`src/cli.ts`) (Subtask 2):** Upgrade CLI help from a flat string to a rich, declarative, and actionable UX featuring both comprehensive root manual and dedicated per-subcommand help manuals (`detect --help`, `scan --help`, `agents --help`, `wrap --help`, `mcp --help`).
3. **MIT License & Copyright Enforcement (Subtask 3):** Verify root and package licenses and enforce uniform copyright header annotations across all TypeScript/JavaScript production source files and scripts.
4. **Ouroboros Engine Heritage Cross-Linking (Subtask 4):** Cross-link Matryoshka and Ouroboros Engine between `site/index.html` and `README.md`, highlighting the recursive autonomous engineering methodology (Harness² / arXiv:2610.14224).

---

## 🏛️ 2. Subtasks & Acceptance Criteria

### Subtask 1: Launch-Grade Showcase README.md
* **AC-1.1 Architecture Diagrams:** Must feature both a Mermaid diagram (`graph TD` or `flowchart TD`) and an ASCII diagram detailing the 5 concentric layers:
  - Layer 5: Native MCP Server (`mcp serve` / `mcp wire`)
  - Layer 4: Polyglot AST Engine (`wrap`)
  - Layer 3: Adaptive AGENTS.md & Modular Skills (`agents generate`)
  - Layer 2: Semantic Code Graph Integration (`codebase-memory-mcp`)
  - Layer 1: Repository Maturity Oracle (L1-L4) (`scan`)
* **AC-1.2 Zero-Install Quickstart:** Provide instant copy-paste invocations for `bunx @maiquelleonel/matryoshka wrap` and `npx @maiquelleonel/matryoshka scan`.
* **AC-1.3 Canonical Aliases:** Document `baba` (ergonomic 4-letter alias), `bbyg` (mythological Baba-Yaga alias), and `matryoshka` (canonical package).
* **AC-1.4 Complete CLI Reference:** Document all subcommands with concrete flags (`detect`, `scan`, `agents`, `wrap`, `mcp`).

### Subtask 2: Polished CLI Help Menus in `src/cli.ts`
* **AC-2.1 Root Help Menu:** Enhanced `HELP_TEXT` preserving alias parity and required search keywords (`Matryoshka-Harness CLI`, `baba / bbyg / matryoshka`, `detect`, `scan`, `agents`, `wrap`, `mcp`, `--json`).
* **AC-2.2 Subcommand Help:** Dedicated, actionable help messages displayed with exit code 0 when invoked as:
  - `baba detect --help` / `baba detect -h`
  - `baba scan --help` / `baba scan -h`
  - `baba agents --help` / `baba agents -h`
  - `baba wrap --help` / `baba wrap -h`
  - `baba mcp --help` / `baba mcp -h` / `baba mcp wire --help`

### Subtask 3: MIT License & Copyright Headers
* **AC-3.1 License Consistency:** Verify `LICENSE` files in root and `packages/*` retain MIT License and copyright notice `Copyright (c) 2026 Maiquel Leonel`.
* **AC-3.2 Source Copyright Annotations:** Every production source file in `src/`, `index.ts`, and `scripts/` must contain the canonical copyright comment header.

### Subtask 4: Ouroboros Heritage & Cross-Linking
* **AC-4.1 Hotsite Cross-Linking (`site/index.html`):** Ensure navigation and footer include clear links to Ouroboros Engine (`https://ouroboros.leonellabshq.dev`) and the GitHub repository.
* **AC-4.2 README Cross-Linking:** Dedicated "🐍 Ouroboros Engine Heritage" section detailing the autonomous engineering roots and linking to `https://ouroboros.leonellabshq.dev` and the visual showcase.
