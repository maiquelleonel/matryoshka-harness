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

  describe("Subtask 4: Rule 3 (negative-phrasing-trap): Flags excessive prohibitive keywords and suggests positive anchors", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rule3-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("passes when AGENTS.md has 3 or fewer prohibitive keywords (within threshold)", () => {
      const content = `# AGENTS
- DO NOT bypass CI checks.
- NEVER push directly to main.
- Use explicit types everywhere.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const negativeTrapViolations = result.violations.filter((v) => v.ruleId === "negative-phrasing-trap");
      expect(negativeTrapViolations).toHaveLength(0);
      expect(result.passed).toBe(true);
      expect(result.passedStrict).toBe(true);
      expect(result.score).toBe(100);
    });

    it("flags excessive prohibitive keywords (> 3) with a warn violation and suggests positive anchors", () => {
      const content = `# AGENTS
## Coding Standards
- DO NOT use any type
- NEVER mutate state directly
- DON'T commit console.log statements
- PROHIBITED: global variable mutation
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const negativeTrapViolations = result.violations.filter((v) => v.ruleId === "negative-phrasing-trap");
      expect(negativeTrapViolations).toHaveLength(1);

      const violation = negativeTrapViolations[0];
      expect(violation.ruleId).toBe("negative-phrasing-trap");
      expect(violation.rule_id).toBe("negative-phrasing-trap");
      expect(violation.severity).toBe("warn");
      expect(violation.message).toContain("Coding Standards");
      expect(violation.message).toContain("4");
      expect(violation.suggestion).toContain("PREFER");
      expect(violation.suggestion).toContain("USE");
      expect(violation.suggestion).toContain("ENFORCE");
      expect(violation.suggestion).toContain("Pink Elephant");
      expect(violation.line).toBe(3);
      expect(violation.snippet).toContain("DO NOT use any type");

      expect(violation.metadata?.count).toBe(4);
      expect(violation.metadata?.positiveAnchors).toContain("PREFER");
      expect(violation.metadata?.positiveAnchors).toContain("USE");
      expect(violation.metadata?.positiveAnchors).toContain("ENFORCE");

      // Score penalty: 100 - 5 = 95
      expect(result.score).toBe(95);
      expect(result.summary.warnCount).toBe(1);
      expect(result.summary.warn_count).toBe(1);
      expect(result.summary.failedCount).toBe(0);
      expect(result.passed).toBe(true);
      expect(result.passedStrict).toBe(true);
    });

    it("detects various prohibitive keywords case-insensitively (MUST NOT, CANNOT, CAN'T, DONT)", () => {
      const content = `# AGENTS
## Strict Constraints
- MUST NOT bypass authentication checks
- CANNOT use untyped variables
- CAN'T ignore compiler errors
- DONT skip unit testing
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const negativeTrapViolations = result.violations.filter((v) => v.ruleId === "negative-phrasing-trap");
      expect(negativeTrapViolations).toHaveLength(1);
      expect(negativeTrapViolations[0].severity).toBe("warn");
      expect(negativeTrapViolations[0].metadata?.count).toBe(4);
    });

    it("evaluates multiple sections independently and flags only sections exceeding threshold", () => {
      const content = `# AGENTS
## Negative Section
- DO NOT do A
- NEVER do B
- DON'T do C
- PROHIBITED to do D

## Clean Section
- PREFER immutability
- USE explicit typing
- ENFORCE linter rules
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const negativeTrapViolations = result.violations.filter((v) => v.ruleId === "negative-phrasing-trap");
      expect(negativeTrapViolations).toHaveLength(1);
      expect(negativeTrapViolations[0].message).toContain("Negative Section");
      expect(negativeTrapViolations[0].message).not.toContain("Clean Section");
    });

    it("flags multiple sections if both exceed the prohibitive keyword threshold", () => {
      const content = `# AGENTS
## Section One
- DO NOT do A
- NEVER do B
- DON'T do C
- MUST NOT do D

## Section Two
- DO NOT do E
- NEVER do F
- DON'T do G
- CANNOT do H
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const negativeTrapViolations = result.violations.filter((v) => v.ruleId === "negative-phrasing-trap");
      expect(negativeTrapViolations).toHaveLength(2);
      expect(result.summary.warnCount).toBe(2);
      expect(result.score).toBe(90); // 100 - 2 * 5
    });

    it("handles documents without markdown headings by checking the root section", () => {
      const content = `DO NOT leak secrets. NEVER bypass gates. DON'T ignore linter. PROHIBITED from running as root.`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const negativeTrapViolations = result.violations.filter((v) => v.ruleId === "negative-phrasing-trap");
      expect(negativeTrapViolations).toHaveLength(1);
      expect(negativeTrapViolations[0].severity).toBe("warn");
      expect(negativeTrapViolations[0].line).toBe(1);
      expect(negativeTrapViolations[0].suggestion).toContain("Pink Elephant");
    });

    it("respects custom maxNegativePhrases option", () => {
      const content = `# AGENTS
- DO NOT bypass CI
- NEVER ignore lint
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      // Default threshold is 3 -> 2 phrases pass
      const defaultResult = auditCognitiveContext(tempDir);
      expect(defaultResult.violations.some((v) => v.ruleId === "negative-phrasing-trap")).toBe(false);

      // Custom threshold of 1 -> 2 phrases triggers warning
      const customResult = auditCognitiveContext(tempDir, { maxNegativePhrases: 1 });
      const violations = customResult.violations.filter((v) => v.ruleId === "negative-phrasing-trap");
      expect(violations).toHaveLength(1);
      expect(violations[0].metadata?.threshold).toBe(1);
    });

    it("executes rule check deterministically in sub-25ms", () => {
      const content = `# AGENTS
- DO NOT bypass CI
- NEVER ignore lint
- DON'T use any
- PROHIBITED: ts-ignore
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.durationMs).toBeLessThan(25);
    });
  });

  describe("Subtask 5: Rule 4 (permissive-leak): Detects wishy-washy language ('try to', 'if possible', 'consider') in imperative sections", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rule4-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("passes when AGENTS.md contains strict, definitive imperatives without wishy-washy language", () => {
      const content = `# AGENTS
## Core Directives
- ALWAYS write unit tests for business logic.
- ENFORCE zero compiler warnings.
- MUST run bun test before pushing changes.
- PREFER immutable state containers.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(0);
      expect(result.passed).toBe(true);
      expect(result.passedStrict).toBe(true);
      expect(result.score).toBe(100);
      expect(result.summary.warnCount).toBe(0);
    });

    it("flags wishy-washy phrase 'try to' as a warn violation in imperative sections", () => {
      const content = `# AGENTS
## Implementation Guidelines
- Try to run unit tests before opening a pull request.
- Keep functions small.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(1);

      const violation = permissiveViolations[0];
      expect(violation.ruleId).toBe("permissive-leak");
      expect(violation.rule_id).toBe("permissive-leak");
      expect(violation.severity).toBe("warn");
      expect(violation.message).toContain("try to");
      expect(violation.message).toContain("Implementation Guidelines");
      expect(violation.line).toBe(3);
      expect(violation.snippet).toContain("Try to run unit tests");
      expect(violation.suggestion).toContain("imperatives");
      expect(violation.suggestion).toContain("try to");
      expect(violation.metadata?.phrase).toBe("Try to");
      expect(violation.metadata?.section).toBe("Implementation Guidelines");
      expect(violation.metadata?.suggestedImperatives).toContain("ALWAYS");
      expect(violation.metadata?.suggestedImperatives).toContain("MUST");

      expect(result.score).toBe(95); // 100 - 5
      expect(result.summary.warnCount).toBe(1);
      expect(result.summary.failedCount).toBe(0);
    });

    it("flags wishy-washy phrase 'if possible' as a warn violation", () => {
      const content = `# AGENTS
## Code Quality
- If possible, write integration tests for all endpoints.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(1);

      const violation = permissiveViolations[0];
      expect(violation.ruleId).toBe("permissive-leak");
      expect(violation.severity).toBe("warn");
      expect(violation.message).toContain("if possible");
      expect(violation.line).toBe(3);
      expect(violation.snippet).toContain("If possible, write integration tests");
      expect(violation.suggestion).toContain("if possible");
    });

    it("flags wishy-washy phrase 'consider' as a warn violation", () => {
      const content = `# AGENTS
## Tooling
- Consider using TypeScript for all new modules.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(1);

      const violation = permissiveViolations[0];
      expect(violation.ruleId).toBe("permissive-leak");
      expect(violation.severity).toBe("warn");
      expect(violation.message).toContain("consider");
      expect(violation.line).toBe(3);
      expect(violation.snippet).toContain("Consider using TypeScript");
    });

    it("flags other wishy-washy patterns ('maybe', 'ideally', 'we usually prefer')", () => {
      const content = `# AGENTS
## General Directives
- Maybe add logging if needed.
- Ideally tests should run fast.
- We usually prefer functional style.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(3);

      const phrases = permissiveViolations.map((v) => v.metadata?.phrase || v.metadata?.match);
      expect(phrases).toContain("Maybe");
      expect(phrases).toContain("Ideally");
      expect(phrases).toContain("We usually prefer");

      expect(result.score).toBe(85); // 100 - 3 * 5
      expect(result.summary.warnCount).toBe(3);
    });

    it("ignores occurrences inside fenced markdown code blocks", () => {
      const content = `# AGENTS
## Invariants
- ALWAYS validate incoming requests.

\`\`\`typescript
// try to connect to the database
if (possible) {
  considerFallback();
}
\`\`\`

- MUST return 400 on invalid input.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(0);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it("does not false positive on legitimate words containing substrings ('considerable', 'reconsidered', 'try/catch')", () => {
      const content = `# AGENTS
## Architecture Notes
- This refactoring has considerable architectural impact.
- We reconsidered the database schema.
- Use try/catch blocks only at boundaries.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(0);
      expect(result.score).toBe(100);
    });

    it("detects multiple distinct leaks on the same line with unique violation IDs", () => {
      const content = `# AGENTS
- Try to optimize algorithms if possible.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(permissiveViolations).toHaveLength(2);

      const ids = permissiveViolations.map((v) => v.id);
      expect(new Set(ids).size).toBe(2);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it("supports custom permissivePhrases option for domain-specific audits", () => {
      const content = `# AGENTS
- You should probably run linting.
- It is kind of slow.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      // Default does not flag custom phrases
      const defaultResult = auditCognitiveContext(tempDir);
      expect(defaultResult.violations.filter((v) => v.ruleId === "permissive-leak")).toHaveLength(0);

      // Custom option flags them
      const customResult = auditCognitiveContext(tempDir, {
        permissivePhrases: ["should probably", "kind of"]
      });
      const customViolations = customResult.violations.filter((v) => v.ruleId === "permissive-leak");
      expect(customViolations).toHaveLength(2);
    });

    it("executes Rule 4 audit deterministically in sub-25ms", () => {
      const content = `# AGENTS
## Guidelines
- Try to write clean code.
- If possible, verify types.
- Consider using bun test.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.durationMs).toBeLessThan(25);
    });
  });
});

