import { describe, expect, it, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  DEFAULT_TARGETS,
  SUPPORTED_TARGETS,
  resolveTargets,
  computeSha256,
  formatChecksumsFile,
  buildBinary,
  buildAllBinaries,
  type BuildTarget,
  type BuildResult,
} from "../scripts/build-binaries";

describe("SPEC-16: Standalone Bun Binaries Compilation (Subtask 1)", () => {
  const tempDirs: string[] = [];

  const createTempDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-build-test-"));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    tempDirs.length = 0;
  });

  describe("Target Definitions & Resolution", () => {
    it("should define canonical DEFAULT_TARGETS matching PRD specifications", () => {
      expect(Array.isArray(DEFAULT_TARGETS)).toBe(true);
      expect(DEFAULT_TARGETS.length).toBeGreaterThanOrEqual(4);

      const targetNames = DEFAULT_TARGETS.map((t) => t.name);
      expect(targetNames).toContain("linux-x64");
      expect(targetNames).toContain("linux-arm64");
      expect(targetNames).toContain("darwin-arm64");
      expect(targetNames).toContain("windows-x64");

      const linuxX64 = DEFAULT_TARGETS.find((t) => t.name === "linux-x64");
      expect(linuxX64?.bunTarget).toBe("bun-linux-x64");
      expect(linuxX64?.outputName).toBe("baba-linux-x64");

      const darwinArm64 = DEFAULT_TARGETS.find((t) => t.name === "darwin-arm64");
      expect(darwinArm64?.bunTarget).toBe("bun-darwin-arm64");
      expect(darwinArm64?.outputName).toBe("baba-darwin-arm64");

      const windowsX64 = DEFAULT_TARGETS.find((t) => t.name === "windows-x64");
      expect(windowsX64?.bunTarget).toBe("bun-windows-x64");
      expect(windowsX64?.outputName).toBe("baba-windows-x64.exe");
    });

    it("should alias SUPPORTED_TARGETS to DEFAULT_TARGETS", () => {
      expect(SUPPORTED_TARGETS).toEqual(DEFAULT_TARGETS);
    });

    it("should resolve all targets when filter is omitted or empty", () => {
      expect(resolveTargets()).toEqual([...DEFAULT_TARGETS]);
      expect(resolveTargets([])).toEqual([...DEFAULT_TARGETS]);
      expect(resolveTargets(["all"])).toEqual([...DEFAULT_TARGETS]);
    });

    it("should resolve filtered targets by name or bun target", () => {
      const filtered = resolveTargets(["linux-x64", "darwin-arm64"]);
      expect(filtered.map((t) => t.name)).toEqual(["linux-x64", "darwin-arm64"]);

      const byBunTarget = resolveTargets(["bun-windows-x64"]);
      expect(byBunTarget.map((t) => t.name)).toEqual(["windows-x64"]);
    });

    it("should resolve 'current' or 'host' to the active platform/arch target", () => {
      const current = resolveTargets(["current"]);
      expect(current.length).toBe(1);
      const target = current[0]!;

      const expectedArch = os.arch();
      const expectedPlatform = os.platform();
      expect(target.arch).toBe(expectedArch === "x64" ? "x64" : "arm64");
      expect(target.platform).toBe(
        expectedPlatform === "win32" ? "windows" : (expectedPlatform as any),
      );
    });

    it("should throw an error on unknown target names", () => {
      expect(() => resolveTargets(["solaris-sparc"])).toThrow(/unknown or unsupported target/i);
    });
  });

  describe("SHA-256 Checksum Utilities", () => {
    it("should compute accurate SHA-256 hash for buffer and file", () => {
      const tempDir = createTempDir();
      const testFile = path.join(tempDir, "sample.txt");
      fs.writeFileSync(testFile, "matryoshka-harness-standalone-test\n");

      const hashFromFile = computeSha256(testFile);
      const hashFromBuffer = computeSha256(Buffer.from("matryoshka-harness-standalone-test\n"));

      expect(hashFromFile).toBe(hashFromBuffer);
      expect(hashFromFile).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should format canonical checksums.txt string with <hash>  <filename>", () => {
      const target0 = DEFAULT_TARGETS[0]!;
      const target1 = DEFAULT_TARGETS[1]!;
      const dummyResults: BuildResult[] = [
        {
          target: target0,
          outputFile: "baba-linux-x64",
          outputPath: "/dist/baba-linux-x64",
          sizeBytes: 123456,
          sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          success: true,
          durationMs: 100,
        },
        {
          target: target1,
          outputFile: "baba-darwin-arm64",
          outputPath: "/dist/baba-darwin-arm64",
          sizeBytes: 654321,
          sha256: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
          success: true,
          durationMs: 120,
        },
      ];

      const formatted = formatChecksumsFile(dummyResults);
      expect(formatted).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  baba-linux-x64\n" +
        "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e  baba-darwin-arm64\n",
      );
    });

    it("should omit failed builds from checksums file", () => {
      const target0 = DEFAULT_TARGETS[0]!;
      const target1 = DEFAULT_TARGETS[1]!;
      const dummyResults: BuildResult[] = [
        {
          target: target0,
          outputFile: "baba-linux-x64",
          outputPath: "/dist/baba-linux-x64",
          sizeBytes: 123456,
          sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          success: true,
          durationMs: 100,
        },
        {
          target: target1,
          outputFile: "baba-darwin-arm64",
          outputPath: "/dist/baba-darwin-arm64",
          sizeBytes: 0,
          sha256: "",
          success: false,
          error: "Compilation failed",
          durationMs: 50,
        },
      ];

      const formatted = formatChecksumsFile(dummyResults);
      expect(formatted).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  baba-linux-x64\n",
      );
    });
  });

  describe("Dry Run Simulation", () => {
    it("should simulate buildAllBinaries without writing files to disk", async () => {
      const tempDir = createTempDir();
      const summary = await buildAllBinaries({
        targets: ["linux-x64", "darwin-arm64"],
        outDir: tempDir,
        dryRun: true,
        silent: true,
      });

      expect(summary.success).toBe(true);
      expect(summary.results.length).toBe(2);
      expect(summary.results[0]!.success).toBe(true);
      expect(summary.results[1]!.success).toBe(true);

      // Verify no files were created on disk in dry-run
      const files = fs.readdirSync(tempDir);
      expect(files.length).toBe(0);
    });
  });

  describe("Compilation Execution (Current Platform)", () => {
    it("should compile a functional standalone binary for current host", async () => {
      const tempDir = createTempDir();
      const summary = await buildAllBinaries({
        targets: ["current"],
        outDir: tempDir,
        minify: true,
        generateChecksums: true,
        silent: true,
      });

      expect(summary.success).toBe(true);
      expect(summary.results.length).toBe(1);

      const result = summary.results[0]!;
      expect(result.success).toBe(true);
      expect(fs.existsSync(result.outputPath)).toBe(true);

      // Verify binary size > 0 and < 120MB
      const stats = fs.statSync(result.outputPath);
      expect(stats.size).toBeGreaterThan(1000);
      expect(stats.size).toBeLessThan(120 * 1024 * 1024);

      // Verify checksums.txt exists and contains hash
      const checksumsPath = path.join(tempDir, "checksums.txt");
      expect(fs.existsSync(checksumsPath)).toBe(true);
      const checksumsContent = fs.readFileSync(checksumsPath, "utf-8");
      expect(checksumsContent).toContain(result.sha256);
      expect(checksumsContent).toContain(result.outputFile);

      // Execute compiled binary and verify functionality
      const procVersion = Bun.spawnSync([result.outputPath, "--version"]);
      expect(procVersion.exitCode).toBe(0);
      expect(procVersion.stdout.toString().trim()).toMatch(/^\d+\.\d+\.\d+/);

      const procHelp = Bun.spawnSync([result.outputPath, "--help"]);
      expect(procHelp.exitCode).toBe(0);
      expect(procHelp.stdout.toString()).toContain("Matryoshka-Harness CLI");
    }, 30000);
  });

  describe("CLI Execution (scripts/build-binaries.ts)", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/build-binaries.ts");

    it("should display help text when invoked with --help", () => {
      const proc = Bun.spawnSync(["bun", "run", scriptPath, "--help"]);
      expect(proc.exitCode).toBe(0);
      const output = proc.stdout.toString();
      expect(output).toContain("Usage: build-binaries");
      expect(output).toContain("--targets");
      expect(output).toContain("--dry-run");
    });

    it("should support --dry-run and output structured JSON with --json", () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        scriptPath,
        "--targets",
        "linux-x64,darwin-arm64",
        "--dry-run",
        "--json",
      ]);

      expect(proc.exitCode).toBe(0);
      const json = JSON.parse(proc.stdout.toString().trim());
      expect(json.success).toBe(true);
      expect(Array.isArray(json.results)).toBe(true);
      expect(json.results.length).toBe(2);
      expect(json.results.map((r: any) => r.target.name)).toEqual(["linux-x64", "darwin-arm64"]);
    });

    it("should fail gracefully with exit code 1 when target is unknown", () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        scriptPath,
        "--targets",
        "nonexistent-os",
        "--dry-run",
      ]);

      expect(proc.exitCode).toBe(1);
    });
  });
});
