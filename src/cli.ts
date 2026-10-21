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
import type { DetectResult, ProjectStack } from "./types";

const VERSION = "0.1.0";

const HELP_TEXT = `
Matryoshka-Harness CLI (baba / bbyg / matryoshka)

Usage:
  baba detect [path] [--json]
  baba scan [path] [--json] [--badge [path]]
  baba agents generate [path] [--force] [--dry-run] [--json]
  baba agents profile [path] [--json]
  baba agents check [path] [--json] [--max-tokens <num>]
  baba agents skill <name> [path] [--json]
  baba wrap [path]

Commands:
  detect   Inspect codebase and detect primary stack, frameworks, and test runner
  scan     Execute maturity audit and semantic AST reconciliation
  agents   Generate adaptive AGENTS.md and modular skills
  wrap     Apply adaptive context fence and inject AGENTS.md / SKILLS.md

Options:
  --force, -f    Overwrite existing files (creates .bak of pre-existing AGENTS.md)
  --dry-run      Simulate generation without writing to disk
  --json         Output strictly valid JSON
  --badge [path] Generate maturity SVG badge (default: ./harness-badge.svg)
  -h, --help     Show help information
  -v, --version  Show version
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

    case "agents": {
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
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
