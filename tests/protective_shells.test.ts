import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  PROTECTIVE_SHELLS,
  generateShellPackageJson,
  generateForwarderScript,
  generateReadme,
  scaffoldShell,
  scaffoldAllShells,
  verifyShell,
  verifyAllShells,
  resolveCanonicalCli,
  type ProtectiveShellConfig,
} from "../scripts/build-shells";

describe("SPEC-16: Protective Typosquatting Forwarding Shells (Subtask 3)", () => {
  const rootDir = process.cwd();
  const rootPackageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"),
  );
  const rootVersion = rootPackageJson.version;

  describe("Canonical Shell Definitions & Configurations", () => {
    it("should define exactly 4 protective shells: baba, bbyg, matrioska, and matryoska", () => {
      expect(Array.isArray(PROTECTIVE_SHELLS)).toBe(true);
      expect(PROTECTIVE_SHELLS.length).toBe(4);

      const names = PROTECTIVE_SHELLS.map((s) => s.name);
      expect(names).toContain("baba");
      expect(names).toContain("bbyg");
      expect(names).toContain("matrioska");
      expect(names).toContain("matryoska");
    });

    it("should target @maiquelleonel/matryoshka across all shells", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        expect(shell.targetPackage).toBe("@maiquelleonel/matryoshka");
        expect(shell.packageName).toBe(`@maiquelleonel/${shell.name}`);
      }
    });

    it("should flag matrioska and matryoska as typo protection packages", () => {
      const matrioska = PROTECTIVE_SHELLS.find((s) => s.name === "matrioska");
      const matryoska = PROTECTIVE_SHELLS.find((s) => s.name === "matryoska");
      const baba = PROTECTIVE_SHELLS.find((s) => s.name === "baba");
      const bbyg = PROTECTIVE_SHELLS.find((s) => s.name === "bbyg");

      expect(matrioska?.isTypoProtection).toBe(true);
      expect(matryoska?.isTypoProtection).toBe(true);
      expect(baba?.isTypoProtection).toBeFalsy();
      expect(bbyg?.isTypoProtection).toBeFalsy();
    });

    it("should map primary and fallback binary aliases in each shell configuration", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        expect(shell.binName).toBe(shell.name);
        expect(shell.aliases).toContain(shell.name);
        expect(shell.aliases).toContain("matryoshka");
      }
    });
  });

  describe("Manifest & Asset Generators", () => {
    const sampleShell: ProtectiveShellConfig = {
      name: "baba",
      packageName: "@maiquelleonel/baba",
      description: "Protective shell for baba",
      binName: "baba",
      aliases: ["baba", "matryoshka", "bbyg"],
      targetPackage: "@maiquelleonel/matryoshka",
    };

    it("should generate compliant package.json with public access and dependencies", () => {
      const pkg = generateShellPackageJson(sampleShell, rootVersion);
      expect(pkg.name).toBe("@maiquelleonel/baba");
      expect(pkg.version).toBe(rootVersion);
      expect(pkg.publishConfig?.access).toBe("public");
      expect(pkg.private).toBeFalsy();
      expect(pkg.dependencies?.["@maiquelleonel/matryoshka"]).toBe(`^${rootVersion}`);
      expect(pkg.bin?.baba).toBe("bin/baba.js");
      expect(pkg.bin?.matryoshka).toBe("bin/baba.js");
      expect(pkg.files).toContain("bin");
      expect(pkg.files).toContain("README.md");
      expect(pkg.files).toContain("LICENSE");
    });

    it("should generate forwarding script starting with shebang and node/bun support", () => {
      const script = generateForwarderScript(sampleShell);
      expect(script.startsWith("#!/usr/bin/env node")).toBe(true);
      expect(script).toContain("@maiquelleonel/matryoshka");
      expect(script).toContain("resolveCanonicalCli");
      expect(script).toContain("spawnSync");
    });

    it("should generate informative README documenting forwarding role", () => {
      const readme = generateReadme(sampleShell, rootVersion);
      expect(readme).toContain("@maiquelleonel/baba");
      expect(readme).toContain("@maiquelleonel/matryoshka");
      expect(readme).toContain("Protective");
      expect(readme).toContain("npx @maiquelleonel/baba");
    });
  });

  describe("On-Disk Scaffolded Packages Validation", () => {
    it("should have directory and package.json for all 4 shells in packages/", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        const shellDir = path.join(rootDir, "packages", shell.name);
        expect(fs.existsSync(shellDir)).toBe(true);

        const pkgJsonPath = path.join(shellDir, "package.json");
        expect(fs.existsSync(pkgJsonPath)).toBe(true);

        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
        expect(pkg.name).toBe(shell.packageName);
        expect(pkg.version).toBe(rootVersion);
        expect(pkg.publishConfig?.access).toBe("public");
        expect(pkg.dependencies?.[shell.targetPackage]).toBeDefined();
        expect(pkg.bin?.[shell.binName]).toBe(`bin/${shell.name}.js`);
      }
    });

    it("should have executable forwarding scripts in packages/<name>/bin/<name>.js", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        const scriptPath = path.join(rootDir, "packages", shell.name, "bin", `${shell.name}.js`);
        expect(fs.existsSync(scriptPath)).toBe(true);

        const content = fs.readFileSync(scriptPath, "utf-8");
        expect(content.startsWith("#!/usr/bin/env node")).toBe(true);

        const stats = fs.statSync(scriptPath);
        // Check executable permission bits on non-Windows platforms
        if (process.platform !== "win32") {
          const isExecutable = Boolean(stats.mode & 0o111);
          expect(isExecutable).toBe(true);
        }
      }
    });

    it("should have library entrypoint index.js re-exporting canonical surface in each package", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        const indexPath = path.join(rootDir, "packages", shell.name, "index.js");
        expect(fs.existsSync(indexPath)).toBe(true);

        const content = fs.readFileSync(indexPath, "utf-8");
        expect(content).toContain("@maiquelleonel/matryoshka");
      }
    });

    it("should have README.md and LICENSE in each shell package", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        const readmePath = path.join(rootDir, "packages", shell.name, "README.md");
        const licensePath = path.join(rootDir, "packages", shell.name, "LICENSE");

        expect(fs.existsSync(readmePath)).toBe(true);
        expect(fs.existsSync(licensePath)).toBe(true);

        const readme = fs.readFileSync(readmePath, "utf-8");
        expect(readme).toContain(shell.packageName);
        expect(readme).toContain(shell.targetPackage);
      }
    });
  });

  describe("Forwarding Execution & CLI Parity", () => {
    it("should resolve canonical CLI path from resolveCanonicalCli helper", () => {
      const resolved = resolveCanonicalCli();
      expect(resolved).toBeTruthy();
      expect(fs.existsSync(resolved)).toBe(true);
      expect(resolved.endsWith("dist/cli.js")).toBe(true);
    });

    it("should execute forwarding script and forward '--version' with exit code 0", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        const scriptPath = path.join(rootDir, "packages", shell.name, "bin", `${shell.name}.js`);
        const proc = Bun.spawnSync(["bun", scriptPath, "--version"], {
          stdout: "pipe",
          stderr: "pipe",
        });

        expect(proc.exitCode).toBe(0);
        expect(proc.stdout.toString().trim()).toBe(rootVersion);
      }
    });

    it("should execute forwarding script and forward '--help' with exit code 0", () => {
      const babaScript = path.join(rootDir, "packages", "baba", "bin", "baba.js");
      const proc = Bun.spawnSync(["bun", babaScript, "--help"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();
      expect(output).toContain("Matryoshka-Harness CLI");
      expect(output).toContain("detect");
      expect(output).toContain("wrap");
    });

    it("should execute forwarding script and forward 'detect --json' subcommand", () => {
      const bbygScript = path.join(rootDir, "packages", "bbyg", "bin", "bbyg.js");
      const proc = Bun.spawnSync(["bun", bbygScript, "detect", "--json"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.status).toBe("success");
      expect(json.stack).toBeDefined();
    });
  });

  describe("Verification & Scaffolding Utilities", () => {
    it("should verify all 4 shells cleanly using verifyAllShells", () => {
      const summary = verifyAllShells();
      expect(summary.success).toBe(true);
      expect(summary.shells.length).toBe(4);
      for (const shellResult of summary.shells) {
        expect(shellResult.success).toBe(true);
        expect(shellResult.validManifest).toBe(true);
        expect(shellResult.validForwarder).toBe(true);
        expect(shellResult.validDependency).toBe(true);
        expect(shellResult.isPublic).toBe(true);
        expect(shellResult.errors.length).toBe(0);
      }
    });

    it("should support dry-run scaffolding without modifying files", () => {
      const summary = scaffoldAllShells({ dryRun: true });
      expect(summary.success).toBe(true);
      expect(summary.results.length).toBe(4);
      for (const res of summary.results) {
        expect(res.success).toBe(true);
        expect(res.filesWritten.length).toBeGreaterThanOrEqual(4);
      }
    });

    it("should support CLI invocation of scripts/build-shells.ts with --verify and --json", () => {
      const proc = Bun.spawnSync(["bun", "run", "scripts/build-shells.ts", "--verify", "--json"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.success).toBe(true);
      expect(json.shells).toBeDefined();
      expect(json.shells.length).toBe(4);
    });
  });
});
