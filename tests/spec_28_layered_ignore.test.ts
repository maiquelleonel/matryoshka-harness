import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  walkCodebase,
  isIgnoredFile,
  loadBabaIgnorePatterns,
  resolveBabaIgnorePath,
} from "../src/ast";
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

  describe("Subtask 2: Add `--include-tests` flag across `baba wrap`, `baba scan`, and `baba agents audit`", () => {
    it("baba scan excludes entities in test suites by default, and includes them with --include-tests", async () => {
      fs.mkdirSync(path.join(tempDir, "src/routes"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "src/routes/users.ts"), "export const route = '/users';");

      fs.mkdirSync(path.join(tempDir, "tests/routes"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "tests/routes/test_mock_router.ts"), "export const mockRoute = '/test';");

      fs.mkdirSync(path.join(tempDir, "tests/controllers"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "tests/controllers/test_ctrl.ts"), "export const testCtrl = {};");

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "scan-test-app" }, null, 2)
      );

      // 1. Without --include-tests: tests/ routes and controllers must be excluded
      const procDefault = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      expect(procDefault.exitCode).toBe(0);
      const parsedDefault = JSON.parse(procDefault.stdout.toString().trim());

      const defaultRoutes = parsedDefault.entities.routes.map((r: string) => r.replace(/\\/g, "/"));
      const defaultControllers = parsedDefault.entities.controllers.map((c: string) => c.replace(/\\/g, "/"));

      expect(defaultRoutes).toContain("src/routes/users.ts");
      expect(defaultRoutes).not.toContain("tests/routes/test_mock_router.ts");
      expect(defaultControllers).not.toContain("tests/controllers/test_ctrl.ts");

      // 2. With --include-tests: tests/ routes and controllers must be included
      const procWithTests = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "scan",
        tempDir,
        "--include-tests",
        "--json",
      ]);
      expect(procWithTests.exitCode).toBe(0);
      const parsedWithTests = JSON.parse(procWithTests.stdout.toString().trim());

      const includedRoutes = parsedWithTests.entities.routes.map((r: string) => r.replace(/\\/g, "/"));
      const includedControllers = parsedWithTests.entities.controllers.map((c: string) => c.replace(/\\/g, "/"));

      expect(includedRoutes).toContain("src/routes/users.ts");
      expect(includedRoutes).toContain("tests/routes/test_mock_router.ts");
      expect(includedControllers).toContain("tests/controllers/test_ctrl.ts");
    });

    it("baba agents audit skips test suite instruction files by default, and audits them with --include-tests", async () => {
      // Setup a project with a bloated test fixture AGENTS.md inside tests/
      fs.mkdirSync(path.join(tempDir, "tests/fixtures"), { recursive: true });
      const bloatedInstructions = [
        "# Test Instructions",
        ...Array(400).fill("never do this action always avoid bad patterns"),
      ].join("\n");
      fs.writeFileSync(path.join(tempDir, "tests/fixtures/AGENTS.md"), bloatedInstructions, "utf-8");

      // 1. Without --include-tests: auditing inside tests/ directory should skip the test suite instructions
      const procDefault = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "audit",
        path.join(tempDir, "tests/fixtures"),
        "--json",
      ]);
      expect(procDefault.exitCode).toBe(0);
      const parsedDefault = JSON.parse(procDefault.stdout.toString().trim());
      expect(parsedDefault.summary.scannedFiles.length).toBe(0);
      expect(parsedDefault.violations.length).toBe(0);

      // 2. With --include-tests: auditing inside tests/ directory audits the file and flags violations
      const procWithTests = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "audit",
        path.join(tempDir, "tests/fixtures"),
        "--include-tests",
        "--json",
      ]);
      expect(procWithTests.exitCode).toBe(0);
      const parsedWithTests = JSON.parse(procWithTests.stdout.toString().trim());
      expect(parsedWithTests.summary.scannedFiles.length).toBe(1);
      expect(parsedWithTests.violations.length).toBeGreaterThanOrEqual(1);
    });

    it("verifies --include-tests CLI help presence across wrap, scan, and agents audit", async () => {
      // baba wrap --help
      const procWrap = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"]);
      expect(procWrap.stdout.toString()).toContain("--include-tests");

      // baba scan --help
      const procScan = Bun.spawnSync(["bun", "run", cliPath, "scan", "--help"]);
      expect(procScan.stdout.toString()).toContain("--include-tests");

      // baba agents audit --help
      const procAudit = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", "--help"]);
      expect(procAudit.stdout.toString()).toContain("--include-tests");
    });
  });

  describe("Subtask 3: Support loading .babaignore (with .bbygignore fallback) from the project root", () => {
    it("resolveBabaIgnorePath resolves .babaignore when present, .bbygignore when fallback, or null when neither exists", () => {
      // 1. Neither exists
      expect(resolveBabaIgnorePath(tempDir)).toBeNull();
      expect(loadBabaIgnorePatterns(tempDir)).toEqual([]);

      // 2. Only .bbygignore exists
      const bbygFile = path.join(tempDir, ".bbygignore");
      fs.writeFileSync(bbygFile, "dist/**\n*.log\n");
      expect(resolveBabaIgnorePath(tempDir)).toBe(bbygFile);
      expect(loadBabaIgnorePatterns(tempDir)).toEqual(["dist/**", "*.log"]);

      // 3. Both .babaignore and .bbygignore exist -> .babaignore takes precedence
      const babaFile = path.join(tempDir, ".babaignore");
      fs.writeFileSync(babaFile, "build/**\n# comment\n   temp/*  \n\r\n");
      expect(resolveBabaIgnorePath(tempDir)).toBe(babaFile);
      expect(loadBabaIgnorePatterns(tempDir)).toEqual(["build/**", "temp/*"]);

      // 4. Directory does not exist -> gracefully returns null and empty array
      const nonExistentDir = path.join(tempDir, "does-not-exist");
      expect(resolveBabaIgnorePath(nonExistentDir)).toBeNull();
      expect(loadBabaIgnorePatterns(nonExistentDir)).toEqual([]);
    });

    it("parses .babaignore with CRLF line endings, trims whitespace, and strips comments", () => {
      const babaFile = path.join(tempDir, ".babaignore");
      fs.writeFileSync(
        babaFile,
        "# Header comment\r\n  docs/**   \r\n\r\n# Another comment\r\nvendor/legacy  \r\n\r\n"
      );
      expect(loadBabaIgnorePatterns(tempDir)).toEqual(["docs/**", "vendor/legacy"]);
    });

    it("ensures discoverCodebaseEntities in scanner honors .babaignore and .bbygignore fallback", async () => {
      fs.mkdirSync(path.join(tempDir, "src/routes"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "ignored_routes"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/routes/active.ts"), "export const route = '/active';");
      fs.writeFileSync(path.join(tempDir, "ignored_routes/ignored.ts"), "export const route = '/ignored';");
      fs.writeFileSync(path.join(tempDir, ".babaignore"), "ignored_routes/**\n");

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "scan-ignore-app" }, null, 2)
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      const routes = parsed.entities.routes.map((r: string) => r.replace(/\\/g, "/"));

      expect(routes).toContain("src/routes/active.ts");
      expect(routes).not.toContain("ignored_routes/ignored.ts");
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
