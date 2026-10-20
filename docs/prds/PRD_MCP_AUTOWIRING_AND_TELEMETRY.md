# 📋 PRD: Auto-Wiring codebase-memory-mcp & Telemetry Dashboard

**Status:** Approved for Development  
**Roadmap Phase:** Phase 3 (Issue #7)  
**Author:** Maiquel Leonel & Ouroboros Architecture Pod  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objective & Overview
Equip coding agents with the **Semantic AST Knowledge Graph** (`codebase-memory-mcp`) prior to generating static instructions (`AGENTS.md`) or allowing agents to waste thousands of tokens scanning directory trees blindly with `read_file` and `run_shell_command`.

This capability auto-wires `codebase-memory-mcp` across popular agentic environments (Cursor, Gemini CLI, Claude Code), ensuring zero-configuration semantic awareness. It also provides a canonical versioned Grafana dashboard (`dashboards/matryoshka-grafana.json`) to track MCP queries, P95 latency, and error rates.

---

## 🔍 2. Auto-Injection Targets & Configuration

| Environment | Configuration Target File | Target Directory | Key Container | Server Command | Server Args |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cursor** | `.cursor/mcp.json` | `.cursor/` | `mcpServers` | `bunx` | `["codebase-memory-mcp"]` |
| **Gemini CLI** | `.gemini/settings.json` | `.gemini/` | `mcpServers` | `bunx` | `["codebase-memory-mcp"]` |
| **Claude Code** | `.claude/mcp.json` | `.claude/` | `mcpServers` | `bunx` | `["codebase-memory-mcp"]` |

---

## ⚡ 3. Terminal Ergonomics (Canonical Aliases & Subcommand)
The CLI exposes the `mcp wire` subcommand with strict functional parity across all three binary aliases:
1. `baba mcp wire [path] [--dry-run] [--json]`
2. `bbyg mcp wire [path] [--dry-run] [--json]`
3. `matryoshka mcp wire [path] [--dry-run] [--json]`

### CLI Flags:
* `[path]`: Optional target directory (defaults to current working directory).
* `--dry-run`: Simulates injection without writing any files or creating directories on disk.
* `--json`: Outputs structured JSON output with injection status and planned modifications.

---

## 🛡️ 4. Safety & Idempotence Contracts
* **Non-destructive Deep Merge:** Pre-existing configuration files (such as user themes, custom settings, or other MCP servers) are 100% preserved.
* **Idempotent Updates:** Re-executing `mcp wire` multiple times produces consistent, non-duplicated configurations.
* **Directory Provisioning:** Required parent directories (`.cursor/`, `.gemini/`, `.claude/`) are created if missing when not in dry-run mode.

---

## 📊 5. Observability & Dashboard-as-Code
A canonical, production-ready Grafana dashboard is maintained at `dashboards/matryoshka-grafana.json`. The dashboard monitors:
* `search_graph` query volume and rate
* P95 latency across knowledge graph operations
* MCP error rates and gap evaluation metrics

---

## ✅ 6. BDD Acceptance Criteria

### Scenario 1: Auto-wiring in a clean workspace
* **Given** the developer executes `baba mcp wire ./my-project`
* **When** directories `.cursor/`, `.gemini/`, and `.claude/` do not exist
* **Then** the CLI must create the required directories
* **And** create the configuration files with `codebase-memory-mcp` set to `bunx codebase-memory-mcp`
* **And** return exit code 0.

### Scenario 2: Preserving existing configurations (Idempotent Merge)
* **Given** `.gemini/settings.json` already contains a custom MCP server and user settings
* **When** the command `baba mcp wire` is executed
* **Then** existing settings and user keys must be strictly preserved
* **And** `codebase-memory-mcp` must be injected/updated under `mcpServers`
* **And** no pre-existing data must be destroyed.

### Scenario 3: Dry-Run Mode and Structured Output
* **Given** the command is executed with `--dry-run --json`
* **When** file inspection finishes
* **Then** no files on disk must be modified
* **And** the JSON payload must report the planned file modifications (`status: planned`).

### Scenario 4: Canonical Versioned Grafana Dashboard
* **Given** the matryoshka-harness repository
* **When** inspecting the `dashboards/` directory
* **Then** `dashboards/matryoshka-grafana.json` must exist with metrics for `search_graph`.
