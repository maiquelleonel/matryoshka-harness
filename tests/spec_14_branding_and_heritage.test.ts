import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("SPEC-14: Launch-Grade README, Actionable CLI Help & Ouroboros Heritage", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const cliPath = path.resolve(repoRoot, "src/cli.ts");

  describe("Subtask 1: Launch-Grade Showcase README.md", () => {
    const readmePath = path.join(repoRoot, "README.md");

    it("verifies README.md exists and is non-trivial (> 2KB)", () => {
      expect(fs.existsSync(readmePath)).toBe(true);
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content.length).toBeGreaterThan(2000);
    });

    it("contains Russian-doll concentric mental model and 5 layers", () => {
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content).toContain("Layer 5");
      expect(content).toContain("Layer 4");
      expect(content).toContain("Layer 3");
      expect(content).toContain("Layer 2");
      expect(content).toContain("Layer 1");
      expect(content.toLowerCase()).toContain("concentric");
      expect(content).toContain("MCP Server");
      expect(content).toContain("Tree-sitter");
    });

    it("contains both Mermaid and ASCII architecture diagrams", () => {
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content).toContain("```mermaid");
      expect(content).toContain("```text");
    });

    it("provides zero-install quickstart commands for bunx and npx", () => {
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content).toContain("bunx @maiquelleonel/matryoshka");
      expect(content).toContain("npx @maiquelleonel/matryoshka");
    });

    it("documents all canonical binary aliases: baba, bbyg, and matryoshka", () => {
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content).toContain("baba");
      expect(content).toContain("bbyg");
      expect(content).toContain("matryoshka");
    });

    it("documents all core CLI subcommands with concrete flags", () => {
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content).toContain("detect");
      expect(content).toContain("scan");
      expect(content).toContain("agents");
      expect(content).toContain("wrap");
      expect(content).toContain("mcp");
    });
  });

  describe("Subtask 2: Polished & Actionable CLI Help Menus", () => {
    it("provides dedicated, actionable help for 'baba detect --help'", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "detect", "--help"]);
      expect(proc.exitCode).toBe(0);
      const out = proc.stdout.toString();
      expect(out).toContain("baba detect");
      expect(out).toContain("--json");
      expect(out.toLowerCase()).toContain("stack");
    });

    it("provides dedicated, actionable help for 'baba scan --help'", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "scan", "--help"]);
      expect(proc.exitCode).toBe(0);
      const out = proc.stdout.toString();
      expect(out).toContain("baba scan");
      expect(out).toContain("--badge");
      expect(out).toContain("--json");
      expect(out.toLowerCase()).toContain("maturity");
    });

    it("provides dedicated, actionable help for 'baba agents --help'", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "--help"]);
      expect(proc.exitCode).toBe(0);
      const out = proc.stdout.toString();
      expect(out).toContain("baba agents generate");
      expect(out).toContain("baba agents profile");
      expect(out).toContain("baba agents check");
      expect(out).toContain("baba agents skill");
      expect(out).toContain("--force");
      expect(out).toContain("--dry-run");
    });

    it("provides dedicated, actionable help for 'baba wrap --help'", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"]);
      expect(proc.exitCode).toBe(0);
      const out = proc.stdout.toString();
      expect(out).toContain("baba wrap");
      expect(out).toContain("--strict");
      expect(out).toContain("--threshold");
      expect(out).toContain("--output");
      expect(out.toLowerCase()).toContain("anti-pattern");
    });

    it("provides dedicated, actionable help for 'baba mcp --help'", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "--help"]);
      expect(proc.exitCode).toBe(0);
      const out = proc.stdout.toString();
      expect(out).toContain("baba mcp wire");
      expect(out).toContain("baba mcp serve");
    });

    it("provides dedicated, actionable help for 'baba mcp wire --help'", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", "--help"]);
      expect(proc.exitCode).toBe(0);
      const out = proc.stdout.toString();
      expect(out).toContain("baba mcp wire");
      expect(out).toContain("--targets");
      expect(out).toContain("cursor");
      expect(out).toContain("claude");
      expect(out).toContain("gemini");
    });
  });

  describe("Subtask 3: MIT License & Copyright Headers Enforcement", () => {
    it("verifies root LICENSE and package LICENSEs exist and contain MIT text", () => {
      const rootLicense = path.join(repoRoot, "LICENSE");
      expect(fs.existsSync(rootLicense)).toBe(true);
      const rootText = fs.readFileSync(rootLicense, "utf-8");
      expect(rootText).toContain("MIT License");
      expect(rootText).toContain("Copyright (c) 2026 Maiquel Leonel");

      const shellPackages = ["baba", "bbyg", "matrioska", "matryoska"];
      for (const pkg of shellPackages) {
        const pkgLicense = path.join(repoRoot, "packages", pkg, "LICENSE");
        expect(fs.existsSync(pkgLicense)).toBe(true);
        const pkgText = fs.readFileSync(pkgLicense, "utf-8");
        expect(pkgText).toContain("MIT License");
        expect(pkgText).toContain("Copyright (c) 2026 Maiquel Leonel");
      }
    });

    it("verifies copyright headers in all production source files in src/ and root", () => {
      const sourceFiles = [
        "index.ts",
        "src/cli.ts",
        "src/detector.ts",
        "src/scanner.ts",
        "src/ast.ts",
        "src/agents.ts",
        "src/mcp.ts",
        "src/mcp-server.ts",
        "src/report.ts",
        "src/scorer.ts",
        "src/types.ts",
        "src/rules.ts",
        "src/governance.ts",
        "src/release.ts",
        "src/core/oracle.ts",
        "scripts/build-binaries.ts",
        "scripts/build-shells.ts",
      ];

      for (const relPath of sourceFiles) {
        const fullPath = path.join(repoRoot, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).toContain("Copyright (c) 2026 Maiquel Leonel");
        expect(content).toContain("MIT License");
      }
    });
  });

  describe("Subtask 4: Ouroboros Heritage & Cross-Linking", () => {
    it("cross-links to Ouroboros Engine from site/index.html", () => {
      const sitePath = path.join(repoRoot, "site/index.html");
      expect(fs.existsSync(sitePath)).toBe(true);
      const html = fs.readFileSync(sitePath, "utf-8");
      expect(html).toContain("https://ouroboros.leonellabshq.dev");
      expect(html).toContain("Ouroboros Engine");
      expect(html).toContain("https://github.com/maiquelleonel/matryoshka-harness");
    });

    it("cross-links to Ouroboros Engine from root README.md", () => {
      const readmePath = path.join(repoRoot, "README.md");
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content).toContain("Ouroboros");
      expect(content).toContain("https://ouroboros.leonellabshq.dev");
      expect(content).toContain("LeonelLabs");
    });
  });
});
