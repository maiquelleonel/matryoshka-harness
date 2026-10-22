import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  MAX_DIAGNOSTIC_TOKENS,
  CANONICAL_RULE_TITLES,
  compileDiagnosticMarkdown,
  formatWrapJsonOutput,
  writeDiagnosticReport,
  inspectDiagnosticTokenBudget,
} from "../src/report";
import type {
  AstLanguage,
  AstViolation,
  AstViolationSeverity,
  Harness2EvaluationResult,
  SurgicalActionItem,
} from "../src/types";

describe("SPEC-11: DIAGNOSTIC.md & JSON Report Compilers (Subtask 4)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-diag-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  function createMockEvaluationResult(overrides?: Partial<Harness2EvaluationResult>): Harness2EvaluationResult {
    const mockViolations: AstViolation[] = [
      {
        id: "sql-interpolation-src/db/users.ts-42-15",
        ruleId: "sql-interpolation",
        severity: "critical",
        message: "Unparameterized SQL query constructed via template literal interpolation.",
        filePath: path.join(tempDir, "src/db/users.ts"),
        relativePath: "src/db/users.ts",
        line: 42,
        column: 15,
        nodeType: "TemplateLiteral",
        codeSnippet: "const res = await db.query(`SELECT * FROM users WHERE id = ${userId}`);",
        remediation: "Use parameterized queries or bound arguments (e.g., 'SELECT * FROM users WHERE id = $1', [userId]) instead of string interpolation.",
      },
      {
        id: "assertionless-test-tests/unit/auth.test.ts-18-5",
        ruleId: "assertionless-test",
        severity: "high",
        message: "Test case 'auth' has no behavioral assertions or expectations.",
        filePath: path.join(tempDir, "tests/unit/auth.test.ts"),
        relativePath: "tests/unit/auth.test.ts",
        line: 18,
        column: 5,
        nodeType: "CallExpression",
        codeSnippet: "it('authenticates user', async () => { client.authenticate(); });",
        remediation: "Add at least one explicit assertion (e.g., 'expect(client.isAuthenticated()).toBe(true)') to verify behavior.",
      },
      {
        id: "hardcoded-credential-src/config/api.ts-12-7",
        ruleId: "hardcoded-credential",
        severity: "critical",
        message: "Hardcoded credential token matching known secret prefix.",
        filePath: path.join(tempDir, "src/config/api.ts"),
        relativePath: "src/config/api.ts",
        line: 12,
        column: 7,
        nodeType: "StringLiteral",
        codeSnippet: 'const apiKey = "[REDACTED]";',
        remediation: "Extract hardcoded secret into environment variable (e.g., process.env.API_KEY) and inject securely at runtime.",
      },
    ];

    const mockActionPlan: SurgicalActionItem[] = [
      {
        id: "sql-interpolation-src/db/users.ts-42-15",
        source: "ast",
        severity: "critical",
        title: "Unparameterized SQL query constructed via template literal interpolation.",
        description: "const res = await db.query(`SELECT * FROM users WHERE id = ${userId}`);",
        target: "src/db/users.ts:42",
        action: "Fix SQL injection in src/db/users.ts:42 using bind parameters.",
        remediation: "Use parameterized queries or bound arguments (e.g., 'SELECT * FROM users WHERE id = $1', [userId]) instead of string interpolation.",
      },
      {
        id: "hardcoded-credential-src/config/api.ts-12-7",
        source: "ast",
        severity: "critical",
        title: "Hardcoded credential token matching known secret prefix.",
        description: 'const apiKey = "[REDACTED]";',
        target: "src/config/api.ts:12",
        action: "Extract hardcoded secret in src/config/api.ts:12 to environment variable.",
        remediation: "Extract hardcoded secret into environment variable (e.g., process.env.API_KEY) and inject securely at runtime.",
      },
      {
        id: "assertionless-test-tests/unit/auth.test.ts-18-5",
        source: "ast",
        severity: "high",
        title: "Test case 'auth' has no behavioral assertions or expectations.",
        description: "it('authenticates user', async () => { client.authenticate(); });",
        target: "tests/unit/auth.test.ts:18",
        action: "Add behavioral assertion to tests/unit/auth.test.ts:18.",
        remediation: "Add at least one explicit assertion (e.g., 'expect(client.isAuthenticated()).toBe(true)') to verify behavior.",
      },
    ];

    const languagesCount: Record<AstLanguage, number> = {
      typescript: 22,
      javascript: 0,
      python: 12,
      go: 8,
      rust: 0,
    };

    return {
      compositeScore: 84,
      status: "PASS",
      threshold: 80,
      passedThreshold: true,
      hasCriticalViolations: true,
      passedStrict: false,
      oracle: {
        rawScore: 92,
        maxScore: 105,
        normalizedScore: 88,
        level: "L3",
        source: "subprocess",
        totalGaps: 1,
      },
      ast: {
        score: 81,
        totalDeductions: 19,
        violationsCount: 3,
        bySeverity: {
          critical: 2,
          high: 1,
          medium: 0,
          low: 0,
        },
        penaltiesApplied: {
          critical: 30,
          high: 8,
          medium: 0,
          low: 0,
        },
      },
      aggregatedGaps: {
        totalCount: 4,
        astViolationsCount: 3,
        oracleGapsCount: 1,
        hasCriticalViolations: true,
        bySeverity: {
          critical: 2,
          high: 1,
          medium: 0,
          low: 0,
        },
        byRule: {
          "sql-interpolation": 1,
          "hardcoded-credential": 1,
          "assertionless-test": 1,
        },
        byAxis: {
          context: 1,
          skills: 0,
          guardrails: 0,
          sensors: 0,
          hygiene: 0,
        },
        actionPlan: mockActionPlan,
      },
      violations: mockViolations,
      projectPath: tempDir,
      totalFilesAnalyzed: 42,
      languagesCount,
      skippedFilesCount: 2,
      timestamp: "2026-10-22T21:00:00.000Z",
      executionTimeMs: 145,
      ...overrides,
    };
  }

  describe("Constants & Configuration", () => {
    it("defines canonical MAX_DIAGNOSTIC_TOKENS as 1500", () => {
      expect(MAX_DIAGNOSTIC_TOKENS).toBe(1500);
    });

    it("maps canonical rule titles to human/agent-readable descriptions", () => {
      expect(CANONICAL_RULE_TITLES["sql-interpolation"]).toBe("Unparameterized SQL Query (SQL Injection Hazard)");
      expect(CANONICAL_RULE_TITLES["assertionless-test"]).toBe("Assertionless Test Case (False Green Hazard)");
      expect(CANONICAL_RULE_TITLES["hardcoded-credential"]).toBe("Hardcoded Credential / Secret Leaked");
    });
  });

  describe("Scenario 1: Deterministic DIAGNOSTIC.md Markdown Compiler (compileDiagnosticMarkdown)", () => {
    it("compiles full diagnostic report matching PRD specification", () => {
      const result = createMockEvaluationResult();
      const markdown = compileDiagnosticMarkdown(result);

      // Header
      expect(markdown).toContain("# 🛡️ Matryoshka Diagnostic & Harness² Remediation Report");
      expect(markdown).toContain("**Generated:** 2026-10-22T21:00:00.000Z");
      expect(markdown).toContain(`**Target Repository:** \`${tempDir}\``);
      expect(markdown).toContain("**Harness² Composite Score:** **84 / 100** [Status: PASS]");

      // Score Breakdown
      expect(markdown).toContain("## 📊 Score Breakdown");
      expect(markdown).toContain("- **Base Repository Hygiene (Oracle):** 88 / 100");
      expect(markdown).toContain("- **AST Context-Fencing Health:** 81 / 100");
      expect(markdown).toContain("- **Total Files Analyzed:** 42 files (8 Go, 12 Python, 22 TypeScript)");
      expect(markdown).toContain("- **Violations Detected:** 2 Critical, 1 High");

      // Detected Violations
      expect(markdown).toContain("## 🚨 Detected AST Violations");
      expect(markdown).toContain("[CRITICAL] Unparameterized SQL Query (SQL Injection Hazard)");
      expect(markdown).toContain("- **File:** `src/db/users.ts:42`");
      expect(markdown).toContain("- **Node Type:** `TemplateLiteral`");
      expect(markdown).toContain("- **Remediation:** Use parameterized queries or bound arguments");

      expect(markdown).toContain("[HIGH] Assertionless Test Case (False Green Hazard)");
      expect(markdown).toContain("- **File:** `tests/unit/auth.test.ts:18`");
      expect(markdown).toContain("- **Node Type:** `CallExpression`");

      // Action Plan
      expect(markdown).toContain("## 🎯 Step-by-Step Surgical Action Plan");
      expect(markdown).toContain("1. [ ] Fix SQL injection in `src/db/users.ts:42` using bind parameters.");
      expect(markdown).toContain("2. [ ] Extract hardcoded secret in `src/config/api.ts:12` to environment variable.");
      expect(markdown).toContain("3. [ ] Add behavioral assertion to `tests/unit/auth.test.ts:18`.");
      expect(markdown).toContain("4. [ ] Re-run `baba wrap --strict` to verify remediation.");
    });

    it("renders clean state when repository has 100 score and zero violations", () => {
      const cleanResult = createMockEvaluationResult({
        compositeScore: 100,
        status: "PASS",
        passedThreshold: true,
        hasCriticalViolations: false,
        passedStrict: true,
        violations: [],
        ast: {
          score: 100,
          totalDeductions: 0,
          violationsCount: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          penaltiesApplied: { critical: 0, high: 0, medium: 0, low: 0 },
        },
        aggregatedGaps: {
          totalCount: 0,
          astViolationsCount: 0,
          oracleGapsCount: 0,
          hasCriticalViolations: false,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          byRule: {},
          byAxis: { context: 0, skills: 0, guardrails: 0, sensors: 0, hygiene: 0 },
          actionPlan: [],
        },
      });

      const markdown = compileDiagnosticMarkdown(cleanResult);

      expect(markdown).toContain("**Harness² Composite Score:** **100 / 100** [Status: PASS]");
      expect(markdown).toContain("- **Violations Detected:** None (Clean)");
      expect(markdown).toContain("No AST context-fencing violations detected. Repository is clean!");
      expect(markdown).toContain("1. [x] All governance gates and AST context-fencing rules satisfied.");
      expect(markdown).toContain("2. [ ] Re-run `baba wrap --strict` in CI to ensure continuous compliance.");
    });

    it("renders NEEDS REMEDIATION status when score < threshold", () => {
      const failingResult = createMockEvaluationResult({
        compositeScore: 65,
        status: "NEEDS_REMEDIATION",
        passedThreshold: false,
        passedStrict: false,
      });

      const markdown = compileDiagnosticMarkdown(failingResult);
      expect(markdown).toContain("**Harness² Composite Score:** **65 / 100** [Status: NEEDS REMEDIATION]");
    });

    it("supports custom remediationCommand option", () => {
      const result = createMockEvaluationResult();
      const markdown = compileDiagnosticMarkdown(result, {
        remediationCommand: "matryoshka wrap --strict --threshold 85",
      });

      expect(markdown).toContain("Re-run `matryoshka wrap --strict --threshold 85` to verify remediation.");
    });

    it("produces byte-for-byte identical output for repeated invocations (Idempotency)", () => {
      const result = createMockEvaluationResult();
      const output1 = compileDiagnosticMarkdown(result);
      const output2 = compileDiagnosticMarkdown(result);

      expect(output1).toBe(output2);
    });
  });

  describe("Scenario 2: Token Budget Guardrail (inspectDiagnosticTokenBudget)", () => {
    it("evaluates markdown token count within budget (< 1500 tokens)", () => {
      const result = createMockEvaluationResult();
      const markdown = compileDiagnosticMarkdown(result);
      const budget = inspectDiagnosticTokenBudget(markdown);

      expect(budget.tokenCount).toBeGreaterThan(0);
      expect(budget.tokenCount).toBeLessThan(MAX_DIAGNOSTIC_TOKENS);
      expect(budget.withinBudget).toBe(true);
      expect(budget.exceededBy).toBe(0);
    });

    it("truncates excessive violations gracefully when exceeding token budget", () => {
      // Create 40 violations to simulate bloated diagnostic output
      const manyViolations: AstViolation[] = [];
      const manyActions: SurgicalActionItem[] = [];

      for (let i = 1; i <= 40; i++) {
        const line = i * 5;
        manyViolations.push({
          id: `sql-interpolation-src/db/repo_${i}.ts-${line}-10`,
          ruleId: "sql-interpolation",
          severity: "critical",
          message: `Unparameterized SQL query constructed via dynamic string formatting in repo ${i}.`,
          filePath: path.join(tempDir, `src/db/repo_${i}.ts`),
          relativePath: `src/db/repo_${i}.ts`,
          line,
          column: 10,
          nodeType: "TemplateLiteral",
          codeSnippet: `const row = await db.query(\`SELECT * FROM items_${i} WHERE val = '\${val}'\`);`,
          remediation: `Use parameterized query for table items_${i}.`,
        });

        manyActions.push({
          id: `sql-interpolation-src/db/repo_${i}.ts-${line}-10`,
          source: "ast",
          severity: "critical",
          title: `SQL injection in repo ${i}`,
          target: `src/db/repo_${i}.ts:${line}`,
          action: `Fix SQL injection in src/db/repo_${i}.ts:${line}.`,
        });
      }

      const bloatedResult = createMockEvaluationResult({
        violations: manyViolations,
        aggregatedGaps: {
          totalCount: 40,
          astViolationsCount: 40,
          oracleGapsCount: 0,
          hasCriticalViolations: true,
          bySeverity: { critical: 40, high: 0, medium: 0, low: 0 },
          byRule: { "sql-interpolation": 40 },
          byAxis: { context: 0, skills: 0, guardrails: 0, sensors: 0, hygiene: 0 },
          actionPlan: manyActions,
        },
      });

      const markdown = compileDiagnosticMarkdown(bloatedResult, {
        maxTokens: 800,
        truncateOnBudget: true,
      });

      const budget = inspectDiagnosticTokenBudget(markdown, 800);
      expect(budget.withinBudget).toBe(true);
      expect(markdown).toContain("omitted for context window optimization");
      expect(markdown).toContain("baba wrap --json");
    });
  });

  describe("Scenario 3: Structured JSON Report Compiler (formatWrapJsonOutput)", () => {
    it("produces valid JSON containing 'harnessScore', 'violations', and 'summary' keys", () => {
      const result = createMockEvaluationResult();
      const json = formatWrapJsonOutput(result);

      // Top level PRD invariants
      expect(json).toHaveProperty("harnessScore", 84);
      expect(json).toHaveProperty("violations");
      expect(json).toHaveProperty("summary");
      expect(Array.isArray(json.violations)).toBe(true);
      expect(typeof json.summary).toBe("object");

      // Dual format keys (snake_case and camelCase)
      expect(json.harness_score).toBe(84);
      expect(json.compositeScore).toBe(84);
      expect(json.composite_score).toBe(84);
      expect(json.projectPath).toBe(tempDir);
      expect(json.project_path).toBe(tempDir);
      expect(json.command).toBe("wrap");

      // Summary subkeys
      expect(json.summary.compositeScore).toBe(84);
      expect(json.summary.composite_score).toBe(84);
      expect(json.summary.oracleScore).toBe(88);
      expect(json.summary.oracle_score).toBe(88);
      expect(json.summary.astScore).toBe(81);
      expect(json.summary.ast_score).toBe(81);
      expect(json.summary.totalFilesAnalyzed).toBe(42);
      expect(json.summary.total_files_analyzed).toBe(42);
      expect(json.summary.totalViolations).toBe(3);
      expect(json.summary.total_violations).toBe(3);
      expect(json.summary.bySeverity.critical).toBe(2);
      expect(json.summary.by_severity.critical).toBe(2);

      // Violations structure
      expect(json.violations.length).toBe(3);
      const first = json.violations[0];
      expect(first.ruleId).toBe("sql-interpolation");
      expect(first.rule_id).toBe("sql-interpolation");
      expect(first.severity).toBe("critical");
      expect(first.relativePath).toBe("src/db/users.ts");
      expect(first.relative_path).toBe("src/db/users.ts");
      expect(first.line).toBe(42);
      expect(first.nodeType).toBe("TemplateLiteral");
      expect(first.node_type).toBe("TemplateLiteral");
      expect(first.codeSnippet).toContain("db.query");
      expect(first.code_snippet).toContain("db.query");

      // Action plan dual format
      expect(json.actionPlan).toBeDefined();
      expect(json.action_plan).toBeDefined();
      expect(json.actionPlan.length).toBe(3);
    });

    it("serializes cleanly to JSON string without circular references", () => {
      const result = createMockEvaluationResult();
      const json = formatWrapJsonOutput(result);
      const str = JSON.stringify(json, null, 2);

      expect(typeof str).toBe("string");
      const parsed = JSON.parse(str);
      expect(parsed.harnessScore).toBe(84);
      expect(parsed.violations.length).toBe(3);
    });
  });

  describe("Scenario 4: Atomic Report Persistence & Dry-Run (writeDiagnosticReport)", () => {
    it("writes DIAGNOSTIC.md atomically to default project root", async () => {
      const result = createMockEvaluationResult();
      const writeResult = await writeDiagnosticReport(tempDir, result);

      expect(writeResult.written).toBe(true);
      expect(writeResult.dryRun).toBe(false);
      expect(writeResult.reportPath).toBe(path.join(tempDir, "DIAGNOSTIC.md"));
      expect(fs.existsSync(writeResult.reportPath)).toBe(true);

      const content = fs.readFileSync(writeResult.reportPath, "utf-8");
      expect(content).toContain("# 🛡️ Matryoshka Diagnostic & Harness² Remediation Report");
      expect(content).toContain("src/db/users.ts:42");
    });

    it("creates parent directories recursively when custom outputPath is provided", async () => {
      const result = createMockEvaluationResult();
      const customSubdir = path.join(tempDir, "nested", "reports", "custom-diag.md");

      const writeResult = await writeDiagnosticReport(tempDir, result, {
        outputPath: customSubdir,
      });

      expect(writeResult.written).toBe(true);
      expect(writeResult.reportPath).toBe(customSubdir);
      expect(fs.existsSync(customSubdir)).toBe(true);
    });

    it("does not write any file to disk when dryRun is true", async () => {
      const result = createMockEvaluationResult();
      const expectedPath = path.join(tempDir, "DIAGNOSTIC.md");

      const writeResult = await writeDiagnosticReport(tempDir, result, {
        dryRun: true,
      });

      expect(writeResult.written).toBe(false);
      expect(writeResult.dryRun).toBe(true);
      expect(writeResult.content).toBeDefined();
      expect(writeResult.content).toContain("# 🛡️ Matryoshka Diagnostic & Harness² Remediation Report");
      expect(fs.existsSync(expectedPath)).toBe(false);
    });

    it("prevents path traversal escaping project directory safely", async () => {
      const result = createMockEvaluationResult();
      const maliciousPath = "../../../../../tmp/escaped_diagnostic.md";

      // Should normalize safely within project or throw an explicit security error
      const writeResult = await writeDiagnosticReport(tempDir, result, {
        outputPath: maliciousPath,
      });

      // Verification: must not write outside or sanitize path
      expect(writeResult.reportPath.startsWith(path.resolve("/tmp/escaped_diagnostic.md"))).toBe(false);
    });
  });
});
