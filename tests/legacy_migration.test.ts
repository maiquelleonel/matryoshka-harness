import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  extractLegacySkills,
  migrateLegacyInstructions,
} from "../src/agents";
import type {
  ExtractedSkill,
  LegacyMigrationOptions,
  LegacyMigrationResult,
  TokenSavingsSummary,
} from "../src/types";

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

  describe("Subtask 2: Zero-Loss Skill Conversion: Converts historical conventions and domain rules into an active modular skill (.agents/skills/legacy-knowledge.md + domain sub-skills)", () => {
    const sampleLegacyMonolith = `# Legacy Operational Directives for FinTech App

## Core Business Invariants & Domain Rules
* All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine.
* Never use floating-point math for balance reconciliations (IEEE 754 hazard).
* Invariant: User account status 'SUSPENDED' prevents debit authorizations.
* The audit ledger is append-only. UPDATE and DELETE statements are strictly forbidden.

# Database Guidelines
* All tables must define an indexed \`tenant_id\` UUID column.
* Foreign keys must use ON DELETE RESTRICT by default to prevent accidental cascading data loss.
* Run all schema modifications through zero-downtime migration scripts.
* Use read-replicas for analytical reporting queries.

# Frontend Styling Conventions
* Design tokens must be imported from \`@ui/theme\` rather than hardcoded hex codes.
* Never create custom CSS files outside of the Tailwind token utility pipeline.
* Maintain WCAG 2.1 AA accessibility contrast ratios across all buttons and inputs.
* Lazy-load modal sheets and heavy graphical chart dependencies.

# Security Guidelines
* Sanitize all raw HTML input using the strict DOMPurify pipeline before rendering.
* API tokens must be rotated every 90 days and stored in the encrypted vault.
* Passwords must meet minimum entropy standards and be hashed with Argon2id.

## Testing Conventions
* Unit tests must achieve 90% branch coverage on core ledger services.
* Always assert error types and messages explicitly in failure branches.
`;

    it("extracts primary legacy-knowledge skill preserving 100% of domain rules and text", () => {
      const skills = extractLegacySkills(sampleLegacyMonolith);
      expect(skills.length).toBeGreaterThanOrEqual(1);

      const primary = skills.find((s) => s.name === "legacy-knowledge");
      expect(primary).toBeDefined();
      expect(primary!.relativePath).toBe(".agents/skills/legacy-knowledge.md");
      expect(primary!.origin).toBe("legacy_migration");
      expect(primary!.description).toBeDefined();
      expect(primary!.migratedAt).toBeDefined();

      // Zero-Loss Invariant verification: all rules must be preserved in the primary skill body
      expect(primary!.content).toContain("All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine.");
      expect(primary!.content).toContain("Never use floating-point math for balance reconciliations (IEEE 754 hazard).");
      expect(primary!.content).toContain("Invariant: User account status 'SUSPENDED' prevents debit authorizations.");
      expect(primary!.content).toContain("The audit ledger is append-only. UPDATE and DELETE statements are strictly forbidden.");
      expect(primary!.content).toContain("All tables must define an indexed `tenant_id` UUID column.");
      expect(primary!.content).toContain("Design tokens must be imported from `@ui/theme` rather than hardcoded hex codes.");
      expect(primary!.content).toContain("Sanitize all raw HTML input using the strict DOMPurify pipeline before rendering.");
      expect(primary!.content).toContain("Unit tests must achieve 90% branch coverage on core ledger services.");
    });

    it("extracts domain sub-skills when structured headers exist", () => {
      const skills = extractLegacySkills(sampleLegacyMonolith);
      const skillNames = skills.map((s) => s.name);

      // Verify domain sub-skills are extracted from structured markdown headers
      expect(skillNames).toContain("legacy-knowledge");
      expect(skillNames).toContain("legacy-database");
      expect(skillNames).toContain("legacy-frontend");
      expect(skillNames).toContain("legacy-security");
      expect(skillNames).toContain("legacy-testing");

      const dbSkill = skills.find((s) => s.name === "legacy-database")!;
      expect(dbSkill.relativePath).toBe(".agents/skills/legacy-database.md");
      expect(dbSkill.origin).toBe("legacy_migration");
      expect(dbSkill.content).toContain("All tables must define an indexed `tenant_id` UUID column.");
      expect(dbSkill.content).toContain("Foreign keys must use ON DELETE RESTRICT");

      const frontendSkill = skills.find((s) => s.name === "legacy-frontend")!;
      expect(frontendSkill.relativePath).toBe(".agents/skills/legacy-frontend.md");
      expect(frontendSkill.origin).toBe("legacy_migration");
      expect(frontendSkill.content).toContain("Design tokens must be imported from `@ui/theme`");
    });

    it("migrates legacy instructions on disk and creates .agents/skills/legacy-knowledge.md with 100% rules preserved", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-migrate-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, sampleLegacyMonolith, "utf-8");

        const result: LegacyMigrationResult = migrateLegacyInstructions(tempDir);

        expect(result.success).toBe(true);
        expect(result.status).toBe("success");
        expect(result.extractedSkills.length).toBeGreaterThan(0);

        // Verify primary skill exists on disk
        const primarySkillPath = path.join(tempDir, ".agents", "skills", "legacy-knowledge.md");
        expect(fs.existsSync(primarySkillPath)).toBe(true);

        const primaryContent = fs.readFileSync(primarySkillPath, "utf-8");
        // Check zero-loss domain preservation
        expect(primaryContent).toContain("All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine.");
        expect(primaryContent).toContain("All tables must define an indexed `tenant_id` UUID column.");
        expect(primaryContent).toContain("Design tokens must be imported from `@ui/theme`");
        expect(primaryContent).toContain("Sanitize all raw HTML input using the strict DOMPurify pipeline");

        // Verify sub-skills also exist on disk
        const dbSkillPath = path.join(tempDir, ".agents", "skills", "legacy-database.md");
        expect(fs.existsSync(dbSkillPath)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes CLI 'baba agents migrate' and verifies zero-loss skill creation", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-cli-migrate-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, sampleLegacyMonolith, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir, "--json"]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();
        const jsonOutput = JSON.parse(stdout);

        expect(jsonOutput.success).toBe(true);
        expect(jsonOutput.status).toBe("success");
        expect(jsonOutput.extractedSkills.length).toBeGreaterThan(0);

        const primarySkillPath = path.join(tempDir, ".agents", "skills", "legacy-knowledge.md");
        expect(fs.existsSync(primarySkillPath)).toBe(true);
        const primaryContent = fs.readFileSync(primarySkillPath, "utf-8");
        expect(primaryContent).toContain("All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine.");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
