# 📄 PRD: Auto-Wiring codebase-memory-mcp & Graph Telemetry

**Status:** Approved  
**Author:** @maiquelleonel (Tech Lead Co-Pilot)  
**Project:** Matryoshka-Harness (`@maiquelleonel/matryoshka`)  
**Phase:** Phase 2 (Semantic Reconnaissance & MCP Auto-Wiring)  
**Associated Issue:** #7  

---

## 🎯 1. Executive Summary & Rationale

Before generating static instruction files (`AGENTS.md`) or allowing silicon agents to burn thousands of tokens blindly scanning directory trees with raw `read_file` and `run_shell_command`, **Matryoshka-Harness** must equip the workspace with the **Semantic AST Knowledge Graph** (`codebase-memory-mcp`).

### The Blind Reconnaissance Problem:
1. Agents without MCP spend on average 70% more tokens performing brute-force file reads (`read_file`, `list_directory`).
2. The repository's AgentOps Grafana dashboard exposes an absence of specialized tool calls (`search_graph`, `trace_path`), indicating poor reconnaissance discipline.
3. Manually configuring MCP across multiple supported environments (Cursor, Gemini CLI, Claude Code) introduces cognitive friction and degrades project maturity.

---

## 🏗️ 2. Architectural Design

The canonical command `baba mcp wire [path]` (and its aliases `bbyg` and `matryoshka`) executes deterministic, idempotent MCP injection across supported development environments:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BABA MCP WIRE PIPELINE                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. INSPECT: Check for presence of .cursor/, .gemini/, .claude/         │
│ 2. MERGE: Read existing configs without overwriting user tools         │
│ 3. INJECT: Insert standardized 'codebase-memory-mcp' server block      │
│ 4. TELEMETRY: Ensure dashboard provisioning & tool metrics visibility │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Injection Targets & Canonical Schemas

* **Cursor (`.cursor/mcp.json`):**
  ```json
  {
    "mcpServers": {
      "codebase-memory-mcp": {
        "command": "bunx",
        "args": ["codebase-memory-mcp"]
      }
    }
  }
  ```
* **Gemini CLI (`.gemini/settings.json`):**
  ```json
  {
    "mcpServers": {
      "codebase-memory-mcp": {
        "command": "bunx",
        "args": ["codebase-memory-mcp"]
      }
    }
  }
  ```
* **Claude Code (`.claude/mcp.json`):**
  ```json
  {
    "mcpServers": {
      "codebase-memory-mcp": {
        "command": "bunx",
        "args": ["codebase-memory-mcp"]
      }
    }
  }
  ```

### 2.2 Dashboard-as-Code & Repository Telemetry
* Versioned canonical dashboard at `dashboards/matryoshka-grafana.json`.
* First-class support for `bughunter_tool_calls_total{tool="search_graph",repo="matryoshka-harness"}`.

---

## 📋 3. BDD Acceptance Criteria (Gherkin)

### Scenario 1: Auto-wiring in a clean workspace
* **Given** the developer executes `baba mcp wire ./my-project`
* **When** directories `.cursor/`, `.gemini/`, and `.claude/` do not exist
* **Then** the CLI must create the necessary directories
* **And** create configuration files containing `codebase-memory-mcp` configured with `bunx codebase-memory-mcp`
* **And** exit with status code 0 and structured/friendly summary.

### Scenario 2: Preserving existing configurations (Idempotent Deep Merge)
* **Given** `.gemini/settings.json` already contains a custom MCP server (`my-internal-server`) and user setting `theme: "dark"`
* **When** the `baba mcp wire` command is executed
* **Then** `theme: "dark"` and `my-internal-server` must be strictly preserved
* **And** `codebase-memory-mcp` must be added or updated under `mcpServers`
* **And** zero existing user configurations must be destroyed or overwritten.

### Scenario 3: Dry-Run Mode and Structured Output
* **Given** the command is executed with `--dry-run --json`
* **When** file inspection completes
* **Then** no files on disk must be created or modified
* **And** the JSON output must report planned changes (`status: "planned"`).

### Scenario 4: Canonical Grafana Dashboard Presence
* **Given** the `matryoshka-harness` repository
* **When** inspecting the `dashboards/` directory
* **Then** `dashboards/matryoshka-grafana.json` must exist with panels tracking `search_graph`, P95 latency, and error rates.

---

## 🛡️ 5. Guardrails & Anti-Slop Principles
* **Safe Runtime:** Prioritize `bunx codebase-memory-mcp` (always Bun over Node).
* **Zero Blind Overwrite:** Never perform destructive `JSON.stringify` writes without deep-merging existing keys.
* **Malformed File Tolerance:** If an existing configuration file contains invalid JSON, report a clean error and create a `.bak` backup before aborting safely.
