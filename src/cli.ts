#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  compileBackendSkill,
  compileDatabaseSkill,
  compileFrontendSkill,
  compileSecuritySkill,
  compileTestingSkill,
  generateAgents,
  inspectTokenBudget,
  MAX_ROOT_AGENTS_TOKENS,
  parseSkillFrontmatter,
  profileArchetype,
  SKILL_DEFINITIONS,
  type SkillName,
} from "./agents";
import { detectStack } from "./detector";
import {
  formatScanHumanOutput,
  formatScanJsonOutput,
  generateHarnessBadgeSvg,
  runMaturityScan,
} from "./scanner";
import { formatMcpWireHumanOutput, wireMcpTargets } from "./mcp";
import { createMatryoshkaMcpServer } from "./mcp-server";
import { evaluateCompositeHarness } from "./scorer";
import {
  formatWrapHumanOutput,
  formatWrapJsonOutput,
  writeDiagnosticReport,
} from "./report";
import type { DetectResult, McpTargetName, ProjectStack } from "./types";

const VERSION = "0.4.0";

const HELP_TEXT = `
Matryoshka-Harness CLI (baba / bbyg / matryoshka)

Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation

Usage:
  baba <command> [arguments] [options]
  bbyg <command> [arguments] [options]
  matryoshka <command> [arguments] [options]

Aliases:
  baba        Canonical ergonomic CLI command (short, fast, zero typos)
  bbyg        Mythological Baba-Yaga alias
  matryoshka  Formal package identity alias

Command Groups:
  Reconnaissance & Maturity Audit:
    detect [path]                     Inspect codebase and detect primary stack, frameworks, and test runner
    scan [path]                       Execute maturity audit (L0-L4) and semantic AST reconciliation via harness-score

  Governance & Context-Fencing:
    agents generate [path]            Generate lean root AGENTS.md (<200 tokens) and modular skills (.agents/skills/)
    agents profile [path]             Profile repository archetype and discover architectural seams (API, DB, UI)
    agents check [path]               Audit AGENTS.md token budget (<250 tokens guardrail to prevent context rot)
    agents skill <name> [path]        Compile and output on-demand domain skill (backend, database, frontend, security, testing)

  Antipattern Remediation & Quality Gates:
    wrap [path]                       Analyze AST antipatterns and compile DIAGNOSTIC.md remediation report

  Agent Context Autowiring & Model Context Protocol:
    mcp wire [path]                   Auto-wire codebase-memory-mcp into Cursor (.cursor/mcp.json), Gemini, and Claude
    mcp serve [path]                  Start native Model Context Protocol (MCP) server over stdio for AI coding agents

Global Options:
  -h, --help                          Show help information for CLI or specific command
  -v, --version                       Show version
  --json                              Output strictly valid JSON for automation and AI orchestrators

Command Options:
  Audit & Remediation Options (scan, wrap):
    --badge [path]                    Generate maturity SVG badge (default: ./harness-badge.svg)
    -o, --output <file>               Custom output report path (default: ./DIAGNOSTIC.md)
    --strict                          Enforce strict CI quality gate (exit 1 on score < threshold or critical violations)
    --threshold <num>                 Minimum acceptable Harness² composite score for strict gate (default: 80)
    --max-file-size <kb>              Maximum file size in KB to parse for AST traversal (default: 500)

  Governance Generation Options (agents):
    -f, --force                       Overwrite existing files (creates atomic .bak backup of AGENTS.md)
    --dry-run                         Simulate execution without modifying files on disk
    --max-tokens <num>                Maximum token budget ceiling for root AGENTS.md (default: 250)

  MCP Configuration Options (mcp wire):
    --targets <list>                  Comma-separated target environments (cursor, gemini, claude; default: all)
    --dry-run                         Preview configuration changes without modifying files on disk

Actionable Examples:
  baba detect                         # Inspect tech stack of current directory
  baba scan --badge                   # Run maturity scan and generate harness-badge.svg
  baba agents generate --force        # Scaffold adaptive AGENTS.md and active skills
  baba agents check                   # Verify AGENTS.md is within 250-token budget
  baba wrap --strict --threshold 80   # CI quality gate blocking antipatterns and critical AST issues
  baba mcp wire --targets cursor      # Wire codebase knowledge graph into Cursor IDE
`.trim();

const DETECT_HELP_TEXT = `
Usage: baba detect [path] [options]

Inspect codebase and detect primary stack, frameworks, and test runner.

Arguments:
  [path]             Target directory to inspect (default: current working directory)

Options:
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  baba detect
  baba detect ./services/api --json
`.trim();

const SCAN_HELP_TEXT = `
Usage: baba scan [path] [options]

Execute maturity audit (L0-L4) and semantic AST reconciliation via harness-score.

Arguments:
  [path]             Target directory to scan (default: current working directory)

Options:
  --badge [path]     Generate maturity SVG badge (default: ./harness-badge.svg)
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  baba scan
  baba scan --badge
  baba scan --badge ./docs/badges/maturity.svg --json
`.trim();

const AGENTS_HELP_TEXT = `
Usage: baba agents <subcommand> [path] [options]

Generate adaptive AGENTS.md and modular skills (.agents/skills/) to prevent context rot.

Subcommands:
  generate [path]             Generate lean root AGENTS.md and modular skills
  profile [path]              Profile repository archetype and architectural seams
  check [path]                Audit AGENTS.md token budget (<250 tokens guardrail)
  skill <name> [path]         Compile and output specialized skill (backend, database, frontend, security, testing)

Options:
  -f, --force                 Overwrite existing files (creates atomic .bak backup)
  --dry-run                   Simulate execution without modifying files on disk
  --max-tokens <num>          Custom token budget ceiling for root AGENTS.md (default: 250)
  --strict                    Enforce strict token guardrail (fail if > max-tokens)
  --json                      Output strictly valid JSON
  -h, --help                  Show help information

Examples:
  baba agents generate --force
  baba agents profile
  baba agents check --max-tokens 200
  baba agents skill backend
`.trim();

const WRAP_HELP_TEXT = `
Usage: baba wrap [path] [options]

Analyze AST antipatterns and compile DIAGNOSTIC.md remediation report.

Arguments:
  [path]                      Target directory to analyze (default: current working directory)

Options:
  -o, --output <file>         Custom output report path (default: ./DIAGNOSTIC.md)
  --strict                    Enforce strict CI quality gate (exit 1 on score < threshold or critical violations)
  --threshold <num>           Minimum acceptable Harness² composite score for strict gate (default: 80)
  --max-file-size <kb>        Maximum file size in KB to parse for AST traversal (default: 500)
  --dry-run                   Preview remediation report without writing to disk
  --json                      Output strictly valid JSON
  -h, --help                  Show help information

Examples:
  baba wrap
  baba wrap --strict --threshold 85
  baba wrap -o ./reports/DIAGNOSTIC.md --dry-run
  baba wrap --strict --json
`.trim();

const MCP_HELP_TEXT = `
Usage: baba mcp <wire|serve> [path] [options]

Manage Model Context Protocol (MCP) autowiring and stdio server execution.

Subcommands:
  wire [path]                 Auto-wire codebase-memory-mcp into Cursor, Gemini CLI, and Claude
  serve [path]                Start native Model Context Protocol (MCP) server over stdio

Options:
  -h, --help                  Show help information

Run 'baba mcp <subcommand> --help' for details on a specific subcommand.
`.trim();

const MCP_WIRE_HELP_TEXT = `
Usage: baba mcp wire [path] [options]

Auto-wire codebase-memory-mcp for Cursor, Gemini CLI, and Claude Code.

Arguments:
  [path]                      Root repository path to configure (default: current working directory)

Options:
  --targets <list>            Comma-separated target environments (cursor, gemini, claude; default: all)
  --dry-run                   Simulate configuration updates without writing to disk
  --json                      Output strictly valid JSON
  -h, --help                  Show help information

Examples:
  baba mcp wire
  baba mcp wire --targets cursor,claude
  baba mcp wire --dry-run --json
`.trim();

const MCP_SERVE_HELP_TEXT = `
Usage: baba mcp serve [path]

Start native Model Context Protocol (MCP) server over stdio for AI coding agents.

Arguments:
  [path]   Root repository path to serve (defaults to current working directory)

Stream Guarantees:
  stdout   Strictly reserved for newline-delimited JSON-RPC 2.0 protocol messages
  stderr   Diagnostic telemetry, startup notices, and logging
`.trim();

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const isVersion = args.includes("--version") || args.includes("-v");
  const isJson = args.includes("--json");

  if (isVersion) {
    console.log(VERSION);
    process.exit(0);
  }

  // Support "help <subcommand>" syntax
  if (args[0] === "help") {
    if (args.length === 1) {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    args = [...args.slice(1), "--help"];
  }

  const isHelp = args.includes("--help") || args.includes("-h");

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const [command, ...rest] = args;

  switch (command) {
    case "detect": {
      if (isHelp) {
        console.log(DETECT_HELP_TEXT);
        process.exit(0);
      }

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
      if (isHelp) {
        console.log(SCAN_HELP_TEXT);
        process.exit(0);
      }

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

    case "agents": {
      if (isHelp) {
        console.log(AGENTS_HELP_TEXT);
        process.exit(0);
      }

      const isForce = rest.includes("--force") || rest.includes("-f");
      const isDryRun = rest.includes("--dry-run");
      const isStrict = rest.includes("--strict") || rest.includes("--strict-token-guard");

      let maxTokens: number | undefined;
      const positional: string[] = [];
      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (!arg) continue;
        if (arg === "--max-tokens") {
          const nextVal = rest[i + 1];
          if (nextVal && !nextVal.startsWith("-")) {
            maxTokens = Number.parseInt(nextVal, 10);
            i++;
          }
        } else if (arg.startsWith("--max-tokens=")) {
          maxTokens = Number.parseInt(arg.slice("--max-tokens=".length), 10);
        } else if (arg.startsWith("-")) {
          // flag, ignore
        } else {
          positional.push(arg);
        }
      }

      let subcommand = "generate";
      let targetDir: string | undefined;
      let skillArg: string | undefined;

      if (
        positional[0] === "skill" ||
        positional[0] === "skills"
      ) {
        subcommand = positional[0];
        skillArg = positional[1];
        targetDir = positional[2] || process.cwd();
      } else if (
        positional[0] === "generate" ||
        positional[0] === "profile" ||
        positional[0] === "seams" ||
        positional[0] === "check" ||
        positional[0] === "guard"
      ) {
        subcommand = positional[0];
        targetDir = positional[1] || process.cwd();
      } else {
        targetDir = positional[0] || process.cwd();
      }

      const resolvedPath = path.resolve(targetDir);

      if (subcommand === "skill" || subcommand === "skills") {
        if (!skillArg) {
          if (isJson) {
            console.log(
              JSON.stringify(
                {
                  status: "error",
                  command: "agents skill",
                  rootPath: resolvedPath,
                  message:
                    "Skill name is required (e.g. backend, database, frontend, security, testing)",
                },
                null,
                2
              )
            );
          } else {
            console.error(
              pc.red(
                "\nError: Missing skill name. Usage: baba agents skill <name> [path] [--json]\n"
              )
            );
          }
          process.exit(1);
        }

        const normalizedSkill =
          skillArg === "test" || skillArg === "testing" || skillArg === "skill-testing"
            ? "skill-testing"
            : skillArg.startsWith("skill-")
            ? skillArg
            : `skill-${skillArg}`;

        let content = "";
        if (normalizedSkill === "skill-backend") {
          content = compileBackendSkill({ projectPath: resolvedPath });
        } else if (normalizedSkill === "skill-database") {
          content = compileDatabaseSkill({ projectPath: resolvedPath });
        } else if (normalizedSkill === "skill-frontend") {
          content = compileFrontendSkill({ projectPath: resolvedPath });
        } else if (normalizedSkill === "skill-security") {
          content = compileSecuritySkill({ projectPath: resolvedPath });
        } else if (normalizedSkill === "skill-testing") {
          content = compileTestingSkill({ projectPath: resolvedPath });
        } else {
          if (isJson) {
            console.log(
              JSON.stringify(
                {
                  status: "error",
                  command: "agents skill",
                  rootPath: resolvedPath,
                  message: `Unknown skill '${skillArg}'. Available: backend, database, frontend, security, testing`,
                },
                null,
                2
              )
            );
          } else {
            console.error(
              pc.red(
                `\nError: Unknown skill '${skillArg}'. Available: backend, database, frontend, security, testing\n`
              )
            );
          }
          process.exit(1);
        }

        const frontmatter = parseSkillFrontmatter(content);
        if (isJson) {
          console.log(
            JSON.stringify(
              {
                status: "success",
                skill: normalizedSkill,
                rootPath: resolvedPath,
                frontmatter,
                content,
              },
              null,
              2
            )
          );
        } else {
          console.log(content);
        }
        process.exit(0);
      }

      if (subcommand === "check" || subcommand === "guard") {
        const agentsFilePath = path.join(resolvedPath, "AGENTS.md");
        const effectiveMaxTokens = maxTokens ?? MAX_ROOT_AGENTS_TOKENS;

        if (!fs.existsSync(agentsFilePath)) {
          if (isJson) {
            console.log(
              JSON.stringify(
                {
                  status: "error",
                  command: "agents check",
                  valid: false,
                  rootPath: resolvedPath,
                  message: `AGENTS.md not found at ${agentsFilePath}`,
                },
                null,
                2
              )
            );
          } else {
            console.error(pc.red(`\nError: AGENTS.md not found at ${agentsFilePath}\n`));
          }
          process.exit(1);
        }

        const fileContent = fs.readFileSync(agentsFilePath, "utf-8");
        const report = inspectTokenBudget(fileContent, effectiveMaxTokens);

        if (isJson) {
          console.log(
            JSON.stringify(
              {
                status: report.withinBudget ? "success" : "error",
                command: "agents check",
                valid: report.withinBudget,
                rootPath: resolvedPath,
                tokenGuard: report,
                token_guard: report,
              },
              null,
              2
            )
          );
        } else {
          console.log(pc.bold(pc.cyan("\n🪆 Matryoshka AGENTS.md Token Guard Audit")));
          console.log(`  ${pc.dim("•")} ${pc.bold("File:")}      ${agentsFilePath}`);
          console.log(
            `  ${pc.dim("•")} ${pc.bold("Status:")}    ${
              report.withinBudget
                ? pc.green("PASSED (within budget)")
                : pc.red(`FAILED (exceeded by ${report.exceededBy} tokens)`)
            }`
          );
          console.log(
            `  ${pc.dim("•")} ${pc.bold("Tokens:")}    ${
              report.withinBudget
                ? pc.green(report.tokenCount.toString())
                : pc.red(report.tokenCount.toString())
            } / ${report.maxTokens} (target: <${report.targetTokens})`
          );
          console.log(
            `  ${pc.dim("•")} ${pc.bold("Savings:")}   ${pc.green(
              `${report.savingsPercentage}% vs monolithic instructions`
            )}\n`
          );
        }
        process.exit(report.withinBudget ? 0 : 1);
      }

      if (subcommand === "profile" || subcommand === "seams") {
        try {
          const profile = profileArchetype(resolvedPath);
          if (isJson) {
            console.log(JSON.stringify(profile, null, 2));
          } else {
            console.log(pc.bold(pc.cyan("\n🪆 Matryoshka Archetype Profiler & Seam Discovery")));
            console.log(`  ${pc.dim("•")} ${pc.bold("Root Path:")}     ${resolvedPath}`);
            console.log(`  ${pc.dim("•")} ${pc.bold("Archetype:")}     ${pc.magenta(profile.archetype)}`);
            console.log(`  ${pc.dim("•")} ${pc.bold("Runtime:")}       ${profile.runtime} (${profile.packageManager})`);
            console.log(`  ${pc.dim("•")} ${pc.bold("Test Runner:")}   ${profile.testCommand}`);
            console.log(`  ${pc.dim("•")} ${pc.bold("Build / Lint:")}  ${profile.buildCommand} | ${profile.lintCommand}`);
            console.log(`  ${pc.dim("•")} ${pc.bold("Active Skills:")} ${profile.activeSkills.join(", ")}`);
            console.log(pc.bold(pc.cyan("  Discovered Seams:")));
            console.log(
              `    ${pc.dim("•")} Backend:   ${profile.seams.hasBackend ? pc.green("yes") : pc.dim("no")} (${profile.seams.routes.length} routes, ${profile.seams.controllers.length} controllers, ${profile.seams.services.length} services)`
            );
            console.log(
              `    ${pc.dim("•")} Database:  ${profile.seams.hasDatabase ? pc.green("yes") : pc.dim("no")} (${profile.seams.models.length} models)`
            );
            console.log(
              `    ${pc.dim("•")} Frontend:  ${profile.seams.hasFrontend ? pc.green("yes") : pc.dim("no")} (${profile.seams.views.length} views)`
            );
            console.log(
              `    ${pc.dim("•")} Testing:   ${profile.seams.hasTesting ? pc.green("yes") : pc.dim("no")} (${profile.seams.tests.length} tests)`
            );
            console.log(
              `    ${pc.dim("•")} Security:  ${profile.seams.hasSecurity ? pc.green("yes") : pc.dim("no")}\n`
            );
          }
          process.exit(0);
        } catch (error: any) {
          if (isJson) {
            console.log(
              JSON.stringify(
                {
                  status: "error",
                  command: "agents profile",
                  rootPath: resolvedPath,
                  message: error?.message || "Archetype profiling failed",
                },
                null,
                2
              )
            );
          } else {
            console.error(pc.red(`\nProfiling failed: ${error?.message || "Unknown error"}\n`));
          }
          process.exit(1);
        }
      }

      try {
        const result = generateAgents(resolvedPath, {
          force: isForce,
          dryRun: isDryRun,
          json: isJson,
          maxTokens,
          strictTokenGuard: isStrict,
        });

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(pc.bold(pc.cyan("\n🪆 Matryoshka Adaptive Agents Generator")));
          console.log(`  ${pc.dim("•")} ${pc.bold("Root Path:")}     ${resolvedPath}`);
          console.log(`  ${pc.dim("•")} ${pc.bold("Archetype:")}     ${pc.magenta(result.archetype)}`);
          console.log(
            `  ${pc.dim("•")} ${pc.bold("Root AGENTS:")}   ${pc.green(result.rootAgentsPath)} (${pc.yellow(result.rootTokens.toString())} tokens)`
          );
          if (result.backupCreated && result.backupPath) {
            console.log(
              `  ${pc.dim("•")} ${pc.bold("Backup:")}        ${pc.yellow(result.backupPath)}`
            );
          }
          console.log(`  ${pc.dim("•")} ${pc.bold("Skills Dir:")}    ${pc.blue(result.skillsDir)}`);
          console.log(pc.bold(pc.cyan("  Planned / Generated Files:")));
          for (const file of result.plannedFiles) {
            console.log(`    ${pc.dim("•")} ${pc.green(file.path)} (${pc.yellow(file.tokens.toString())} tokens)`);
          }
          console.log(
            `  ${pc.dim("•")} ${pc.bold("Token Savings:")} ${pc.green(
              `${result.estimatedTokenSavings.savedTokens} tokens (${result.estimatedTokenSavings.savingsPercentage}%)`
            )}\n`
          );
        }
        process.exit(0);
      } catch (error: any) {
        if (isJson) {
          console.log(
            JSON.stringify(
              {
                status: "error",
                command: "agents",
                rootPath: resolvedPath,
                message: error?.message || "Agents generation failed",
              },
              null,
              2
            )
          );
        } else {
          console.error(pc.red(`\nGeneration failed: ${error?.message || "Unknown error"}\n`));
        }
        process.exit(1);
      }
      break;
    }

    case "wrap": {
      if (isHelp) {
        console.log(WRAP_HELP_TEXT);
        process.exit(0);
      }

      let isStrict = rest.includes("--strict");
      let isDryRun = rest.includes("--dry-run");
      let targetDir: string | undefined;
      let outputPath: string | undefined;
      let threshold: number | undefined;
      let maxFileSizeKb: number | undefined;

      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (!arg) continue;

        if (arg === "--json" || arg === "--strict" || arg === "--dry-run") {
          // Handled via flags
        } else if (arg === "--output" || arg === "-o") {
          const nextVal = rest[i + 1];
          if (nextVal && !nextVal.startsWith("-")) {
            outputPath = nextVal;
            i++;
          }
        } else if (arg.startsWith("--output=")) {
          outputPath = arg.slice("--output=".length);
        } else if (arg.startsWith("-o=")) {
          outputPath = arg.slice("-o=".length);
        } else if (arg === "--threshold") {
          const nextVal = rest[i + 1];
          if (nextVal && !nextVal.startsWith("-")) {
            const parsed = Number.parseInt(nextVal, 10);
            if (!Number.isNaN(parsed)) threshold = parsed;
            i++;
          }
        } else if (arg.startsWith("--threshold=")) {
          const parsed = Number.parseInt(arg.slice("--threshold=".length), 10);
          if (!Number.isNaN(parsed)) threshold = parsed;
        } else if (arg === "--max-file-size") {
          const nextVal = rest[i + 1];
          if (nextVal && !nextVal.startsWith("-")) {
            const parsed = Number.parseInt(nextVal, 10);
            if (!Number.isNaN(parsed)) maxFileSizeKb = parsed;
            i++;
          }
        } else if (arg.startsWith("--max-file-size=")) {
          const parsed = Number.parseInt(arg.slice("--max-file-size=".length), 10);
          if (!Number.isNaN(parsed)) maxFileSizeKb = parsed;
        } else if (arg.startsWith("-")) {
          // Unrecognized flag - ignore
        } else {
          if (!targetDir) {
            targetDir = arg;
          }
        }
      }

      const resolvedPath = path.resolve(targetDir || process.cwd());

      try {
        const evaluationResult = await evaluateCompositeHarness(resolvedPath, {
          threshold: threshold ?? 80,
          astOptions: {
            maxFileSizeKb: maxFileSizeKb ?? 500,
          },
        });

        const writeResult = await writeDiagnosticReport(resolvedPath, evaluationResult, {
          outputPath,
          dryRun: isDryRun,
          atomic: true,
        });

        if (isJson) {
          const jsonOutput = formatWrapJsonOutput(evaluationResult, {
            reportPath: writeResult.reportPath,
            written: writeResult.written,
          });
          console.log(JSON.stringify(jsonOutput, null, 2));
        } else {
          console.log(formatWrapHumanOutput(evaluationResult, writeResult));
        }

        if (isStrict && !evaluationResult.passedStrict) {
          let failureMsg = `Strict mode failed: Composite score (${evaluationResult.compositeScore}) is below threshold (${evaluationResult.threshold}).`;
          if (evaluationResult.hasCriticalViolations && !evaluationResult.passedThreshold) {
            failureMsg = `Strict mode failed: Composite score (${evaluationResult.compositeScore}) is below threshold (${evaluationResult.threshold}) and critical AST violations were detected.`;
          } else if (evaluationResult.hasCriticalViolations) {
            failureMsg = `Strict mode failed: Critical AST violations detected (${evaluationResult.ast.bySeverity.critical} critical).`;
          }

          if (isJson) {
            console.error(pc.red(failureMsg));
          } else {
            console.error(pc.red(`\n❌ ${failureMsg}\n`));
          }
          process.exit(1);
        }

        process.exit(0);
      } catch (error: any) {
        if (isJson) {
          console.log(
            JSON.stringify(
              {
                status: "error",
                command: "wrap",
                projectPath: resolvedPath,
                project_path: resolvedPath,
                message: error?.message || "Wrap command failed",
              },
              null,
              2
            )
          );
        } else {
          console.error(pc.red(`\nWrap failed: ${error?.message || "Unknown error"}\n`));
        }
        process.exit(1);
      }
      break;
    }

    case "mcp": {
      const [subcommand, ...mcpArgs] = rest;

      if (!subcommand) {
        if (isHelp) {
          console.log(MCP_HELP_TEXT);
          process.exit(0);
        }
        console.error(pc.red("Error: Missing MCP subcommand. Usage: baba mcp <wire|serve> [path] [--dry-run] [--json]"));
        process.exit(1);
      }

      if (subcommand === "--help" || subcommand === "-h") {
        console.log(MCP_HELP_TEXT);
        process.exit(0);
      }

      if (subcommand === "serve") {
        if (mcpArgs.includes("--help") || mcpArgs.includes("-h")) {
          console.log(MCP_SERVE_HELP_TEXT);
          process.exit(0);
        }

        const positional = mcpArgs.filter((arg) => !arg.startsWith("-"));
        const targetDir = positional[0] || process.cwd();
        const resolvedPath = path.resolve(targetDir);

        const server = createMatryoshkaMcpServer(resolvedPath);
        server.listenStdio();
        return;
      }

      if (subcommand === "wire") {
        if (mcpArgs.includes("--help") || mcpArgs.includes("-h")) {
          console.log(MCP_WIRE_HELP_TEXT);
          process.exit(0);
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

        for (const arg of mcpArgs) {
          if (arg.startsWith("--targets=")) {
            const val = arg.slice("--targets=".length);
            targets = val
              .split(",")
              .map((t) => t.trim().toLowerCase() as McpTargetName)
              .filter(Boolean);
          } else if (arg.startsWith("--target=")) {
            const val = arg.slice("--target=".length);
            targets = [val.trim().toLowerCase() as McpTargetName];
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
      }

      console.error(
        pc.red(
          `Error: Unknown subcommand '${subcommand}' for 'mcp'. Usage: baba mcp <wire|serve> [path] [--dry-run] [--json]`
        )
      );
      process.exit(1);
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
