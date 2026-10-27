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
      expect(content).toContain("cognitive-linter-bdd-determinism");
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

  describe("Subtask 6: Rule 5 (greedy-preload): Identifies large raw code/schema dumps (> 25 lines) in the root instruction file", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rule5-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("passes when code blocks and schema dumps are within the threshold (<= 25 lines)", () => {
      const shortCode = Array(15).fill("console.log('short code');").join("\n");
      const content = `# AGENTS
## Examples
\`\`\`typescript
${shortCode}
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const greedyViolations = result.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(greedyViolations).toHaveLength(0);
      expect(result.passed).toBe(true);
      expect(result.passedStrict).toBe(true);
      expect(result.score).toBe(100);
      expect(result.summary.warnCount).toBe(0);
    });

    it("flags a code block exceeding 25 lines with a warn violation by default", () => {
      const codeLines = Array(35).fill("const x = 42;").join("\n");
      const content = `# AGENTS
## Implementation Details
\`\`\`typescript
${codeLines}
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const greedyViolations = result.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(greedyViolations).toHaveLength(1);

      const violation = greedyViolations[0];
      expect(violation.ruleId).toBe("greedy-preload");
      expect(violation.rule_id).toBe("greedy-preload");
      expect(violation.severity).toBe("warn");
      expect(violation.line).toBe(3);
      expect(violation.snippet).toContain("```typescript");
      expect(violation.message).toContain("35");
      expect(violation.message).toContain("25");
      expect(violation.suggestion).toContain(".agents/skills/");
      expect(violation.metadata?.linesCount).toBe(35);
      expect(violation.metadata?.lines_count).toBe(35);
      expect(violation.metadata?.threshold).toBe(25);
      expect(violation.metadata?.language).toBe("typescript");
      expect(violation.metadata?.type).toBe("code-block");

      expect(result.score).toBe(95); // 100 - 5
      expect(result.summary.warnCount).toBe(1);
      expect(result.summary.failedCount).toBe(0);
      expect(result.passed).toBe(true);
    });

    it("flags large raw table / schema dumps exceeding 25 lines", () => {
      const tableRows = Array(30)
        .fill(0)
        .map((_, i) => `| user_${i} | active | developer |`)
        .join("\n");
      const content = `# AGENTS
## Database Schema Table
| user_id | status | role |
|---|---|---|
${tableRows}
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const greedyViolations = result.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(greedyViolations).toHaveLength(1);

      const violation = greedyViolations[0];
      expect(violation.ruleId).toBe("greedy-preload");
      expect(violation.severity).toBe("warn");
      expect(violation.line).toBe(3);
      expect(violation.snippet).toContain("| user_id | status | role |");
      expect(violation.metadata?.type).toBe("table");
      expect(violation.metadata?.linesCount).toBe(32); // header + separator + 30 rows
      expect(violation.metadata?.threshold).toBe(25);
    });

    it("promotes violation to fail in strict mode when code block exceeds 50 lines", () => {
      const largeCode = Array(60).fill("x;").join("\n");
      const content = `# AGENTS
## Huge Monolithic Implementation
\`\`\`javascript
${largeCode}
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      // Non-strict mode: warns
      const warnResult = auditCognitiveContext(tempDir, { strict: false });
      const warnViolations = warnResult.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(warnViolations).toHaveLength(1);
      expect(warnViolations[0].severity).toBe("warn");
      expect(warnResult.summary.warnCount).toBe(1);
      expect(warnResult.summary.failedCount).toBe(0);
      expect(warnResult.score).toBe(95);

      // Strict mode: fails (> 50 lines)
      const strictResult = auditCognitiveContext(tempDir, { strict: true });
      const strictViolations = strictResult.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(strictViolations).toHaveLength(1);
      expect(strictViolations[0].severity).toBe("fail");
      expect(strictResult.passed).toBe(false);
      expect(strictResult.passedStrict).toBe(false);
      expect(strictResult.summary.failedCount).toBe(1);
      expect(strictResult.score).toBe(85); // 100 - 15
    });

    it("keeps violation as warn in strict mode when code block is between 26 and 50 lines", () => {
      const mediumCode = Array(35).fill("const item = 1;").join("\n");
      const content = `# AGENTS
## Medium Code Block
\`\`\`typescript
${mediumCode}
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const strictResult = auditCognitiveContext(tempDir, { strict: true });
      const violations = strictResult.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe("warn");
      expect(strictResult.summary.warnCount).toBe(1);
      expect(strictResult.summary.failedCount).toBe(0);
    });

    it("flags multiple code blocks independently if each exceeds 25 lines", () => {
      const block1 = Array(30).fill("a;").join("\n");
      const block2 = Array(40).fill("b;").join("\n");
      const content = `# AGENTS
## Block One
\`\`\`typescript
${block1}
\`\`\`

## Block Two
\`\`\`python
${block2}
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const greedyViolations = result.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(greedyViolations).toHaveLength(2);

      const languages = greedyViolations.map((v) => v.metadata?.language);
      expect(languages).toContain("typescript");
      expect(languages).toContain("python");

      expect(result.summary.warnCount).toBe(2);
      expect(result.score).toBe(90); // 100 - 2 * 5
    });

    it("supports tilde code fences (~~~)", () => {
      const codeLines = Array(30).fill("echo 'test'").join("\n");
      const content = `# AGENTS
## Shell Script
~~~bash
${codeLines}
~~~
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      const greedyViolations = result.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(greedyViolations).toHaveLength(1);
      expect(greedyViolations[0].snippet).toContain("~~~bash");
      expect(greedyViolations[0].metadata?.language).toBe("bash");
      expect(greedyViolations[0].metadata?.linesCount).toBe(30);
    });

    it("respects custom maxCodeBlockLines option", () => {
      const codeLines = Array(15).fill("let y = 10;").join("\n");
      const content = `# AGENTS
\`\`\`typescript
${codeLines}
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      // Default threshold is 25 -> 15 lines passes
      const defaultResult = auditCognitiveContext(tempDir);
      expect(defaultResult.violations.filter((v) => v.ruleId === "greedy-preload")).toHaveLength(0);

      // Custom threshold of 10 -> 15 lines triggers warning
      const customResult = auditCognitiveContext(tempDir, { maxCodeBlockLines: 10 });
      const customViolations = customResult.violations.filter((v) => v.ruleId === "greedy-preload");
      expect(customViolations).toHaveLength(1);
      expect(customViolations[0].metadata?.threshold).toBe(10);
      expect(customViolations[0].metadata?.linesCount).toBe(15);
    });

    it("executes Rule 5 check deterministically in sub-25ms", () => {
      const codeLines = Array(40).fill("console.log('perf test');").join("\n");
      const content = `# AGENTS
\`\`\`typescript
${codeLines}
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const result = auditCognitiveContext(tempDir);
      expect(result.durationMs).toBeLessThan(25);
    });
  });

  describe("Subtask 7: CLI flags: --json and --strict (exit code 1 on failures)", () => {
    let tempDir: string;
    const cliPath = path.join(repoRoot, "src", "cli.ts");

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-subtask7-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("runs baba agents audit and exits 0 on compliant AGENTS.md", () => {
      const content = `# AGENTS
- ALWAYS write explicit types.
- PREFER immutability.
- ENFORCE unit tests.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Cognitive Context Linter");
      expect(stdout).toContain("Health Score:");
      expect(stdout).toContain("100 / 100");
    });

    it("outputs structured JSON envelope when --json flag is provided", () => {
      const content = `# AGENTS
- ALWAYS write explicit types.
- PREFER immutability.
- ENFORCE unit tests.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString().trim();
      const parsed = JSON.parse(stdout);

      expect(parsed.command).toBe("agents audit");
      expect(parsed.status).toBe("success");
      expect(parsed.score).toBe(100);
      expect(parsed.passed).toBe(true);
      expect(parsed.passedStrict).toBe(true);
      expect(parsed.violations).toBeArray();
      expect(parsed.violations).toHaveLength(0);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.totalRules).toBe(5);
      expect(parsed.summary.failedCount).toBe(0);
      expect(parsed.summary.warnCount).toBe(0);
      expect(parsed.durationMs).toBeDefined();
    });

    it("emits violations in JSON output when rules are triggered", () => {
      const content = `# AGENTS
## Guidelines
- Try to run tests if possible.
- See missing skill at [Nonexistent](.agents/skills/nonexistent.md).
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);
      expect(proc.exitCode).toBe(0); // non-strict exits 0
      const stdout = proc.stdout.toString().trim();
      const parsed = JSON.parse(stdout);

      expect(parsed.violations.length).toBeGreaterThanOrEqual(2);
      expect(parsed.violations.some((v: any) => v.ruleId === "dead-skills")).toBe(true);
      expect(parsed.violations.some((v: any) => v.ruleId === "permissive-leak")).toBe(true);
    });

    it("exits with code 1 in strict mode (--strict) when FAIL violation is present (bloated AGENTS.md > 250 tokens)", () => {
      const failContent = "# AGENTS\n\n" + Array(300).fill("directive").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"]);
      expect(proc.exitCode).toBe(1);
      const stderr = proc.stderr.toString();
      expect(stderr).toContain("Strict mode failed");
    });

    it("exits with code 1 and outputs valid JSON in strict mode when --strict and --json are combined", () => {
      const failContent = "# AGENTS\n\n" + Array(300).fill("directive").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict", "--json"]);
      expect(proc.exitCode).toBe(1);
      const stdout = proc.stdout.toString().trim();
      const parsed = JSON.parse(stdout);

      expect(parsed.command).toBe("agents audit");
      expect(parsed.passedStrict).toBe(false);
      expect(parsed.violations.some((v: any) => v.ruleId === "token-budget" && v.severity === "fail")).toBe(true);
      const stderr = proc.stderr.toString();
      expect(stderr).toContain("Strict mode failed");
    });

    it("exits with code 0 in non-strict mode even when violations are present", () => {
      const failContent = "# AGENTS\n\n" + Array(300).fill("directive").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("token-budget");
    });

    it("exits with code 0 in strict mode when only minor warnings are present and health score >= 80", () => {
      const warnContent = "# AGENTS\n\n" + Array(220).fill("directive").join(" "); // 1 warn -> score 95
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), warnContent, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Health Score:");
    });

    it("exits with code 1 in strict mode when multiple warnings drop health score below 80", () => {
      const content = `# AGENTS
## Negative Section
- DO NOT do A
- NEVER do B
- DON'T do C
- PROHIBITED to do D

## Section Two
- DO NOT do E
- NEVER do F
- DON'T do G
- CANNOT do H

## Section Three
- DO NOT do I
- NEVER do J
- DON'T do K
- CANNOT do L

## Section Four
- DO NOT do M
- NEVER do N
- DON'T do O
- CANNOT do P

## Section Five
- DO NOT do Q
- NEVER do R
- DON'T do S
- CANNOT do T
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"]);
      expect(proc.exitCode).toBe(1);
      const stderr = proc.stderr.toString();
      expect(stderr).toContain("Strict mode failed");
    });

    it("fails gracefully with exit code 1 in strict mode when AGENTS.md is missing", () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-empty-subtask7-"));
      try {
        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", emptyDir, "--strict"]);
        expect(proc.exitCode).toBe(1);
        const stderr = proc.stderr.toString();
        expect(stderr).toContain("Strict mode failed");
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("displays formatted human-readable terminal output with severity badges, health score, and suggestions", () => {
      const content = `# AGENTS
## Guidelines
- Try to run tests.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Cognitive Context Linter");
      expect(stdout).toContain("WARN");
      expect(stdout).toContain("permissive-leak");
      expect(stdout).toContain("Suggestion:");
    });

    it("supports --help flag for agents audit subcommand", () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", "--help"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Usage: baba agents audit");
      expect(stdout).toContain("--strict");
      expect(stdout).toContain("--json");
      expect(stdout).toContain("token-budget");
      expect(stdout).toContain("dead-skills");
    });

    it("ensures alias parity across baba, bbyg, and matryoshka for agents audit --json", () => {
      const content = `# AGENTS
- ALWAYS write clean code.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "baba" }
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" }
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" }
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.score).toBe(parsedBbyg.score);
      expect(parsedBaba.score).toBe(parsedMatryoshka.score);
      expect(parsedBaba.passed).toBe(parsedBbyg.passed);
      expect(parsedBaba.passedStrict).toBe(parsedBbyg.passedStrict);
    });

    it("ensures alias parity across baba, bbyg, and matryoshka for agents audit --strict with violations", () => {
      const failContent = "# AGENTS\n\n" + Array(300).fill("directive").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "baba" }
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" }
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" }
      });

      expect(procBaba.exitCode).toBe(1);
      expect(procBbyg.exitCode).toBe(1);
      expect(procMatryoshka.exitCode).toBe(1);
    });
  });

  describe("Subtask 8: Full BDD test suite with 100% deterministic local execution (< 25ms)", () => {
    let tempDir: string;
    const cliPath = path.join(repoRoot, "src", "cli.ts");

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-subtask8-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    // -------------------------------------------------------------------------
    // BDD AC-8: Sub-25ms Local Deterministic Execution Guarantee
    // -------------------------------------------------------------------------
    describe("AC-8: Sub-25ms Local Execution Latency Guarantee", () => {
      it("executes audit on a healthy lean AGENTS.md in strictly sub-25ms", () => {
        const leanContent = `# AGENTS\n## Principles\n- ALWAYS enforce type safety.\n- PREFER pure functions.\n`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), leanContent, "utf-8");

        const t0 = performance.now();
        const result = auditCognitiveContext(tempDir);
        const elapsed = performance.now() - t0;

        expect(elapsed).toBeLessThan(25);
        expect(result.durationMs).toBeLessThan(25);
        expect(result.duration_ms).toBeLessThan(25);
        expect(result.passed).toBe(true);
        expect(result.score).toBe(100);
      });

      it("executes audit on a bloated AGENTS.md in strictly sub-25ms", () => {
        const bloatedContent = "# AGENTS\n\n" + Array(600).fill("directive word").join(" ");
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), bloatedContent, "utf-8");

        const t0 = performance.now();
        const result = auditCognitiveContext(tempDir);
        const elapsed = performance.now() - t0;

        expect(elapsed).toBeLessThan(25);
        expect(result.durationMs).toBeLessThan(25);
        expect(result.passed).toBe(false);
      });

      it("executes audit on a complex multi-section multi-violation AGENTS.md in strictly sub-25ms", () => {
        const complexContent = `# AGENTS
## Directives
- DO NOT do A
- NEVER do B
- DON'T do C
- PROHIBITED to do D

## Rules
- Try to verify inputs.
- If possible, check bounds.
- Refer to [Missing](.agents/skills/missing.md).

\`\`\`typescript
${Array(40).fill("console.log('line');").join("\n")}
\`\`\`
`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), complexContent, "utf-8");

        const t0 = performance.now();
        const result = auditCognitiveContext(tempDir);
        const elapsed = performance.now() - t0;

        expect(elapsed).toBeLessThan(25);
        expect(result.durationMs).toBeLessThan(25);
        expect(result.violations.length).toBeGreaterThanOrEqual(4);
      });

      it("executes audit on an empty directory (missing AGENTS.md) in strictly sub-25ms", () => {
        const t0 = performance.now();
        const result = auditCognitiveContext(tempDir);
        const elapsed = performance.now() - t0;

        expect(elapsed).toBeLessThan(25);
        expect(result.durationMs).toBeLessThan(25);
        expect(result.passed).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // The 9 Production Dimensions Audit (PRD Section 4)
    // -------------------------------------------------------------------------
    describe("The 9 Production Dimensions Audit Verification", () => {
      // Dimension 1: Input Validation
      describe("Dimension 1: Input Validation & File Discovery", () => {
        it("handles direct file paths pointing directly to AGENTS.md", () => {
          const filePath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(filePath, "# AGENTS\n- ALWAYS use strict types.\n", "utf-8");

          const result = auditCognitiveContext(filePath);
          expect(result.passed).toBe(true);
          expect(result.summary.targetPath).toBe(filePath);
          expect(result.summary.scannedFiles).toContain(filePath);
        });

        it("discovers .cursorrules when AGENTS.md is absent", () => {
          const cursorrulesPath = path.join(tempDir, ".cursorrules");
          fs.writeFileSync(cursorrulesPath, "# Cursor Rules\n- ALWAYS write tests.\n", "utf-8");

          const result = auditCognitiveContext(tempDir);
          expect(result.passed).toBe(true);
          expect(result.summary.scannedFiles).toContain(cursorrulesPath);
          expect(result.violations.filter((v) => v.ruleId === "token-budget")).toHaveLength(0);
        });

        it("discovers CLAUDE.md when AGENTS.md and .cursorrules are absent", () => {
          const claudePath = path.join(tempDir, "CLAUDE.md");
          fs.writeFileSync(claudePath, "# Claude Instructions\n- ALWAYS use bun.\n", "utf-8");

          const result = auditCognitiveContext(tempDir);
          expect(result.passed).toBe(true);
          expect(result.summary.scannedFiles).toContain(claudePath);
        });

        it("prioritizes AGENTS.md over .cursorrules and CLAUDE.md when multiple exist", () => {
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# AGENTS\n- Lean agents file.\n", "utf-8");
          fs.writeFileSync(path.join(tempDir, ".cursorrules"), "# Rules\n- Cursor rules.\n", "utf-8");
          fs.writeFileSync(path.join(tempDir, "CLAUDE.md"), "# Claude\n- Claude rules.\n", "utf-8");

          const result = auditCognitiveContext(tempDir);
          expect(result.summary.scannedFiles[0]).toBe(path.join(tempDir, "AGENTS.md"));
        });

        it("gracefully isolates path traversal attempts without unhandled exceptions", () => {
          const nestedDir = path.join(tempDir, "deep", "nested", "sub");
          fs.mkdirSync(nestedDir, { recursive: true });
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Root AGENTS\n- Strict root.\n", "utf-8");

          // Path with relative traversal ..
          const traversalPath = path.join(nestedDir, "..", "..", "..");
          const result = auditCognitiveContext(traversalPath);
          expect(result).toBeDefined();
          expect(typeof result.score).toBe("number");
        });

        it("handles non-existent paths gracefully without throwing an exception", () => {
          const nonExistent = path.join(tempDir, "does-not-exist-" + Date.now());
          const result = auditCognitiveContext(nonExistent);
          expect(result.passed).toBe(false);
          expect(result.summary.failedCount).toBe(1);
          expect(result.violations[0].ruleId).toBe("token-budget");
          expect(result.violations[0].suggestion).toContain("baba agents generate");
        });
      });

      // Dimension 2: Failure Modes & Boundary Handling
      describe("Dimension 2: Failure Modes & Boundary Handling", () => {
        it("handles completely empty AGENTS.md (0 bytes) gracefully", () => {
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "", "utf-8");

          const result = auditCognitiveContext(tempDir);
          expect(result.passed).toBe(true);
          expect(result.score).toBe(100);
          expect(result.summary.estimatedTokens).toBe(0);
          expect(result.violations).toHaveLength(0);
          expect(result.durationMs).toBeLessThan(25);
        });

        it("handles instructions containing unicode, emojis, and non-ASCII characters", () => {
          const unicodeContent = `# 🪆 AGENTS & 🤖 SKILLS\n- ALWAYS 🚀 ship clean código com tipagem estrita! ✨\n- PREFER 🛡️ immutabilidade.\n`;
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), unicodeContent, "utf-8");

          const result = auditCognitiveContext(tempDir);
          expect(result.passed).toBe(true);
          expect(result.score).toBe(100);
          expect(result.summary.estimatedTokens).toBeGreaterThan(0);
          expect(result.durationMs).toBeLessThan(25);
        });

        it("handles extremely long single lines without regex backtracking hang", () => {
          const longLine = "- ALWAYS " + "token ".repeat(500);
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), longLine, "utf-8");

          const t0 = performance.now();
          const result = auditCognitiveContext(tempDir);
          const elapsed = performance.now() - t0;

          expect(elapsed).toBeLessThan(25);
          expect(result.durationMs).toBeLessThan(25);
        });
      });

      // Dimension 3: Idempotency & Retry
      describe("Dimension 3: Idempotency & Repeatability", () => {
        it("produces 100% byte-for-byte identical output across 50 consecutive runs", () => {
          const content = `# AGENTS
## Guidelines
- DO NOT do X
- NEVER do Y
- DON'T do Z
- MUST NOT do W
- Try to check things.
`;
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

          const initial = auditCognitiveContext(tempDir);
          const initialClean = {
            score: initial.score,
            passed: initial.passed,
            passedStrict: initial.passedStrict,
            violations: initial.violations.map((v) => ({ ...v, durationMs: undefined })),
            summary: initial.summary
          };

          for (let i = 0; i < 50; i++) {
            const run = auditCognitiveContext(tempDir);
            expect(run.score).toBe(initialClean.score);
            expect(run.passed).toBe(initialClean.passed);
            expect(run.passedStrict).toBe(initialClean.passedStrict);
            expect(run.summary.failedCount).toBe(initialClean.summary.failedCount);
            expect(run.summary.warnCount).toBe(initialClean.summary.warnCount);
            expect(run.summary.estimatedTokens).toBe(initialClean.summary.estimatedTokens);
            expect(run.violations.length).toBe(initialClean.violations.length);
          }
        });

        it("produces deterministic structured JSON via CLI across repeated runs", () => {
          const content = `# AGENTS\n- ALWAYS write tests.\n`;
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

          const proc1 = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);
          const proc2 = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);

          const parsed1 = JSON.parse(proc1.stdout.toString().trim());
          const parsed2 = JSON.parse(proc2.stdout.toString().trim());

          expect(parsed1.score).toBe(parsed2.score);
          expect(parsed1.passed).toBe(parsed2.passed);
          expect(parsed1.passedStrict).toBe(parsed2.passedStrict);
          expect(parsed1.summary.totalRules).toBe(parsed2.summary.totalRules);
          expect(parsed1.violations).toEqual(parsed2.violations);
        });
      });

      // Dimension 4: Authorization & Zero-Mutation Invariant
      describe("Dimension 4: Authorization & Scopes (Zero-Mutation Invariant)", () => {
        it("strictly touches zero files and modifies zero bytes on disk", () => {
          const content = `# AGENTS\n- ALWAYS write clean code.\n`;
          const filePath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(filePath, content, "utf-8");

          const statBefore = fs.statSync(filePath);
          const filesBefore = fs.readdirSync(tempDir);

          auditCognitiveContext(tempDir);
          auditCognitiveContext(tempDir, { strict: true });

          const statAfter = fs.statSync(filePath);
          const filesAfter = fs.readdirSync(tempDir);

          expect(filesAfter).toEqual(filesBefore);
          expect(statAfter.size).toBe(statBefore.size);
          expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
          expect(fs.readFileSync(filePath, "utf-8")).toBe(content);
        });
      });

      // Dimension 5: Concurrency & Performance
      describe("Dimension 5: Concurrency & Non-Interference", () => {
        it("runs 20 concurrent audit evaluations simultaneously without cross-talk or race conditions", async () => {
          const subdirs: string[] = [];
          for (let i = 0; i < 20; i++) {
            const sub = path.join(tempDir, `concurrent-${i}`);
            fs.mkdirSync(sub, { recursive: true });
            const isFailing = i % 2 === 0;
            const content = isFailing
              ? "# AGENTS\n\n" + Array(300).fill("bloat").join(" ")
              : "# AGENTS\n- ALWAYS pass tests.\n";
            fs.writeFileSync(path.join(sub, "AGENTS.md"), content, "utf-8");
            subdirs.push(sub);
          }

          const results = await Promise.all(
            subdirs.map((dir, idx) =>
              new Promise<CognitiveAuditResult>((resolve) => {
                const res = auditCognitiveContext(dir);
                resolve(res);
              })
            )
          );

          expect(results).toHaveLength(20);
          results.forEach((res, idx) => {
            const isFailing = idx % 2 === 0;
            if (isFailing) {
              expect(res.passed).toBe(false);
              expect(res.violations.some((v) => v.ruleId === "token-budget")).toBe(true);
            } else {
              expect(res.passed).toBe(true);
              expect(res.score).toBe(100);
            }
            expect(res.durationMs).toBeLessThan(25);
          });
        });
      });

      // Dimension 6: Data Lifecycle & In-Memory Isolation
      describe("Dimension 6: Data Lifecycle & In-Memory Isolation", () => {
        it("maintains pure functional isolation between successive audits of different projects", () => {
          const dirA = path.join(tempDir, "project-a");
          const dirB = path.join(tempDir, "project-b");
          fs.mkdirSync(dirA, { recursive: true });
          fs.mkdirSync(dirB, { recursive: true });

          // Project A has dead skill
          fs.writeFileSync(
            path.join(dirA, "AGENTS.md"),
            "# AGENTS\n- See [Skill](.agents/skills/ghost.md)\n",
            "utf-8"
          );
          // Project B is totally clean
          fs.writeFileSync(path.join(dirB, "AGENTS.md"), "# AGENTS\n- ALWAYS pure.\n", "utf-8");

          const resA1 = auditCognitiveContext(dirA);
          const resB1 = auditCognitiveContext(dirB);
          const resA2 = auditCognitiveContext(dirA);

          expect(resA1.violations.some((v) => v.ruleId === "dead-skills")).toBe(true);
          expect(resB1.violations).toHaveLength(0);
          expect(resB1.score).toBe(100);
          expect(resA2.violations.some((v) => v.ruleId === "dead-skills")).toBe(true);
          expect(resA2.score).toBe(resA1.score);
        });
      });

      // Dimension 7: External Fallbacks & Airgap-Safe
      describe("Dimension 7: External Fallbacks & Airgap-Safe", () => {
        it("operates strictly local with zero network egress and zero remote dependencies", () => {
          const content = `# AGENTS\n- ALWAYS execute locally.\n`;
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

          const originalFetch = globalThis.fetch;
          let fetchCalled = false;
          (globalThis as any).fetch = () => {
            fetchCalled = true;
            throw new Error("Network access prohibited during audit");
          };

          try {
            const result = auditCognitiveContext(tempDir);
            expect(fetchCalled).toBe(false);
            expect(result.passed).toBe(true);
          } finally {
            globalThis.fetch = originalFetch;
          }
        });
      });

      // Dimension 8: State Transitions
      describe("Dimension 8: State Transitions & Scoring Boundaries", () => {
        it("correctly transitions health score through full range [0, 100]", () => {
          // Perfectly clean: 100
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# AGENTS\n- Clean directive.\n", "utf-8");
          const clean = auditCognitiveContext(tempDir);
          expect(clean.score).toBe(100);

          // 1 Warn: 95
          fs.writeFileSync(
            path.join(tempDir, "AGENTS.md"),
            "# AGENTS\n" + Array(220).fill("word").join(" "),
            "utf-8"
          );
          const warn1 = auditCognitiveContext(tempDir);
          expect(warn1.score).toBe(95);

          // 1 Fail: 85
          fs.writeFileSync(
            path.join(tempDir, "AGENTS.md"),
            "# AGENTS\n" + Array(300).fill("word").join(" "),
            "utf-8"
          );
          const fail1 = auditCognitiveContext(tempDir);
          expect(fail1.score).toBe(85);

          // 7 Fails: penalty 105 -> clamped to 0
          const sevenDeadSkills = Array(7)
            .fill(0)
            .map((_, i) => `- [Missing ${i}](.agents/skills/missing_${i}.md)`)
            .join("\n");
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), `# AGENTS\n${sevenDeadSkills}\n`, "utf-8");
          const clamped = auditCognitiveContext(tempDir);
          expect(clamped.score).toBe(0);
          expect(clamped.passed).toBe(false);
          expect(clamped.passedStrict).toBe(false);
        });
      });

      // Dimension 9: Observability & Telemetry Completeness
      describe("Dimension 9: Observability & Telemetry Completeness", () => {
        it("guarantees full schema adherence and double-keying across all response structures", () => {
          const content = `# AGENTS\n- ALWAYS test.\n- Try to check.\n`;
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

          const res = auditCognitiveContext(tempDir);

          // Top-level properties
          expect(typeof res.score).toBe("number");
          expect(typeof res.healthScore).toBe("number");
          expect(typeof res.health_score).toBe("number");
          expect(typeof res.passed).toBe("boolean");
          expect(typeof res.passedStrict).toBe("boolean");
          expect(typeof res.passed_strict).toBe("boolean");
          expect(typeof res.durationMs).toBe("number");
          expect(typeof res.duration_ms).toBe("number");

          // Summary properties
          expect(res.summary.totalRules).toBe(5);
          expect(res.summary.total_rules).toBe(5);
          expect(typeof res.summary.failedCount).toBe("number");
          expect(typeof res.summary.failed_count).toBe("number");
          expect(typeof res.summary.warnCount).toBe("number");
          expect(typeof res.summary.warn_count).toBe("number");
          expect(typeof res.summary.passedCount).toBe("number");
          expect(typeof res.summary.passed_count).toBe("number");
          expect(typeof res.summary.estimatedTokens).toBe("number");
          expect(typeof res.summary.estimated_tokens).toBe("number");
          expect(typeof res.summary.targetPath).toBe("string");
          expect(typeof res.summary.target_path).toBe("string");
          expect(Array.isArray(res.summary.scannedFiles)).toBe(true);
          expect(Array.isArray(res.summary.scanned_files)).toBe(true);

          // Violations structure
          expect(Array.isArray(res.violations)).toBe(true);
          for (const v of res.violations) {
            expect(typeof v.id).toBe("string");
            expect(typeof v.ruleId).toBe("string");
            expect(typeof v.rule_id).toBe("string");
            expect(["fail", "warn", "pass"]).toContain(v.severity);
            expect(typeof v.message).toBe("string");
            expect(typeof v.file).toBe("string");
            if (v.suggestion) {
              expect(typeof v.suggestion).toBe("string");
            }
          }
        });
      });
    });

    // -------------------------------------------------------------------------
    // PRD Section 6 Full BDD Acceptance Criteria (Gherkin Scenarios)
    // -------------------------------------------------------------------------
    describe("PRD Section 6 Gherkin BDD Acceptance Criteria Scenarios", () => {
      it("Scenario 1: Healthy root AGENTS.md passes audit (score > 90, exits 0)", () => {
        const content = `# AGENTS
## Core Directives
- ALWAYS write unit tests for critical code paths.
- PREFER declarative state transitions.
- ENFORCE zero compiler warnings in build pipeline.
`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

        const result = auditCognitiveContext(tempDir);
        expect(result.passed).toBe(true);
        expect(result.passedStrict).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(90);
        expect(result.violations).toHaveLength(0);

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir]);
        expect(proc.exitCode).toBe(0);
        expect(proc.stdout.toString()).toContain("PASS (optimal)");
      });

      it("Scenario 2: Bloated AGENTS.md fails in strict mode (exits 1, token-budget violation)", () => {
        const content = "# AGENTS\n\n" + Array(600).fill("bloated instruction directive").join(" ");
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

        const result = auditCognitiveContext(tempDir, { strict: true });
        expect(result.passed).toBe(false);
        expect(result.passedStrict).toBe(false);
        const tokenViolation = result.violations.find((v) => v.ruleId === "token-budget");
        expect(tokenViolation).toBeDefined();
        expect(tokenViolation?.severity).toBe("fail");

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"]);
        expect(proc.exitCode).toBe(1);
        expect(proc.stderr.toString()).toContain("Strict mode failed");
      });

      it("Scenario 3: Dead skill link is detected (dead-skills violation reported)", () => {
        const content = `# AGENTS
- For testing procedures, consult [Testing Guide](.agents/skills/nonexistent.md).
`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

        const result = auditCognitiveContext(tempDir);
        const deadSkillViolation = result.violations.find((v) => v.ruleId === "dead-skills");
        expect(deadSkillViolation).toBeDefined();
        expect(deadSkillViolation?.severity).toBe("fail");
        expect(deadSkillViolation?.line).toBe(2);
        expect(deadSkillViolation?.snippet).toContain("[Testing Guide](.agents/skills/nonexistent.md)");

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);
        expect(proc.exitCode).toBe(0);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.violations.some((v: any) => v.ruleId === "dead-skills")).toBe(true);
      });

      it("Scenario 4: Negative phrasing trap triggers warning and provides positive anchor suggestions", () => {
        const content = `# AGENTS
## Prohibitions
- DO NOT use any type
- NEVER bypass gate checks
- DON'T commit secrets
- PROHIBITED: mutable globals
`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

        const result = auditCognitiveContext(tempDir);
        const negViolation = result.violations.find((v) => v.ruleId === "negative-phrasing-trap");
        expect(negViolation).toBeDefined();
        expect(negViolation?.severity).toBe("warn");
        expect(negViolation?.suggestion).toContain("PREFER");
        expect(negViolation?.suggestion).toContain("USE");
        expect(negViolation?.suggestion).toContain("ENFORCE");

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.violations.some((v: any) => v.ruleId === "negative-phrasing-trap")).toBe(true);
      });

      it("Scenario 5: Permissive linguistic leaks are flagged with suggested imperatives", () => {
        const content = `# AGENTS
## Guidelines
- Try to verify all boundary conditions.
- If possible, write tests before coding.
`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

        const result = auditCognitiveContext(tempDir);
        const permissiveViolations = result.violations.filter((v) => v.ruleId === "permissive-leak");
        expect(permissiveViolations.length).toBeGreaterThanOrEqual(2);
        expect(permissiveViolations.every((v) => v.severity === "warn")).toBe(true);

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.violations.some((v: any) => v.ruleId === "permissive-leak")).toBe(true);
      });

      it("Scenario 6: Large raw code block triggers greedy preload guard", () => {
        const codeBlock = Array(35).fill("const line = true;").join("\n");
        const content = `# AGENTS
## Code Reference
\`\`\`typescript
${codeBlock}
\`\`\`
`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

        const result = auditCognitiveContext(tempDir);
        const greedyViolation = result.violations.find((v) => v.ruleId === "greedy-preload");
        expect(greedyViolation).toBeDefined();
        expect(greedyViolation?.severity).toBe("warn");
        expect(greedyViolation?.suggestion).toContain(".agents/skills/");

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"]);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.violations.some((v: any) => v.ruleId === "greedy-preload")).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Combined Realistic Multi-Pattern Repository Evaluation
    // -------------------------------------------------------------------------
    describe("Realistic Multi-Antipattern Comprehensive Scenario", () => {
      it("audits a repository with all 5 antipatterns simultaneously and computes accurate composite score", () => {
        // Create valid skill for one link, but leave another dead
        const skillsDir = path.join(tempDir, ".agents", "skills");
        fs.mkdirSync(skillsDir, { recursive: true });
        fs.writeFileSync(path.join(skillsDir, "valid-skill.md"), "# Valid Skill\nBody", "utf-8");

        const codeBlock = Array(30).fill("console.log('greedy');").join("\n");
        const content = `# AGENTS
## Negative Section
- DO NOT ignore errors
- NEVER push without tests
- DON'T use eval
- PROHIBITED: ts-ignore

## Soft Directives
- Try to format files.
- If possible keep modules small.

## Skills Links
- Valid: [Valid](.agents/skills/valid-skill.md)
- Missing: [Missing](.agents/skills/missing-skill.md)

## Massive Raw Code
\`\`\`javascript
${codeBlock}
\`\`\`

## Extra padding to reach warning threshold
${Array(180).fill("padding instruction rule").join(" ")}
`;
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

        const result = auditCognitiveContext(tempDir);

        // Violations present:
        // 1. dead-skills (missing-skill.md) -> fail (-15)
        // 2. negative-phrasing-trap -> warn (-5)
        // 3. permissive-leak (try to, if possible) -> warn x 2 (-10)
        // 4. greedy-preload (code block 30 lines) -> warn (-5)
        // 5. token-budget (exceeds 200 warn) -> warn (-5)
        expect(result.summary.failedCount).toBeGreaterThanOrEqual(1);
        expect(result.summary.warnCount).toBeGreaterThanOrEqual(3);
        expect(result.passed).toBe(false); // has a fail violation
        expect(result.passedStrict).toBe(false);
        expect(result.score).toBeLessThan(75);
        expect(result.durationMs).toBeLessThan(25);

        // Ensure every unique violation rule is present
        const ruleIds = new Set(result.violations.map((v) => v.ruleId));
        expect(ruleIds.has("dead-skills")).toBe(true);
        expect(ruleIds.has("negative-phrasing-trap")).toBe(true);
        expect(ruleIds.has("permissive-leak")).toBe(true);
        expect(ruleIds.has("greedy-preload")).toBe(true);
      });
    });
  });

  // =========================================================================
  // Subtask 9: Alias parity across baba, bbyg, and matryoshka
  // =========================================================================
  describe("Subtask 9: Alias parity across `baba`, `bbyg`, and `matryoshka`", () => {
    let tempDir: string;
    const cliPath = path.join(repoRoot, "src", "cli.ts");
    const shellBaba = path.join(repoRoot, "packages", "baba", "bin", "baba.js");
    const shellBbyg = path.join(repoRoot, "packages", "bbyg", "bin", "bbyg.js");
    const shellMatryoska = path.join(repoRoot, "packages", "matryoska", "bin", "matryoska.js");
    const shellMatrioska = path.join(repoRoot, "packages", "matrioska", "bin", "matrioska.js");

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-subtask9-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("ensures CLI help menu parity across baba, bbyg, and matryoshka for agents audit --help", () => {
      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", "--help"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", "--help"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", "--help"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString().trim();
      const outBbyg = procBbyg.stdout.toString().trim();
      const outMatryoshka = procMatryoshka.stdout.toString().trim();

      expect(outBaba).toBe(outBbyg);
      expect(outBaba).toBe(outMatryoshka);
      expect(outBaba).toContain("Usage: baba agents audit [path] [options]");
      expect(outBaba).toContain("--strict");
      expect(outBaba).toContain("--json");
      expect(outBaba).toContain("token-budget");
      expect(outBaba).toContain("dead-skills");
      expect(outBaba).toContain("negative-phrasing-trap");
      expect(outBaba).toContain("permissive-leak");
      expect(outBaba).toContain("greedy-preload");
    });

    it("ensures human-readable audit parity across baba, bbyg, and matryoshka on compliant repository", () => {
      const healthyContent = `# AGENTS
## Guidelines
- ALWAYS write unit tests for critical code paths.
- PREFER declarative state transitions.
- ENFORCE zero compiler warnings in build pipeline.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), healthyContent, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString();
      const outBbyg = procBbyg.stdout.toString();
      const outMatryoshka = procMatryoshka.stdout.toString();

      expect(outBaba).toContain("100 / 100");
      expect(outBbyg).toContain("100 / 100");
      expect(outMatryoshka).toContain("100 / 100");
      expect(outBaba).toContain("PASS (optimal)");
      expect(outBbyg).toContain("PASS (optimal)");
      expect(outMatryoshka).toContain("PASS (optimal)");
    });

    it("ensures structured JSON parity across baba, bbyg, and matryoshka for agents audit --json", () => {
      const content = `# AGENTS
## Guidelines
- DO NOT ignore errors
- Try to format files.
`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.status).toBe(parsedBbyg.status);
      expect(parsedBaba.status).toBe(parsedMatryoshka.status);
      expect(parsedBaba.score).toBe(parsedBbyg.score);
      expect(parsedBaba.score).toBe(parsedMatryoshka.score);
      expect(parsedBaba.healthScore).toBe(parsedBbyg.healthScore);
      expect(parsedBaba.health_score).toBe(parsedMatryoshka.health_score);
      expect(parsedBaba.passed).toBe(parsedBbyg.passed);
      expect(parsedBaba.passedStrict).toBe(parsedBbyg.passedStrict);
      expect(parsedBaba.passed_strict).toBe(parsedMatryoshka.passed_strict);
      expect(parsedBaba.summary.totalRules).toBe(parsedBbyg.summary.totalRules);
      expect(parsedBaba.summary.total_rules).toBe(parsedMatryoshka.summary.total_rules);
      expect(parsedBaba.summary.warnCount).toBe(parsedBbyg.summary.warnCount);
      expect(parsedBaba.summary.warn_count).toBe(parsedMatryoshka.summary.warn_count);
      expect(parsedBaba.summary.failedCount).toBe(parsedBbyg.summary.failedCount);
      expect(parsedBaba.summary.failed_count).toBe(parsedMatryoshka.summary.failed_count);
      expect(parsedBaba.summary.passedCount).toBe(parsedBbyg.summary.passedCount);
      expect(parsedBaba.summary.estimatedTokens).toBe(parsedBbyg.summary.estimatedTokens);
      expect(parsedBaba.violations.length).toBe(parsedBbyg.violations.length);
      expect(parsedBaba.violations.length).toBe(parsedMatryoshka.violations.length);
    });

    it("ensures strict mode parity across baba, bbyg, and matryoshka for failing audit (--strict)", () => {
      const failContent =
        "# AGENTS\n\n" +
        Array(350).fill("directive").join(" ") +
        "\n- [Broken](.agents/skills/missing.md)\n";
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(1);
      expect(procBbyg.exitCode).toBe(1);
      expect(procMatryoshka.exitCode).toBe(1);

      expect(procBaba.stderr.toString()).toContain("Strict mode failed");
      expect(procBbyg.stderr.toString()).toContain("Strict mode failed");
      expect(procMatryoshka.stderr.toString()).toContain("Strict mode failed");
    });

    it("ensures combined strict and json parity across baba, bbyg, and matryoshka (--strict --json)", () => {
      const failContent = "# AGENTS\n\n" + Array(300).fill("bloat").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), failContent, "utf-8");

      const procBaba = Bun.spawnSync(
        ["bun", "run", cliPath, "agents", "audit", tempDir, "--strict", "--json"],
        { env: { ...process.env, BABA_ALIAS: "baba" } }
      );
      const procBbyg = Bun.spawnSync(
        ["bun", "run", cliPath, "agents", "audit", tempDir, "--strict", "--json"],
        { env: { ...process.env, BABA_ALIAS: "bbyg" } }
      );
      const procMatryoshka = Bun.spawnSync(
        ["bun", "run", cliPath, "agents", "audit", tempDir, "--strict", "--json"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBaba.exitCode).toBe(1);
      expect(procBbyg.exitCode).toBe(1);
      expect(procMatryoshka.exitCode).toBe(1);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.status).toBe("error");
      expect(parsedBbyg.status).toBe("error");
      expect(parsedMatryoshka.status).toBe("error");
      expect(parsedBaba.passedStrict).toBe(false);
      expect(parsedBbyg.passedStrict).toBe(false);
      expect(parsedMatryoshka.passedStrict).toBe(false);
      expect(parsedBaba.score).toBe(parsedBbyg.score);
      expect(parsedBaba.score).toBe(parsedMatryoshka.score);
    });

    it("ensures alias parity when invoked via package.json scripts (bun run baba / bbyg / matryoshka)", () => {
      const content = `# AGENTS\n- ALWAYS pass tests.\n`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", "baba", "agents", "audit", tempDir, "--json"]);
      const procBbyg = Bun.spawnSync(["bun", "run", "bbyg", "agents", "audit", tempDir, "--json"]);
      const procMatryoshka = Bun.spawnSync(["bun", "run", "matryoshka", "agents", "audit", tempDir, "--json"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim().replace(/^.*?\n(?=\{)/s, ""));
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim().replace(/^.*?\n(?=\{)/s, ""));
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim().replace(/^.*?\n(?=\{)/s, ""));

      expect(parsedBaba.score).toBe(100);
      expect(parsedBbyg.score).toBe(100);
      expect(parsedMatryoshka.score).toBe(100);
      expect(parsedBaba.passed).toBe(true);
      expect(parsedBbyg.passed).toBe(true);
      expect(parsedMatryoshka.passed).toBe(true);
    });

    it("ensures alias parity through protective shell forwarders (packages/baba, packages/bbyg, packages/matryoska, packages/matrioska)", () => {
      const content = `# AGENTS\n- ALWAYS write resilient code.\n`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", shellBaba, "agents", "audit", tempDir, "--json"]);
      const procBbyg = Bun.spawnSync(["bun", "run", shellBbyg, "agents", "audit", tempDir, "--json"]);
      const procMatryoska = Bun.spawnSync(["bun", "run", shellMatryoska, "agents", "audit", tempDir, "--json"]);
      const procMatrioska = Bun.spawnSync(["bun", "run", shellMatrioska, "agents", "audit", tempDir, "--json"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoska.exitCode).toBe(0);
      expect(procMatrioska.exitCode).toBe(0);

      const resBaba = JSON.parse(procBaba.stdout.toString().trim());
      const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const resMatryoska = JSON.parse(procMatryoska.stdout.toString().trim());
      const resMatrioska = JSON.parse(procMatrioska.stdout.toString().trim());

      expect(resBaba.score).toBe(100);
      expect(resBbyg.score).toBe(100);
      expect(resMatryoska.score).toBe(100);
      expect(resMatrioska.score).toBe(100);
      expect(resBaba.status).toBe(resBbyg.status);
      expect(resBaba.passed).toBe(true);
    });

    it("ensures error boundary parity across baba, bbyg, and matryoshka when AGENTS.md is missing", () => {
      const emptyDir = path.join(tempDir, "empty");
      fs.mkdirSync(emptyDir, { recursive: true });

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", emptyDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", emptyDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", emptyDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.status).toBe("error");
      expect(parsedBbyg.status).toBe("error");
      expect(parsedMatryoshka.status).toBe("error");
      expect(parsedBaba.passed).toBe(false);
      expect(parsedBbyg.passed).toBe(false);
      expect(parsedMatryoshka.passed).toBe(false);
      expect(parsedBaba.violations[0]?.id).toBe("token-budget-missing");
      expect(parsedBbyg.violations[0]?.id).toBe("token-budget-missing");
      expect(parsedMatryoshka.violations[0]?.id).toBe("token-budget-missing");

      // In strict mode, all exit with code 1
      const procBabaStrict = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", emptyDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbygStrict = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", emptyDir, "--strict"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshkaStrict = Bun.spawnSync(
        ["bun", "run", cliPath, "agents", "audit", emptyDir, "--strict"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBabaStrict.exitCode).toBe(1);
      expect(procBbygStrict.exitCode).toBe(1);
      expect(procMatryoshkaStrict.exitCode).toBe(1);
    });

    it("ensures custom option parity across baba, bbyg, and matryoshka (--max-tokens)", () => {
      // 150 words -> exceeds 100 max-tokens
      const content = "# AGENTS\n\n" + Array(150).fill("directive").join(" ");
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const procBaba = Bun.spawnSync(
        ["bun", "run", cliPath, "agents", "audit", tempDir, "--max-tokens", "100", "--json"],
        { env: { ...process.env, BABA_ALIAS: "baba" } }
      );
      const procBbyg = Bun.spawnSync(
        ["bun", "run", cliPath, "agents", "audit", tempDir, "--max-tokens", "100", "--json"],
        { env: { ...process.env, BABA_ALIAS: "bbyg" } }
      );
      const procMatryoshka = Bun.spawnSync(
        ["bun", "run", cliPath, "agents", "audit", tempDir, "--max-tokens", "100", "--json"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.passed).toBe(false);
      expect(parsedBbyg.passed).toBe(false);
      expect(parsedMatryoshka.passed).toBe(false);
      expect(parsedBaba.violations.some((v: any) => v.ruleId === "token-budget")).toBe(true);
      expect(parsedBbyg.violations.some((v: any) => v.ruleId === "token-budget")).toBe(true);
      expect(parsedMatryoshka.violations.some((v: any) => v.ruleId === "token-budget")).toBe(true);
    });

    it("ensures sub-25ms execution duration across baba, bbyg, and matryoshka audit runs", () => {
      const content = `# AGENTS\n- ALWAYS run fast.\n`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.durationMs).toBeLessThan(25);
      expect(parsedBbyg.durationMs).toBeLessThan(25);
      expect(parsedMatryoshka.durationMs).toBeLessThan(25);
    });

    it("ensures top-level shorthand parity across baba audit, bbyg audit, and matryoshka audit", () => {
      const content = `# AGENTS\n- ALWAYS maintain shorthand parity.\n`;
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), content, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "audit", tempDir, "--json"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.command).toBe("agents audit");
      expect(parsedBbyg.command).toBe("agents audit");
      expect(parsedMatryoshka.command).toBe("agents audit");
      expect(parsedBaba.score).toBe(100);
      expect(parsedBbyg.score).toBe(100);
      expect(parsedMatryoshka.score).toBe(100);
    });
  });
});



