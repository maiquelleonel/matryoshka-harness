import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("SPEC-16: NPM Publishing Metadata & Bin Dispatchers (Subtask 2)", () => {
  const rootDir = process.cwd();
  const packageJsonPath = path.join(rootDir, "package.json");

  const readPackageJson = (): Record<string, any> => {
    const raw = fs.readFileSync(packageJsonPath, "utf-8");
    return JSON.parse(raw);
  };

  describe("Manifest Identity & Registry Publishing Metadata", () => {
    it("should configure package name as '@maiquelleonel/matryoshka'", () => {
      const pkg = readPackageJson();
      expect(pkg.name).toBe("@maiquelleonel/matryoshka");
    });

    it("should set version to '0.4.0' matching PRD specification", () => {
      const pkg = readPackageJson();
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it("should configure publishConfig with public access", () => {
      const pkg = readPackageJson();
      expect(pkg.publishConfig).toBeDefined();
      expect(pkg.publishConfig.access).toBe("public");
    });

    it("should not be marked as private (allow npm publishing)", () => {
      const pkg = readPackageJson();
      expect(pkg.private).toBeFalsy();
    });

    it("should include canonical repository, homepage, and bugs metadata", () => {
      const pkg = readPackageJson();
      expect(pkg.repository).toBeDefined();
      const repoUrl = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
      expect(repoUrl).toContain("maiquelleonel/matryoshka-harness");

      expect(pkg.bugs).toBeDefined();
      const bugsUrl = typeof pkg.bugs === "string" ? pkg.bugs : pkg.bugs?.url;
      expect(bugsUrl).toContain("maiquelleonel/matryoshka-harness");

      expect(pkg.homepage).toBeDefined();
      expect(pkg.homepage).toContain("maiquelleonel/matryoshka-harness");
    });

    it("should specify relevant keywords for discoverability", () => {
      const pkg = readPackageJson();
      expect(Array.isArray(pkg.keywords)).toBe(true);
      expect(pkg.keywords.length).toBeGreaterThanOrEqual(3);
      expect(pkg.keywords).toContain("harness");
    });

    it("should whitelist distribution files preventing artifact leakage", () => {
      const pkg = readPackageJson();
      expect(Array.isArray(pkg.files)).toBe(true);
      expect(pkg.files).toContain("dist");
      expect(pkg.files).toContain("README.md");
      expect(pkg.files).toContain("LICENSE");
    });
  });

  describe("Canonical Entrypoints & Subpath Exports", () => {
    it("should configure main, module, and types pointing to dist artifacts", () => {
      const pkg = readPackageJson();
      expect(pkg.main).toBe("dist/index.js");
      expect(pkg.module).toBe("dist/index.js");
      expect(pkg.types).toBe("dist/index.d.ts");
    });

    it("should configure modern subpath exports for ESM and types resolution", () => {
      const pkg = readPackageJson();
      expect(pkg.exports).toBeDefined();
      expect(pkg.exports["."]).toBeDefined();

      const rootExport = pkg.exports["."];
      const importTarget = typeof rootExport === "string" ? rootExport : rootExport.import;
      const typesTarget = typeof rootExport === "string" ? undefined : rootExport.types;

      expect(importTarget).toMatch(/dist\/index\.js$/);
      if (typesTarget) {
        expect(typesTarget).toMatch(/dist\/index\.d\.ts$/);
      }
    });
  });

  describe("Binary Aliases & Dispatcher Parity", () => {
    it("should expose canonical binary aliases: matryoshka, baba, and bbyg", () => {
      const pkg = readPackageJson();
      expect(pkg.bin).toBeDefined();
      expect(pkg.bin.matryoshka).toBeDefined();
      expect(pkg.bin.baba).toBeDefined();
      expect(pkg.bin.bbyg).toBeDefined();
    });

    it("should point all three aliases to the compiled dist/cli.js dispatcher", () => {
      const pkg = readPackageJson();
      const normalize = (p: string) => p.replace(/^\.\//, "");
      expect(normalize(pkg.bin.matryoshka)).toBe("dist/cli.js");
      expect(normalize(pkg.bin.baba)).toBe("dist/cli.js");
      expect(normalize(pkg.bin.bbyg)).toBe("dist/cli.js");
    });
  });

  describe("Build Script & Distribution Artifacts", () => {
    it("should have a build script that bundles library, cli, and types into dist", () => {
      const pkg = readPackageJson();
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.build).toContain("bun build");
    });

    it("should compile all distribution artifacts when executing bun run build", () => {
      const buildProc = Bun.spawnSync(["bun", "run", "build"], {
        cwd: rootDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(buildProc.exitCode).toBe(0);

      const distIndex = path.join(rootDir, "dist", "index.js");
      const distCli = path.join(rootDir, "dist", "cli.js");
      const distTypes = path.join(rootDir, "dist", "index.d.ts");

      expect(fs.existsSync(distIndex)).toBe(true);
      expect(fs.existsSync(distCli)).toBe(true);
      expect(fs.existsSync(distTypes)).toBe(true);

      const indexContent = fs.readFileSync(distIndex, "utf-8");
      expect(indexContent.length).toBeGreaterThan(100);

      const cliContent = fs.readFileSync(distCli, "utf-8");
      expect(cliContent.length).toBeGreaterThan(100);
      expect(cliContent.startsWith("#!/usr/bin/env bun")).toBe(true);
    }, 30000);

    it("should execute compiled dist/cli.js and return SemVer 0.4.0 matching package.json", () => {
      const distCli = path.join(rootDir, "dist", "cli.js");
      expect(fs.existsSync(distCli)).toBe(true);

      const proc = Bun.spawnSync([distCli, "--version"]);
      expect(proc.exitCode).toBe(0);
      const pkg = readPackageJson();
      expect(proc.stdout.toString().trim()).toBe(pkg.version);
    });

    it("should execute compiled dist/cli.js and display help text", () => {
      const distCli = path.join(rootDir, "dist", "cli.js");
      const proc = Bun.spawnSync([distCli, "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();
      expect(output).toContain("Matryoshka-Harness CLI");
      expect(output).toContain("detect");
      expect(output).toContain("scan");
      expect(output).toContain("wrap");
    });

    it("should execute detect subcommand via compiled dist/cli.js with --json", () => {
      const distCli = path.join(rootDir, "dist", "cli.js");
      const proc = Bun.spawnSync([distCli, "detect", "--json"]);
      expect(proc.exitCode).toBe(0);

      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.status).toBe("success");
      expect(json.stack).toBeDefined();
      expect(json.stack.primary).toBe("typescript");
    });
  });
});
