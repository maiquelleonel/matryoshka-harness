#!/usr/bin/env bun
import * as path from "node:path";
import pc from "picocolors";
import { detectStack } from "./detector";
import type { DetectResult, ProjectStack } from "./types";

const VERSION = "0.1.0";

const HELP_TEXT = `
Matryoshka-Harness CLI (baba / bbyg / matryoshka)

Usage:
  baba detect [path] [--json]
  baba scan [path] [--json]
  baba wrap [path]

Commands:
  detect   Inspect codebase and detect primary stack, frameworks, and test runner
  scan     Execute maturity audit and semantic AST reconciliation
  wrap     Apply adaptive context fence and inject AGENTS.md / SKILLS.md

Options:
  --json         Output strictly valid JSON
  -h, --help     Show help information
  -v, --version  Show version
`.trim();

export function runCli(args: string[] = process.argv.slice(2)): void {
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
      const positional = rest.filter((arg) => !arg.startsWith("-"));
      const targetDir = positional[0] || process.cwd();
      const resolvedPath = path.resolve(targetDir);

      if (isJson) {
        console.log(
          JSON.stringify(
            {
              status: "pending",
              command: "scan",
              rootPath: resolvedPath,
              message: "Maturity scan engine scheduled for Phase 1 (Issue #2)"
            },
            null,
            2
          )
        );
      } else {
        console.log(
          pc.yellow(
            `\n[baba scan] Scheduled for Phase 1 (Issue #2). Inspected path: ${resolvedPath}\n`
          )
        );
      }
      process.exit(0);
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

    default: {
      console.error(pc.red(`Error: Unknown command '${command}'.`));
      console.log(HELP_TEXT);
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  runCli();
}
