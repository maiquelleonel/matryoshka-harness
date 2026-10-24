import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  buildAllBinaries,
  buildBinary,
  computeSha256,
  resolveTargets,
  type BuildResult,
  type BuildTarget,
} from "../scripts/build-binaries";
import { PROTECTIVE_SHELLS } from "../scripts/build-shells";

describe("SPEC-16: Standalone Binary Execution & CLI Alias Parity (Subtask 5)", () => {
  const rootDir = process.cwd();
  const packageJsonPath = path.join(rootDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const expectedVersion = pkg.version;

  let tempDir: string;
  let testProjectDir: string;
  let standaloneBabaPath: string;
  let standaloneBbygPath: string;
  let standaloneMatryoshkaPath: string;
  let hostTarget: BuildTarget;
  let buildResult: BuildResult;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-standalone-verification-"));
    testProjectDir = path.join(tempDir, "sample-project");
    fs.mkdirSync(testProjectDir, { recursive: true });

    // Setup dummy project for CLI testing
    fs.writeFileSync(
      path.join(testProjectDir, "package.json"),
      JSON.stringify(
        {
          name: "standalone-sample-app",
          version: "1.0.0",
          dependencies: { express: "^4.18.2" },
          scripts: { test: "bun test" },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(testProjectDir, "bun.lock"), "");
    fs.writeFileSync(path.join(testProjectDir, "README.md"), "# Standalone Sample App\n");

    const srcDir = path.join(testProjectDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "index.ts"),
      `
export function greet(name: string): string {
  return "Hello, " + name;
}
`.trim(),
    );

    // Resolve host target and compile standalone binary
    const resolved = resolveTargets(["current"]);
    expect(resolved.length).toBe(1);
    hostTarget = resolved[0]!;

    buildResult = await buildBinary(hostTarget, {
      cwd: rootDir,
      outDir: tempDir,
      entrypoint: "src/cli.ts",
      minify: true,
      silent: true,
    });

    expect(buildResult.success).toBe(true);
    standaloneBabaPath = buildResult.outputPath;
    expect(fs.existsSync(standaloneBabaPath)).toBe(true);

    // Create binary aliases for bbyg and matryoshka (symlink or copy)
    const isWindows = process.platform === "win32";
    const bbygName = isWindows ? "bbyg.exe" : "bbyg";
    const matryoshkaName = isWindows ? "matryoshka.exe" : "matryoshka";

    standaloneBbygPath = path.join(tempDir, bbygName);
    standaloneMatryoshkaPath = path.join(tempDir, matryoshkaName);

    fs.copyFileSync(standaloneBabaPath, standaloneBbygPath);
    fs.copyFileSync(standaloneBabaPath, standaloneMatryoshkaPath);

    if (!isWindows) {
      fs.chmodSync(standaloneBabaPath, 0o755);
      fs.chmodSync(standaloneBbygPath, 0o755);
      fs.chmodSync(standaloneMatryoshkaPath, 0o755);
    }
  }, 60000);

  afterAll(() => {
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  });

  describe("Scenario 1: Standalone Binary Properties & Checksum Verification", () => {
    it("should compile a standalone binary that exists and has executable permissions", () => {
      expect(fs.existsSync(standaloneBabaPath)).toBe(true);
      const stats = fs.statSync(standaloneBabaPath);
      expect(stats.size).toBeGreaterThan(1000);

      if (process.platform !== "win32") {
        const isExecutable = Boolean(stats.mode & 0o111);
        expect(isExecutable).toBe(true);
      }
    });

    it("should satisfy binary size guardrail strictly under 120MB", () => {
      const stats = fs.statSync(standaloneBabaPath);
      const sizeMB = stats.size / (1024 * 1024);
      expect(sizeMB).toBeLessThan(120);
      expect(sizeMB).toBeGreaterThan(1);
    });

    it("should generate SHA-256 hash matching on-disk binary digest", () => {
      const computedHash = computeSha256(standaloneBabaPath);
      expect(buildResult.sha256).toBe(computedHash);
      expect(computedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should match format in checksums.txt when batch build is performed", async () => {
      const batchDir = path.join(tempDir, "checksums-test");
      const summary = await buildAllBinaries({
        targets: ["current"],
        outDir: batchDir,
        generateChecksums: true,
        dryRun: false,
        silent: true,
      });

      expect(summary.success).toBe(true);
      expect(summary.checksumsPath).toBeDefined();
      expect(fs.existsSync(summary.checksumsPath!)).toBe(true);

      const checksumsContent = fs.readFileSync(summary.checksumsPath!, "utf-8");
      const currentResult = summary.results[0]!;
      expect(checksumsContent).toContain(`${currentResult.sha256}  ${currentResult.outputFile}\n`);
    }, 60000);
  });

  describe("Scenario 2: Zero External Host Toolchain Direct Execution", () => {
    it("should execute standalone binary directly without Bun or Node in process invocation", () => {
      // Spawning standalone binary directly as executable file
      const proc = Bun.spawnSync([standaloneBabaPath, "--version"], {
        env: {
          PATH: process.env.PATH || "/usr/bin:/bin",
          TMPDIR: os.tmpdir(),
        },
      });

      expect(proc.exitCode).toBe(0);
      expect(proc.stdout.toString().trim()).toBe(expectedVersion);
    });

    it("should print complete usage manual on '--help' and '-h'", () => {
      const procHelp = Bun.spawnSync([standaloneBabaPath, "--help"]);
      expect(procHelp.exitCode).toBe(0);
      const helpOutput = procHelp.stdout.toString();

      expect(helpOutput).toContain("Matryoshka-Harness CLI");
      expect(helpOutput).toContain("baba / bbyg / matryoshka");
      expect(helpOutput).toContain("detect");
      expect(helpOutput).toContain("scan");
      expect(helpOutput).toContain("agents");
      expect(helpOutput).toContain("wrap");
      expect(helpOutput).toContain("mcp");

      const procShortH = Bun.spawnSync([standaloneBabaPath, "-h"]);
      expect(procShortH.exitCode).toBe(0);
      expect(procShortH.stdout.toString()).toBe(helpOutput);
    });

    it("should print SemVer version on '--version' and '-v'", () => {
      const procVer = Bun.spawnSync([standaloneBabaPath, "--version"]);
      expect(procVer.exitCode).toBe(0);
      expect(procVer.stdout.toString().trim()).toBe(expectedVersion);

      const procShortV = Bun.spawnSync([standaloneBabaPath, "-v"]);
      expect(procShortV.exitCode).toBe(0);
      expect(procShortV.stdout.toString().trim()).toBe(expectedVersion);
    });

    it("should fail gracefully with exit code 1 on unknown subcommand", () => {
      const procUnknown = Bun.spawnSync([standaloneBabaPath, "nonexistent-subcommand"]);
      expect(procUnknown.exitCode).toBe(1);
      const stderr = procUnknown.stderr.toString();
      expect(stderr).toContain("Unknown command 'nonexistent-subcommand'");
    });
  });

  describe("Scenario 3: Standalone Binary Subcommands Functional Verification", () => {
    it("should execute 'detect' command returning human-readable output", () => {
      const proc = Bun.spawnSync([standaloneBabaPath, "detect", testProjectDir]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Stack Detector");
      expect(stdout).toContain("typescript");
      expect(stdout).toContain("express");
    });

    it("should execute 'detect --json' returning structured JSON matching DetectResult", () => {
      const proc = Bun.spawnSync([standaloneBabaPath, "detect", testProjectDir, "--json"]);
      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());

      expect(json.status).toBe("success");
      expect(json.stack).toBeDefined();
      expect(json.stack.primary).toBe("typescript");
      expect(json.stack.frameworks).toContain("express");
      expect(json.stack.testRunner).toBe("bun test");
      expect(path.resolve(json.rootPath)).toBe(path.resolve(testProjectDir));
    });

    it("should execute 'scan' command and generate maturity badge via '--badge'", () => {
      const badgeFile = path.join(testProjectDir, "standalone-badge.svg");
      const proc = Bun.spawnSync([
        standaloneBabaPath,
        "scan",
        testProjectDir,
        "--json",
        "--badge",
        badgeFile,
      ]);

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.status).toBe("success");
      expect(json.oracleScore).toBeDefined();
      expect(json.oracleLevel).toBeDefined();
      expect(json.badgePath).toBe(badgeFile);

      expect(fs.existsSync(badgeFile)).toBe(true);
      const svgContent = fs.readFileSync(badgeFile, "utf-8");
      expect(svgContent).toContain("<svg");
      expect(svgContent).toContain("harness");
      expect(svgContent).toContain("</svg>");
    });

    it("should execute 'wrap' command with AST parsing and zero external dependencies", () => {
      const proc = Bun.spawnSync([
        standaloneBabaPath,
        "wrap",
        testProjectDir,
        "--dry-run",
        "--json",
      ]);

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.command).toBe("wrap");
      expect(json.compositeScore).toBeDefined();
      expect(json.ast).toBeDefined();
      expect(Array.isArray(json.violations)).toBe(true);
      expect(Array.isArray(json.actionPlan)).toBe(true);
    });

    it("should execute 'agents profile' command and return architectural seams", () => {
      const proc = Bun.spawnSync([
        standaloneBabaPath,
        "agents",
        "profile",
        testProjectDir,
        "--json",
      ]);

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.archetype).toBeDefined();
      expect(json.runtime).toBeDefined();
      expect(json.seams).toBeDefined();
      expect(Array.isArray(json.activeSkills)).toBe(true);
    });

    it("should execute 'agents skill backend' command and render skill guidance", () => {
      const proc = Bun.spawnSync([
        standaloneBabaPath,
        "agents",
        "skill",
        "backend",
        testProjectDir,
        "--json",
      ]);

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.status).toBe("success");
      expect(json.skill).toBe("skill-backend");
      expect(json.content).toContain("Backend Engineering Guidelines");
    });

    it("should execute 'mcp wire' with '--dry-run' and return planned integrations", () => {
      const proc = Bun.spawnSync([
        standaloneBabaPath,
        "mcp",
        "wire",
        testProjectDir,
        "--dry-run",
        "--json",
      ]);

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.command).toBe("mcp wire");
      expect(json.dryRun).toBe(true);
      expect(Array.isArray(json.targets)).toBe(true);
    });

    it("should enforce strict quality gate '--strict' returning exit code 1 when threshold not met", () => {
      // Empty temp dir has composite score ~60, threshold 95 fails strict
      const emptyDir = path.join(tempDir, "empty-dir");
      fs.mkdirSync(emptyDir, { recursive: true });

      const proc = Bun.spawnSync([
        standaloneBabaPath,
        "wrap",
        emptyDir,
        "--strict",
        "--threshold",
        "95",
        "--dry-run",
      ]);

      expect(proc.exitCode).toBe(1);
      const output = proc.stdout.toString() + proc.stderr.toString();
      expect(output.toLowerCase()).toContain("strict mode failed");
    });
  });

  describe("Scenario 4: Strict CLI Alias Parity Across Standalone Executables (baba, bbyg, matryoshka)", () => {
    it("should yield identical exit code and stdout for '--version' across all three standalone aliases", () => {
      const procBaba = Bun.spawnSync([standaloneBabaPath, "--version"]);
      const procBbyg = Bun.spawnSync([standaloneBbygPath, "--version"]);
      const procMatryoshka = Bun.spawnSync([standaloneMatryoshkaPath, "--version"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString().trim();
      const outBbyg = procBbyg.stdout.toString().trim();
      const outMatryoshka = procMatryoshka.stdout.toString().trim();

      expect(outBaba).toBe(expectedVersion);
      expect(outBbyg).toBe(expectedVersion);
      expect(outMatryoshka).toBe(expectedVersion);
      expect(outBaba).toBe(outBbyg);
      expect(outBaba).toBe(outMatryoshka);
    });

    it("should yield identical exit code and stdout for '--help' across all three standalone aliases", () => {
      const procBaba = Bun.spawnSync([standaloneBabaPath, "--help"]);
      const procBbyg = Bun.spawnSync([standaloneBbygPath, "--help"]);
      const procMatryoshka = Bun.spawnSync([standaloneMatryoshkaPath, "--help"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString();
      const outBbyg = procBbyg.stdout.toString();
      const outMatryoshka = procMatryoshka.stdout.toString();

      expect(outBaba).toBe(outBbyg);
      expect(outBaba).toBe(outMatryoshka);
      expect(outBaba).toContain("Matryoshka-Harness CLI");
    });

    it("should yield identical JSON outputs for 'detect --json' across all three standalone aliases", () => {
      const procBaba = Bun.spawnSync([standaloneBabaPath, "detect", testProjectDir, "--json"]);
      const procBbyg = Bun.spawnSync([standaloneBbygPath, "detect", testProjectDir, "--json"]);
      const procMatryoshka = Bun.spawnSync([
        standaloneMatryoshkaPath,
        "detect",
        testProjectDir,
        "--json",
      ]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim());
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(jsonBaba).toEqual(jsonBbyg);
      expect(jsonBaba).toEqual(jsonMatryoshka);
    });

    it("should yield identical JSON outputs for 'scan --json' across all three standalone aliases", () => {
      const procBaba = Bun.spawnSync([standaloneBabaPath, "scan", testProjectDir, "--json"]);
      const procBbyg = Bun.spawnSync([standaloneBbygPath, "scan", testProjectDir, "--json"]);
      const procMatryoshka = Bun.spawnSync([
        standaloneMatryoshkaPath,
        "scan",
        testProjectDir,
        "--json",
      ]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim());
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(jsonBaba.status).toBe(jsonBbyg.status);
      expect(jsonBaba.oracleScore).toBe(jsonBbyg.oracleScore);
      expect(jsonBaba.oracleLevel).toBe(jsonBbyg.oracleLevel);
      expect(jsonBaba.primaryStack).toBe(jsonBbyg.primaryStack);

      expect(jsonBaba.status).toBe(jsonMatryoshka.status);
      expect(jsonBaba.oracleScore).toBe(jsonMatryoshka.oracleScore);
      expect(jsonBaba.oracleLevel).toBe(jsonMatryoshka.oracleLevel);
      expect(jsonBaba.primaryStack).toBe(jsonMatryoshka.primaryStack);
    });

    it("should yield identical JSON outputs for 'wrap --dry-run --json' across all three standalone aliases", () => {
      const procBaba = Bun.spawnSync([
        standaloneBabaPath,
        "wrap",
        testProjectDir,
        "--dry-run",
        "--json",
      ]);
      const procBbyg = Bun.spawnSync([
        standaloneBbygPath,
        "wrap",
        testProjectDir,
        "--dry-run",
        "--json",
      ]);
      const procMatryoshka = Bun.spawnSync([
        standaloneMatryoshkaPath,
        "wrap",
        testProjectDir,
        "--dry-run",
        "--json",
      ]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim());
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(jsonBaba.compositeScore).toBe(jsonBbyg.compositeScore);
      expect(jsonBaba.compositeScore).toBe(jsonMatryoshka.compositeScore);
      expect(jsonBaba.violations.length).toBe(jsonBbyg.violations.length);
      expect(jsonBaba.violations.length).toBe(jsonMatryoshka.violations.length);
    });

    it("should yield identical exit code 1 for unknown command across all three standalone aliases", () => {
      const procBaba = Bun.spawnSync([standaloneBabaPath, "invalid-cmd"]);
      const procBbyg = Bun.spawnSync([standaloneBbygPath, "invalid-cmd"]);
      const procMatryoshka = Bun.spawnSync([standaloneMatryoshkaPath, "invalid-cmd"]);

      expect(procBaba.exitCode).toBe(1);
      expect(procBbyg.exitCode).toBe(1);
      expect(procMatryoshka.exitCode).toBe(1);

      expect(procBaba.stderr.toString()).toContain("Unknown command 'invalid-cmd'");
      expect(procBbyg.stderr.toString()).toContain("Unknown command 'invalid-cmd'");
      expect(procMatryoshka.stderr.toString()).toContain("Unknown command 'invalid-cmd'");
    });
  });

  describe("Scenario 5: Parity Between Standalone Binaries and Dist/Package Artifacts", () => {
    it("should ensure dist/cli.js produces identical version to standalone binary", () => {
      const distCliPath = path.join(rootDir, "dist", "cli.js");
      expect(fs.existsSync(distCliPath)).toBe(true);

      const procDist = Bun.spawnSync([distCliPath, "--version"]);
      const procStandalone = Bun.spawnSync([standaloneBabaPath, "--version"]);

      expect(procDist.exitCode).toBe(0);
      expect(procStandalone.exitCode).toBe(0);
      expect(procDist.stdout.toString().trim()).toBe(procStandalone.stdout.toString().trim());
    });

    it("should ensure dist/cli.js produces identical help manual to standalone binary", () => {
      const distCliPath = path.join(rootDir, "dist", "cli.js");
      const procDist = Bun.spawnSync([distCliPath, "--help"]);
      const procStandalone = Bun.spawnSync([standaloneBabaPath, "--help"]);

      expect(procDist.exitCode).toBe(0);
      expect(procStandalone.exitCode).toBe(0);
      expect(procDist.stdout.toString().trim()).toBe(procStandalone.stdout.toString().trim());
    });

    it("should ensure dist/cli.js produces identical detect JSON to standalone binary", () => {
      const distCliPath = path.join(rootDir, "dist", "cli.js");
      const procDist = Bun.spawnSync([distCliPath, "detect", testProjectDir, "--json"]);
      const procStandalone = Bun.spawnSync([
        standaloneBabaPath,
        "detect",
        testProjectDir,
        "--json",
      ]);

      expect(procDist.exitCode).toBe(0);
      expect(procStandalone.exitCode).toBe(0);

      const jsonDist = JSON.parse(procDist.stdout.toString().trim());
      const jsonStandalone = JSON.parse(procStandalone.stdout.toString().trim());
      expect(jsonDist).toEqual(jsonStandalone);
    });

    it("should verify protective forwarding shells match standalone version and help parity", () => {
      for (const shell of PROTECTIVE_SHELLS) {
        const shellBinPath = path.join(rootDir, "packages", shell.name, "bin", `${shell.name}.js`);
        expect(fs.existsSync(shellBinPath)).toBe(true);

        const procShellVer = Bun.spawnSync(["bun", shellBinPath, "--version"]);
        expect(procShellVer.exitCode).toBe(0);
        expect(procShellVer.stdout.toString().trim()).toBe(expectedVersion);

        const procShellHelp = Bun.spawnSync(["bun", shellBinPath, "--help"]);
        expect(procShellHelp.exitCode).toBe(0);
        expect(procShellHelp.stdout.toString()).toContain("Matryoshka-Harness CLI");
      }
    });
  });
});
