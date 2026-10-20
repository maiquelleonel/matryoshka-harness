import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  executeHarnessScore,
  normalizeMaturityLevel,
  resolveHarnessScoreBinary,
  runHarnessScoreSubprocess,
} from "../src/scanner";
import type {
  HarnessGap,
  HarnessScoreOptions,
  HarnessScoreResult,
  MaturityLevel,
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
      expect(result.gaps[0].id).toBe("CTX-01");
      expect(result.gaps[0].axis).toBe("context");
      expect(result.gaps[1].id).toBe("CI-01");
      expect(result.gaps[1].axis).toBe("guardrails");
      expect(result.gaps[2].id).toBe("SNS-05");
      expect(result.gaps[2].axis).toBe("sensors");
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

      expect(result.gaps[0].axis).toBe("context");
      expect(result.gaps[1].axis).toBe("skills");
      expect(result.gaps[2].axis).toBe("guardrails");
      expect(result.gaps[3].axis).toBe("sensors");
      expect(result.gaps[4].axis).toBe("hygiene");
      expect(result.gaps[5].axis).toBe("hygiene");
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
  });
});
