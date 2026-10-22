import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  DEFAULT_AST_DEDUCTION_PENALTIES,
  DEFAULT_HARNESS2_WEIGHTS,
  calculateAstHealthScore,
  normalizeOracleBaseScore,
  calculateCompositeScore,
  aggregateHarnessGaps,
  evaluateCompositeHarness,
  Harness2Scorer,
} from "../src/scorer";
import type {
  AstViolation,
  AstViolationSeverity,
  HarnessGap,
  HarnessScoreResult,
  AstRuleSuiteResult,
} from "../src/types";

describe("SPEC-11: Harness² Composite Scorer & Gap Aggregator (Subtask 3)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-scorer-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("Constants & Default Configurations", () => {
    it("exports canonical deduction penalties matching PRD specification", () => {
      expect(DEFAULT_AST_DEDUCTION_PENALTIES.critical).toBe(15);
      expect(DEFAULT_AST_DEDUCTION_PENALTIES.high).toBe(8);
      expect(DEFAULT_AST_DEDUCTION_PENALTIES.medium).toBe(4);
      expect(DEFAULT_AST_DEDUCTION_PENALTIES.low).toBe(2);
    });

    it("exports canonical Harness² weights (Oracle 0.4, AST 0.6)", () => {
      expect(DEFAULT_HARNESS2_WEIGHTS.oracleWeight).toBe(0.4);
      expect(DEFAULT_HARNESS2_WEIGHTS.astWeight).toBe(0.6);
      expect(DEFAULT_HARNESS2_WEIGHTS.oracleWeight + DEFAULT_HARNESS2_WEIGHTS.astWeight).toBeCloseTo(1.0);
    });
  });

  describe("Scenario 1: AST Health Score Calculation (calculateAstHealthScore)", () => {
    it("returns 100 for zero AST violations", () => {
      const breakdown = calculateAstHealthScore([]);
      expect(breakdown.score).toBe(100);
      expect(breakdown.totalDeductions).toBe(0);
      expect(breakdown.violationsCount).toBe(0);
      expect(breakdown.bySeverity.critical).toBe(0);
      expect(breakdown.bySeverity.high).toBe(0);
      expect(breakdown.bySeverity.medium).toBe(0);
      expect(breakdown.bySeverity.low).toBe(0);
    });

    it("applies exact deduction penalties per severity level", () => {
      const violations: AstViolation[] = [
        {
          id: "v1",
          ruleId: "sql-interpolation",
          severity: "critical",
          message: "SQL injection",
          filePath: "/app/users.ts",
          relativePath: "users.ts",
          line: 10,
          column: 5,
          nodeType: "TemplateLiteral",
          codeSnippet: "SELECT * FROM users",
          remediation: "Use params",
        },
        {
          id: "v2",
          ruleId: "assertionless-test",
          severity: "high",
          message: "No assertions",
          filePath: "/app/users.test.ts",
          relativePath: "users.test.ts",
          line: 20,
          column: 1,
          nodeType: "CallExpression",
          codeSnippet: "it('works')",
          remediation: "Add expect",
        },
        {
          id: "v3",
          ruleId: "custom-rule",
          severity: "medium",
          message: "Medium issue",
          filePath: "/app/foo.ts",
          relativePath: "foo.ts",
          line: 1,
          column: 1,
          nodeType: "Identifier",
          codeSnippet: "foo",
          remediation: "Fix foo",
        },
        {
          id: "v4",
          ruleId: "style-rule",
          severity: "low",
          message: "Low issue",
          filePath: "/app/bar.ts",
          relativePath: "bar.ts",
          line: 1,
          column: 1,
          nodeType: "Identifier",
          codeSnippet: "bar",
          remediation: "Fix bar",
        },
      ];

      // Total deduction: 15 + 8 + 4 + 2 = 29
      // Health score: 100 - 29 = 71
      const breakdown = calculateAstHealthScore(violations);
      expect(breakdown.totalDeductions).toBe(29);
      expect(breakdown.score).toBe(71);
      expect(breakdown.violationsCount).toBe(4);
      expect(breakdown.bySeverity.critical).toBe(1);
      expect(breakdown.bySeverity.high).toBe(1);
      expect(breakdown.bySeverity.medium).toBe(1);
      expect(breakdown.bySeverity.low).toBe(1);
      expect(breakdown.penaltiesApplied.critical).toBe(15);
      expect(breakdown.penaltiesApplied.high).toBe(8);
      expect(breakdown.penaltiesApplied.medium).toBe(4);
      expect(breakdown.penaltiesApplied.low).toBe(2);
    });

    it("clamps the health score floor strictly to 0 even when penalties exceed 100", () => {
      const heavyViolations: AstViolation[] = Array.from({ length: 10 }, (_, i) => ({
        id: `crit-${i}`,
        ruleId: "sql-interpolation",
        severity: "critical" as AstViolationSeverity,
        message: "SQL Injection",
        filePath: `/app/file${i}.ts`,
        relativePath: `file${i}.ts`,
        line: 1,
        column: 1,
        nodeType: "TemplateLiteral",
        codeSnippet: "query",
        remediation: "bind",
      }));

      // 10 * 15 = 150 deductions -> clamp to 0
      const breakdown = calculateAstHealthScore(heavyViolations);
      expect(breakdown.totalDeductions).toBe(150);
      expect(breakdown.score).toBe(0);
    });

    it("supports custom penalty overrides", () => {
      const violations: AstViolation[] = [
        {
          id: "v1",
          ruleId: "sql-interpolation",
          severity: "critical",
          message: "SQL injection",
          filePath: "/app/users.ts",
          relativePath: "users.ts",
          line: 10,
          column: 5,
          nodeType: "TemplateLiteral",
          codeSnippet: "SELECT *",
          remediation: "params",
        },
      ];

      const breakdown = calculateAstHealthScore(violations, { critical: 30 });
      expect(breakdown.totalDeductions).toBe(30);
      expect(breakdown.score).toBe(70);
    });
  });

  describe("Scenario 2: Oracle Base Score Normalization (normalizeOracleBaseScore)", () => {
    it("normalizes HarnessScoreResult with maxScore 105 to 100 scale", () => {
      const oracle: HarnessScoreResult = {
        score: 88,
        maxScore: 105,
        level: "L3",
        gaps: [],
        passed: [],
        source: "fallback",
        executionTimeMs: 10,
      };

      const breakdown = normalizeOracleBaseScore(oracle);
      expect(breakdown.rawScore).toBe(88);
      expect(breakdown.maxScore).toBe(105);
      // Math.round((88 / 105) * 100) = 84
      expect(breakdown.normalizedScore).toBe(84);
      expect(breakdown.level).toBe("L3");
      expect(breakdown.source).toBe("fallback");
    });

    it("handles numeric input directly", () => {
      const breakdown = normalizeOracleBaseScore(88);
      expect(breakdown.rawScore).toBe(88);
      expect(breakdown.maxScore).toBe(100);
      expect(breakdown.normalizedScore).toBe(88);
      expect(breakdown.level).toBe("L3");
    });

    it("clamps normalized score to [0, 100] for negative or overflow scores", () => {
      expect(normalizeOracleBaseScore(-10).normalizedScore).toBe(0);
      expect(normalizeOracleBaseScore(150).normalizedScore).toBe(100);
    });

    it("preserves raw score when normalize is explicitly disabled", () => {
      const oracle: HarnessScoreResult = {
        score: 88,
        maxScore: 105,
        level: "L3",
        gaps: [],
        passed: [],
        source: "subprocess",
        executionTimeMs: 15,
      };

      const breakdown = normalizeOracleBaseScore(oracle, 105, false);
      expect(breakdown.normalizedScore).toBe(88);
    });
  });

  describe("Scenario 3: Weighted Composite Score Calculation (calculateCompositeScore)", () => {
    it("computes composite score from PRD example: Base 88, AST 81 => Composite 84", () => {
      // In PRD: Base 88, AST 81
      // Score = 88 * 0.4 + 81 * 0.6 = 35.2 + 48.6 = 83.8 -> 84
      const result = calculateCompositeScore(88, {
        totalViolations: 2,
        violations: [
          {
            id: "v1",
            ruleId: "sql-interpolation",
            severity: "critical", // -15
            message: "SQL",
            filePath: "f1.ts",
            relativePath: "f1.ts",
            line: 1,
            column: 1,
            nodeType: "TemplateLiteral",
            codeSnippet: "",
            remediation: "",
          },
          {
            id: "v2",
            ruleId: "custom",
            severity: "medium", // -4
            message: "Medium",
            filePath: "f2.ts",
            relativePath: "f2.ts",
            line: 1,
            column: 1,
            nodeType: "Identifier",
            codeSnippet: "",
            remediation: "",
          },
        ],
        bySeverity: { critical: 1, high: 0, medium: 1, low: 0 },
        byRule: { "sql-interpolation": 1, custom: 1 },
        scannedFilesCount: 2,
        cleanFilesCount: 0,
        executionTimeMs: 5,
      });

      // AST Health: 100 - (15 + 4) = 81
      expect(result.ast.score).toBe(81);
      expect(result.oracle.normalizedScore).toBe(88);
      // Composite: Math.round(88 * 0.4 + 81 * 0.6) = Math.round(35.2 + 48.6) = 84
      expect(result.compositeScore).toBe(84);
      expect(result.status).toBe("PASS");
      expect(result.passedThreshold).toBe(true);
    });

    it("evaluates status as NEEDS_REMEDIATION when score is below threshold", () => {
      const result = calculateCompositeScore(50, [], { threshold: 80 });
      // Base: 50, AST: 100 -> Composite: Math.round(50 * 0.4 + 100 * 0.6) = 80
      expect(result.compositeScore).toBe(80);
      expect(result.status).toBe("PASS");

      const lowResult = calculateCompositeScore(40, [], { threshold: 80 });
      // Base: 40, AST: 100 -> Composite: Math.round(40 * 0.4 + 100 * 0.6) = 76
      expect(lowResult.compositeScore).toBe(76);
      expect(lowResult.status).toBe("NEEDS_REMEDIATION");
      expect(lowResult.passedThreshold).toBe(false);
    });

    it("supports custom weights", () => {
      // 50% Oracle, 50% AST
      const result = calculateCompositeScore(80, [], {
        weights: { oracleWeight: 0.5, astWeight: 0.5 },
      });
      // 80 * 0.5 + 100 * 0.5 = 90
      expect(result.compositeScore).toBe(90);
    });

    it("enforces strict quality gate (passedStrict = false on critical violations even if score >= threshold)", () => {
      const criticalViolation: AstViolation = {
        id: "crit-1",
        ruleId: "sql-interpolation",
        severity: "critical",
        message: "SQL Injection",
        filePath: "users.ts",
        relativePath: "users.ts",
        line: 12,
        column: 4,
        nodeType: "TemplateLiteral",
        codeSnippet: "db.query(`...`)",
        remediation: "Use params",
      };

      const result = calculateCompositeScore(100, [criticalViolation], { threshold: 80 });
      // Base: 100, AST: 85 (100 - 15) -> Composite: Math.round(100 * 0.4 + 85 * 0.6) = 40 + 51 = 91
      expect(result.compositeScore).toBe(91);
      expect(result.passedThreshold).toBe(true);
      expect(result.hasCriticalViolations).toBe(true);
      // STRICT MODE: Should fail strict gate because critical violation exists!
      expect(result.passedStrict).toBe(false);
    });
  });

  describe("Scenario 4: Gap Aggregator & Surgical Action Plan (aggregateHarnessGaps)", () => {
    it("aggregates Oracle gaps and AST violations into a unified telemetry structure", () => {
      const oracleGaps: HarnessGap[] = [
        {
          id: "CTX-01",
          axis: "context",
          title: "Missing root AGENTS.md context fence",
          description: "Codebase lacks root operational guidelines.",
          remediation: "Run 'baba wrap .' to generate tailored AGENTS.md.",
          weight: 15,
        },
        {
          id: "CI-01",
          axis: "guardrails",
          title: "Missing Continuous Integration Pipeline",
          weight: 15,
        },
      ];

      const astViolations: AstViolation[] = [
        {
          id: "v-sql",
          ruleId: "sql-interpolation",
          severity: "critical",
          message: "Unparameterized SQL query",
          filePath: "src/db/users.ts",
          relativePath: "src/db/users.ts",
          line: 42,
          column: 10,
          nodeType: "TemplateLiteral",
          codeSnippet: "SELECT * FROM users WHERE id = ${userId}",
          remediation: "Use parameterized queries or bound arguments.",
        },
        {
          id: "v-test",
          ruleId: "assertionless-test",
          severity: "high",
          message: "Assertionless test case",
          filePath: "tests/unit/auth.test.ts",
          relativePath: "tests/unit/auth.test.ts",
          line: 18,
          column: 3,
          nodeType: "CallExpression",
          codeSnippet: "it('authenticates', () => { ... })",
          remediation: "Add explicit assertion.",
        },
      ];

      const aggregated = aggregateHarnessGaps(oracleGaps, astViolations);

      expect(aggregated.totalCount).toBe(4);
      expect(aggregated.oracleGapsCount).toBe(2);
      expect(aggregated.astViolationsCount).toBe(2);
      expect(aggregated.hasCriticalViolations).toBe(true);
      expect(aggregated.bySeverity.critical).toBe(1);
      expect(aggregated.bySeverity.high).toBe(1);
      expect(aggregated.byRule["sql-interpolation"]).toBe(1);
      expect(aggregated.byRule["assertionless-test"]).toBe(1);
      expect(aggregated.byAxis["context"]).toBe(1);
      expect(aggregated.byAxis["guardrails"]).toBe(1);

      // Verify surgical action plan ordering: Critical AST first, High AST next, then Oracle gaps
      expect(aggregated.actionPlan.length).toBe(4);
      expect(aggregated.actionPlan[0]!.source).toBe("ast");
      expect(aggregated.actionPlan[0]!.severity).toBe("critical");
      expect(aggregated.actionPlan[0]!.target).toBe("src/db/users.ts:42");
      expect(aggregated.actionPlan[0]!.action).toContain("Fix SQL injection in src/db/users.ts:42 using bind parameters.");

      expect(aggregated.actionPlan[1]!.source).toBe("ast");
      expect(aggregated.actionPlan[1]!.severity).toBe("high");
      expect(aggregated.actionPlan[1]!.target).toBe("tests/unit/auth.test.ts:18");
      expect(aggregated.actionPlan[1]!.action).toContain("Add behavioral assertion to tests/unit/auth.test.ts:18");

      expect(aggregated.actionPlan[2]!.source).toBe("oracle");
      expect(aggregated.actionPlan[3]!.source).toBe("oracle");
    });

    it("handles null or undefined gap inputs cleanly", () => {
      const aggregated = aggregateHarnessGaps(null, undefined);
      expect(aggregated.totalCount).toBe(0);
      expect(aggregated.actionPlan).toEqual([]);
      expect(aggregated.hasCriticalViolations).toBe(false);
    });
  });

  describe("Scenario 5: End-to-End Evaluation & Resilience (evaluateCompositeHarness)", () => {
    it("runs complete evaluation over an empty temporary repository with fallback oracle", async () => {
      const result = await evaluateCompositeHarness(tempDir);

      expect(result.projectPath).toBe(tempDir);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
      expect(result.oracle).toBeDefined();
      expect(result.ast).toBeDefined();
      expect(result.aggregatedGaps).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      // Empty repo has 0 AST violations -> AST health is 100
      expect(result.ast.score).toBe(100);
      expect(result.ast.violationsCount).toBe(0);
    });

    it("evaluates a project with real TypeScript code containing an SQL injection hazard", async () => {
      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(
        path.join(srcDir, "users.ts"),
        `
export async function findUser(id: string) {
  const query = \`SELECT * FROM users WHERE id = \${id}\`;
  return query;
}
        `.trim()
      );

      const result = await evaluateCompositeHarness(tempDir);

      expect(result.totalFilesAnalyzed).toBeGreaterThanOrEqual(1);
      expect(result.ast.violationsCount).toBeGreaterThanOrEqual(1);
      expect(result.ast.bySeverity.critical).toBeGreaterThanOrEqual(1);
      expect(result.hasCriticalViolations).toBe(true);
      expect(result.passedStrict).toBe(false);
      expect(result.ast.score).toBeLessThan(100);
    });

    it("supports Harness2Scorer class instance and fluent API", async () => {
      const scorer = new Harness2Scorer({
        threshold: 75,
        weights: { oracleWeight: 0.3, astWeight: 0.7 },
      });

      const scoreResult = scorer.score(90, []);
      // 90 * 0.3 + 100 * 0.7 = 27 + 70 = 97
      expect(scoreResult.compositeScore).toBe(97);
      expect(scoreResult.status).toBe("PASS");

      const evalResult = await scorer.evaluate(tempDir);
      expect(evalResult.threshold).toBe(75);
    });
  });
});
