# baba mcp

Model Context Protocol (MCP) integrations: auto-wire knowledge graph tooling and launch native stdio servers for AI coding agents.

---

## 🚀 Synopsis

```bash
baba mcp <command> [path] [options]
```

### Command Aliases
`baba mcp` maintains strict parity across all CLI aliases:
* `baba mcp` — Convenient 4-letter alias
* `bbyg mcp` — Baba-Yaga alias
* `matryoshka mcp` — Canonical package binary

---

## 📖 Description

The `mcp` command suite connects Matryoshka's governance engines directly to AI development tools and editors through Anthropic's **Model Context Protocol (MCP)**.

It provides two core capabilities:
1. **`wire`:** Automatically injects `codebase-memory-mcp` configuration into Cursor, Gemini CLI, and Claude Code without overwriting existing settings.
2. **`serve`:** Launches a native JSON-RPC 2.0 MCP server over `stdio` exposing Matryoshka auditing tools, prompts, and resources.

---

## 🛠️ Subcommand 1: `baba mcp wire`

Auto-wire knowledge graph tooling across popular AI IDEs and CLI agents.

```bash
baba mcp wire [path] [options]
```

### Target Environments & Configurations
* **Cursor:** Injected into `.cursor/mcp.json`
* **Gemini CLI:** Injected into `.gemini/settings.json`
* **Claude Code:** Injected into `.claude/mcp.json`

### Options:
* `--targets <list>` — Comma-separated list of target environments to configure (e.g. `cursor,gemini,claude`). Defaults to all supported targets.
* `--target <name>` — Singular alias for targeting a single environment.
* `--dry-run` — Preview planned configuration modifications without modifying files on disk.
* `--json` — Output injection plans and results as structured JSON.
* `-h, --help` — Display help information.

### Deep Non-Destructive Merging Invariants
* **Preserves Pre-existing Settings:** User preferences, themes, and other configured MCP servers are never deleted or truncated.
* **Zero Destructive Overwrite:** If a target configuration file contains malformed or unparseable JSON, Matryoshka halts modification for that target with an explicit error status, preventing data loss.
* **Strict Idempotency:** If `codebase-memory-mcp` is already configured with identical command arguments, the action is marked as `unchanged` and disk I/O is skipped.

---

## 🛠️ Subcommand 2: `baba mcp serve`

Launch a native Model Context Protocol (MCP) server over `stdio` adhering strictly to the **JSON-RPC 2.0** protocol specification.

```bash
baba mcp serve [path]
```

### Stdio Stream Isolation & Logging Guards
* **Clean Stdout:** Standard output (`stdout`) is strictly reserved for newline-delimited JSON-RPC 2.0 message frames.
* **Stderr Logging Guard:** All console logs, internal telemetry, and diagnostics are routed directly to `stderr` with a structured `[matryoshka-mcp]` prefix. This prevents protocol corruption and parsing crashes in client IDEs.

### Exposed MCP Tools

| Tool Name | Parameters | Description |
|:---|:---|:---|
| `detect_stack` | `path?: string` | Detect framework, testing conventions, and repo archetype |
| `scan_harness` | `path?: string` | Evaluate current L1–L4 harness score and generate maturity metrics |
| `generate_agents` | `path?: string`, `force?: boolean`, `dryRun?: boolean`, `maxTokens?: number` | Autonomously produce lean `AGENTS.md` and modular `.agents/skills/` |
| `wrap_context` | `path?: string`, `threshold?: number`, `strict?: boolean` | Run polyglot AST audit and generate remediation plan |

### Exposed MCP Resources
* `matryoshka://agents` — Exposes the current compiled `AGENTS.md` context boundary.
* `matryoshka://diagnostic` — Exposes the latest `DIAGNOSTIC.md` remediation report.

### Exposed MCP Prompts
* `audit_repository` — Guided system prompt instructing AI agents on structured repository inspection, maturity remediation, and quality gate enforcement.

---

## 📋 Examples

### Auto-Wire All IDE Configurations
```bash
baba mcp wire
```

### Wire Specific IDE with Dry Run Preview
```bash
baba mcp wire --targets cursor,claude --dry-run
```

### Structured JSON Telemetry for Wiring
```bash
baba mcp wire --json
```

Output:
```json
{
  "status": "success",
  "command": "mcp:wire",
  "targets": [
    {
      "name": "Cursor",
      "target": "cursor",
      "path": ".cursor/mcp.json",
      "action": "create",
      "status": "success"
    }
  ]
}
```

### Start the Native MCP Server over Stdio
```bash
baba mcp serve
```
