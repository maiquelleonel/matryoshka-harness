#!/usr/bin/env bun
/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  compileBackendSkill,
  compileDatabaseSkill,
  compileFrontendSkill,
  compileSecuritySkill,
  compileTestingSkill,
  auditCognitiveContext,
  formatCognitiveAuditHumanOutput,
  generateAgents,
  inspectTokenBudget,
  MAX_ROOT_AGENTS_TOKENS,
  migrateLegacyInstructions,
  parseSkillFrontmatter,
  profileArchetype,
  SKILL_DEFINITIONS,
  type SkillName,
} from "./agents";
import {
  formatArchetypeProfileReview,
  runInteractiveSkillSelector,
  promptInteractiveSkillSelection,
  isHeadlessEnvironment,
  shouldRunInteractivePrompt,
} from "./agents-tui";
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

function resolveCliVersion(): string {
  try {
    // Procura o package.json relativo ao dist ou src
    for (const relPath of ["../package.json", "../../package.json", "./package.json"]) {
      const target = path.resolve(__dirname, relPath);
      if (fs.existsSync(target)) {
        const pkg = JSON.parse(fs.readFileSync(target, "utf-8"));
        if (pkg.name === "@maiquelleonel/matryoshka" && pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch {}
  return "0.21.1";
}

const VERSION = resolveCliVersion();

const HELP_TEXT = `
Matryoshka-Harness CLI (baba / bbyg / matryoshka)

Concentric Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation

Usage:
  baba detect [path] [--json]
  baba scan [path] [--json] [--badge [path]]
  baba agents generate [path] [--ci] [--force] [--dry-run] [--interactive] [--yes] [--json]
  baba agents profile [path] [--json]
  baba agents check [path] [--json] [--max-tokens <num>]
  baba agents audit [path] [--strict] [--json]
  baba agents migrate [path] [--from <file>] [--force] [--dry-run] [--json]
  baba agents skill <name> [path] [--json]
  baba wrap [path] [--output <file>] [--strict] [--threshold <num>] [--dry-run] [--json]
  baba mcp wire [path] [--dry-run] [--targets <targets>] [--json]
  baba mcp serve [path]

Commands:
  detect     Inspect codebase and detect primary stack, frameworks, and test runner
  scan       Execute maturity audit and semantic AST reconciliation
  agents     Generate adaptive AGENTS.md and modular skills
  wrap       Analyze AST antipatterns and compile DIAGNOSTIC.md remediation report
  mcp wire   Auto-wire codebase-memory-mcp for Cursor, Gemini CLI, and Claude
  mcp serve  Start native Model Context Protocol (MCP) server over stdio

Options:
  --force, -f        Overwrite existing files (creates .bak of pre-existing AGENTS.md)
  --dry-run          Simulate execution without modifying files on disk
  --interactive, -i  Launch interactive terminal UI to review stack and select skills
  --yes, -y          Bypass interactive prompts and apply recommended defaults non-interactively
  --json             Output strictly valid JSON
  --targets <list>   Comma-separated target environments (cursor, gemini, claude)
  --badge [path]     Generate maturity SVG badge (default: ./harness-badge.svg)
  --output <file>, -o Custom output report path (default: ./DIAGNOSTIC.md)
  --strict           Enforce strict CI quality gate (exit 1 on score < threshold or critical violations)
  --threshold <num>  Minimum acceptable Harness² composite score for strict gate (default: 80)
  --max-file-size    Maximum file size in KB to parse for AST traversal (default: 500)
  --include-tests    Include test suites and test files in AST and scan evaluations
  --exclude <list>   Comma-separated or repeated glob patterns to exclude from evaluation
  -h, --help         Show help information
  -v, --version      Show version

Aliases:
  baba               Slavic matriarch of nesting dolls (4 letters, zero typos)
  bbyg               Baba-Yaga mythology (silicon wizardry)
  matryoshka         Formal academic package name
`.trim();

const DETECT_HELP = `
Usage: baba detect [path] [--json]

Inspect codebase and detect primary stack, frameworks, and test runner.

Arguments:
  [path]             Target project directory (default: current directory)

Options:
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  $ baba detect
  $ baba detect ./my-project --json
`.trim();

const SCAN_HELP = `
Usage: baba scan [path] [--json] [--badge [path]]

Execute repository maturity audit (L0 to L4) and semantic AST reconciliation.

Arguments:
  [path]             Target project directory (default: current directory)

Options:
  --badge [path]     Generate maturity SVG badge (default: ./harness-badge.svg)
  --include-tests    Include test suites in scan evaluation
  --exclude <list>   Exclude files or directories matching comma-separated glob patterns
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  $ baba scan
  $ baba scan --badge
  $ baba scan ./project --json --badge ./badges/harness.svg
`.trim();

const AGENTS_HELP = `
Usage: baba agents <command> [path] [options]

Adaptive Context-Aware AGENTS.md Compiler & Modular Skills Engine.

Commands:
  baba agents generate [path]   Generate ultra-lean root AGENTS.md (< 200 tokens) & on-demand skills
  baba agents migrate [path]    Non-destructive migration of monolithic instructions into modular skills
  baba agents profile [path]    Inspect architectural seams and profile archetype governance
  baba agents check [path]      Audit AGENTS.md token budget (< 250 tokens hard limit)
  baba agents audit [path]      Static cognitive context linter for root AGENTS.md & modular skills
  baba agents skill <name> [path] Render compiled on-demand skill (backend, frontend, database, security, testing)

Options:
  --interactive, -i  Launch interactive terminal UI to review stack and select skills
  --yes, -y          Bypass interactive prompts and apply recommended defaults non-interactively
  --from <file>      Source legacy instruction file (default: AGENTS.md)
  --force, -f        Overwrite existing AGENTS.md (creates .bak backup)
  --dry-run          Simulate execution without modifying files on disk
  --strict           Enforce strict CI quality gate (exit 1 on FAIL violation or score < 80)
  --max-tokens <num> Maximum token limit for check / audit (default: 250)
  --include-tests    Include test files in cognitive context audit
  --exclude <list>   Exclude files or directories matching comma-separated glob patterns
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  $ baba agents generate --interactive
  $ baba agents generate --yes
  $ baba agents generate -y
  $ baba agents generate --dry-run
  $ baba agents generate --force
  $ baba agents migrate --from=.cursorrules --dry-run
  $ baba agents migrate --from=CLAUDE.md
  $ baba agents check
  $ baba agents audit
  $ baba agents audit --strict
  $ baba agents audit ./project --json
  $ baba agents skill backend --json
`.trim();

const MIGRATE_HELP = `
Usage: baba agents migrate [path] [options]

Non-destructive legacy instructions migration engine into modular skills.

Arguments:
  [path]             Target directory or source file (default: current working directory)

Options:
  --from <file>      Source legacy instruction file (e.g. .cursorrules, CLAUDE.md) (default: AGENTS.md)
  --dry-run          Simulate execution and token metrics without mutating files on disk
  --force, -f        Overwrite existing backup snapshot and target files
  --max-tokens <num> Maximum token limit for compiled root AGENTS.md (default: 200)
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  $ baba agents migrate
  $ baba agents migrate --dry-run
  $ baba agents migrate --from=.cursorrules --dry-run
  $ baba agents migrate --from=CLAUDE.md
  $ baba agents migrate ./legacy-project --from=.cursorrules --dry-run
  $ baba agents migrate --from=.cursorrules --json
`.trim();

const AUDIT_HELP = `
Usage: baba agents audit [path] [options]

Static cognitive context linter & Turn-Zero prompt simulator for AI coding agents.

Arguments:
  [path]             Target project directory or file (default: current directory)

Options:
  --strict           Enforce strict CI quality gate (exit 1 on FAIL violation or score < 80)
  --include-tests    Include test files in cognitive context audit
  --exclude <list>   Exclude files or directories matching comma-separated glob patterns
  --json             Output strictly valid JSON
  --max-tokens <num> Maximum token limit for budget rule (default: 250)
  -h, --help         Show help information

Cognitive Antipattern Rules Enforced:
  • token-budget           Turn-Zero budget ceiling (warn > 200, fail > 250)
  • dead-skills            Dead link detector for missing files in .agents/skills/
  • negative-phrasing-trap Pink Elephant Paradox guard for excessive negative keywords
  • permissive-leak        Wishy-washy language detector in imperative directives
  • greedy-preload         Large raw code/schema dumps detector (> 25 lines)

Examples:
  $ baba agents audit
  $ baba agents audit --strict
  $ baba agents audit ./project --json
`.trim();

const WRAP_HELP = `
Usage: baba wrap [path] [options]

Polyglot AST anti-pattern scanner & remediation report powered by Tree-sitter WASM.

Arguments:
  [path]             Target project directory (default: current directory)

Options:
  --output <file>, -o Custom output report path (default: ./DIAGNOSTIC.md)
  --strict           Enforce strict CI quality gate (exit 1 on score < threshold or critical violations)
  --threshold <num>  Minimum acceptable Harness² composite score for strict gate (default: 80)
  --max-file-size    Maximum file size in KB to parse for AST traversal (default: 500)
  --include-tests    Include test directories and test files in AST evaluation
  --exclude <list>   Exclude files or directories matching comma-separated glob patterns
  --dry-run          Simulate execution without writing report to disk
  --json             Output strictly valid JSON
  -h, --help         Show help information

Anti-Pattern Rules Enforced:
  • raw-sql             Detects unparameterized SQL interpolation / injection (CWE-89)
  • assertionless-test  Detects test functions missing behavioral assertions (requires --include-tests)
  • hardcoded-credential Detects plaintext secrets, private keys, and tokens

Examples:
  $ baba wrap
  $ baba wrap --strict --threshold 85
  $ baba wrap ./service -o ./REMEDIATION.md --json
`.trim();

const MCP_HELP = `
Usage: baba mcp <command> [path] [options]

Model Context Protocol (MCP) integrations for AI coding agents.

Commands:
  baba mcp wire [path]   Auto-wire codebase-memory-mcp configuration for Cursor, Gemini, and Claude
  baba mcp serve [path]  Start native Model Context Protocol (MCP) server over stdio

Options:
  --targets <list>   Comma-separated target environments (cursor, gemini, claude)
  --dry-run          Preview changes without writing to disk
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  $ baba mcp wire
  $ baba mcp wire --targets cursor,claude
  $ baba mcp serve
`.trim();

const MCP_WIRE_HELP = `
Usage: baba mcp wire [path] [options]

Auto-wire codebase-memory-mcp configuration for Cursor, Gemini CLI, and Claude.

Arguments:
  [path]             Target project directory (default: current directory)

Options:
  --targets <list>   Comma-separated target environments: cursor, gemini, claude (default: all)
  --target <name>    Singular alias for single target isolation
  --dry-run          Preview configuration changes without writing to disk
  --json             Output strictly valid JSON
  -h, --help         Show help information

Examples:
  $ baba mcp wire
  $ baba mcp wire --targets cursor,claude
  $ baba mcp wire --dry-run --json
`.trim();

/**
 * Parses comma-separated and repeated --exclude flags into a list of glob patterns.
 */
export function parseExcludeFlags(args: string[]): string[] {
  const patterns: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--exclude") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        const parts = next
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
          .filter(Boolean);
        patterns.push(...parts);
        i++;
      }
    } else if (arg.startsWith("--exclude=")) {
      const val = arg.slice("--exclude=".length);
      const parts = val
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
        .filter(Boolean);
      patterns.push(...parts);
    }
  }
  return patterns;
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const isHelp = args.includes("--help") || args.includes("-h");
  const isVersion = args.includes("--version") || args.includes("-v");
  const isJson = args.includes("--json");

  if (isVersion) {
    console.log(VERSION);
    process.exit(0);
  }

  // Handle "help <subcommand>" syntax
  if (args[0] === "help") {
    const sub = args[1];
    if (!sub) {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    args = [sub, "--help", ...args.slice(2)];
  }

  if (args.length === 0 || (isHelp && (args.length === 1 || args[0] === "--help" || args[0] === "-h"))) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const [command, ...rest] = args;

  switch (command) {
    case "baba":
    case "bbyg":
    case "matryoshka":
    case "matrioska":
    case "matryoska": {
      return runCli(rest);
    }

    case "audit": {
      return runCli(["agents", "audit", ...rest]);
    }

    case "detect": {
      if (rest.includes("--help") || rest.includes("-h") || rest.includes("help")) {
        console.log(DETECT_HELP);
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
      if (rest.includes("--help") || rest.includes("-h") || rest.includes("help")) {
        console.log(SCAN_HELP);
        process.exit(0);
      }
      let targetDir: string | undefined;
      let badgePath: string | null = null;
      let isBadge = false;
      let includeTests = rest.includes("--include-tests");
      const excludePatterns: string[] = [];

      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (!arg) continue;
        if (arg === "--json" || arg === "--include-tests") {
          // Handled via flags
        } else if (arg === "--exclude") {
          const next = rest[i + 1];
          if (next && !next.startsWith("-")) {
            const parts = next
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
              .filter(Boolean);
            excludePatterns.push(...parts);
            i++;
          }
        } else if (arg.startsWith("--exclude=")) {
          const val = arg.slice("--exclude=".length);
          const parts = val
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
            .filter(Boolean);
          excludePatterns.push(...parts);
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
          includeTests,
          exclude: excludePatterns,
          excludePatterns,
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
      if (rest.includes("migrate") && (rest.includes("--help") || rest.includes("-h") || rest.includes("help"))) {
        console.log(MIGRATE_HELP);
        process.exit(0);
      }
      if (rest.includes("audit") && (rest.includes("--help") || rest.includes("-h") || rest.includes("help"))) {
        console.log(AUDIT_HELP);
        process.exit(0);
      }
      if (rest.includes("--help") || rest.includes("-h") || rest.includes("help")) {
        console.log(AGENTS_HELP);
        process.exit(0);
      }
      const isForce = rest.includes("--force") || rest.includes("-f");
      const isDryRun = rest.includes("--dry-run");
      const isCi = rest.includes("--ci");
      const isStrict = rest.includes("--strict") || rest.includes("--strict-token-guard");
      const isIncludeTests = rest.includes("--include-tests");
      const isYes =
        rest.includes("--yes") ||
        rest.includes("-y") ||
        rest.includes("--non-interactive") ||
        rest.includes("--no-interactive");
      const isInteractive = rest.includes("--interactive") || rest.includes("-i");

      let maxTokens: number | undefined;
      let fromFile: string | undefined;
      const excludePatterns: string[] = [];
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
        } else if (arg === "--from") {
          const nextVal = rest[i + 1];
          if (nextVal && !nextVal.startsWith("-")) {
            fromFile = nextVal;
            i++;
          }
        } else if (arg.startsWith("--from=")) {
          fromFile = arg.slice("--from=".length);
        } else if (arg === "--exclude") {
          const nextVal = rest[i + 1];
          if (nextVal && !nextVal.startsWith("-")) {
            const parts = nextVal
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
              .filter(Boolean);
            excludePatterns.push(...parts);
            i++;
          }
        } else if (arg.startsWith("--exclude=")) {
          const val = arg.slice("--exclude=".length);
          const parts = val
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
            .filter(Boolean);
          excludePatterns.push(...parts);
        } else if (arg === "--include-tests") {
          // Handled via isIncludeTests flag
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
        positional[0] === "guard" ||
        positional[0] === "audit" ||
        positional[0] === "lint" ||
        positional[0] === "migrate"
      ) {
        subcommand = positional[0];
        targetDir = positional[1] || process.cwd();
      } else {
        targetDir = positional[0] || process.cwd();
      }

      let resolvedPath = path.resolve(targetDir);
      if (subcommand === "migrate" && fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        if (!fromFile) {
          fromFile = path.basename(resolvedPath);
        }
        resolvedPath = path.dirname(resolvedPath);
      }

      if (subcommand === "migrate") {
        try {
          const migrationResult = migrateLegacyInstructions(resolvedPath, {
            from: fromFile,
            dryRun: isDryRun,
            force: isForce,
            json: isJson,
            maxRootTokens: maxTokens,
          });

          if (isJson) {
            console.log(JSON.stringify(migrationResult, null, 2));
          } else {
            console.log(
              pc.bold(
                pc.cyan(
                  "\n🪆 Matryoshka Legacy AGENTS.md Migration Engine (baba agents migrate)"
                )
              )
            );
            console.log(`  ${pc.dim("•")} ${pc.bold("Target Path:")}    ${resolvedPath}`);
            console.log(`  ${pc.dim("•")} ${pc.bold("Source File:")}    ${migrationResult.sourceFile}`);
            console.log(
              `  ${pc.dim("•")} ${pc.bold("Status:")}         ${
                migrationResult.status === "success"
                  ? pc.green("SUCCESS (migrated)")
                  : migrationResult.status === "simulated"
                  ? pc.yellow("SIMULATED (--dry-run)")
                  : pc.blue(migrationResult.status)
              }`
            );
            if (migrationResult.backupCreated && migrationResult.backupPath) {
              console.log(
                `  ${pc.dim("•")} ${pc.bold("Safety Backup:")}  ${pc.yellow(
                  migrationResult.backupPath
                )}`
              );
            } else if (migrationResult.dryRun && migrationResult.backupPath) {
              console.log(
                `  ${pc.dim("•")} ${pc.bold("Safety Backup:")}  ${pc.yellow(
                  migrationResult.backupPath
                )} ${pc.dim("(planned)")}`
              );
            }
            if (migrationResult.error) {
              console.log(
                `  ${pc.dim("•")} ${pc.bold("Error:")}          ${pc.red(
                  migrationResult.error
                )}`
              );
            }
            console.log(
              `  ${pc.dim("•")} ${pc.bold("Root AGENTS:")}    ${pc.green(
                migrationResult.rootAgentsPath
              )} (${pc.yellow(migrationResult.rootAgentsTokens.toString())} tokens)${
                migrationResult.dryRun ? pc.dim(" (planned)") : ""
              }`
            );
            console.log(
              `  ${pc.dim("•")} ${pc.bold("Token Savings:")}  ${pc.green(
                `${migrationResult.tokenSavings.savedTokens} tokens (${migrationResult.tokenSavings.reductionPercentage}% reduction)`
              )}`
            );
            console.log(
              pc.bold(
                pc.cyan(
                  migrationResult.dryRun
                    ? "  Planned Modular Skills Extraction (diff):"
                    : "  Extracted Modular Skills:"
                )
              )
            );
            for (const skill of migrationResult.extractedSkills) {
              console.log(
                `    ${pc.dim("•")} ${pc.green(skill.name)} ${pc.dim(
                  `(${skill.relativePath})`
                )} - ${pc.yellow(skill.estimatedTokens.toString())} tokens`
              );
            }
            console.log("");
          }

          process.exit(migrationResult.success ? 0 : 1);
        } catch (error: any) {
          if (isJson) {
            console.log(
              JSON.stringify(
                {
                  success: false,
                  status: "error",
                  command: "agents migrate",
                  rootPath: resolvedPath,
                  message: error?.message || "Migration failed",
                },
                null,
                2
              )
            );
          } else {
            console.error(pc.red(`\nMigration failed: ${error?.message || "Unknown error"}\n`));
          }
          process.exit(1);
        }
      }

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

      if (subcommand === "audit" || subcommand === "lint") {
        try {
          const auditResult = auditCognitiveContext(resolvedPath, {
            strict: isStrict,
            json: isJson,
            maxTokens,
            includeTests: isIncludeTests,
            exclude: excludePatterns,
            excludePatterns,
          });

          if (isJson) {
            let status = "success";
            if (auditResult.summary.failedCount > 0 || !auditResult.passed) {
              status = "error";
            } else if (auditResult.summary.warnCount > 0) {
              status = "warn";
            }
            const jsonOutput = {
              status,
              command: "agents audit",
              ...auditResult,
            };
            console.log(JSON.stringify(jsonOutput, null, 2));
          } else {
            console.log(formatCognitiveAuditHumanOutput(auditResult, resolvedPath));
          }

          if (isStrict && !auditResult.passedStrict) {
            const failureMsg = `Strict mode failed: Cognitive context health score (${auditResult.score}) is below threshold (80) or FAIL violations were detected.`;
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
                  command: "agents audit",
                  rootPath: resolvedPath,
                  message: error?.message || "Cognitive context audit failed",
                },
                null,
                2
              )
            );
          } else {
            console.error(pc.red(`\nAudit failed: ${error?.message || "Unknown error"}\n`));
          }
          process.exit(1);
        }
      }

      if (subcommand === "profile" || subcommand === "seams") {
        try {
          const profile = profileArchetype(resolvedPath, {
            exclude: excludePatterns,
            excludePatterns,
            includeTests: isIncludeTests,
          });
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
        const isCI = Boolean(
          process.env.CI === "true" ||
          process.env.CI === "1" ||
          process.env.CONTINUOUS_INTEGRATION === "1" ||
          process.env.CONTINUOUS_INTEGRATION === "true" ||
          process.env.GITHUB_ACTIONS ||
          process.env.DEBIAN_FRONTEND === "noninteractive"
        );

        const shouldPrompt = shouldRunInteractivePrompt({
          stdin: process.stdin,
          stdout: process.stdout,
          isYes,
          isInteractive,
          isJson,
          ci: isCI,
        });

        if (isInteractive && !isYes && !process.stdin.isTTY && !isJson) {
          console.log(
            pc.yellow(
              "\nNotice: Headless environment detected (process.stdin.isTTY is false). Falling back to non-interactive mode.\n"
            )
          );
        }

        let selectedSkills: SkillName[] | undefined;
        if (shouldPrompt) {
          const selectorResult = await promptInteractiveSkillSelection({
            profile: profileArchetype(resolvedPath, {
              exclude: excludePatterns,
              excludePatterns,
              includeTests: isIncludeTests,
            }),
            projectPath: resolvedPath,
            stdin: process.stdin,
            stdout: process.stdout,
            dryRun: isDryRun,
            force: isForce,
            maxTokens,
            strictTokenGuard: isStrict,
            isInteractive,
            isYes,
            isJson,
          });

          if (!selectorResult.confirmed) {
            console.log(pc.yellow("\nOperation cancelled by user.\n"));
            process.exit(0);
          }
          selectedSkills = selectorResult.selectedSkills;
        }

        const result = generateAgents(resolvedPath, {
          ci: isCi,
          force: isForce,
          dryRun: isDryRun,
          json: isJson,
          maxTokens,
          strictTokenGuard: isStrict,
          selectedSkills,
          exclude: excludePatterns,
          excludePatterns,
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
          console.log(pc.bold(pc.green("✨ Context and skills scaffolded successfully!")));
          console.log(`Run ${pc.cyan("baba wrap .")} to inspect the result and compute your updated Harness² score.\n`);
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
      if (rest.includes("--help") || rest.includes("-h") || rest.includes("help")) {
        console.log(WRAP_HELP);
        process.exit(0);
      }
      let isStrict = rest.includes("--strict");
      let isDryRun = rest.includes("--dry-run");
      let includeTests = rest.includes("--include-tests");
      const excludePatterns: string[] = [];
      let targetDir: string | undefined;
      let outputPath: string | undefined;
      let threshold: number | undefined;
      let maxFileSizeKb: number | undefined;

      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (!arg) continue;

        if (arg === "--json" || arg === "--strict" || arg === "--dry-run" || arg === "--include-tests") {
          // Handled via flags
        } else if (arg === "--exclude") {
          const nextVal = rest[i + 1];
          if (nextVal && !nextVal.startsWith("-")) {
            const parts = nextVal
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
              .filter(Boolean);
            excludePatterns.push(...parts);
            i++;
          }
        } else if (arg.startsWith("--exclude=")) {
          const val = arg.slice("--exclude=".length);
          const parts = val
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
            .filter(Boolean);
          excludePatterns.push(...parts);
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
          includeTests,
          exclude: excludePatterns,
          excludePatterns,
          astOptions: {
            maxFileSizeKb: maxFileSizeKb ?? 500,
            includeTests,
            excludePatterns,
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

      if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
        console.log(MCP_HELP);
        process.exit(0);
      }

      if (!subcommand) {
        console.error(pc.red("Error: Missing MCP subcommand. Usage: baba mcp <wire|serve> [path] [--dry-run] [--json]"));
        process.exit(1);
      }

      if (subcommand === "serve") {
        if (mcpArgs.includes("--help") || mcpArgs.includes("-h") || mcpArgs.includes("help")) {
          console.log(`
Usage: baba mcp serve [path]

Start native Model Context Protocol (MCP) server over stdio for AI coding agents.

Arguments:
  [path]   Root repository path to serve (defaults to current working directory)

Stream Guarantees:
  stdout   Strictly reserved for newline-delimited JSON-RPC 2.0 protocol messages
  stderr   Diagnostic telemetry, startup notices, and logging
`.trim());
          process.exit(0);
        }

        const positional = mcpArgs.filter((arg) => !arg.startsWith("-"));
        const targetDir = positional[0] || process.cwd();
        const resolvedPath = path.resolve(targetDir);

        const server = createMatryoshkaMcpServer(resolvedPath);
        server.listenStdio();
        return;
      }

      if (subcommand !== "wire") {
        console.error(
          pc.red(
            `Error: Unknown subcommand '${subcommand}' for 'mcp'. Usage: baba mcp <wire|serve> [path] [--dry-run] [--json]`
          )
        );
        process.exit(1);
      }

      if (mcpArgs.includes("--help") || mcpArgs.includes("-h") || mcpArgs.includes("help")) {
        console.log(MCP_WIRE_HELP);
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
