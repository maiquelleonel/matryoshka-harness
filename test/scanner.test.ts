import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  discoverCodebaseEntities,
  evaluateInMemoryFallback,
  executeHarnessScore,
  formatScanHumanOutput,
  formatScanJsonOutput,
  generateHarnessBadgeSvg,
  generateRemediationIssue,
  normalizeMaturityLevel,
  reconcileGapsWithStack,
  resolveHarnessScoreBinary,
  runHarnessScoreSubprocess,
  runMaturityScan,
} from "../src/scanner";
import type {
  CodebaseEntities,
  HarnessGap,
  HarnessScoreOptions,
  HarnessScoreResult,
  MaturityLevel,
  ProjectStack,
  RemediationIssue,
  SemanticReconciliation,
} from "../src/types";

describe("Maturity Oracle Integration (src/scanner.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-scanner-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors in ephemeral sandbox
    }
  });

  describe("AC-1: Deterministic Subprocess Spawning via Bun.spawn", () => {
    it("executes a mock harness-score binary and returns typed HarnessScoreResult", async () => {
      // Create a mock executable harness-score script
      const mockBinPath = path.join(tempDir, "mock-harness-score");
      const mockOutput = {
        score: 42,
        maxScore: 105,
        level: "L1",
        gaps: [
          {
            id: "CTX-01",
            axis: "context",
            title: "Missing AGENTS.md context fence",
            description: "No root AGENTS.md found",
          },
          {
            id: "CI-01",
            axis: "guardrails",
            title: "Missing CI workflow",
            description: "No GitHub Actions CI workflow",
          },
          {
            id: "SNS-05",
            axis: "sensors",
            title: "Missing test runner configuration",
            description: "No automated test runner detected",
          },
        ],
        passed: ["HYG-01", "HYG-02"],
      };

      const scriptContent = `#!/usr/bin/env bun
console.log(JSON.stringify(${JSON.stringify(mockOutput)}));
process.exit(0);
`;
      fs.writeFileSync(mockBinPath, scriptContent, { mode: 0o755 });

      const result: HarnessScoreResult = await runHarnessScoreSubprocess(tempDir, {
        binaryPath: mockBinPath,
      });

      expect(result).toBeDefined();
      expect(result.source).toBe("subprocess");
      expect(result.score).toBe(42);
      expect(result.maxScore).toBe(105);
      expect(result.level).toBe("L1");
      expect(result.gaps.length).toBe(3);
      expect(result.gaps[0]?.id).toBe("CTX-01");
      expect(result.gaps[0]?.axis).toBe("context");
      expect(result.gaps[1]?.id).toBe("CI-01");
      expect(result.gaps[1]?.axis).toBe("guardrails");
      expect(result.gaps[2]?.id).toBe("SNS-05");
      expect(result.gaps[2]?.axis).toBe("sensors");
      expect(result.passed).toContain("HYG-01");
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("passes target path and custom arguments to subprocess", async () => {
      const mockBinPath = path.join(tempDir, "mock-arg-checker");
      const argsLogPath = path.join(tempDir, "args.json");

      const scriptContent = `#!/usr/bin/env bun
import * as fs from "node:fs";
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsLogPath)}, JSON.stringify(args));
console.log(JSON.stringify({ score: 100, maxScore: 105, level: "L4", gaps: [] }));
process.exit(0);
`;
      fs.writeFileSync(mockBinPath, scriptContent, { mode: 0o755 });

      await runHarnessScoreSubprocess(tempDir, {
        binaryPath: mockBinPath,
        args: ["--strict", "--verbose"],
      });

      expect(fs.existsSync(argsLogPath)).toBe(true);
      const recordedArgs = JSON.parse(fs.readFileSync(argsLogPath, "utf-8"));
      expect(recordedArgs).toContain("--json");
      expect(recordedArgs).toContain("--strict");
      expect(recordedArgs).toContain("--verbose");
      expect(recordedArgs).toContain(tempDir);
    });
  });

  describe("AC-2: Structured JSON Output Parsing & Gap Mapping", () => {
    it("correctly infers governance axis from gap IDs when axis is omitted", async () => {
      const mockBinPath = path.join(tempDir, "mock-inferred-gaps");
      const mockOutput = {
        score: 30,
        maxScore: 105,
        level: "L1",
        gaps: [
          { id: "CTX-02", title: "Missing Architecture Blueprint" },
          { id: "SKL-01", title: "No Agent Skills Defined" },
          { id: "GRD-03", title: "No Pre-commit Linter" },
          { id: "SNS-02", title: "No Coverage Reporting" },
          { id: "HYG-05", title: "Unclean Git Working Tree" },
          { id: "DOC-02", title: "Missing Living Documentation" },
        ],
      };

      fs.writeFileSync(
        mockBinPath,
        `#!/usr/bin/env bun\nconsole.log(JSON.stringify(${JSON.stringify(mockOutput)}));\n`,
        { mode: 0o755 }
      );

      const result = await runHarnessScoreSubprocess(tempDir, { binaryPath: mockBinPath });

      expect(result.gaps[0]?.axis).toBe("context");
      expect(result.gaps[1]?.axis).toBe("skills");
      expect(result.gaps[2]?.axis).toBe("guardrails");
      expect(result.gaps[3]?.axis).toBe("sensors");
      expect(result.gaps[4]?.axis).toBe("hygiene");
      expect(result.gaps[5]?.axis).toBe("hygiene");
    });

    it("normalizes maturity levels accurately across integer and string formats", () => {
      expect(normalizeMaturityLevel("L0")).toBe("L0");
      expect(normalizeMaturityLevel("L1")).toBe("L1");
      expect(normalizeMaturityLevel("L2")).toBe("L2");
      expect(normalizeMaturityLevel("L3")).toBe("L3");
      expect(normalizeMaturityLevel("L4")).toBe("L4");
      expect(normalizeMaturityLevel("level 2")).toBe("L2");
      expect(normalizeMaturityLevel(0)).toBe("L0");
      expect(normalizeMaturityLevel(4)).toBe("L4");
      expect(normalizeMaturityLevel("unknown")).toBe("L0");
    });
  });

  describe("AC-3: Execution Timeout & Error Handling", () => {
    it("rejects with an error when subprocess exits with non-zero code", async () => {
      const mockBinPath = path.join(tempDir, "mock-failing-bin");
      fs.writeFileSync(
        mockBinPath,
        `#!/usr/bin/env bun\nconsole.error("Fatal error: repository index corrupted");\nprocess.exit(2);\n`,
        { mode: 0o755 }
      );

      let thrownError: Error | null = null;
      try {
        await runHarnessScoreSubprocess(tempDir, { binaryPath: mockBinPath });
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain("harness-score subprocess failed");
      expect(thrownError?.message).toContain("Fatal error: repository index corrupted");
    });

    it("rejects with timeout error when subprocess exceeds timeoutMs", async () => {
      const mockBinPath = path.join(tempDir, "mock-hanging-bin");
      fs.writeFileSync(
        mockBinPath,
        `#!/usr/bin/env bun\nawait new Promise(r => setTimeout(r, 2000));\nconsole.log("{}");\n`,
        { mode: 0o755 }
      );

      let thrownError: Error | null = null;
      try {
        await runHarnessScoreSubprocess(tempDir, {
          binaryPath: mockBinPath,
          timeoutMs: 100,
        });
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain("timed out");
    });

    it("rejects when subprocess emits non-JSON stdout", async () => {
      const mockBinPath = path.join(tempDir, "mock-text-bin");
      fs.writeFileSync(
        mockBinPath,
        `#!/usr/bin/env bun\nconsole.log("This is plain text, not JSON");\n`,
        { mode: 0o755 }
      );

      let thrownError: Error | null = null;
      try {
        await runHarnessScoreSubprocess(tempDir, { binaryPath: mockBinPath });
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain("Failed to parse JSON");
    });
  });

  describe("AC-4: Binary Resolution & In-Memory Fallback", () => {
    it("resolves binary path from HARNESS_SCORE_BIN environment variable", () => {
      const customPath = "/opt/custom/harness-score";
      const resolved = resolveHarnessScoreBinary(tempDir, {
        env: { HARNESS_SCORE_BIN: customPath },
      });
      expect(resolved).toBe(customPath);
    });

    it("returns null when binary cannot be resolved and no fallback allowed", () => {
      const resolved = resolveHarnessScoreBinary(tempDir, {
        env: { HARNESS_SCORE_BIN: "", PATH: "" },
      });
      expect(resolved).toBeNull();
    });

    it("executes in-memory fallback via executeHarnessScore when binary is not found", async () => {
      // Create minimal repository structure
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "sample" }));
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Sample");

      const result = await executeHarnessScore(tempDir, {
        allowFallback: true,
        binaryPath: "/non/existent/path/to/harness-score",
      });

      expect(result).toBeDefined();
      expect(result.source).toBe("fallback");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.maxScore).toBe(105);
      expect(["L0", "L1", "L2", "L3", "L4"]).toContain(result.level);
      expect(Array.isArray(result.gaps)).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("executes in-memory fallback via runHarnessScoreSubprocess when binary is not found and allowFallback is true", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "sample" }));
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Sample");

      const result = await runHarnessScoreSubprocess(tempDir, {
        allowFallback: true,
        binaryPath: "/non/existent/path/to/harness-score",
      });

      expect(result).toBeDefined();
      expect(result.source).toBe("fallback");
      expect(result.score).toBeGreaterThanOrEqual(15);
      expect(result.maxScore).toBe(105);
      expect(result.passed).toContain("SNS-02");
      expect(result.passed).toContain("CTX-03");
    });

    it("falls back gracefully in runHarnessScoreSubprocess when process fails and allowFallback is true", async () => {
      const mockBinPath = path.join(tempDir, "mock-failing-bin");
      fs.writeFileSync(
        mockBinPath,
        `#!/usr/bin/env bun\nconsole.error("Critical failure");\nprocess.exit(1);\n`,
        { mode: 0o755 }
      );

      const result = await runHarnessScoreSubprocess(tempDir, {
        binaryPath: mockBinPath,
        allowFallback: true,
      });

      expect(result).toBeDefined();
      expect(result.source).toBe("fallback");
    });

    it("falls back gracefully in runHarnessScoreSubprocess when process times out and allowFallback is true", async () => {
      const mockBinPath = path.join(tempDir, "mock-hanging-bin");
      fs.writeFileSync(
        mockBinPath,
        `#!/usr/bin/env bun\nawait new Promise(r => setTimeout(r, 2000));\nconsole.log("{}");\n`,
        { mode: 0o755 }
      );

      const result = await runHarnessScoreSubprocess(tempDir, {
        binaryPath: mockBinPath,
        timeoutMs: 50,
        allowFallback: true,
      });

      expect(result).toBeDefined();
      expect(result.source).toBe("fallback");
    });

    it("evaluateInMemoryFallback scores empty repository as L0 with 0 points and all 8 governance gaps", () => {
      const result = evaluateInMemoryFallback(tempDir);
      expect(result.score).toBe(0);
      expect(result.maxScore).toBe(105);
      expect(result.level).toBe("L0");
      expect(result.source).toBe("fallback");
      expect(result.passed.length).toBe(0);
      expect(result.gaps.length).toBe(9);
      const gapIds = result.gaps.map((g) => g.id);
      expect(gapIds).toContain("CTX-01");
      expect(gapIds).toContain("CTX-02");
      expect(gapIds).toContain("CTX-03");
      expect(gapIds).toContain("SKL-01");
      expect(gapIds).toContain("CI-01");
      expect(gapIds).toContain("GRD-01");
      expect(gapIds).toContain("SNS-01");
      expect(gapIds).toContain("SNS-02");
      expect(gapIds).toContain("HYG-01");
    });

    it("evaluateInMemoryFallback scores fully harnessed repository as L4 with 105 points and 0 gaps", () => {
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Guidelines");
      fs.writeFileSync(path.join(tempDir, "ARCHITECTURE.md"), "# Architecture");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Readme");
      fs.mkdirSync(path.join(tempDir, "skills"));
      fs.mkdirSync(path.join(tempDir, ".github", "workflows"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, ".gitignore"), "node_modules/");
      fs.mkdirSync(path.join(tempDir, "tests"));
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      fs.writeFileSync(path.join(tempDir, "LICENSE"), "MIT");

      const result = evaluateInMemoryFallback(tempDir);
      expect(result.score).toBe(105);
      expect(result.maxScore).toBe(105);
      expect(result.level).toBe("L4");
      expect(result.source).toBe("fallback");
      expect(result.gaps.length).toBe(0);
      expect(result.passed.length).toBe(9);
    });

    it("reconcileGapsWithStack preserves oracleSource in SemanticReconciliation", () => {
      const mockResult: HarnessScoreResult = {
        score: 0,
        maxScore: 105,
        level: "L0",
        gaps: [{ id: "SNS-02", axis: "sensors", title: "Missing manifest" }],
        passed: [],
        source: "fallback",
        executionTimeMs: 5,
      };
      const reconciliation = reconcileGapsWithStack(mockResult, {
        primary: "typescript",
        frameworks: [],
        testRunner: "bun test",
        archetype: "generic",
      });

      expect(reconciliation.oracleSource).toBe("fallback");
      expect(reconciliation.remediationIssues.length).toBeGreaterThan(0);
      const firstIssue = reconciliation.remediationIssues[0];
      if (firstIssue) {
        expect(firstIssue.targetFiles).toContain("package.json");
      }
    });
  });

  describe("AC-5: Semantic Reconciliation of Gaps with Polyglot Stack", () => {
    it("reconciles gaps for TypeScript/Next.js reactive frontend stack", () => {
      const mockOracleResult: HarnessScoreResult = {
        score: 35,
        maxScore: 105,
        level: "L1",
        gaps: [
          { id: "CTX-01", axis: "context", title: "Missing AGENTS.md" },
          { id: "CI-01", axis: "guardrails", title: "Missing CI workflow" },
          { id: "SNS-05", axis: "sensors", title: "Missing test runner" },
          { id: "DOC-02", axis: "hygiene", title: "Missing living docs" },
        ],
        passed: [],
        source: "fallback",
        executionTimeMs: 10,
      };

      const stack: ProjectStack = {
        primary: "typescript",
        frameworks: ["nextjs", "react"],
        testRunner: "bun test",
        archetype: "reactive-frontend",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack);

      expect(reconciliation).toBeDefined();
      expect(reconciliation.primaryStack).toBe("typescript");
      expect(reconciliation.archetype).toBe("reactive-frontend");
      expect(reconciliation.oracleScore).toBe(35);
      expect(reconciliation.totalGaps).toBe(4);
      expect(reconciliation.remediationIssues.length).toBe(4);

      // Verify CTX-01 issue
      const ctxIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CTX-01");
      expect(ctxIssue).toBeDefined();
      expect(ctxIssue?.targetFiles).toContain("AGENTS.md");
      expect(ctxIssue?.priority).toBe("critical");
      expect(ctxIssue?.suggestedAction.toLowerCase()).toContain("reactive");
      expect(ctxIssue?.suggestedAction.toLowerCase()).toContain("solid");

      // Verify CI-01 issue
      const ciIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CI-01");
      expect(ciIssue).toBeDefined();
      expect(ciIssue?.targetFiles).toContain(".github/workflows/ci.yml");
      expect(ciIssue?.priority).toBe("high");
      expect(ciIssue?.suggestedAction).toContain("bun test");

      // Verify SNS-05 issue
      const snsIssue = reconciliation.remediationIssues.find((i) => i.gapId === "SNS-05");
      expect(snsIssue).toBeDefined();
      expect(snsIssue?.priority).toBe("high");
      expect(snsIssue?.suggestedAction).toContain("bun test");

      // Verify priority ordering: critical -> high -> medium -> low
      const priorities = reconciliation.remediationIssues.map((i) => i.priority);
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorityOrder[priorities[i]!]).toBeLessThanOrEqual(priorityOrder[priorities[i + 1]!]);
      }
    });

    it("reconciles gaps for Python/FastAPI stack with pytest", () => {
      const mockOracleResult: HarnessScoreResult = {
        score: 40,
        maxScore: 105,
        level: "L1",
        gaps: [
          { id: "CTX-01", axis: "context", title: "Missing AGENTS.md" },
          { id: "CI-01", axis: "guardrails", title: "Missing CI" },
          { id: "GRD-03", axis: "guardrails", title: "Missing linter" },
          { id: "HYG-01", axis: "hygiene", title: "Missing LICENSE" },
        ],
        passed: [],
        source: "fallback",
        executionTimeMs: 12,
      };

      const stack: ProjectStack = {
        primary: "python",
        frameworks: ["fastapi"],
        testRunner: "pytest",
        archetype: "generic",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack);

      const ctxIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CTX-01");
      expect(ctxIssue?.suggestedAction).toContain("FastAPI");
      expect(ctxIssue?.suggestedAction).toContain("pytest");

      const ciIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CI-01");
      expect(ciIssue?.suggestedAction).toContain("pytest");

      const grdIssue = reconciliation.remediationIssues.find((i) => i.gapId === "GRD-03");
      expect(grdIssue?.targetFiles).toContain("ruff.toml");

      const hygIssue = reconciliation.remediationIssues.find((i) => i.gapId === "HYG-01");
      expect(hygIssue?.priority).toBe("low");
    });

    it("reconciles gaps for PHP procedural CMS (WordPress) enforcing anti-slop rules", () => {
      const mockOracleResult: HarnessScoreResult = {
        score: 20,
        maxScore: 105,
        level: "L0",
        gaps: [{ id: "CTX-01", axis: "context", title: "Missing AGENTS.md" }],
        passed: [],
        source: "fallback",
        executionTimeMs: 8,
      };

      const stack: ProjectStack = {
        primary: "php",
        frameworks: ["wordpress"],
        testRunner: "phpunit",
        archetype: "procedural-cms",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack);
      const ctxIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CTX-01");

      // Verify zero forced SOLID rule is explicitly embedded for procedural CMS
      expect(ctxIssue?.suggestedAction.toLowerCase()).toContain("zero forced solid");
      expect(ctxIssue?.suggestedAction.toLowerCase()).toContain("hooks");
    });

    it("reconciles gaps for Go distributed systems stack", () => {
      const mockOracleResult: HarnessScoreResult = {
        score: 50,
        maxScore: 105,
        level: "L2",
        gaps: [
          { id: "CTX-01", axis: "context", title: "Missing AGENTS.md" },
          { id: "CI-01", axis: "guardrails", title: "Missing CI" },
        ],
        passed: [],
        source: "fallback",
        executionTimeMs: 5,
      };

      const stack: ProjectStack = {
        primary: "go",
        frameworks: ["gin"],
        testRunner: "go test",
        archetype: "distributed-systems",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack);
      const ctxIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CTX-01");
      expect(ctxIssue?.suggestedAction).toContain("Go");
      expect(ctxIssue?.suggestedAction).toContain("error handling");

      const ciIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CI-01");
      expect(ciIssue?.suggestedAction).toContain("go test");
    });

    it("reconciles gaps for Rust stack with Cargo test", () => {
      const mockOracleResult: HarnessScoreResult = {
        score: 50,
        maxScore: 105,
        level: "L2",
        gaps: [
          { id: "CTX-01", axis: "context", title: "Missing AGENTS.md" },
          { id: "CI-01", axis: "guardrails", title: "Missing CI" },
        ],
        passed: [],
        source: "fallback",
        executionTimeMs: 5,
      };

      const stack: ProjectStack = {
        primary: "rust",
        frameworks: ["axum"],
        testRunner: "cargo test",
        archetype: "distributed-systems",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack);
      const ctxIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CTX-01");
      expect(ctxIssue?.suggestedAction).toContain("Rust");
      expect(ctxIssue?.suggestedAction).toContain("ownership");

      const ciIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CI-01");
      expect(ciIssue?.suggestedAction).toContain("cargo test");
    });

    it("reconciles gaps for Ruby on Rails stack", () => {
      const mockOracleResult: HarnessScoreResult = {
        score: 50,
        maxScore: 105,
        level: "L2",
        gaps: [{ id: "CTX-01", axis: "context", title: "Missing AGENTS.md" }],
        passed: [],
        source: "fallback",
        executionTimeMs: 5,
      };

      const stack: ProjectStack = {
        primary: "ruby",
        frameworks: ["rails"],
        testRunner: "rspec",
        archetype: "opinionated-framework",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack);
      const ctxIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CTX-01");
      expect(ctxIssue?.suggestedAction).toContain("Ruby");
      expect(ctxIssue?.suggestedAction).toContain("Rails");
    });

    it("handles unharnessed unknown stack gracefully without crashing", () => {
      const mockOracleResult: HarnessScoreResult = {
        score: 0,
        maxScore: 105,
        level: "L0",
        gaps: [
          { id: "CTX-01", axis: "context", title: "Missing AGENTS.md" },
          { id: "CI-01", axis: "guardrails", title: "Missing CI" },
        ],
        passed: [],
        source: "fallback",
        executionTimeMs: 2,
      };

      const stack: ProjectStack = {
        primary: "unknown",
        frameworks: [],
        testRunner: null,
        archetype: "generic",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack);
      expect(reconciliation.primaryStack).toBe("unknown");
      expect(reconciliation.remediationIssues.length).toBe(2);
      expect(reconciliation.remediationIssues[0]?.targetFiles).toContain("AGENTS.md");
    });
  });

  describe("AC-6: Codebase Entity Discovery & Anti-Slop Fencing", () => {
    it("discovers existing routes, models, and controllers in target repository", () => {
      fs.mkdirSync(path.join(tempDir, "src", "routes"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "src", "models"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "src", "controllers"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src", "routes", "api.ts"), "export const routes = [];");
      fs.writeFileSync(path.join(tempDir, "src", "models", "user.ts"), "export interface User {}");
      fs.writeFileSync(path.join(tempDir, "src", "controllers", "auth.ts"), "export class AuthController {}");

      const entities = discoverCodebaseEntities(tempDir);

      expect(entities.routes).toContain("src/routes/api.ts");
      expect(entities.models).toContain("src/models/user.ts");
      expect(entities.controllers).toContain("src/controllers/auth.ts");
    });

    it("returns empty arrays when scanning empty directory without crashing", () => {
      const entities = discoverCodebaseEntities(tempDir);
      expect(entities.routes).toEqual([]);
      expect(entities.models).toEqual([]);
      expect(entities.controllers).toEqual([]);
    });

    it("incorporates discovered codebase entities into reconciliation context", () => {
      fs.mkdirSync(path.join(tempDir, "routes"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "models"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "routes", "users.py"), "# routes");
      fs.writeFileSync(path.join(tempDir, "models", "user.py"), "# models");

      const mockOracleResult: HarnessScoreResult = {
        score: 25,
        maxScore: 105,
        level: "L1",
        gaps: [{ id: "CTX-01", axis: "context", title: "Missing AGENTS.md" }],
        passed: [],
        source: "fallback",
        executionTimeMs: 5,
      };

      const stack: ProjectStack = {
        primary: "python",
        frameworks: ["fastapi"],
        testRunner: "pytest",
        archetype: "generic",
      };

      const reconciliation = reconcileGapsWithStack(mockOracleResult, stack, tempDir);

      expect(reconciliation.entities.routes).toContain("routes/users.py");
      expect(reconciliation.entities.models).toContain("models/user.py");

      const ctxIssue = reconciliation.remediationIssues.find((i) => i.gapId === "CTX-01");
      expect(ctxIssue?.description).toContain("routes/users.py");
      expect(ctxIssue?.description).toContain("models/user.py");
    });

    it("runMaturityScan executes end-to-end detection and reconciliation", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "sample-app",
          dependencies: { next: "^14.0.0", react: "^18.0.0" },
          scripts: { test: "bun test" },
        })
      );
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Sample App");

      const scanResult = await runMaturityScan(tempDir, { allowFallback: true });

      expect(scanResult).toBeDefined();
      expect(scanResult.primaryStack).toBe("typescript");
      expect(scanResult.frameworks).toContain("nextjs");
      expect(scanResult.oracleScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(scanResult.remediationIssues)).toBe(true);
      expect(scanResult.entities).toBeDefined();
    });
  });

  describe("AC-7: Human-Readable Terminal Output & Structured JSON Export", () => {
    it("formatScanHumanOutput generates styled terminal report with colors and summary", () => {
      const mockReconciliation: SemanticReconciliation = {
        primaryStack: "typescript",
        archetype: "reactive-frontend",
        frameworks: ["nextjs", "react"],
        testRunner: "bun test",
        oracleScore: 45,
        oracleLevel: "L1",
        totalGaps: 2,
        remediationIssues: [
          {
            id: "REM-CTX-01",
            gapId: "CTX-01",
            axis: "context",
            title: "Generate Context Fence (AGENTS.md)",
            description: "Missing root AGENTS.md",
            targetFiles: ["AGENTS.md"],
            stack: "typescript",
            priority: "critical",
            suggestedAction: "Generate root AGENTS.md with TypeScript conventions",
          },
          {
            id: "REM-CI-01",
            gapId: "CI-01",
            axis: "guardrails",
            title: "Configure Continuous Integration Pipeline",
            description: "No CI workflow configurations found",
            targetFiles: [".github/workflows/ci.yml"],
            stack: "typescript",
            priority: "high",
            suggestedAction: "Configure GitHub Actions CI workflow",
          },
        ],
        entities: {
          routes: ["src/routes/users.ts"],
          models: ["src/models/user.ts"],
          controllers: [],
        },
        timestamp: "2026-10-20T12:00:00.000Z",
      };

      const output = formatScanHumanOutput(mockReconciliation, tempDir);

      expect(output).toContain("Matryoshka Maturity Scanner");
      expect(output).toContain(tempDir);
      expect(output).toContain("typescript");
      expect(output).toContain("nextjs, react");
      expect(output).toContain("bun test");
      expect(output).toContain("L1");
      expect(output).toContain("45/105");
      expect(output).toContain("src/routes/users.ts");
      expect(output).toContain("src/models/user.ts");
      expect(output).toContain("CRITICAL");
      expect(output).toContain("REM-CTX-01");
      expect(output).toContain("AGENTS.md");
      expect(output).toContain("HIGH");
      expect(output).toContain("REM-CI-01");
    });

    it("formatScanHumanOutput handles empty entities gracefully without crashing", () => {
      const mockReconciliation: SemanticReconciliation = {
        primaryStack: "unknown",
        archetype: "generic",
        frameworks: [],
        testRunner: null,
        oracleScore: 0,
        oracleLevel: "L0",
        totalGaps: 1,
        remediationIssues: [
          {
            id: "REM-CTX-01",
            gapId: "CTX-01",
            axis: "context",
            title: "Generate Context Fence",
            description: "Missing AGENTS.md",
            targetFiles: ["AGENTS.md"],
            stack: "unknown",
            priority: "critical",
            suggestedAction: "Create AGENTS.md",
          },
        ],
        entities: {
          routes: [],
          models: [],
          controllers: [],
        },
        timestamp: "2026-10-20T12:00:00.000Z",
      };

      const output = formatScanHumanOutput(mockReconciliation, tempDir);

      expect(output).toContain("none");
      expect(output).toContain("L0");
      expect(output).toContain("0/105");
      expect(output).toContain("CRITICAL");
    });

    it("formatScanJsonOutput produces valid structured envelope with snake_case remediation_issues", () => {
      const mockReconciliation: SemanticReconciliation = {
        primaryStack: "python",
        archetype: "generic",
        frameworks: ["fastapi"],
        testRunner: "pytest",
        oracleScore: 35,
        oracleLevel: "L1",
        totalGaps: 1,
        remediationIssues: [
          {
            id: "REM-CTX-01",
            gapId: "CTX-01",
            axis: "context",
            title: "Generate Context Fence (AGENTS.md)",
            description: "Missing AGENTS.md",
            targetFiles: ["AGENTS.md"],
            stack: "python",
            priority: "critical",
            suggestedAction: "Generate root AGENTS.md with FastAPI conventions",
          },
        ],
        entities: {
          routes: ["api/routes.py"],
          models: ["api/models.py"],
          controllers: [],
        },
        timestamp: "2026-10-20T12:00:00.000Z",
      };

      const jsonPayload = formatScanJsonOutput(mockReconciliation, tempDir);

      expect(jsonPayload.status).toBe("success");
      expect(jsonPayload.command).toBe("scan");
      expect(jsonPayload.rootPath).toBe(tempDir);
      expect(jsonPayload.primaryStack).toBe("python");
      expect(jsonPayload.archetype).toBe("generic");
      expect(jsonPayload.frameworks).toEqual(["fastapi"]);
      expect(jsonPayload.testRunner).toBe("pytest");
      expect(jsonPayload.oracleScore).toBe(35);
      expect(jsonPayload.oracleLevel).toBe("L1");
      expect(jsonPayload.totalGaps).toBe(1);

      // Both camelCase and snake_case properties are exposed for agent tooling
      expect(Array.isArray(jsonPayload.remediationIssues)).toBe(true);
      expect(Array.isArray(jsonPayload.remediation_issues)).toBe(true);

      const snakeIssue = jsonPayload.remediation_issues[0];
      expect(snakeIssue.id).toBe("REM-CTX-01");
      expect(snakeIssue.gap_id).toBe("CTX-01");
      expect(snakeIssue.target_files).toContain("AGENTS.md");
      expect(snakeIssue.suggested_action).toContain("FastAPI");

      expect(jsonPayload.entities.routes).toContain("api/routes.py");
    });
  });

  describe("AC-8: SVG Maturity Badge Generation (generateHarnessBadgeSvg)", () => {
    const baseReconciliation: SemanticReconciliation = {
      primaryStack: "typescript",
      archetype: "reactive-frontend",
      frameworks: ["nextjs"],
      testRunner: "bun test",
      oracleScore: 85,
      oracleLevel: "L3",
      totalGaps: 2,
      remediationIssues: [],
      entities: { routes: [], models: [], controllers: [] },
      timestamp: "2026-10-20T12:00:00.000Z",
    };

    it("generates a valid SVG badge with standard shields.io elements and aria metadata", () => {
      const svg = generateHarnessBadgeSvg(baseReconciliation);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain('role="img"');
      expect(svg).toContain('aria-label="harness: L3 (85/105)"');
      expect(svg).toContain("harness");
      expect(svg).toContain("L3 (85/105)");
    });

    it("applies canonical color palette according to maturity level", () => {
      const svgL4 = generateHarnessBadgeSvg({ level: "L4", score: 105, maxScore: 105 });
      expect(svgL4).toContain("#2ea44f");

      const svgL3 = generateHarnessBadgeSvg({ level: "L3", score: 80, maxScore: 105 });
      expect(svgL3).toContain("#0969da");

      const svgL2 = generateHarnessBadgeSvg({ level: "L2", score: 55, maxScore: 105 });
      expect(svgL2).toContain("#1f6feb");

      const svgL1 = generateHarnessBadgeSvg({ level: "L1", score: 30, maxScore: 105 });
      expect(svgL1).toContain("#d29922");

      const svgL0 = generateHarnessBadgeSvg({ level: "L0", score: 0, maxScore: 105 });
      expect(svgL0).toContain("#cf222e");
    });

    it("supports custom label and format options", () => {
      const svgCustom = generateHarnessBadgeSvg(
        { level: "L4", score: 100, maxScore: 105 },
        { label: "governance", format: "level" }
      );
      expect(svgCustom).toContain("governance");
      expect(svgCustom).toContain(">L4<");

      const svgScore = generateHarnessBadgeSvg(
        { level: "L2", score: 50, maxScore: 100 },
        { label: "maturity", format: "score" }
      );
      expect(svgScore).toContain("maturity");
      expect(svgScore).toContain("50/100");
    });

    it("supports formatScanHumanOutput and formatScanJsonOutput with badgePath option", () => {
      const badgePath = path.join(tempDir, "harness-badge.svg");

      const humanOutput = formatScanHumanOutput(baseReconciliation, tempDir, { badgePath });
      expect(humanOutput).toContain("Badge:");
      expect(humanOutput).toContain("harness-badge.svg");

      const jsonOutput = formatScanJsonOutput(baseReconciliation, tempDir, { badgePath });
      expect(jsonOutput.badgePath).toBe(badgePath);
      expect(jsonOutput.badge_path).toBe(badgePath);
    });
  });
});
