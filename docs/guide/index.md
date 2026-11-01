# Matryoshka-Harness

<div align="center">
  <h3>Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation for Autonomous Coding Agents</h3>
</div>

---

## 🧭 Overview & Manifesto: The AI-Slop Crisis

Autonomous AI coding agents (such as Claude Code, Gemini CLI, Cursor, and OpenAI Codex) have fundamentally transformed modern software engineering. However, when deployed on complex production codebases without deterministic constraints, agents rapidly fall victim to what the industry designates the **AI-Slop Crisis**:

1. **Context Window Pollution & Token Tax:** Monolithic prompt files exceeding 1,000 lines dilute model attention, exhaust context windows, and impose a staggering recurring cost on developer teams.
2. **Speculative Abstractions & Bloat:** Given unconstrained freedom, agents hallucinate generic enterprise patterns, superfluous abstract interfaces, and unnecessary class hierarchies where simple functions suffice.
3. **The False-Green Hazard:** In unverified test environments, agents frequently produce assertionless tests that execute cleanly without validating behavioral contracts, providing a deceptive sense of security.
4. **Silent Security Regressions:** Under pressure to deliver quick patches, models inadvertently introduce dynamic string interpolations into SQL queries (CWE-89) or hardcode secrets into commit histories.

**Matryoshka-Harness** (`baba` / `bbyg` / `matryoshka`) resolves this crisis through the **Russian Doll mental model**: encapsulating codebases into **five concentric governance layers**. Each layer tightly fencemarks context from the outermost IDE tool surface down to foundational repository hygiene.

---

## 🪆 The Russian Doll Mental Model

Like traditional nested nesting dolls (*matryoshkas*), each concentric governance layer encapsulates, protects, and constrains the next:

```text
+-------------------------------------------------------------------------+
| LAYER 5: Native MCP Server (baba mcp serve / wire)                      |
| - stdio JSON-RPC 2.0 protocol for Cursor, Claude Code, Zed & Gemini CLI |
| +---------------------------------------------------------------------+ |
| | LAYER 4: Polyglot AST Engine (baba wrap)                            | |
| | - In-memory Tree-sitter WASM inspection in < 200ms                  | |
| | - Raw SQL injection, assertionless tests, hardcoded secrets         | |
| | +-----------------------------------------------------------------+ | |
| | | LAYER 3: Adaptive AGENTS.md & Modular Skills (baba agents)      | | |
| | | - Root AGENTS.md strictly under 200 tokens (Token Guard < 250)  | | |
| | | - On-demand .agents/skills/<domain>/SKILL.md with strict YAML   | | | 
| | |   frontmatter                                                   | | |
| | | +-------------------------------------------------------------+ | | |
| | | | LAYER 2: Semantic Code Graph Integration (codebase-memory)  | | | |
| | | | - Cross-references static file paths with codebase memory   | | | |
| | | | - Reconciles missing governance against actual entities     | | | |
| | | | +---------------------------------------------------------+ | | | |
| | | | |  LAYER 1: Repository Maturity Oracle (baba scan)        | | | | |
| | | | |  - Powered by canonical paladini/harness-score          | | | | |
| | | | |  - L0 to L4 hygiene scoring & dynamic SVG badges        | | | | |
| | | | +---------------------------------------------------------+ | | | |
| | | +-------------------------------------------------------------+ | | |
| | +-----------------------------------------------------------------+ | |
| +---------------------------------------------------------------------+ |
+-------------------------------------------------------------------------+
```

Learn more in [Concentric Layers](concepts/concentric-layers.md).

---

## ⚡ Zero-Install Quickstart

Execute directly with zero global installation through your preferred package runner:

=== "bunx"
    ```bash
    # Scan repository maturity and generate compliance SVG badge
    bunx @maiquelleonel/matryoshka scan --badge

    # Audit polyglot AST antipatterns and compile DIAGNOSTIC.md
    bunx @maiquelleonel/matryoshka wrap

    # Auto-wire native Model Context Protocol into Cursor, Claude, and Gemini
    bunx @maiquelleonel/matryoshka mcp wire
    ```

=== "npx"
    ```bash
    # Scan repository maturity and generate compliance SVG badge
    npx @maiquelleonel/matryoshka scan --badge

    # Audit polyglot AST antipatterns and compile DIAGNOSTIC.md
    npx @maiquelleonel/matryoshka wrap

    # Auto-wire native Model Context Protocol into Cursor, Claude, and Gemini
    npx @maiquelleonel/matryoshka mcp wire
    ```

=== "Standalone Binaries"
    ```bash
    # Run the pre-compiled native binary directly on Linux, macOS, or Windows
    ./baba-linux-x64 scan --badge
    ```

Visit the [Installation Guide](getting-started/installation.md) and [5-Minute Quickstart](getting-started/quickstart.md) for step-by-step instructions.

---

## 🎯 Official Ergonomic Aliases Parity

Every command is accessible through three interchangeable aliases with byte-for-byte behavioral parity:

* **`baba`** — The Slavic matriarch of nesting dolls (4 letters, zero typos). Recommended for day-to-day terminal ergonomics.
* **`bbyg`** — Baba-Yaga mythology shorthand for rapid agent sandboxes.
* **`matryoshka`** — Canonical package name for corporate CI/CD pipelines.

```bash
# All three invocations are byte-for-byte identical:
baba scan --json
bbyg scan --json
matryoshka scan --json
```

---

## 📚 Documentation Map

| Section | Focus Areas | Reference Guides |
| :--- | :--- | :--- |
| **Getting Started** | Fast onboarding & setup | [Installation](getting-started/installation.md) • [Quickstart](getting-started/quickstart.md) |
| **Core Concepts** | Architecture & mental models | [Concentric Layers](concepts/concentric-layers.md) • [Polyglot AST Engine](concepts/ast-engine.md) • [Adaptive Agents](concepts/adaptive-agents.md) |
| **CLI Reference** | Complete syntax, flags & schemas | [`baba detect`](cli/detect.md) • [`baba scan`](cli/scan.md) • [`baba wrap`](cli/wrap.md) • [`baba agents`](cli/agents.md) • [`baba mcp`](cli/mcp.md) |
| **Integrations** | Protocols & quality gates | [Native MCP Server](integrations/mcp-server.md) • [CI/CD Quality Gates](integrations/ci-cd-gates.md) |
