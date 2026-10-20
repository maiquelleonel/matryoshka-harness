import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import type {
  McpTargetConfig,
  McpTargetName,
  McpWireOptions,
  McpWireResult,
} from "./types";

export const MCP_SERVER_NAME = "codebase-memory-mcp";

export const MCP_SERVER_CONFIG = {
  command: "bunx",
  args: ["codebase-memory-mcp"],
};

export interface TargetDefinition {
  name: string;
  target: McpTargetName;
  relativePath: string;
}

export const TARGET_DEFINITIONS: TargetDefinition[] = [
  { name: "Cursor", target: "cursor", relativePath: ".cursor/mcp.json" },
  { name: "Gemini CLI", target: "gemini", relativePath: ".gemini/settings.json" },
  { name: "Claude Code", target: "claude", relativePath: ".claude/mcp.json" },
];

/**
 * Auto-wires codebase-memory-mcp across Cursor, Gemini CLI, and Claude Code.
 * Executes non-destructive deep merges preserving all pre-existing settings.
 */
export function wireMcpTargets(
  targetDir: string = process.cwd(),
  options: McpWireOptions = {}
): McpWireResult {
  const rootPath = path.resolve(targetDir);
  const dryRun = Boolean(options.dryRun);
  const targetFilter =
    options.targets && options.targets.length > 0
      ? new Set(options.targets.map((t) => t.toLowerCase()))
      : null;

  const targetDefs = targetFilter
    ? TARGET_DEFINITIONS.filter((def) => targetFilter.has(def.target))
    : TARGET_DEFINITIONS;

  const results: McpTargetConfig[] = [];

  for (const def of targetDefs) {
    const filePath = path.resolve(rootPath, def.relativePath);
    const dirPath = path.dirname(filePath);

    let action: "create" | "update" | "unchanged" = "create";
    const fileExisted = fs.existsSync(filePath);
    let finalContent: Record<string, any> = {};

    if (fileExisted) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          finalContent = parsed;
        } else {
          finalContent = {};
        }
      } catch {
        finalContent = {};
      }

      if (
        !finalContent.mcpServers ||
        typeof finalContent.mcpServers !== "object" ||
        Array.isArray(finalContent.mcpServers)
      ) {
        finalContent.mcpServers = {};
      }

      const existingServer = finalContent.mcpServers[MCP_SERVER_NAME];
      const isAlreadyConfigured =
        existingServer &&
        typeof existingServer === "object" &&
        existingServer.command === MCP_SERVER_CONFIG.command &&
        Array.isArray(existingServer.args) &&
        existingServer.args.length === MCP_SERVER_CONFIG.args.length &&
        existingServer.args.every(
          (val: string, idx: number) => val === MCP_SERVER_CONFIG.args[idx]
        );

      if (isAlreadyConfigured) {
        action = "unchanged";
      } else {
        action = "update";
      }

      finalContent.mcpServers[MCP_SERVER_NAME] = { ...MCP_SERVER_CONFIG };
    } else {
      action = "create";
      finalContent = {
        mcpServers: {
          [MCP_SERVER_NAME]: { ...MCP_SERVER_CONFIG },
        },
      };
    }

    let status: McpTargetConfig["status"] = "planned";
    let targetError: string | undefined;

    if (!dryRun) {
      try {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(
          filePath,
          JSON.stringify(finalContent, null, 2) + "\n",
          "utf-8"
        );
        status =
          action === "create"
            ? "created"
            : action === "update"
            ? "updated"
            : "unchanged";
      } catch (err: any) {
        status = "error";
        targetError = err?.message || String(err);
      }
    } else {
      status = "planned";
    }

    results.push({
      name: def.name,
      target: def.target,
      path: filePath,
      relativePath: def.relativePath,
      action,
      status,
      ...(targetError ? { error: targetError } : {}),
    });
  }

  const hasErrors = results.some((r) => r.status === "error");

  return {
    status: hasErrors ? "error" : dryRun ? "planned" : "success",
    command: "mcp wire",
    rootPath,
    dryRun,
    serverName: MCP_SERVER_NAME,
    serverConfig: MCP_SERVER_CONFIG,
    targets: results,
    files: results,
  };
}

/**
 * Formats structured McpWireResult into a human-readable terminal report.
 */
export function formatMcpWireHumanOutput(result: McpWireResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push(pc.bold(pc.yellow("\n🔍 [dry-run] Matryoshka MCP Auto-Wiring Simulation")));
    lines.push(`  ${pc.dim("•")} ${pc.bold("Target Path:")}  ${result.rootPath}`);
    lines.push(`  ${pc.dim("•")} ${pc.bold("Server:")}       ${pc.cyan(result.serverName)} (${result.serverConfig.command} ${result.serverConfig.args.join(" ")})`);
    lines.push(`  ${pc.dim("•")} ${pc.bold("Simulated Actions:")}`);

    for (const t of result.targets) {
      const actionBadge = pc.yellow(`[dry-run: ${t.action}]`);
      lines.push(`    - ${pc.bold(t.name)}: ${t.relativePath} ${actionBadge}`);
    }

    lines.push(pc.dim("\n  Notice: Dry-run active. Zero modifications written to disk.\n"));
  } else {
    lines.push(pc.bold(pc.cyan("\n🔌 Matryoshka MCP Auto-Wiring")));
    lines.push(`  ${pc.dim("•")} ${pc.bold("Target Path:")}  ${result.rootPath}`);
    lines.push(`  ${pc.dim("•")} ${pc.bold("Injected:")}     ${pc.green(result.serverName)} (${result.serverConfig.command} ${result.serverConfig.args.join(" ")})`);
    lines.push(`  ${pc.dim("•")} ${pc.bold("Targets Configured:")}`);

    for (const t of result.targets) {
      const statusBadge =
        t.status === "created"
          ? pc.green("[created]")
          : t.status === "updated"
          ? pc.cyan("[updated]")
          : t.status === "error"
          ? pc.red(`[error: ${t.error || "failed"}]`)
          : pc.dim("[unchanged]");
      lines.push(`    - ${pc.bold(t.name)}: ${t.relativePath} ${statusBadge}`);
    }

    lines.push(pc.green("\n  ✓ Auto-wiring complete. Agent knowledge graph ready.\n"));
  }

  return lines.join("\n");
}
