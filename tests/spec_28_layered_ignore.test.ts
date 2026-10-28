import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  walkCodebase,
  isIgnoredFile,
  matchesPattern,
  loadBabaIgnorePatterns,
  resolveBabaIgnorePath,
  normalizeExcludePatterns,
  AstEngine,
} from "../src/ast";
import { parseExcludeFlags } from "../src/cli";
import { evaluateCompositeHarness } from "../src/scorer";
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

  describe("Subtask 4: Patterns must follow standard gitignore-style glob semantics", () => {
    it("handles * wildcard without crossing directory boundaries (/)", () => {
      expect(matchesPattern("src/index.ts", "src/*.ts")).toBe(true);
      expect(matchesPattern("src/nested/index.ts", "src/*.ts")).toBe(false);
      expect(matchesPattern("app.log", "*.log")).toBe(true);
      expect(matchesPattern("deep/dir/app.log", "*.log")).toBe(true);
      expect(matchesPattern("app.log.bak", "*.log")).toBe(false);
    });

    it("handles ? wildcard matching exactly one non-separator character", () => {
      expect(matchesPattern("file1.ts", "file?.ts")).toBe(true);
      expect(matchesPattern("fileA.ts", "file?.ts")).toBe(true);
      expect(matchesPattern("file.ts", "file?.ts")).toBe(false);
      expect(matchesPattern("file12.ts", "file?.ts")).toBe(false);
      expect(matchesPattern("file/a.ts", "file?.ts")).toBe(false);
    });

    it("handles character classes [...] and ranges [0-9], [a-z], and negated [!0-9]", () => {
      expect(matchesPattern("doc1.txt", "doc[0-9].txt")).toBe(true);
      expect(matchesPattern("doc9.txt", "doc[0-9].txt")).toBe(true);
      expect(matchesPattern("docA.txt", "doc[0-9].txt")).toBe(false);

      expect(matchesPattern("docA.txt", "doc[!0-9].txt")).toBe(true);
      expect(matchesPattern("doc1.txt", "doc[!0-9].txt")).toBe(false);

      expect(matchesPattern("alpha.txt", "[a-z]*.txt")).toBe(true);
      expect(matchesPattern("123.txt", "[a-z]*.txt")).toBe(false);
    });

    it("handles ** wildcard in leading, trailing, and middle positions (zero or more directories)", () => {
      // Leading **/
      expect(matchesPattern("config.json", "**/config.json")).toBe(true);
      expect(matchesPattern("sub/config.json", "**/config.json")).toBe(true);
      expect(matchesPattern("a/b/c/config.json", "**/config.json")).toBe(true);

      // Trailing /**
      expect(matchesPattern("temp", "temp/**")).toBe(true);
      expect(matchesPattern("temp/file.txt", "temp/**")).toBe(true);
      expect(matchesPattern("temp/a/b/file.txt", "temp/**")).toBe(true);
      expect(matchesPattern("other/temp/file.txt", "temp/**")).toBe(false);

      // Middle /**/ matching zero directories (a/b) and multiple directories (a/x/y/b)
      expect(matchesPattern("src/util.ts", "src/**/util.ts")).toBe(true);
      expect(matchesPattern("src/core/util.ts", "src/**/util.ts")).toBe(true);
      expect(matchesPattern("src/core/nested/util.ts", "src/**/util.ts")).toBe(true);
      expect(matchesPattern("other/src/util.ts", "src/**/util.ts")).toBe(false);
    });

    it("distinguishes anchored (/ leading or in middle) from unanchored patterns", () => {
      // Leading / anchors to root
      expect(matchesPattern("build", "/build")).toBe(true);
      expect(matchesPattern("build/output.js", "/build")).toBe(true);
      expect(matchesPattern("src/build", "/build")).toBe(false);
      expect(matchesPattern("src/build/output.js", "/build")).toBe(false);

      // Slash in middle anchors to root
      expect(matchesPattern("docs/api.md", "docs/*.md")).toBe(true);
      expect(matchesPattern("sub/docs/api.md", "docs/*.md")).toBe(false);

      // Unanchored pattern matches anywhere
      expect(matchesPattern("build", "build")).toBe(true);
      expect(matchesPattern("src/build", "build")).toBe(true);
      expect(matchesPattern("src/build/output.js", "build")).toBe(true);
    });

    it("handles directory-only trailing slash (dir/)", () => {
      // Matches directory and files within directory
      expect(matchesPattern("dist/bundle.js", "dist/")).toBe(true);
      expect(matchesPattern("sub/dist/bundle.js", "dist/")).toBe(true);
      expect(matchesPattern("dist", "dist/", true)).toBe(true);

      // Does not match regular file named dist when isDirectory is false
      expect(matchesPattern("dist", "dist/", false)).toBe(false);
    });

    it("supports negation (!) to un-ignore files in pattern lists", () => {
      expect(
        isIgnoredFile("app.log", {
          customPatterns: ["*.log", "!important.log"],
        })
      ).toBe(true);

      expect(
        isIgnoredFile("important.log", {
          customPatterns: ["*.log", "!important.log"],
        })
      ).toBe(false);

      expect(
        isIgnoredFile("docs/api.md", {
          babaIgnorePatterns: ["docs/**", "!docs/README.md"],
        })
      ).toBe(true);

      expect(
        isIgnoredFile("docs/README.md", {
          babaIgnorePatterns: ["docs/**", "!docs/README.md"],
        })
      ).toBe(false);
    });

    it("walkCodebase respects .babaignore negation (!) semantics", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const ok = 1;");
      fs.writeFileSync(path.join(tempDir, "docs/api.ts"), "export const api = 2;");
      fs.writeFileSync(path.join(tempDir, "docs/keep.ts"), "export const keep = 3;");

      fs.writeFileSync(
        path.join(tempDir, ".babaignore"),
        "docs/**\n!docs/keep.ts\n"
      );

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toContain("src/index.ts");
      expect(scannedPaths).toContain("docs/keep.ts");
      expect(scannedPaths).not.toContain("docs/api.ts");
    });
  });

  describe("Subtask 5: Relative paths matching patterns in this file must be bypassed during directory walks and AST parsing", () => {
    it("bypasses directory walks early when directory matches relative patterns in .babaignore (pruning subtree)", async () => {
      fs.mkdirSync(path.join(tempDir, "src/nested/ignored_dir/deep"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "src/nested/normal"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/nested/normal/valid.ts"), "export const ok = 1;");
      fs.writeFileSync(
        path.join(tempDir, "src/nested/ignored_dir/deep/file.ts"),
        "export const danger = 2;"
      );
      fs.writeFileSync(
        path.join(tempDir, ".babaignore"),
        "src/nested/ignored_dir/\n"
      );

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toContain("src/nested/normal/valid.ts");
      expect(scannedPaths).not.toContain("src/nested/ignored_dir/deep/file.ts");

      // Verify directory was pruned and registered as skipped with reason "ignored"
      const skippedRelPaths = result.skippedFiles.map((s) => s.relativePath.replace(/\\/g, "/"));
      expect(skippedRelPaths).toContain("src/nested/ignored_dir");
    });

    it("bypasses AST parsing for individual files matching relative patterns while scanning sibling files in the same directory", async () => {
      fs.mkdirSync(path.join(tempDir, "src/api"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/api/routes.ts"), "export const routes = [];");
      fs.writeFileSync(
        path.join(tempDir, "src/api/routes.generated.ts"),
        "export const generatedRoutes = [];"
      );

      fs.writeFileSync(
        path.join(tempDir, ".babaignore"),
        "src/api/*.generated.ts\n"
      );

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toContain("src/api/routes.ts");
      expect(scannedPaths).not.toContain("src/api/routes.generated.ts");

      const skipped = result.skippedFiles.find(
        (s) => s.relativePath.replace(/\\/g, "/") === "src/api/routes.generated.ts"
      );
      expect(skipped).toBeDefined();
      expect(skipped?.reason).toBe("ignored");
    });

    it("bypasses relative paths matching leading ./ patterns in .babaignore during directory walks and AST parsing", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "build"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const app = true;");
      fs.writeFileSync(path.join(tempDir, "build/bundle.ts"), "export const bundle = 1;");

      fs.writeFileSync(path.join(tempDir, ".babaignore"), "./build/**\n");

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toEqual(["src/index.ts"]);
    });

    it("AstEngine.walk bypasses relative paths matching .babaignore during walks and AST parsing", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "generated"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const app = 1;");
      fs.writeFileSync(path.join(tempDir, "generated/code.ts"), "export const code = 2;");

      fs.writeFileSync(path.join(tempDir, ".babaignore"), "generated/\n");

      const engine = new AstEngine();
      const result = await engine.walk(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toEqual(["src/index.ts"]);
    });

    it("bypasses files matching .babaignore relative patterns in composite harness evaluation, avoiding false-positive AST violations", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "legacy"), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "ignore-eval-app", scripts: { test: "bun test" } }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Ignore Eval App\n");

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const ok = 1;");
      // File with deliberate SQL interpolation antipattern
      fs.writeFileSync(
        path.join(tempDir, "legacy/hazard.ts"),
        "export function query(id: string) { return `SELECT * FROM table WHERE id = ${id}`; }"
      );

      fs.writeFileSync(path.join(tempDir, ".babaignore"), "legacy/**\n");

      const harnessResult = await evaluateCompositeHarness(tempDir);

      const sqlViolations = (harnessResult.violations || []).filter(
        (v) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);
      expect(harnessResult.totalFilesAnalyzed).toBe(1);
    });

    it("respects relative pattern negations during directory walks and AST parsing", async () => {
      fs.mkdirSync(path.join(tempDir, "modules/auth"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "modules/auth/public.ts"), "export const pub = true;");
      fs.writeFileSync(path.join(tempDir, "modules/auth/secret.ts"), "export const priv = false;");

      fs.writeFileSync(
        path.join(tempDir, ".babaignore"),
        "modules/auth/**\n!modules/auth/public.ts\n"
      );

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toContain("modules/auth/public.ts");
      expect(scannedPaths).not.toContain("modules/auth/secret.ts");
    });

    it("falls back to .bbygignore when .babaignore is not present and bypasses matching relative paths", async () => {
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

  describe("Subtask 6: Add `--exclude` option to `baba wrap`, `baba scan`, `baba agents generate`, and `baba agents audit`", () => {
    it("baba wrap respects --exclude to skip evaluating matching files and paths", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "legacy_hazards"), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "wrap-exclude-app", scripts: { test: "bun test" } }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Wrap Exclude App\n");

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const ok = 1;");
      fs.writeFileSync(
        path.join(tempDir, "legacy_hazards/sql.ts"),
        "export function q(id: string) { return `SELECT * FROM tbl WHERE id = ${id}`; }"
      );

      // Without --exclude: flags sql-interpolation
      const procWithout = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--dry-run",
        "--json",
      ]);
      expect(procWithout.exitCode).toBe(0);
      const parsedWithout = JSON.parse(procWithout.stdout.toString().trim());
      const sqlWithout = (parsedWithout.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlWithout.length).toBeGreaterThanOrEqual(1);

      // With --exclude: skips legacy_hazards/**
      const procWith = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        tempDir,
        "--dry-run",
        "--exclude",
        "legacy_hazards/**",
        "--json",
      ]);
      expect(procWith.exitCode).toBe(0);
      const parsedWith = JSON.parse(procWith.stdout.toString().trim());
      const sqlWith = (parsedWith.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlWith.length).toBe(0);
    });

    it("baba scan respects --exclude to skip discovering routes/controllers/models in matching paths", async () => {
      fs.mkdirSync(path.join(tempDir, "src/routes"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "ignored_routes"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/routes/active.ts"), "export const route = '/active';");
      fs.writeFileSync(path.join(tempDir, "ignored_routes/legacy.route.ts"), "export const route = '/legacy';");

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "scan-exclude-app" }, null, 2)
      );

      // Without --exclude
      const procWithout = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      expect(procWithout.exitCode).toBe(0);
      const parsedWithout = JSON.parse(procWithout.stdout.toString().trim());
      expect(parsedWithout.entities.routes.some((r: string) => r.includes("ignored_routes"))).toBe(true);

      // With --exclude
      const procWith = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "scan",
        tempDir,
        "--exclude",
        "ignored_routes/**",
        "--json",
      ]);
      expect(procWith.exitCode).toBe(0);
      const parsedWith = JSON.parse(procWith.stdout.toString().trim());
      expect(parsedWith.entities.routes.some((r: string) => r.includes("ignored_routes"))).toBe(false);
      expect(parsedWith.entities.routes.some((r: string) => r.includes("src/routes/active.ts"))).toBe(true);
    });

    it("baba agents generate respects --exclude during seam discovery and archetype profiling", async () => {
      fs.mkdirSync(path.join(tempDir, "src/controllers"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "src/controllers/user_ctrl.ts"), "export class UserController {}");

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "agents-exclude-app", dependencies: { express: "^4.18.0" } }, null, 2)
      );

      // Without --exclude: controllers seam is detected
      const procWithout = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "generate",
        tempDir,
        "--dry-run",
        "--json",
      ]);
      expect(procWithout.exitCode).toBe(0);
      const parsedWithout = JSON.parse(procWithout.stdout.toString().trim());
      expect(parsedWithout.seams.controllers.length).toBeGreaterThanOrEqual(1);

      // With --exclude: controllers matching pattern are omitted from discovered seams
      const procWith = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "generate",
        tempDir,
        "--dry-run",
        "--exclude",
        "src/controllers/**",
        "--json",
      ]);
      expect(procWith.exitCode).toBe(0);
      const parsedWith = JSON.parse(procWith.stdout.toString().trim());
      expect(parsedWith.seams.controllers.length).toBe(0);
    });

    it("baba agents audit respects --exclude to skip auditing matching instruction files", async () => {
      fs.mkdirSync(path.join(tempDir, "custom"), { recursive: true });
      const bloated = [
        "# Monolithic Guidelines",
        ...Array(400).fill("never do bad things always write tests"),
      ].join("\n");
      fs.writeFileSync(path.join(tempDir, "custom/AGENTS.md"), bloated, "utf-8");

      // Without --exclude: flags bloated file
      const procWithout = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "audit",
        path.join(tempDir, "custom"),
        "--json",
      ]);
      expect(procWithout.exitCode).toBe(0);
      const parsedWithout = JSON.parse(procWithout.stdout.toString().trim());
      expect(parsedWithout.summary.scannedFiles.length).toBe(1);

      // With --exclude: skips the instruction file entirely
      const procWith = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "audit",
        path.join(tempDir, "custom"),
        "--exclude",
        "custom/AGENTS.md",
        "--json",
      ]);
      expect(procWith.exitCode).toBe(0);
      const parsedWith = JSON.parse(procWith.stdout.toString().trim());
      expect(parsedWith.summary.scannedFiles.length).toBe(0);
      expect(parsedWith.violations.length).toBe(0);
    });

    it("verifies --exclude CLI option presence in --help across wrap, scan, agents generate, and agents audit", async () => {
      const procWrap = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"]);
      expect(procWrap.stdout.toString()).toContain("--exclude");

      const procScan = Bun.spawnSync(["bun", "run", cliPath, "scan", "--help"]);
      expect(procScan.stdout.toString()).toContain("--exclude");

      const procGenerate = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", "--help"]);
      expect(procGenerate.stdout.toString()).toContain("--exclude");

      const procAudit = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", "--help"]);
      expect(procAudit.stdout.toString()).toContain("--exclude");
    });

    it("ensures strict parity across aliases (baba, bbyg, matryoshka, matrioska) for --exclude", async () => {
      for (const alias of ["baba", "bbyg", "matryoshka", "matrioska"]) {
        const procWrap = Bun.spawnSync(["bun", "run", cliPath, "wrap", "--help"], {
          env: { ...process.env, BABA_ALIAS: alias },
        });
        expect(procWrap.stdout.toString()).toContain("--exclude");

        const procScan = Bun.spawnSync(["bun", "run", cliPath, "scan", "--help"], {
          env: { ...process.env, BABA_ALIAS: alias },
        });
        expect(procScan.stdout.toString()).toContain("--exclude");

        const procGenerate = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", "--help"], {
          env: { ...process.env, BABA_ALIAS: alias },
        });
        expect(procGenerate.stdout.toString()).toContain("--exclude");

        const procAudit = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", "--help"], {
          env: { ...process.env, BABA_ALIAS: alias },
        });
        expect(procAudit.stdout.toString()).toContain("--exclude");
      }
    });

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

  describe("Subtask 7: Accepts comma-separated values or repeated flags (e.g. `--exclude tests,docs` or `--exclude \"tests/**\" --exclude \"docs/**\"`)", () => {
    describe("parseExcludeFlags helper unit tests", () => {
      it("parses comma-separated values into a list of glob patterns", () => {
        const result = parseExcludeFlags(["--exclude", "tests,docs"]);
        expect(result).toEqual(["tests", "docs"]);
      });

      it("parses repeated --exclude flags into a combined list of glob patterns", () => {
        const result = parseExcludeFlags(["--exclude", "tests/**", "--exclude", "docs/**"]);
        expect(result).toEqual(["tests/**", "docs/**"]);
      });

      it("parses combined repeated flags and comma-separated values", () => {
        const result = parseExcludeFlags([
          "--exclude",
          "tests,docs",
          "--exclude",
          "scripts/**,fixtures/**",
        ]);
        expect(result).toEqual(["tests", "docs", "scripts/**", "fixtures/**"]);
      });

      it("parses --exclude=value syntax with comma-separated values and repeated flags", () => {
        const result1 = parseExcludeFlags(["--exclude=tests,docs"]);
        expect(result1).toEqual(["tests", "docs"]);

        const result2 = parseExcludeFlags(["--exclude=tests/**", "--exclude=docs/**"]);
        expect(result2).toEqual(["tests/**", "docs/**"]);

        const result3 = parseExcludeFlags(["--exclude=tests/**,docs/**", "--exclude", "scripts/**"]);
        expect(result3).toEqual(["tests/**", "docs/**", "scripts/**"]);
      });

      it("trims surrounding whitespace and quotes in patterns", () => {
        const result = parseExcludeFlags(["--exclude", '  "tests/**" , \'docs/**\' ,  scripts/**  ']);
        expect(result).toEqual(["tests/**", "docs/**", "scripts/**"]);
      });

      it("handles dangling --exclude or --exclude immediately followed by another flag", () => {
        expect(parseExcludeFlags(["--exclude"])).toEqual([]);
        expect(parseExcludeFlags(["--exclude", "--json"])).toEqual([]);
        expect(parseExcludeFlags(["--dry-run", "--exclude"])).toEqual([]);
      });
    });

    describe("normalizeExcludePatterns core utility", () => {
      it("normalizes a single comma-separated string into discrete patterns", () => {
        expect(normalizeExcludePatterns("tests,docs")).toEqual(["tests", "docs"]);
      });

      it("normalizes an array containing comma-separated strings", () => {
        expect(normalizeExcludePatterns(["tests,docs", "fixtures/**,build/**"])).toEqual([
          "tests",
          "docs",
          "fixtures/**",
          "build/**",
        ]);
      });

      it("normalizes mixed arrays, trims whitespace and filters out empty values", () => {
        expect(normalizeExcludePatterns([" tests , docs ", "", "  fixtures/** "])).toEqual([
          "tests",
          "docs",
          "fixtures/**",
        ]);
        expect(normalizeExcludePatterns(undefined)).toEqual([]);
      });
    });

    describe("walkCodebase and isIgnoredFile integration", () => {
      it("walkCodebase excludes multiple targets when given comma-separated excludePatterns", async () => {
        fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });

        fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const prod = 1;");
        fs.writeFileSync(path.join(tempDir, "tests/dummy.ts"), "export const test = 1;");
        fs.writeFileSync(path.join(tempDir, "docs/doc.ts"), "export const doc = 1;");

        const result = await walkCodebase(tempDir, {
          excludePatterns: ["tests/**,docs/**"],
        });
        const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

        expect(scannedPaths).toContain("src/index.ts");
        expect(scannedPaths).not.toContain("tests/dummy.ts");
        expect(scannedPaths).not.toContain("docs/doc.ts");
      });

      it("walkCodebase accepts exclude parameter as comma-separated or array", async () => {
        fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "dirA"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "dirB"), { recursive: true });

        fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const prod = 1;");
        fs.writeFileSync(path.join(tempDir, "dirA/a.ts"), "export const a = 1;");
        fs.writeFileSync(path.join(tempDir, "dirB/b.ts"), "export const b = 1;");

        const result = await walkCodebase(tempDir, {
          exclude: ["dirA/**", "dirB/**"],
        });
        const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

        expect(scannedPaths).toEqual(["src/index.ts"]);
      });

      it("isIgnoredFile respects comma-separated exclude patterns in options", () => {
        expect(
          isIgnoredFile("tests/foo.ts", {
            excludePatterns: ["tests/**,docs/**"],
          })
        ).toBe(true);

        expect(
          isIgnoredFile("docs/bar.ts", {
            excludePatterns: ["tests/**,docs/**"],
          })
        ).toBe(true);

        expect(
          isIgnoredFile("src/index.ts", {
            excludePatterns: ["tests/**,docs/**"],
          })
        ).toBe(false);
      });
    });

    describe("CLI commands integration with comma-separated and repeated --exclude", () => {
      it("baba wrap respects repeated --exclude flags across different folders", async () => {
        fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "hazards1"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "hazards2"), { recursive: true });

        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "wrap-rep-app", scripts: { test: "bun test" } }, null, 2)
        );
        fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
        fs.writeFileSync(path.join(tempDir, "README.md"), "# App\n");

        fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const ok = 1;");
        fs.writeFileSync(
          path.join(tempDir, "hazards1/sql1.ts"),
          "export const q1 = (id: string) => `SELECT * FROM t1 WHERE id = ${id}`;"
        );
        fs.writeFileSync(
          path.join(tempDir, "hazards2/sql2.ts"),
          "export const q2 = (id: string) => `SELECT * FROM t2 WHERE id = ${id}`;"
        );

        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "wrap",
          tempDir,
          "--dry-run",
          "--exclude",
          "hazards1/**",
          "--exclude",
          "hazards2/**",
          "--json",
        ]);
        expect(proc.exitCode).toBe(0);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        const sqlViolations = (parsed.violations || []).filter(
          (v: any) => v.ruleId === "sql-interpolation"
        );
        expect(sqlViolations.length).toBe(0);
      });

      it("baba wrap respects comma-separated and repeated --exclude= syntax", async () => {
        fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "hazards1"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "hazards2"), { recursive: true });

        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "wrap-eq-app", scripts: { test: "bun test" } }, null, 2)
        );
        fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
        fs.writeFileSync(path.join(tempDir, "README.md"), "# App\n");

        fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const ok = 1;");
        fs.writeFileSync(
          path.join(tempDir, "hazards1/sql1.ts"),
          "export const q1 = (id: string) => `SELECT * FROM t1 WHERE id = ${id}`;"
        );
        fs.writeFileSync(
          path.join(tempDir, "hazards2/sql2.ts"),
          "export const q2 = (id: string) => `SELECT * FROM t2 WHERE id = ${id}`;"
        );

        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "wrap",
          tempDir,
          "--dry-run",
          "--exclude=hazards1/**,hazards2/**",
          "--json",
        ]);
        expect(proc.exitCode).toBe(0);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        const sqlViolations = (parsed.violations || []).filter(
          (v: any) => v.ruleId === "sql-interpolation"
        );
        expect(sqlViolations.length).toBe(0);
      });

      it("baba scan respects comma-separated and repeated --exclude flags", async () => {
        fs.mkdirSync(path.join(tempDir, "src/routes"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "legacy_routes1"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "legacy_routes2"), { recursive: true });

        fs.writeFileSync(path.join(tempDir, "src/routes/live.ts"), "export const r = '/live';");
        fs.writeFileSync(path.join(tempDir, "legacy_routes1/r1.ts"), "export const r1 = '/r1';");
        fs.writeFileSync(path.join(tempDir, "legacy_routes2/r2.ts"), "export const r2 = '/r2';");

        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "scan-rep-app" }, null, 2)
        );

        // 1. Repeated flags
        const procRepeated = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "scan",
          tempDir,
          "--exclude",
          "legacy_routes1/**",
          "--exclude",
          "legacy_routes2/**",
          "--json",
        ]);
        expect(procRepeated.exitCode).toBe(0);
        const parsedRep = JSON.parse(procRepeated.stdout.toString().trim());
        expect(parsedRep.entities.routes.some((r: string) => r.includes("legacy_routes1"))).toBe(false);
        expect(parsedRep.entities.routes.some((r: string) => r.includes("legacy_routes2"))).toBe(false);
        expect(parsedRep.entities.routes.some((r: string) => r.includes("src/routes/live.ts"))).toBe(true);

        // 2. Comma-separated flag
        const procComma = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "scan",
          tempDir,
          "--exclude",
          "legacy_routes1/**,legacy_routes2/**",
          "--json",
        ]);
        expect(procComma.exitCode).toBe(0);
        const parsedComma = JSON.parse(procComma.stdout.toString().trim());
        expect(parsedComma.entities.routes.some((r: string) => r.includes("legacy_routes1"))).toBe(false);
        expect(parsedComma.entities.routes.some((r: string) => r.includes("legacy_routes2"))).toBe(false);
        expect(parsedComma.entities.routes.some((r: string) => r.includes("src/routes/live.ts"))).toBe(true);
      });

      it("baba agents generate respects comma-separated and repeated --exclude flags", async () => {
        fs.mkdirSync(path.join(tempDir, "src/controllers"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "src/models"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, "src/controllers/ctrl.ts"), "export class Ctrl {}");
        fs.writeFileSync(path.join(tempDir, "src/models/model.ts"), "export class Model {}");

        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "agents-rep-app", dependencies: { express: "^4.18.0" } }, null, 2)
        );

        // Comma-separated --exclude
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "agents",
          "generate",
          tempDir,
          "--dry-run",
          "--exclude",
          "src/controllers/**,src/models/**",
          "--json",
        ]);
        expect(proc.exitCode).toBe(0);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.seams.controllers.length).toBe(0);
        expect(parsed.seams.models.length).toBe(0);
      });

      it("baba agents audit respects comma-separated and repeated --exclude flags", async () => {
        fs.mkdirSync(path.join(tempDir, "dirA"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "dirB"), { recursive: true });

        const bloated = [
          "# Monolithic Guidelines",
          ...Array(400).fill("never do bad things always write tests"),
        ].join("\n");
        fs.writeFileSync(path.join(tempDir, "dirA/AGENTS.md"), bloated, "utf-8");
        fs.writeFileSync(path.join(tempDir, "dirB/AGENTS.md"), bloated, "utf-8");

        // Without --exclude: dirA/AGENTS.md fails audit
        const procWithout = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "agents",
          "audit",
          path.join(tempDir, "dirA"),
          "--json",
        ]);
        expect(procWithout.exitCode).toBe(0);
        const parsedWithout = JSON.parse(procWithout.stdout.toString().trim());
        expect(parsedWithout.summary.scannedFiles.length).toBe(1);
        expect(parsedWithout.violations.length).toBeGreaterThanOrEqual(1);

        // 1. Repeated --exclude flags
        const procRep = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "agents",
          "audit",
          path.join(tempDir, "dirA"),
          "--exclude",
          "dirA/AGENTS.md",
          "--exclude",
          "dirB/AGENTS.md",
          "--json",
        ]);
        expect(procRep.exitCode).toBe(0);
        const parsedRep = JSON.parse(procRep.stdout.toString().trim());
        expect(parsedRep.summary.scannedFiles.length).toBe(0);
        expect(parsedRep.violations.length).toBe(0);

        // 2. Comma-separated --exclude flag
        const procComma = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "agents",
          "audit",
          path.join(tempDir, "dirB"),
          "--exclude",
          "dirA/AGENTS.md,dirB/AGENTS.md",
          "--json",
        ]);
        expect(procComma.exitCode).toBe(0);
        const parsedComma = JSON.parse(procComma.stdout.toString().trim());
        expect(parsedComma.summary.scannedFiles.length).toBe(0);
        expect(parsedComma.violations.length).toBe(0);
      });
    });
  });

  describe("Subtask 8: **AC-1:** `baba wrap --dry-run` on a project containing `tests/ast_rules.test.ts` with literal SQL strings does not trigger SQL injection security remediation checklist by default", () => {
    it("does not report SQL injection in human output remediation checklist (dry-run content) by default", async () => {
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
export function testQuery(name: string) {
  return "SELECT * FROM accounts WHERE name = '" + name + "'";
}
        `.trim()
      );

      // Execute baba wrap in human dry-run mode
      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run"]);
      expect(proc.exitCode).toBe(0);

      const stdout = proc.stdout.toString();
      // Verify report is displayed in dry-run mode
      expect(stdout).toContain("# 🛡️ Matryoshka Diagnostic & Harness² Remediation Report");
      expect(stdout).toContain("[dry-run] (not written to disk)");

      // AC-1: Must NOT trigger SQL injection security remediation checklist
      expect(stdout).not.toContain("Fix SQL injection");
      expect(stdout).not.toContain("sql-interpolation");
      expect(stdout).not.toContain("tests/ast_rules.test.ts");
      expect(stdout).not.toContain("Unparameterized SQL Query");

      // Verify AST health reports 0 violations detected
      expect(stdout).toContain("AST Health:       100 / 100 (0 violation(s))");
      expect(stdout).toContain("No AST context-fencing violations detected. Repository is clean!");

      // Verify the Step-by-Step Surgical Action Plan checklist is present but contains NO SQL injection items
      expect(stdout).toContain("## 🎯 Step-by-Step Surgical Action Plan");
      const surgicalPlanSection = stdout.split("## 🎯 Step-by-Step Surgical Action Plan")[1] || "";
      expect(surgicalPlanSection.toLowerCase()).not.toContain("sql");
      expect(surgicalPlanSection).not.toContain("tests/ast_rules.test.ts");
    });

    it("does not include SQL injection violations or action plan items in JSON output by default", async () => {
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

      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run", "--json"]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      // By default tests/ must be excluded, so no sql-interpolation violation in ast violations
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);
      expect(parsed.summary.hasCriticalViolations).toBe(false);
      expect(parsed.summary.bySeverity.critical).toBe(0);
      expect(parsed.ast.score).toBe(100);

      // Verify actionPlan contains zero SQL injection remediation items
      const sqlActionPlan = (parsed.actionPlan || []).filter(
        (item: any) =>
          item.action?.toLowerCase().includes("sql") ||
          item.target?.includes("tests/ast_rules.test.ts") ||
          item.id === "sql-interpolation"
      );
      expect(sqlActionPlan.length).toBe(0);
    });

    it("does not trigger SQL injection remediation checklist when evaluating the workspace root which contains tests/ast_rules.test.ts", async () => {
      const workspaceRoot = path.resolve(__dirname, "..");
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "wrap",
        workspaceRoot,
        "--dry-run",
        "--json",
      ]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);

      const sqlActionPlan = (parsed.actionPlan || []).filter(
        (item: any) =>
          item.action?.toLowerCase().includes("sql") ||
          item.target?.includes("ast_rules.test.ts")
      );
      expect(sqlActionPlan.length).toBe(0);
    });

    it("maintains parity across all command aliases omitting SQL injection remediation checklist on tests/ast_rules.test.ts", async () => {
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
        `export const sql = (id: string) => \`SELECT * FROM users WHERE id = \${id}\`;`
      );

      for (const alias of ["baba", "bbyg", "matryoshka", "matrioska"]) {
        const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run"], {
          env: { ...process.env, BABA_ALIAS: alias },
        });
        expect(proc.exitCode).toBe(0);
        const output = proc.stdout.toString();
        expect(output).not.toContain("Fix SQL injection");
        expect(output).not.toContain("tests/ast_rules.test.ts");
      }
    });
  });

  describe("Subtask 9: **AC-2:** Passing `baba wrap --include-tests` evaluates `tests/` and reports any violations found inside test files", () => {
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

  describe("Subtask 10: **AC-3:** Adding `docs/**` to `.babaignore` successfully skips scanning the `docs` directory", () => {
    it("AC-3: Adding docs/** to .babaignore skips scanning docs directory in wrap --dry-run (JSON output)", async () => {
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

      // 1. Without .babaignore: docs/vulnerable.ts is scanned and triggers SQL injection
      const procWithout = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run", "--json"]);
      expect(procWithout.exitCode).toBe(0);
      const parsedWithout = JSON.parse(procWithout.stdout.toString().trim());
      const sqlWithout = (parsedWithout.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlWithout.length).toBeGreaterThanOrEqual(1);

      // 2. With docs/** in .babaignore: docs directory is completely skipped
      fs.writeFileSync(path.join(tempDir, ".babaignore"), "docs/**\n");

      const procWith = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run", "--json"]);
      expect(procWith.exitCode).toBe(0);

      const parsedWith = JSON.parse(procWith.stdout.toString().trim());
      const sqlWith = (parsedWith.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlWith.length).toBe(0);
      expect(parsedWith.ast.score).toBe(100);

      const sqlActionPlan = (parsedWith.actionPlan || []).filter(
        (item: any) => item.target?.includes("docs") || item.action?.toLowerCase().includes("sql")
      );
      expect(sqlActionPlan.length).toBe(0);
    });

    it("AC-3: Adding docs/** to .babaignore skips scanning docs directory in wrap --dry-run (Human output)", async () => {
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

      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run"]);
      expect(proc.exitCode).toBe(0);

      const stdout = proc.stdout.toString();
      expect(stdout).not.toContain("docs/vulnerable.ts");
      expect(stdout).not.toContain("Fix SQL injection");
      expect(stdout).toContain("AST Health:       100 / 100 (0 violation(s))");
    });

    it("AC-3: Adding docs/** to .babaignore skips scanning docs directory and nested subdirectories in walkCodebase", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "docs/guide/deep"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const clean = 1;");
      fs.writeFileSync(path.join(tempDir, "docs/overview.ts"), "export const doc1 = 1;");
      fs.writeFileSync(path.join(tempDir, "docs/guide/deep/nested.ts"), "export const doc2 = 2;");
      fs.writeFileSync(path.join(tempDir, ".babaignore"), "docs/**\n");

      const result = await walkCodebase(tempDir);
      const scannedPaths = result.scannedFiles.map((f) => f.relativePath.replace(/\\/g, "/"));

      expect(scannedPaths).toEqual(["src/index.ts"]);
      expect(scannedPaths).not.toContain("docs/overview.ts");
      expect(scannedPaths).not.toContain("docs/guide/deep/nested.ts");

      // Verify docs directory was registered as skipped with reason "ignored"
      const skippedRelPaths = result.skippedFiles.map((s) => s.relativePath.replace(/\\/g, "/"));
      expect(skippedRelPaths).toContain("docs");
    });

    it("AC-3: Adding docs/** to .babaignore skips scanning docs directory in baba scan", async () => {
      fs.mkdirSync(path.join(tempDir, "src/routes"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "docs/routes"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/routes/api.ts"), "export const route = '/api';");
      fs.writeFileSync(path.join(tempDir, "docs/routes/example.route.ts"), "export const exampleRoute = '/example';");

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "demo-scan-app" }, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, ".babaignore"), "docs/**\n");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      const routes = parsed.entities.routes.map((r: string) => r.replace(/\\/g, "/"));

      expect(routes).toContain("src/routes/api.ts");
      expect(routes).not.toContain("docs/routes/example.route.ts");
    });

    it("AC-3: Adding docs/** to .babaignore skips scanning docs directory in baba agents audit", async () => {
      fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
      const bloated = [
        "# Bloated Documentation Guidelines",
        ...Array(400).fill("never do bad things always write tests"),
      ].join("\n");
      fs.writeFileSync(path.join(tempDir, "docs/AGENTS.md"), bloated, "utf-8");
      fs.writeFileSync(path.join(tempDir, ".babaignore"), "docs/**\n");

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "audit",
        path.join(tempDir, "docs"),
        "--json",
      ]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.summary.scannedFiles.length).toBe(0);
      expect(parsed.violations.length).toBe(0);
    });

    it("AC-3: Adding docs/** to .bbygignore fallback successfully skips scanning docs directory", async () => {
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
      // Use .bbygignore fallback instead of .babaignore
      fs.writeFileSync(path.join(tempDir, ".bbygignore"), "docs/**\n");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run", "--json"]);
      expect(proc.exitCode).toBe(0);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      const sqlViolations = (parsed.violations || []).filter(
        (v: any) => v.ruleId === "sql-interpolation"
      );
      expect(sqlViolations.length).toBe(0);
      expect(parsed.ast.score).toBe(100);
    });

    it("AC-3: Parity across all command aliases (baba, bbyg, matryoshka, matrioska) for .babaignore docs/**", async () => {
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

      for (const alias of ["baba", "bbyg", "matryoshka", "matrioska"]) {
        const proc = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--dry-run"], {
          env: { ...process.env, BABA_ALIAS: alias },
        });
        expect(proc.exitCode).toBe(0);
        const output = proc.stdout.toString();
        expect(output).not.toContain("docs/vulnerable.ts");
        expect(output).not.toContain("Fix SQL injection");
      }
    });
  });

  describe("Subtask 11: **AC-4:** Passing `--exclude <pattern>` skips matched files even if absent from ignore files", () => {
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

  describe("Subtask 12: **AC-5:** Strict parity across all command aliases (`baba`, `bbyg`, `matryoshka`, `matrioska`)", () => {
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
