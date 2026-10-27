import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("SPEC-23: feat(agents): non-destructive legacy AGENTS.md migration engine (baba agents migrate)", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const prdPath = path.join(repoRoot, "docs", "prds", "PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md");
  const specPath = path.join(repoRoot, "docs", "specs", "SPEC-23.md");
  const experiencePath = path.join(repoRoot, "docs", "EXPERIENCE.md");

  describe("Subtask 1: Detailed PRD: docs/prds/PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md & Technical Specification", () => {
    it("verifies that PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md exists and is substantive (> 3.5KB)", () => {
      expect(fs.existsSync(prdPath)).toBe(true);
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content.length).toBeGreaterThan(3500);
    });

    it("documents all core problem patterns in the PRD problem statement", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("Lost Domain Knowledge");
      expect(content).toContain("Adoption Friction");
      expect(content).toContain("Manual Slicing Burden");
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

    it("specifies Zero-Loss skill conversion, frontmatter stamping, and rollback snapshot in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("Zero-Loss Domain Preservation");
      expect(content).toContain(".agents/skills/legacy-knowledge.md");
      expect(content).toContain("origin: legacy_migration");
      expect(content).toContain("name: legacy-knowledge");
      expect(content).toContain("AGENTS.md.bak");
      expect(content).toContain("200 tokens");
    });

    it("specifies CLI invocation parity and flags in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("baba agents migrate");
      expect(content).toContain("bbyg agents migrate");
      expect(content).toContain("matryoshka agents migrate");
      expect(content).toContain("--dry-run");
      expect(content).toContain("--from=");
      expect(content).toContain("--json");
      expect(content).toContain("--force");
    });

    it("specifies Gherkin BDD acceptance scenarios across subtasks in PRD", () => {
      const content = fs.readFileSync(prdPath, "utf-8");
      expect(content).toContain("Feature: baba agents migrate command");
      expect(content).toContain("Subtask 1 - Detailed PRD: docs/prds/PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md");
      expect(content).toContain("Subtask 2 - Zero-Loss Skill Conversion");
      expect(content).toContain("Subtask 3 - YAML Frontmatter Stamping");
      expect(content).toContain("Subtask 4 - Lean Root Compilation");
      expect(content).toContain("Subtask 5 - Rollback Safety Snapshot");
      expect(content).toContain("Subtask 6 - CLI Options");
      expect(content).toContain("Subtask 7 - Full BDD Test Suite Verification");
      expect(content).toContain("Subtask 8 - Strict CLI Alias Parity");
    });

    it("verifies that docs/specs/SPEC-23.md exists and defines complete TypeScript I/O contracts", () => {
      expect(fs.existsSync(specPath)).toBe(true);
      const content = fs.readFileSync(specPath, "utf-8");
      expect(content).toContain("ExtractedSkill");
      expect(content).toContain("TokenSavingsSummary");
      expect(content).toContain("LegacyMigrationOptions");
      expect(content).toContain("LegacyMigrationResult");
      expect(content).toContain("migrateLegacyInstructions");
      expect(content).toContain("baba agents migrate");
      expect(content).toContain("Issue #23");
    });

    it("verifies docs/EXPERIENCE.md documents legacy migration lessons", () => {
      const content = fs.readFileSync(experiencePath, "utf-8");
      expect(content).toContain("baba agents migrate");
      expect(content).toContain("legacy-knowledge");
      expect(content).toContain("legacy-migration");
    });
  });
});
