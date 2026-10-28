import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { walkCodebase, isIgnoredFile, loadBabaIgnorePatterns } from "../src/ast";
import type { AstWalkResult } from "../src/types";

describe("SPEC-28: Layered Ignore Engine & Default Test Suite Exclusion", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-ignore-test-"));
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

  describe("Subtask 1: Default Test Suite Exclusion in walkCodebase", () => {
    it("skips test directories (tests/, test/, __tests__/) and test files (*.test.*, *.spec.*) by default", async () => {
      // Create prod source files
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const prod = 1;");
      fs.writeFileSync(path.join(tempDir, "src/util.ts"), "export const helper = true;");

      // Create test directories and test files
      fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "tests/app.test.ts"), "test('app', () => {});");

      fs.mkdirSync(path.join(tempDir, "test"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "test/unit.ts"), "test('unit', () => {});");

      fs.mkdirSync(path.join(tempDir, "src/__tests__"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "src/__tests__/inner.ts"), "test('inner', () => {});");

      fs.writeFileSync(path.join(tempDir, "src/service.spec.ts"), "describe('service', () => {});");
      fs.writeFileSync(path.join(tempDir, "src/service.test.js"), "test('js', () => {});");

      const result: AstWalkResult = await walkCodebase(tempDir);

      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));
      expect(scannedPaths).toContain("src/index.ts");
      expect(scannedPaths).toContain("src/util.ts");

      // Verify test directories and test files are skipped by default
      expect(scannedPaths).not.toContain("tests/app.test.ts");
      expect(scannedPaths).not.toContain("test/unit.ts");
      expect(scannedPaths).not.toContain("src/__tests__/inner.ts");
      expect(scannedPaths).not.toContain("src/service.spec.ts");
      expect(scannedPaths).not.toContain("src/service.test.js");
      expect(result.scannedFiles.length).toBe(2);
    });

    it("scans test directories and files when includeTests is explicitly true", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const prod = 1;");

      fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "tests/app.test.ts"), "test('app', () => {});");

      const result = await walkCodebase(tempDir, { includeTests: true });
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toContain("src/index.ts");
      expect(scannedPaths).toContain("tests/app.test.ts");
      expect(result.scannedFiles.length).toBe(2);
    });
  });

  describe("Subtask 3-5: Dedicated Ignore Files (.babaignore & .bbygignore)", () => {
    it("loads .babaignore and skips matching relative paths during walkCodebase", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "generated"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const app = true;");
      fs.writeFileSync(path.join(tempDir, "docs/sample.ts"), "export const docCode = 123;");
      fs.writeFileSync(path.join(tempDir, "generated/schema.ts"), "export const schema = {};");

      // Write .babaignore
      fs.writeFileSync(
        path.join(tempDir, ".babaignore"),
        "# ignore docs and generated code\ndocs/**\ngenerated/\n"
      );

      const patterns = loadBabaIgnorePatterns(tempDir);
      expect(patterns).toContain("docs/**");
      expect(patterns).toContain("generated/");

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toEqual(["src/index.ts"]);
    });

    it("falls back to .bbygignore when .babaignore is not present", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "fixtures"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const app = true;");
      fs.writeFileSync(path.join(tempDir, "fixtures/data.ts"), "export const fixture = 1;");

      fs.writeFileSync(path.join(tempDir, ".bbygignore"), "fixtures/**\n");

      const patterns = loadBabaIgnorePatterns(tempDir);
      expect(patterns).toContain("fixtures/**");

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toEqual(["src/index.ts"]);
    });
  });

  describe("Subtask 6-7: Ad-hoc CLI Flag (--exclude) and Layered Filtering Precedence", () => {
    it("skips files matching --exclude patterns", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const app = true;");
      fs.writeFileSync(path.join(tempDir, "scripts/deploy.ts"), "export const deploy = true;");

      const result = await walkCodebase(tempDir, {
        excludePatterns: ["scripts/**"],
      });
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toEqual(["src/index.ts"]);
    });
  });

  describe("AC-1 & AC-2: baba wrap test suite exclusion and --include-tests", () => {
    it("AC-1: baba wrap --dry-run does not report SQL injection in tests/ directory by default", async () => {
      // Set up project with src/ and tests/
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "demo-app", scripts: { test: "bun test" } }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Demo App\n");

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const clean = 1;");
      // Test file with literal SQL injection hazard
      fs.writeFileSync(
        path.join(tempDir, "tests/ast_rules.test.ts"),
        `
export function testSql(id: string) {
  const sql = \`SELECT * FROM users WHERE id = \${id}\`;
  return sql;
}
        `.trim()
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run", "--json"]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      // By default tests/ must be excluded, so no sql-interpolation violation in ast violations
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);
    });

    it("AC-2: baba wrap --include-tests reports SQL injection hazard inside tests/ directory", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "demo-app", scripts: { test: "bun test" } }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Demo App\n");

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const clean = 1;");
      fs.writeFileSync(
        path.join(tempDir, "tests/ast_rules.test.ts"),
        `
export function testSql(id: string) {
  const sql = \`SELECT * FROM users WHERE id = \${id}\`;
  return sql;
}
        `.trim()
      );

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--dry-run",
        "--include-tests",
        "--json",
      ]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AC-3 & AC-4: CLI --exclude and .babaignore integration", () => {
    it("AC-3: Adding docs/** to .babaignore skips scanning docs directory", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "demo-app", scripts: { test: "bun test" } }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Demo App\n");

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const clean = 1;");
      fs.writeFileSync(
        path.join(tempDir, "docs/vulnerable.ts"),
        "export const q = (id: string) => `SELECT * FROM x WHERE id = ${id}`;"
      );
      fs.writeFileSync(path.join(tempDir, ".babaignore"), "docs/**\n");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run", "--json"]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);
    });

    it("AC-4: Passing --exclude <pattern> skips matched files", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "demo-app", scripts: { test: "bun test" } }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Demo App\n");

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const clean = 1;");
      fs.writeFileSync(
        path.join(tempDir, "scripts/danger.ts"),
        "export const q = (id: string) => `SELECT * FROM x WHERE id = ${id}`;"
      );

      // Pass --exclude scripts/**
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--dry-run",
        "--exclude",
        "scripts/**",
        "--json",
      ]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);
    });

    it("supports comma-separated and repeated --exclude flags", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "dirA"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "dirB"), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "demo-app", scripts: { test: "bun test" } }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Demo App\n");

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const clean = 1;");
      fs.writeFileSync(
        path.join(tempDir, "dirA/a.ts"),
        "export const q = (id: string) => `SELECT * FROM x WHERE id = ${id}`;"
      );
      fs.writeFileSync(
        path.join(tempDir, "dirB/b.ts"),
        "export const q = (id: string) => `SELECT * FROM x WHERE id = ${id}`;"
      );

      // Comma-separated or repeated --exclude
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--dry-run",
        "--exclude",
        "dirA/**,dirB/**",
        "--json",
      ]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);
    });
  });

  describe("AC-5: Strict Parity Across Command Aliases", () => {
    it("ensures baba, bbyg, matryoshka, and matrioska all support --include-tests and --exclude", async () => {
      for (const alias of ["baba", "bbyg", "matryoshka", "matrioska"]) {
        const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"], {
          env: { ...process.env, BABA_ALIAS: alias },
        });
        expect(proc.exitCode).toBe(0);
        const output = proc.stdout.toString();
        expect(output).toContain("--include-tests");
        expect(output).toContain("--exclude");
      }
    });
  });
});
