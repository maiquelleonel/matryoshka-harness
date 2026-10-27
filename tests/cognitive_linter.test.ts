import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  auditCognitiveContext,
  type CognitiveAuditResult,
  type CognitiveViolation,
  type CognitiveRuleId
} from "../src/agents";

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

  describe("Subtask 2: Rule 1 (token-budget): Warnings > 200 tokens, strict fail > 250 tokens for root AGENTS.md", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rule1-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("passes when AGENTS.md is under the warning threshold (<= 200 tokens)", () => {
      const leanContent = "# AGENTS\n\n" + Array(80).fill("directive").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), leanContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.passed).toBe(true);
      expect(result.passedStrict).toBe(true);
      expect(result.score).toBe(100);
      expect(result.summary.failedCount).toBe(0);
      expect(result.summary.warnCount).toBe(0);
      expect(result.summary.estimatedTokens).toBeLessThanOrEqual(200);
      expect(result.violations.some((v) => v.ruleId === "token-budget")).toBe(false);
    });

    it("emits a warn violation when AGENTS.md exceeds 200 tokens but is <= 250 tokens", () => {
      const warnContent = "# AGENTS\n\n" + Array(220).fill("instruction").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), warnContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.passed).toBe(true);
      expect(result.passedStrict).toBe(true);
      expect(result.score).toBe(95);
      expect(result.summary.warnCount).toBe(1);
      expect(result.summary.failedCount).toBe(0);

      const violation = result.violations.find((v) => v.ruleId === "token-budget");
      expect(violation).toBeDefined();
      expect(violation?.severity).toBe("warn");
      expect(violation?.message).toContain("200");
      expect(violation?.suggestion).toBeDefined();
    });

    it("emits a fail violation when AGENTS.md exceeds strict limit (> 250 tokens)", () => {
      const failContent = "# AGENTS\n\n" + Array(300).fill("instruction").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.passed).toBe(false);
      expect(result.passedStrict).toBe(false);
      expect(result.score).toBe(85);
      expect(result.summary.failedCount).toBe(1);

      const violation = result.violations.find((v) => v.ruleId === "token-budget");
      expect(violation).toBeDefined();
      expect(violation?.severity).toBe("fail");
      expect(violation?.message).toContain("250");
      expect(violation?.suggestion).toBeDefined();
    });

    it("respects custom warnTokens and maxTokens options", () => {
      const content = "# AGENTS\n\n" + Array(120).fill("instruction").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const warnResult = auditCognitiveContext(tempDir, { warnTokens: 100, maxTokens: 150 });
      expect(warnResult.violations.some((v) => v.ruleId === "token-budget" && v.severity === "warn")).toBe(true);

      const failResult = auditCognitiveContext(tempDir, { warnTokens: 80, maxTokens: 100 });
      expect(failResult.violations.some((v) => v.ruleId === "token-budget" && v.severity === "fail")).toBe(true);
    });

    it("gracefully reports failure when AGENTS.md is missing without throwing an exception", () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-empty-"));
      try {
        const result = auditCognitiveContext(emptyDir);
        expect(result.passed).toBe(false);
        expect(result.summary.failedCount).toBeGreaterThanOrEqual(1);
        const violation = result.violations.find((v) => v.ruleId === "token-budget");
        expect(violation).toBeDefined();
        expect(violation?.severity).toBe("fail");
        expect(violation?.message).toContain("not found");
        expect(violation?.suggestion).toContain("baba agents generate");
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("completes audit execution sub-25ms", () => {
      const leanContent = "# AGENTS\n\n" + Array(50).fill("rule").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), leanContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.durationMs).toBeLessThan(25);
    });

    it("supports double keying for camelCase and snake_case properties", () => {
      const failContent = "# AGENTS\n\n" + Array(280).fill("directive").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.passedStrict).toBe(false);
      expect(result.passed_strict).toBe(false);
      expect(result.summary.failedCount).toBe(1);
      expect(result.summary.failed_count).toBe(1);
      expect(result.summary.estimatedTokens).toBeGreaterThan(250);
      expect(result.summary.estimated_tokens).toBeGreaterThan(250);
      expect(result.duration_ms).toBeDefined();
    });
  });

  describe("Subtask 3: Rule 2 (dead-skills): Dead link detector for missing files in .agents/skills/", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rule2-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("passes when all referenced skills in .agents/skills/ exist on disk", () => {
      // Create referenced skill on disk
      const skillsDir = path.join(tempDir, ".agents", "skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "git-workflow.md"), "# Git Workflow\nGuidelines", "utf-8");

      const agentsContent = `# AGENTS
See the [Git Workflow](.agents/skills/git-workflow.md) for commit standards.
Also refer to \`.agents/skills/git-workflow.md\` when creating pull requests.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), agentsContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const deadSkillViolations = result.violations.filter((v) => v.ruleId === "dead-skills");
      expect(deadSkillViolations).toHaveLength(0);
      expect(result.passed).toBe(true);
      expect(result.passedStrict).toBe(true);
      expect(result.score).toBe(100);
    });

    it("emits a fail violation when a referenced skill does not exist on disk", () => {
      const agentsContent = `# AGENTS
Read the [Phantom Skill](.agents/skills/phantom-skill.md) before implementing.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), agentsContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const deadSkillViolations = result.violations.filter((v) => v.ruleId === "dead-skills");
      expect(deadSkillViolations).toHaveLength(1);

      const violation = deadSkillViolations[0];
      expect(violation.ruleId).toBe("dead-skills");
      expect(violation.rule_id).toBe("dead-skills");
      expect(violation.severity).toBe("fail");
      expect(violation.message).toContain("phantom-skill.md");
      expect(violation.suggestion).toContain("baba agents generate");
      expect(violation.line).toBe(2);
      expect(violation.snippet).toContain("[Phantom Skill](.agents/skills/phantom-skill.md)");

      expect(result.passed).toBe(false);
      expect(result.passedStrict).toBe(false);
      expect(result.summary.failedCount).toBe(1);
      expect(result.summary.failed_count).toBe(1);
      expect(result.score).toBe(85); // 100 - 15 penalty
    });

    it("detects dead skills with different link syntaxes (markdown link, inline backtick, plain text)", () => {
      const agentsContent = `# AGENTS
- Markdown: [Testing Guide](.agents/skills/missing-test.md)
- Backtick: \`skills/missing-build.md\`
- Plain: See .agents/skills/missing-deploy.md for details.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), agentsContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const deadSkillViolations = result.violations.filter((v) => v.ruleId === "dead-skills");
      expect(deadSkillViolations).toHaveLength(3);

      const missingFiles = deadSkillViolations.map((v) => v.metadata?.skill || v.metadata?.skillName);
      expect(missingFiles).toContain("missing-test.md");
      expect(missingFiles).toContain("missing-build.md");
      expect(missingFiles).toContain("missing-deploy.md");

      expect(result.summary.failedCount).toBe(3);
      expect(result.score).toBe(100 - 3 * 15);
    });

    it("does not flag existing skills in .agents/skills/ even when another dead skill is present", () => {
      const skillsDir = path.join(tempDir, ".agents", "skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "existing-skill.md"), "# Existing", "utf-8");

      const agentsContent = `# AGENTS
- Existing: [Existing](.agents/skills/existing-skill.md)
- Missing: [Missing](.agents/skills/missing-skill.md)
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), agentsContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const deadSkillViolations = result.violations.filter((v) => v.ruleId === "dead-skills");
      expect(deadSkillViolations).toHaveLength(1);
      expect(deadSkillViolations[0].message).toContain("missing-skill.md");
      expect(deadSkillViolations.some((v) => v.message.includes("existing-skill.md"))).toBe(false);
    });

    it("handles relative path prefixes like ./ correctly", () => {
      const skillsDir = path.join(tempDir, ".agents", "skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "valid.md"), "# Valid", "utf-8");

      const agentsContent = `# AGENTS
Check [Valid](./.agents/skills/valid.md) and [Invalid](./.agents/skills/invalid.md).
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), agentsContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const deadSkillViolations = result.violations.filter((v) => v.ruleId === "dead-skills");
      expect(deadSkillViolations).toHaveLength(1);
      expect(deadSkillViolations[0].message).toContain("invalid.md");
    });

    it("deduplicates repeated dead references to the same missing skill file", () => {
      const agentsContent = `# AGENTS
First mention of [Phantom](.agents/skills/repeated-phantom.md).
Second mention of \`.agents/skills/repeated-phantom.md\`.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), agentsContent, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const deadSkillViolations = result.violations.filter((v) => v.ruleId === "dead-skills");
      expect(deadSkillViolations).toHaveLength(1);
      expect(deadSkillViolations[0].message).toContain("repeated-phantom.md");
      expect(result.summary.failedCount).toBe(1);
    });
  });
});

