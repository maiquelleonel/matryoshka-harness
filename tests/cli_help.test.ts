import { describe, it, expect } from "bun:test";
import * as path from "node:path";

describe("SPEC-14 Subtask 2: Actionable & Declarative CLI Help Menus", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  describe("AC-2.1: Main Help Menu Structure & Grouping", () => {
    it("renders grouped commands with clear functional categories", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      // Header and branding
      expect(output).toContain("Matryoshka-Harness CLI");
      expect(output).toContain("baba / bbyg / matryoshka");

      // Canonical aliases section
      expect(output).toContain("Aliases:");
      expect(output).toContain("baba");
      expect(output).toContain("bbyg");
      expect(output).toContain("matryoshka");

      // Grouped commands
      expect(output).toContain("Reconnaissance & Maturity Audit:");
      expect(output).toContain("detect");
      expect(output).toContain("scan");

      expect(output).toContain("Governance & Context-Fencing:");
      expect(output).toContain("agents generate");
      expect(output).toContain("agents profile");
      expect(output).toContain("agents check");
      expect(output).toContain("agents skill");

      expect(output).toContain("Antipattern Remediation & Quality Gates:");
      expect(output).toContain("wrap");

      expect(output).toContain("Agent Context Autowiring & Model Context Protocol:");
      expect(output).toContain("mcp wire");
      expect(output).toContain("mcp serve");

      // Actionable examples
      expect(output).toContain("Actionable Examples:");
    });

    it("renders grouped options with actionable flag descriptions", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "-h"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      expect(output).toContain("Global Options:");
      expect(output).toContain("--help");
      expect(output).toContain("--version");
      expect(output).toContain("--json");

      expect(output).toContain("Audit & Remediation Options (scan, wrap):");
      expect(output).toContain("--badge");
      expect(output).toContain("--output");
      expect(output).toContain("--strict");
      expect(output).toContain("--threshold");
      expect(output).toContain("--max-file-size");

      expect(output).toContain("Governance Generation Options (agents):");
      expect(output).toContain("--force");
      expect(output).toContain("--dry-run");
      expect(output).toContain("--max-tokens");

      expect(output).toContain("MCP Configuration Options (mcp wire):");
      expect(output).toContain("--targets");
    });

    it("guarantees byte-for-byte help parity across baba, bbyg, and matryoshka", () => {
      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "--help"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "--help"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "--help"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString().trim();
      const outBbyg = procBbyg.stdout.toString().trim();
      const outMatryoshka = procMatryoshka.stdout.toString().trim();

      expect(outBaba).toBe(outBbyg);
      expect(outBaba).toBe(outMatryoshka);
    });
  });

  describe("AC-2.2: Subcommand-Specific Declarative Help Menus", () => {
    it("renders dedicated help for 'detect' subcommand", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "detect", "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      expect(output).toContain("Usage: baba detect [path] [options]");
      expect(output).toContain("Inspect codebase and detect primary stack, frameworks, and test runner");
      expect(output).toContain("--json");
      expect(output).toContain("Examples:");
    });

    it("renders dedicated help for 'scan' subcommand", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "scan", "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      expect(output).toContain("Usage: baba scan [path] [options]");
      expect(output).toContain("Execute maturity audit");
      expect(output).toContain("--badge");
      expect(output).toContain("--json");
      expect(output).toContain("Examples:");
    });

    it("renders dedicated help for 'agents' subcommand and its subcommands", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      expect(output).toContain("Usage: baba agents <subcommand> [path] [options]");
      expect(output).toContain("generate");
      expect(output).toContain("profile");
      expect(output).toContain("check");
      expect(output).toContain("skill");
      expect(output).toContain("--force");
      expect(output).toContain("--max-tokens");
      expect(output).toContain("Examples:");
    });

    it("renders dedicated help for 'wrap' subcommand", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      expect(output).toContain("Usage: baba wrap [path] [options]");
      expect(output).toContain("Analyze AST antipatterns");
      expect(output).toContain("--strict");
      expect(output).toContain("--threshold");
      expect(output).toContain("--output");
      expect(output).toContain("Examples:");
    });

    it("renders dedicated help for 'mcp wire' subcommand", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      expect(output).toContain("Usage: baba mcp wire [path] [options]");
      expect(output).toContain("--targets");
      expect(output).toContain("--dry-run");
      expect(output).toContain("Examples:");
    });

    it("preserves stream guarantees in 'mcp serve --help'", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "serve", "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();

      expect(output).toContain("Usage: baba mcp serve [path]");
      expect(output).toContain("stdout");
      expect(output).toContain("stderr");
    });

    it("supports 'help <subcommand>' syntax as alternative to '<subcommand> --help'", () => {
      const procHelpDetect = Bun.spawnSync(["bun", "run", cliPath, "help", "detect"]);
      const procDetectHelp = Bun.spawnSync(["bun", "run", cliPath, "detect", "--help"]);

      expect(procHelpDetect.exitCode).toBe(0);
      expect(procDetectHelp.exitCode).toBe(0);
      expect(procHelpDetect.stdout.toString().trim()).toBe(procDetectHelp.stdout.toString().trim());

      const procHelpWrap = Bun.spawnSync(["bun", "run", cliPath, "help", "wrap"]);
      const procWrapHelp = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"]);

      expect(procHelpWrap.exitCode).toBe(0);
      expect(procWrapHelp.exitCode).toBe(0);
      expect(procHelpWrap.stdout.toString().trim()).toBe(procWrapHelp.stdout.toString().trim());
    });

    it("ensures alias parity across all subcommand help invocations", () => {
      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"]);
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);
      expect(procBaba.stdout.toString().trim()).toBe(procBbyg.stdout.toString().trim());
      expect(procBaba.stdout.toString().trim()).toBe(procMatryoshka.stdout.toString().trim());
    });
  });
});
