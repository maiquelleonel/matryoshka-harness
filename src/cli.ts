#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import { detectStack } from "./detector";
import {
  formatScanHumanOutput,
  formatScanJsonOutput,
  generateHarnessBadgeSvg,
  runMaturityScan,
} from "./scanner";
import { formatMcpWireHumanOutput, wireMcpTargets } from "./mcp";
import type { DetectResult, McpTargetName, ProjectStack } from "./types";

const VERSION = "0.1.0";

const HELP_TEXT = `
Matryoshka-Harness CLI (baba / bbyg / matryoshka)

Usage:
  baba detect [path] [--json]
  baba scan [path] [--json] [--badge [path]]
  baba wrap [path]
  baba mcp wire [path] [--dry-run] [--targets <targets>] [--json]

Commands:
  detect   Inspect codebase and detect primary stack, frameworks, and test runner
  scan     Execute maturity audit and semantic AST reconciliation
  wrap     Apply adaptive context fence and inject AGENTS.md / SKILLS.md
  mcp wire Auto-wire codebase-memory-mcp for Cursor, Gemini CLI, and Claude

Options:
  --json             Output strictly valid JSON
  --dry-run          Simulate execution without modifying files on disk
  --targets <list>   Comma-separated target environments (cursor, gemini, claude)
  --badge [path]     Generate maturity SVG badge (default: ./harness-badge.svg)
  -h, --help         Show help information
  -v, --version      Show version
`.trim();

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const isHelp = args.includes("--help") || args.includes("-h");
  const isVersion = args.includes("--version") || args.includes("-v");
  const isJson = args.includes("--json");

  if (isVersion) {
    console.log(VERSION);
    process.exit(0);
  }

  if (isHelp || args.length === 0) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const [command, ...rest] = args;

  switch (command) {
    case "detect": {
      const positional = rest.filter((arg) => !arg.startsWith("-"));
      const targetDir = positional[0] || process.cwd();
      const resolvedPath = path.resolve(targetDir);

      const stack: ProjectStack = detectStack(resolvedPath);

      if (isJson) {
        const result: DetectResult = {
          status: "success",
          stack: {
            primary: stack.primary,
            frameworks: stack.frameworks,
            testRunner: stack.testRunner,
            archetype: stack.archetype
          },
          rootPath: resolvedPath
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(pc.bold(pc.cyan("\n🪆 Matryoshka Stack Detector")));
        console.log(`  ${pc.dim("•")} ${pc.bold("Root Path:")}   ${resolvedPath}`);
        console.log(`  ${pc.dim("•")} ${pc.bold("Primary:")}     ${pc.green(stack.primary)}`);
        console.log(
          `  ${pc.dim("•")} ${pc.bold("Frameworks:")}  ${
            stack.frameworks.length > 0
              ? stack.frameworks.map((f) => pc.blue(f)).join(", ")
              : pc.dim("none")
          }`
        );
        console.log(
          `  ${pc.dim("•")} ${pc.bold("Test Runner:")} ${
            stack.testRunner ? pc.yellow(stack.testRunner) : pc.dim("none")
          }`
        );
        console.log(`  ${pc.dim("•")} ${pc.bold("Archetype:")}   ${pc.magenta(stack.archetype)}\n`);
      }
      process.exit(0);
      break;
    }

    case "scan": {
      let targetDir: string | undefined;
      let badgePath: string | null = null;
      let isBadge = false;

      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (!arg) continue;
        if (arg === "--json") {
          // Handled via isJson flag
        } else if (arg === "--badge") {
          isBadge = true;
          const next = rest[i + 1];
          if (next && !next.startsWith("-")) {
            badgePath = next;
            i++;
          } else {
            badgePath = "harness-badge.svg";
          }
        } else if (arg.startsWith("--badge=")) {
          isBadge = true;
          badgePath = arg.slice("--badge=".length) || "harness-badge.svg";
        } else if (!arg.startsWith("-")) {
          if (!targetDir) {
            targetDir = arg;
          }
        }
      }

      const resolvedPath = path.resolve(targetDir || process.cwd());

      try {
        const reconciliation = await runMaturityScan(resolvedPath, {
          allowFallback: true,
        });

        let resolvedBadgePath: string | undefined;
        if (isBadge && badgePath) {
          resolvedBadgePath = path.isAbsolute(badgePath)
            ? badgePath
            : path.resolve(resolvedPath, badgePath);

          const badgeSvg = generateHarnessBadgeSvg(reconciliation);
          const badgeDir = path.dirname(resolvedBadgePath);
          if (!fs.existsSync(badgeDir)) {
            fs.mkdirSync(badgeDir, { recursive: true });
          }
          fs.writeFileSync(resolvedBadgePath, badgeSvg, "utf-8");
        }

        if (isJson) {
          const jsonResult = formatScanJsonOutput(reconciliation, resolvedPath, {
            badgePath: resolvedBadgePath,
          });
          console.log(JSON.stringify(jsonResult, null, 2));
        } else {
          console.log(formatScanHumanOutput(reconciliation, resolvedPath, {
            badgePath: resolvedBadgePath,
          }));
        }
        process.exit(0);
      } catch (error: any) {
        if (isJson) {
          console.log(
            JSON.stringify(
              {
                status: "error",
                command: "scan",
                rootPath: resolvedPath,
                message: error?.message || "Maturity scan failed",
              },
              null,
              2
            )
          );
        } else {
          console.error(pc.red(`\nScan failed: ${error?.message || "Unknown error"}\n`));
        }
        process.exit(1);
      }
      break;
    }

    case "wrap": {
      const positional = rest.filter((arg) => !arg.startsWith("-"));
      const targetDir = positional[0] || process.cwd();
      const resolvedPath = path.resolve(targetDir);

      if (isJson) {
        console.log(
          JSON.stringify(
            {
              status: "pending",
              command: "wrap",
              rootPath: resolvedPath,
              message: "Context wrap engine scheduled for Phase 2 (Issue #8)"
            },
            null,
            2
          )
        );
      } else {
        console.log(
          pc.yellow(
            `\n[baba wrap] Scheduled for Phase 2 (Issue #8). Inspected path: ${resolvedPath}\n`
          )
        );
      }
      process.exit(0);
      break;
    }

    case "mcp": {
      const [subcommand, ...mcpArgs] = rest;

      if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
        console.error(pc.red("Error: Missing MCP subcommand. Usage: baba mcp wire [path] [--dry-run] [--json]"));
        process.exit(1);
      }

      if (subcommand !== "wire") {
        console.error(
          pc.red(
            `Error: Unknown subcommand '${subcommand}' for 'mcp'. Usage: baba mcp wire [path] [--dry-run] [--json]`
          )
        );
        process.exit(1);
      }

      const isDryRun = mcpArgs.includes("--dry-run");

      let targets: McpTargetName[] | undefined;
      const targetsIdx = mcpArgs.indexOf("--targets");
      const targetIdx = mcpArgs.indexOf("--target");

      if (targetsIdx !== -1) {
        const nextVal = mcpArgs[targetsIdx + 1];
        if (typeof nextVal === "string" && !nextVal.startsWith("-")) {
          targets = nextVal
            .split(",")
            .map((t) => t.trim().toLowerCase() as McpTargetName)
            .filter(Boolean);
        }
      } else if (targetIdx !== -1) {
        const nextVal = mcpArgs[targetIdx + 1];
        if (typeof nextVal === "string" && !nextVal.startsWith("-")) {
          targets = [nextVal.trim().toLowerCase() as McpTargetName];
        }
      }

      const positional = mcpArgs.filter((arg, idx) => {
        if (arg.startsWith("-")) return false;
        if (idx > 0 && (mcpArgs[idx - 1] === "--targets" || mcpArgs[idx - 1] === "--target")) return false;
        return true;
      });
      const targetDir = positional[0] || process.cwd();
      const resolvedPath = path.resolve(targetDir);

      try {
        const wireResult = wireMcpTargets(resolvedPath, { dryRun: isDryRun, targets });

        if (isJson) {
          console.log(JSON.stringify(wireResult, null, 2));
        } else {
          console.log(formatMcpWireHumanOutput(wireResult));
        }
        process.exit(wireResult.status === "error" ? 1 : 0);
      } catch (error: any) {
        if (isJson) {
          console.log(
            JSON.stringify(
              {
                status: "error",
                command: "mcp wire",
                rootPath: resolvedPath,
                message: error?.message || "MCP wire failed",
              },
              null,
              2
            )
          );
        } else {
          console.error(pc.red(`\nMCP wire failed: ${error?.message || "Unknown error"}\n`));
        }
        process.exit(1);
      }
      break;
    }

    default: {
      console.error(pc.red(`Error: Unknown command '${command}'.`));
      console.log(HELP_TEXT);
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
