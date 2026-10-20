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

Target selection can be filtered using `--targets <comma-separated-targets>` or `--target <target>`:
- `baba mcp wire --targets cursor`
- `baba mcp wire --targets cursor,claude`
If omitted, all 3 targets are configured by default.

When target file writing fails (e.g. read-only filesystem or invalid permissions), the error is isolated per target with `status: "error"` and `error` description, setting the overall result status to `"error"`.

### 2.3. Subtask 3: Idempotence, Safety & Dry-Run
- **Deep Merge:** If any target configuration file already exists, existing top-level keys, nested configurations, and existing `mcpServers` entries are strictly preserved across all targets (Cursor, Gemini CLI, Claude Code).
- **Idempotent Write:** Re-running the command does not duplicate or corrupt settings. When a target is already configured with identical parameters, no unnecessary disk writes are performed (`status: "unchanged"`).
- **Zero Destructive Overwrites:** If an existing configuration file contains invalid/unparseable JSON, it must NOT be overwritten or wiped out; the error is safely isolated with `status: "error"`.
- **Dry-Run Mode (`--dry-run`):** When `--dry-run` is specified, no directories are created and no files are written to disk. The simulation accurately computes actions (`create`, `update`, `unchanged`) with `status: "planned"`.
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
  targets?: McpTargetName[];
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

### AC-1.1: Target Isolation and Filtering
Given the developer executes `baba mcp wire ./my-project --targets cursor,claude`
When directories do not exist
Then only `.cursor/mcp.json` and `.claude/mcp.json` must be created
And `.gemini/settings.json` must not be created.

### AC-1.2: Target Error Isolation
Given a target configuration cannot be written to disk
When `wireMcpTargets` is executed
Then the affected target must report `status: "error"` and include the `error` message
And the overall result status must be `"error"`.

### AC-2: Non-Destructive Idempotent Merge
Given `.gemini/settings.json` already contains a custom MCP server and user settings
When the command `baba mcp wire` is executed
Then existing settings and user keys must be strictly preserved
And `codebase-memory-mcp` must be injected/updated under `mcpServers`
And no pre-existing data must be destroyed.

### AC-2.1: Safety Against Corrupted Files (Zero Destructive Overwrite)
Given an existing target configuration file contains malformed or unparseable JSON
When `baba mcp wire` is executed
Then the existing corrupted file must NOT be destroyed or overwritten
And the affected target must report `status: "error"` with an explicit error description
And the CLI must exit with code 1.

### AC-2.2: True Idempotence on Unchanged Configurations
Given a target configuration file is already correctly configured with `codebase-memory-mcp`
When `baba mcp wire` is executed
Then the target must report `action: "unchanged"` and `status: "unchanged"`
And no unnecessary disk write is attempted (preserving read-only files).

### AC-3: Dry-Run Mode & Structured Output
Given the command is executed with `--dry-run --json`
When file inspection finishes
Then no files on disk must be modified
And the JSON payload must report the planned file modifications (`status: planned`).

### AC-4: Canonical Grafana Dashboard
Given the matryoshka-harness repository
When inspecting the `dashboards/` directory
Then `dashboards/matryoshka-grafana.json` must exist with metrics for `search_graph`.
