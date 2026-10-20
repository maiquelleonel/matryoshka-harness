# 📐 SPEC-7: Auto-Wiring codebase-memory-mcp & Telemetry Dashboard

## 🎯 1. Specification Metadata
- **Spec ID:** SPEC-7
- **Issue:** #7 - feat(mcp): auto-wire codebase-memory-mcp for Cursor, Gemini CLI, and Claude
- **Status:** IMPLEMENTING
- **Author:** Maiquel Leonel & Ouroboros Architecture Pod
- **Target Runtime:** Bun v1.3+ / TypeScript

---

## 📋 2. Functional Description

### 2.1. Subtask 1: CLI Injection Subcommand
The CLI exposes `mcp wire [path]` across all three canonical binary aliases (`baba`, `bbyg`, `matryoshka`).
Syntax:
```bash
baba mcp wire [path] [--dry-run] [--json]
bbyg mcp wire [path] [--dry-run] [--json]
matryoshka mcp wire [path] [--dry-run] [--json]
```
If `path` is omitted, the current working directory is used.

### 2.2. Subtask 2: Auto-Injection Targets
The command automates MCP configuration for 3 developer agent environments:
1. **Cursor:** `.cursor/mcp.json`
2. **Gemini CLI:** `.gemini/settings.json`
3. **Claude Code:** `.claude/mcp.json`

Each target file maps the `codebase-memory-mcp` entry inside `mcpServers`:
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

### 2.3. Subtask 3: Idempotence, Safety & Dry-Run
- **Deep Merge:** If any target configuration file already exists, existing top-level keys, nested configurations, and existing `mcpServers` entries are strictly preserved.
- **Idempotent Write:** Re-running the command does not duplicate or corrupt settings.
- **Dry-Run Mode (`--dry-run`):** When `--dry-run` is specified, no directories are created and no files are written to disk.
- **Structured JSON Mode (`--json`):** Emits structured output detailing targeted files, planned/actual status, and root path. In `--dry-run`, `status` is `"planned"`.

### 2.4. Subtask 4: Dashboard-as-Code & Observability
A versioned Grafana dashboard is stored at `dashboards/matryoshka-grafana.json`. It provides visualization for:
- `search_graph` queries and request rates
- Knowledge graph P95 query latencies
- MCP error rates and gap evaluation counts

---

## 🛠️ 3. Technical Contracts

### 3.1. Core Module (`src/mcp.ts`)
```typescript
export interface McpTargetConfig {
  name: string;
  target: "cursor" | "gemini" | "claude";
  path: string;
  relativePath: string;
  action: "create" | "update" | "unchanged";
  status: "planned" | "created" | "updated" | "unchanged" | "error";
  error?: string;
}

export interface McpWireOptions {
  dryRun?: boolean;
}

export interface McpWireResult {
  status: "planned" | "success" | "error";
  command: "mcp wire";
  rootPath: string;
  dryRun: boolean;
  serverName: "codebase-memory-mcp";
  serverConfig: {
    command: string;
    args: string[];
  };
  targets: McpTargetConfig[];
  files: McpTargetConfig[];
  message?: string;
}

export function wireMcpTargets(targetDir: string, options?: McpWireOptions): McpWireResult;
```

---

## ✅ 4. Acceptance Criteria (BDD)

### AC-1: Clean Workspace Auto-Wiring
Given the developer executes `baba mcp wire ./my-project`
When directories `.cursor/`, `.gemini/`, and `.claude/` do not exist
Then the CLI must create the required directories
And create the configuration files with `codebase-memory-mcp` set to `bunx codebase-memory-mcp`
And return exit code 0.

### AC-2: Non-Destructive Idempotent Merge
Given `.gemini/settings.json` already contains a custom MCP server and user settings
When the command `baba mcp wire` is executed
Then existing settings and user keys must be strictly preserved
And `codebase-memory-mcp` must be injected/updated under `mcpServers`
And no pre-existing data must be destroyed.

### AC-3: Dry-Run Mode & Structured Output
Given the command is executed with `--dry-run --json`
When file inspection finishes
Then no files on disk must be modified
And the JSON payload must report the planned file modifications (`status: planned`).

### AC-4: Canonical Grafana Dashboard
Given the matryoshka-harness repository
When inspecting the `dashboards/` directory
Then `dashboards/matryoshka-grafana.json` must exist with metrics for `search_graph`.
