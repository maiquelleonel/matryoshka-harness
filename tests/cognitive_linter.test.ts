import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("SPEC-22: feat(agents): cognitive context linter & turn-zero prompt simulator (baba agents audit)", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const prdPath = path.join(repoRoot, "docs", "prds", "PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md");
  const specPath = path.join(repoRoot, "docs", "specs", "SPEC-22.md");
  const experiencePath = path.join(repoRoot, "docs", "EXPERIENCE.md");

  describe("Subtask 1: Detailed PRD: docs/prds/PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md & Technical Specification", () => {
    it("verifies that PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md exists and is substantive (> 2.5KB)", () => {
      expect(fs.existsSync(prdPath)).toBe(true);
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content.length).toBeGreaterThan(2500);
    });

    it("documents all 5 core problem patterns in the PRD problem statement", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("Turn-Zero Token Bloat");
      expect(content).toContain("Dead Skill");
      expect(content).toContain("Negative Phrasing Trap");
      expect(content).toContain("Permissive");
      expect(content).toContain("Greedy Preload");
    });

    it("specifies all 5 invariant heuristic rules with exact IDs and criteria in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      // Rule 1: token-budget
      expect(content).toContain("token-budget");
      expect(content).toContain("200 tokens");
      expect(content).toContain("250 tokens");

      // Rule 2: dead-skills
      expect(content).toContain("dead-skills");
      expect(content).toContain(".agents/skills/");

      // Rule 3: negative-phrasing-trap
      expect(content).toContain("negative-phrasing-trap");
      expect(content).toContain("DO NOT");
      expect(content).toContain("NEVER");
      expect(content).toContain("Pink Elephant");

      // Rule 4: permissive-leak
      expect(content).toContain("permissive-leak");
      expect(content).toContain("try to");
      expect(content).toContain("if possible");
      expect(content).toContain("consider");

      // Rule 5: greedy-preload
      expect(content).toContain("greedy-preload");
      expect(content).toContain("25 lines");
    });

    it("specifies the 9 Production Dimensions Audit in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("Input Validation");
      expect(content).toContain("Failure Modes & Timeout");
      expect(content).toContain("Idempotency & Retry");
      expect(content).toContain("Authorization & Scopes");
      expect(content).toContain("Concurrency & Performance");
      expect(content).toContain("Data Lifecycle & In-Memory");
      expect(content).toContain("External Fallbacks");
      expect(content).toContain("State Transitions");
      expect(content).toContain("Observability & Telemetry");
    });

    it("specifies CLI invocation parity and flags in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("baba agents audit");
      expect(content).toContain("bbyg agents audit");
      expect(content).toContain("matryoshka agents audit");
      expect(content).toContain("--json");
      expect(content).toContain("--strict");
    });

    it("specifies health score 0-100 and severity badges in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("0–100");
      expect(content).toContain("WARN");
      expect(content).toContain("FAIL");
      expect(content).toContain("PASS");
    });

    it("specifies Gherkin BDD acceptance scenarios in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("Feature: baba agents audit");
      expect(content).toContain("Scenario: Healthy root AGENTS.md passes audit");
      expect(content).toContain("Scenario: Bloated AGENTS.md fails in strict mode");
      expect(content).toContain("Scenario: Dead skill link is detected");
    });

    it("verifies that docs/specs/SPEC-22.md exists and defines complete TypeScript I/O contracts", () => {
      expect(fs.existsSync(specPath)).toBe(true);
      const content = fs.readFileSync(specPath, "utf-8");
      expect(content).toContain("CognitiveRuleId");
      expect(content).toContain("CognitiveViolationSeverity");
      expect(content).toContain("CognitiveViolation");
      expect(content).toContain("CognitiveAuditResult");
      expect(content).toContain("CognitiveAuditOptions");
      expect(content).toContain("auditCognitiveContext");
      expect(content).toContain("baba agents audit");
      expect(content).toContain("Issue #22");
    });

    it("verifies docs/EXPERIENCE.md documents cognitive context linter lessons", () => {
      const content = fs.readFileSync(experiencePath, "utf-8");
      expect(content).toContain("baba agents audit");
      expect(content).toContain("Pink Elephant");
    });
  });
});
