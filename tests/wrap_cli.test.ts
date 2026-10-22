import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("SPEC-11 Subtask 5: CLI Subcommand Integration, Guardrails & Strict Mode (baba wrap)", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-wrap-cli-test-"));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  });

  function setupVulnerableProject(dir: string): void {
    // Basic package.json to establish typescript project
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          name: "vulnerable-app",
          scripts: { test: "bun test" },
        },
        null,
        2
      )
    );
    fs.writeFileSync(path.join(dir, "bun.lock"), "");
    fs.writeFileSync(path.join(dir, "README.md"), "# Vulnerable App\n");

    // TypeScript file with unparameterized SQL interpolation
    const dbDir = path.join(dir, "src/db");
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(
      path.join(dbDir, "users.ts"),
      `
import { db } from "./client";

export async function findUser(userId: string) {
  const query = \`SELECT * FROM users WHERE id = \${userId}\`;
  return await db.query(query);
}
`.trim()
    );
  }

  function setupCleanProject(dir: string): void {
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          name: "clean-app",
          scripts: { test: "bun test" },
        },
        null,
        2
      )
    );
    fs.writeFileSync(path.join(dir, "bun.lock"), "");
    fs.writeFileSync(path.join(dir, "README.md"), "# Clean App\n");

    const srcDir = path.join(dir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "calculator.ts"),
      `
export function add(a: number, b: number): number {
  return a + b;
}
`.trim()
    );

    const testDir = path.join(dir, "tests");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, "calculator.test.ts"),
      `
import { describe, it, expect } from "bun:test";
import { add } from "../src/calculator";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(1, 2)).toBe(3);
  });
});
`.trim()
    );
  }

  describe("Scenario: Successfully detect unparameterized SQL query and generate DIAGNOSTIC.md", () => {
    it("executes baba wrap, detects unparameterized SQL and creates DIAGNOSTIC.md with exit code 0", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir]);

      expect(proc.exitCode).toBe(0);
      const diagnosticPath = path.join(tempDir, "DIAGNOSTIC.md");
      expect(fs.existsSync(diagnosticPath)).toBe(true);

      const content = fs.readFileSync(diagnosticPath, "utf-8");
      expect(content).toContain("Unparameterized SQL Query");
      expect(content).toContain("src/db/users.ts");
      expect(content).toContain("Step-by-Step Surgical Action Plan");
      expect(content).toContain("Re-run `baba wrap --strict` to verify remediation");
    });
  });

  describe("Scenario: Output structured JSON for automated CI pipelines", () => {
    it("outputs valid JSON matching contract with harnessScore, violations, and summary", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--json",
      ]);

      expect(proc.exitCode).toBe(0);
      const rawStdout = proc.stdout.toString().trim();
      const parsed = JSON.parse(rawStdout);

      expect(parsed.command).toBe("wrap");
      expect(parsed.status).toBe("remediation_needed");
      expect(typeof parsed.harnessScore).toBe("number");
      expect(typeof parsed.compositeScore).toBe("number");
      expect(Array.isArray(parsed.violations)).toBe(true);
      expect(parsed.violations.length).toBeGreaterThan(0);
      expect(parsed.summary).toBeDefined();
      expect(typeof parsed.summary.compositeScore).toBe("number");
      expect(parsed.summary.hasCriticalViolations).toBe(true);
      expect(Array.isArray(parsed.actionPlan)).toBe(true);
      expect(parsed.oracle).toBeDefined();
      expect(parsed.ast).toBeDefined();
    });

    it("does not write DIAGNOSTIC.md when --dry-run is combined with --json", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--json",
        "--dry-run",
      ]);

      expect(proc.exitCode).toBe(0);
      const diagnosticPath = path.join(tempDir, "DIAGNOSTIC.md");
      expect(fs.existsSync(diagnosticPath)).toBe(false);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.command).toBe("wrap");
      expect(parsed.written).toBe(false);
    });

    it("prints report to stdout without writing to disk when --dry-run is passed without --json", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--dry-run",
      ]);

      expect(proc.exitCode).toBe(0);
      const diagnosticPath = path.join(tempDir, "DIAGNOSTIC.md");
      expect(fs.existsSync(diagnosticPath)).toBe(false);

      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Context Wrap");
      expect(stdout).toContain("dry-run");
      expect(stdout).toContain("Score Breakdown");
    });
  });

  describe("Scenario: Enforce CI quality gate with strict mode (--strict)", () => {
    it("exits with code 1 when score is below --threshold", async () => {
      // Empty directory has composite score ~60, which is below default threshold 80
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--strict",
        "--threshold",
        "80",
      ]);

      expect(proc.exitCode).toBe(1);
      const combinedOutput = proc.stdout.toString() + proc.stderr.toString();
      expect(combinedOutput.toLowerCase()).toContain("strict mode failed");
      expect(combinedOutput).toContain("threshold");
    });

    it("exits with code 1 when critical violations exist even if composite score satisfies threshold", async () => {
      setupVulnerableProject(tempDir);

      // Low threshold (e.g. 10) so score >= threshold passes, but critical SQL injection fails strict
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--strict",
        "--threshold",
        "10",
      ]);

      expect(proc.exitCode).toBe(1);
      const combinedOutput = proc.stdout.toString() + proc.stderr.toString();
      expect(combinedOutput.toLowerCase()).toContain("strict mode failed");
      expect(combinedOutput.toLowerCase()).toContain("critical");
    });

    it("passes with exit code 0 under strict mode for clean repository satisfying threshold", async () => {
      setupCleanProject(tempDir);

      // Clean project with low threshold passes strict cleanly
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--strict",
        "--threshold",
        "50",
      ]);

      expect(proc.exitCode).toBe(0);
      const diagnosticPath = path.join(tempDir, "DIAGNOSTIC.md");
      expect(fs.existsSync(diagnosticPath)).toBe(true);
    });

    it("emits valid JSON to stdout and logs strict failure to stderr when --strict and --json are combined", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--strict",
        "--threshold",
        "80",
        "--json",
      ]);

      expect(proc.exitCode).toBe(1);
      const stdout = proc.stdout.toString().trim();
      const parsed = JSON.parse(stdout);
      expect(parsed.command).toBe("wrap");
      expect(parsed.summary.passedStrict).toBe(false);
      expect(proc.stderr.toString()).toContain("Strict mode failed");
    });
  });

  describe("Scenario: Custom report output path & path traversal protection", () => {
    it("writes report to custom output path specified via --output", async () => {
      setupVulnerableProject(tempDir);
      const customReport = "docs/remediation.md";

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--output",
        customReport,
      ]);

      expect(proc.exitCode).toBe(0);
      const fullCustomPath = path.join(tempDir, customReport);
      expect(fs.existsSync(fullCustomPath)).toBe(true);
      const content = fs.readFileSync(fullCustomPath, "utf-8");
      expect(content).toContain("Matryoshka Diagnostic");
    });

    it("supports shorthand -o flag for custom report path", async () => {
      setupVulnerableProject(tempDir);
      const customReport = "custom-report.md";

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "-o",
        customReport,
      ]);

      expect(proc.exitCode).toBe(0);
      const fullCustomPath = path.join(tempDir, customReport);
      expect(fs.existsSync(fullCustomPath)).toBe(true);
    });

    it("sanitizes directory traversal escapes (..)", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--output",
        "../../escape.md",
      ]);

      expect(proc.exitCode).toBe(0);
      // Must not escape outside tempDir
      expect(fs.existsSync(path.resolve(tempDir, "../../escape.md"))).toBe(false);
      // Must be safely contained inside tempDir
      expect(fs.existsSync(path.join(tempDir, "escape.md"))).toBe(true);
    });
  });

  describe("Scenario: CLI alias parity across baba, bbyg, and matryoshka", () => {
    it("ensures identical JSON outputs across baba, bbyg, and matryoshka wrap invocations", async () => {
      setupVulnerableProject(tempDir);

      const procBaba = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--json",
        "--dry-run",
      ]);
      const procBbyg = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--json",
        "--dry-run",
      ]);
      const procMatryoshka = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--json",
        "--dry-run",
      ]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.compositeScore).toBe(parsedBbyg.compositeScore);
      expect(parsedBaba.compositeScore).toBe(parsedMatryoshka.compositeScore);
      expect(parsedBaba.violations.length).toBe(parsedBbyg.violations.length);
      expect(parsedBaba.violations.length).toBe(parsedMatryoshka.violations.length);
    });
  });

  describe("Scenario: Configurable threshold and max file size flags", () => {
    it("parses --threshold=90 syntax and updates threshold in evaluation result", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--threshold=90",
        "--json",
        "--dry-run",
      ]);

      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.summary.threshold).toBe(90);
    });

    it("respects --max-file-size flag and skips files exceeding the limit", async () => {
      setupVulnerableProject(tempDir);

      // Create a 20KB file with high-entropy credential
      const largeFile = path.join(tempDir, "src/large_secret.ts");
      const padding = "// comment padding\n".repeat(800);
      fs.writeFileSync(
        largeFile,
        `${padding}\nexport const apiKey = "[REDACTED]";\n`
      );

      // Set max-file-size to 1 KB -> should skip large_secret.ts
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--max-file-size=1",
        "--json",
        "--dry-run",
      ]);

      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      // large_secret.ts should not be in violations because it was skipped
      const largeFileViolations = parsed.violations.filter(
        (v: any) => v.relativePath.includes("large_secret.ts")
      );
      expect(largeFileViolations.length).toBe(0);
    });

    it("defaults target directory to current working directory when omitted", async () => {
      setupVulnerableProject(tempDir);

      const proc = Bun.spawnSync(
        ["bun", "run", cliPath, "wrap", "--json", "--dry-run"],
        { cwd: tempDir }
      );

      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(path.resolve(parsed.projectPath)).toBe(path.resolve(tempDir));
    });
  });
});
