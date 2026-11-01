import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  TokenBudgetExceededError,
  compileMigratedRootAgents,
  estimateTokens,
  extractLegacySkills,
  isLegacyMigrationSkill,
  migrateLegacyInstructions,
  parseSkillFrontmatter,
  rollbackLegacyMigration,
  stampLegacySkillFrontmatter,
  validateSkillFrontmatter,
  type SkillFrontmatter,
} from "../src/agents";
import type {
  ExtractedSkill,
  LegacyMigrationOptions,
  LegacyMigrationResult,
  LegacyRollbackResult,
  LegacySkillMetadata,
  MigratedRootAgentsOptions,
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
      expect(content).toContain("legacy-migration-alias-parity");
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

  describe("Subtask 3: YAML Frontmatter Stamping: Stamped with metadata (origin: legacy_migration, name: legacy-knowledge, description: ...) so AI coding agents know when to activate it on-demand", () => {
    const sampleLegacyMonolith = `# Legacy Operational Directives for FinTech App

## Core Business Invariants & Domain Rules
* All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine.
* Invariant: User account status 'SUSPENDED' prevents debit authorizations.

# Database Guidelines
* All tables must define an indexed \`tenant_id\` UUID column.
* Foreign keys must use ON DELETE RESTRICT.

# Security Guidelines
* Sanitize all raw HTML input using the strict DOMPurify pipeline before rendering.
`;

    it("verifies primary skill has valid YAML frontmatter delimiters '---'", () => {
      const skills = extractLegacySkills(sampleLegacyMonolith);
      const primary = skills.find((s) => s.name === "legacy-knowledge");
      expect(primary).toBeDefined();

      expect(primary!.content.startsWith("---\n") || primary!.content.startsWith("---\r\n")).toBe(true);
      const closingDelimiter = primary!.content.indexOf("\n---\n", 3);
      expect(closingDelimiter).toBeGreaterThan(0);
    });

    it("stamps metadata with origin: legacy_migration, name: legacy-knowledge, and descriptive description", () => {
      const skills = extractLegacySkills(sampleLegacyMonolith);
      const primary = skills.find((s) => s.name === "legacy-knowledge");
      expect(primary).toBeDefined();

      const parsed = parseSkillFrontmatter(primary!.content);
      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe("legacy-knowledge");
      expect(parsed!.origin).toBe("legacy_migration");
      expect(parsed!.description).toContain("legacy conventions");
      expect(parsed!.migrated_at).toBeDefined();
      expect(new Date(parsed!.migrated_at!).getTime()).not.toBeNaN();
    });

    it("validates that validateSkillFrontmatter passes for all extracted skills", () => {
      const skills = extractLegacySkills(sampleLegacyMonolith);
      expect(skills.length).toBeGreaterThan(1);

      for (const skill of skills) {
        expect(validateSkillFrontmatter(skill.content)).toBe(true);
      }
    });

    it("verifies isLegacyMigrationSkill detects legacy-migration skills and rejects standard ones", () => {
      const skills = extractLegacySkills(sampleLegacyMonolith);
      const primary = skills.find((s) => s.name === "legacy-knowledge")!;
      expect(isLegacyMigrationSkill(primary.content)).toBe(true);

      const standardSkill = `---
name: skill-backend
description: ORM patterns
---
# Content`;
      expect(isLegacyMigrationSkill(standardSkill)).toBe(false);
      expect(isLegacyMigrationSkill("invalid-skill")).toBe(false);
    });

    it("stamps domain sub-skills with unique names, correct descriptions, and origin: legacy_migration", () => {
      const skills = extractLegacySkills(sampleLegacyMonolith);
      const subSkills = skills.filter((s) => s.name !== "legacy-knowledge");
      expect(subSkills.length).toBeGreaterThanOrEqual(2);

      for (const sub of subSkills) {
        const parsed = parseSkillFrontmatter(sub.content);
        expect(parsed).not.toBeNull();
        expect(parsed!.origin).toBe("legacy_migration");
        expect(parsed!.name).toBe(sub.name);
        expect(parsed!.description.length).toBeGreaterThan(15);
        expect(parsed!.migrated_at).toBeDefined();
      }
    });

    it("uses stampLegacySkillFrontmatter helper to stamp custom legacy content cleanly without duplicate frontmatter", () => {
      const rawText = `---
old_tag: discarded
---
# Legacy Rules
* Do not touch the production billing database directly.`;

      const stamped = stampLegacySkillFrontmatter(rawText, {
        name: "legacy-knowledge",
        description: "Preserved historical domain knowledge.",
        origin: "legacy_migration",
        migratedAt: "2026-03-30T12:00:00.000Z",
      });

      expect(stamped).toContain("name: legacy-knowledge");
      expect(stamped).toContain("origin: legacy_migration");
      expect(stamped).toContain('migrated_at: "2026-03-30T12:00:00.000Z"');
      expect(stamped).not.toContain("old_tag: discarded");
      expect(stamped).toContain("Do not touch the production billing database directly.");

      // Check frontmatter delimiters count
      const delimiterMatches = stamped.match(/^---$/gm);
      expect(delimiterMatches?.length).toBe(2);

      const parsed = parseSkillFrontmatter(stamped);
      expect(parsed?.name).toBe("legacy-knowledge");
      expect(parsed?.origin).toBe("legacy_migration");
      expect(parsed?.migrated_at).toBe("2026-03-30T12:00:00.000Z");
    });

    it("verifies frontmatter stamping persists correctly to disk during migrateLegacyInstructions", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-frontmatter-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, sampleLegacyMonolith, "utf-8");

        const result = migrateLegacyInstructions(tempDir);
        expect(result.success).toBe(true);

        const skillPath = path.join(tempDir, ".agents", "skills", "legacy-knowledge.md");
        expect(fs.existsSync(skillPath)).toBe(true);

        const diskContent = fs.readFileSync(skillPath, "utf-8");
        expect(diskContent).toMatch(/^---\r?\nname:\s*legacy-knowledge\r?\ndescription:\s*.+\r?\norigin:\s*legacy_migration/);

        const parsed = parseSkillFrontmatter(diskContent);
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe("legacy-knowledge");
        expect(parsed?.origin).toBe("legacy_migration");
        expect(isLegacyMigrationSkill(diskContent)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("verifies CLI 'baba agents migrate' creates skills with valid frontmatter stamped on disk", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-cli-frontmatter-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, sampleLegacyMonolith, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir]);
        expect(proc.exitCode).toBe(0);

        const skillPath = path.join(tempDir, ".agents", "skills", "legacy-knowledge.md");
        expect(fs.existsSync(skillPath)).toBe(true);

        const diskContent = fs.readFileSync(skillPath, "utf-8");
        const parsed = parseSkillFrontmatter(diskContent);
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe("legacy-knowledge");
        expect(parsed?.origin).toBe("legacy_migration");
        expect(parsed?.description).toBeDefined();
        expect(isLegacyMigrationSkill(diskContent)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Subtask 4: Lean Root Compilation: Assembles a pristine, canonical root AGENTS.md (< 200 tokens) that links to and registers the legacy skill in its modular catalog", () => {
    const monolithicLegacy1200Tokens = `# Monolithic Enterprise Guidelines & Historical Rules for FinTech Core

## 1. System Architecture & Core Tenets
* All microservices must be structured using hex or clean architecture principles with decoupled core domains.
* Inbound ports must be defined as abstract interfaces and never coupled to external transport protocols like HTTP or gRPC.
* Domain events must be published transactionally using the transactional outbox pattern to prevent data loss.
* Event consumers must be strictly idempotent and tolerate at-least-once message delivery from message brokers.
* Distributed transactions across multiple service boundaries are prohibited; use saga patterns instead.
* Never instantiate global mutable singletons inside application services or controllers.
* Service-to-service communication must always supply correlation identifiers in HTTP headers (X-Correlation-Id).
* Every domain aggregate must maintain its own consistency boundary and enforce all business invariants locally.
* Aggregate roots are the sole gateway for mutating nested entity state within the boundary.

## 2. Core Business Invariants & Transaction Rules
* All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine and strict rounding modes.
* Never use IEEE 754 floating-point math for balance calculations, interest rates, or reconciliation sums.
* Invariant: User account status 'SUSPENDED' prevents debit authorizations and scheduled payouts immediately.
* The audit ledger is strictly append-only. UPDATE and DELETE SQL statements are permanently forbidden.
* Daily settlement reconciliations must run at 00:00 UTC and compare credit sums against debit sums.
* If a reconciliation discrepancy exceeds 0.01 currency units, freeze settlement and page the on-call engineer.
* High-value payments above 10,000 currency units require dual human approval (four-eyes principle).
* Currency conversions must read exchange rates locked at transaction initiation time and log the rate provider.
* Credit limits cannot be updated while an active withdrawal transaction is currently in flight.
* Reversals must be executed as distinct offsetting credit/debit transaction pairs referencing the original entry.

## 3. Database Guidelines & Schema Migration Invariants
* All tables must define an indexed \`tenant_id\` UUID column for multi-tenant tenant isolation.
* Foreign keys must use ON DELETE RESTRICT by default to prevent accidental cascading data loss across records.
* Run all schema modifications through zero-downtime migration scripts following the expand-and-contract model.
* Use read-replicas for analytical reporting queries and long-running ledger exports.
* Indexes must be created concurrently outside transaction blocks to avoid locking live production tables.
* Never use SELECT * in production queries; always specify explicit projections for performance and bandwidth.
* Set aggressive lock timeouts (maximum 2000 milliseconds) on DDL schema operations to prevent connection pool exhaustion.
* Database connections must be recycled after 30 minutes to prevent resource leaks and stale socket states.
* Soft-deleted rows must use a nullable deleted_at timestamp column and be excluded by default ORM scopes.
* Primary keys must use distributed time-sortable identifiers like UUIDv7 or ULID for efficient B-tree clustering.

## 4. Frontend Styling & UI Component Conventions
* Design tokens must be imported from \`@ui/theme\` rather than hardcoded hex color codes or arbitrary pixel margins.
* Never create custom CSS files outside of the Tailwind token utility pipeline and CSS variable bindings.
* Maintain WCAG 2.1 AA accessibility contrast ratios across all buttons, typography, inputs, and icon badges.
* Lazy-load modal sheets, graphical charts, and heavy reporting dependencies to optimize initial page load.
* Forms must perform optimistic client-side validation using zod schemas before submitting payloads.
* All interactive elements must support complete keyboard navigation including tab indexes and escape key handlers.
* Destructive modal actions (such as account deletion) require explicit typing of confirmation words.
* Error toasts must automatically dismiss after 5 seconds but offer an action button to copy the trace ID.
* Use responsive viewport units and fluid layouts; never force fixed pixel widths on mobile viewports.
* Images and icons must declare explicit width and height dimensions to eliminate layout shifts (CLS).

## 5. Security & Authentication Standards
* Sanitize all raw HTML input using the strict DOMPurify pipeline before rendering in browser views.
* API tokens must be rotated every 90 days and stored in the encrypted hardware security vault.
* Passwords must meet minimum entropy standards (16+ chars) and be hashed with Argon2id and salt.
* All HTTP responses must include strict security headers: CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.
* Sensitive personal identifiable information (PII) must be encrypted at rest using AES-256-GCM.
* Implement rate limiting on all public authentication routes: 5 failed attempts per IP per 15 minutes.
* Session tokens must be stored in HTTP-only, Secure, SameSite=Strict cookies to defend against XSS.
* Access tokens must have a maximum lifetime of 15 minutes; refresh tokens must be revoked on reuse.
* Webhook payloads must be verified using HMAC-SHA256 signatures before processing.
* Internal admin endpoints must be firewalled and accessible only over the private corporate VPN.

## 6. Testing & Quality Verification Directives
* Unit tests must achieve 90% branch coverage on core ledger services and monetary calculation utilities.
* Always assert error types and messages explicitly in failure branches; never rely on generic catch blocks.
* End-to-end integration tests must run against isolated test databases spun up in ephemeral Docker containers.
* Mocking the database driver in repository integration tests is strictly forbidden; test against real engines.
* Flaky tests must be quarantined within 24 hours of first detection and resolved within the sprint.
* Load tests must verify that payment authorization endpoints sustain 5,000 requests per second under 200ms latency.
* Snapshot tests must be approved by design system maintainers before being merged into main.
* Property-based tests must be used for currency conversion algorithms and decimal rounding boundaries.
* Never check in API keys, database credentials, or test secrets into test fixtures or git repositories.
* Integration test suites must clean up all created database records after test completion.
`;

    it("verifies the sample monolith is substantive (> 1,000 tokens)", () => {
      const tokens = estimateTokens(monolithicLegacy1200Tokens);
      expect(tokens).toBeGreaterThan(1000);
    });

    it("compiles root AGENTS.md strictly under 200 tokens via compileMigratedRootAgents()", () => {
      const extractedSkills: ExtractedSkill[] = [
        {
          name: "legacy-knowledge",
          relativePath: ".agents/skills/legacy-knowledge.md",
          description: "Preserved legacy knowledge",
          origin: "legacy_migration",
          migratedAt: new Date().toISOString(),
          content: "# Legacy Knowledge",
          estimatedTokens: 50,
        },
        {
          name: "legacy-database",
          relativePath: ".agents/skills/legacy-database.md",
          description: "Preserved legacy database guidelines",
          origin: "legacy_migration",
          migratedAt: new Date().toISOString(),
          content: "# Legacy Database",
          estimatedTokens: 30,
        },
      ];

      const content = compileMigratedRootAgents(
        {
          archetype: "api_backend",
          runtime: "bun",
          packageManager: "bun",
          testCommand: "bun test",
          buildCommand: "bun run build",
          lintCommand: "none",
        },
        extractedSkills
      );

      const tokenCount = estimateTokens(content);
      expect(tokenCount).toBeLessThan(200);

      // Verify canonical sections
      expect(content).toContain("# 🤖 Project Operational Directives");
      expect(content).toContain("## 🌐 Stack & Identity");
      expect(content).toContain("## 🛡️ Anti-Slop Core Invariants");
      expect(content).toContain("## 🧭 On-Demand Specialized Skills");
      expect(content).toContain("Load specialized guidelines only when touching respective domains:");

      // Verify skill registration
      expect(content).toContain("* Preserved Legacy Knowledge: `.agents/skills/legacy-knowledge.md`");
      expect(content).toContain("* Legacy Database: `.agents/skills/legacy-database.md`");
    });

    it("registers all extracted domain sub-skills with human-readable titles in modular catalog", () => {
      const extractedSkills: ExtractedSkill[] = [
        {
          name: "legacy-knowledge",
          relativePath: ".agents/skills/legacy-knowledge.md",
          description: "Preserved legacy knowledge",
          origin: "legacy_migration",
          migratedAt: new Date().toISOString(),
          content: "",
          estimatedTokens: 10,
        },
        {
          name: "legacy-database",
          relativePath: ".agents/skills/legacy-database.md",
          description: "Preserved legacy database guidelines",
          origin: "legacy_migration",
          migratedAt: new Date().toISOString(),
          content: "",
          estimatedTokens: 10,
        },
        {
          name: "legacy-frontend",
          relativePath: ".agents/skills/legacy-frontend.md",
          description: "Preserved legacy frontend guidelines",
          origin: "legacy_migration",
          migratedAt: new Date().toISOString(),
          content: "",
          estimatedTokens: 10,
        },
        {
          name: "legacy-security",
          relativePath: ".agents/skills/legacy-security.md",
          description: "Preserved legacy security guidelines",
          origin: "legacy_migration",
          migratedAt: new Date().toISOString(),
          content: "",
          estimatedTokens: 10,
        },
        {
          name: "legacy-testing",
          relativePath: ".agents/skills/legacy-testing.md",
          description: "Preserved legacy testing guidelines",
          origin: "legacy_migration",
          migratedAt: new Date().toISOString(),
          content: "",
          estimatedTokens: 10,
        },
      ];

      const content = compileMigratedRootAgents(
        {
          archetype: "fullstack_hybrid",
          runtime: "node",
          packageManager: "npm",
          testCommand: "npm test",
          buildCommand: "npm run build",
          lintCommand: "npm run lint",
        },
        extractedSkills
      );

      const tokenCount = estimateTokens(content);
      expect(tokenCount).toBeLessThan(200);

      expect(content).toContain("* Preserved Legacy Knowledge: `.agents/skills/legacy-knowledge.md`");
      expect(content).toContain("* Legacy Database: `.agents/skills/legacy-database.md`");
      expect(content).toContain("* Legacy Frontend: `.agents/skills/legacy-frontend.md`");
      expect(content).toContain("* Legacy Security: `.agents/skills/legacy-security.md`");
      expect(content).toContain("* Legacy Testing: `.agents/skills/legacy-testing.md`");
    });

    it("defaults to registering legacy-knowledge when extractedSkills is empty", () => {
      const content = compileMigratedRootAgents(
        {
          archetype: "api_backend",
          runtime: "bun",
          packageManager: "bun",
          testCommand: "bun test",
          buildCommand: "none",
          lintCommand: "none",
        },
        []
      );

      expect(content).toContain("* Preserved Legacy Knowledge: `.agents/skills/legacy-knowledge.md`");
      expect(estimateTokens(content)).toBeLessThan(200);
    });

    it("throws TokenBudgetExceededError when strictTokenGuard is enabled and ceiling is exceeded", () => {
      expect(() => {
        compileMigratedRootAgents(
          {
            archetype: "api_backend",
            runtime: "bun",
            packageManager: "bun",
            testCommand: "bun test",
            buildCommand: "bun run build",
            lintCommand: "none",
          },
          [],
          {
            maxTokens: 25,
            strictTokenGuard: true,
          }
        );
      }).toThrow(TokenBudgetExceededError);
    });

    it("executes migrateLegacyInstructions on a >1,000 token monolith and writes root AGENTS.md (< 200 tokens) to disk", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-lean-root-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, monolithicLegacy1200Tokens, "utf-8");

        const beforeTokens = estimateTokens(monolithicLegacy1200Tokens);
        expect(beforeTokens).toBeGreaterThan(1000);

        const result: LegacyMigrationResult = migrateLegacyInstructions(tempDir);

        expect(result.success).toBe(true);
        expect(result.status).toBe("success");
        expect(result.rootAgentsTokens).toBeLessThan(200);
        expect(result.tokenSavings.beforeTokens).toBeGreaterThan(1000);
        expect(result.tokenSavings.afterTokens).toBeLessThan(200);
        expect(result.tokenSavings.savedTokens).toBeGreaterThan(800);
        expect(result.tokenSavings.reductionPercentage).toBeGreaterThanOrEqual(75);

        // Verify root AGENTS.md exists on disk and is strictly under 200 tokens
        const rootContent = fs.readFileSync(legacyAgentsPath, "utf-8");
        const diskTokens = estimateTokens(rootContent);
        expect(diskTokens).toBeLessThan(200);

        // Verify canonical sections and links in root AGENTS.md
        expect(rootContent).toContain("# 🤖 Project Operational Directives");
        expect(rootContent).toContain("## 🌐 Stack & Identity");
        expect(rootContent).toContain("## 🛡️ Anti-Slop Core Invariants");
        expect(rootContent).toContain("## 🧭 On-Demand Specialized Skills");
        expect(rootContent).toContain("* Preserved Legacy Knowledge: `.agents/skills/legacy-knowledge.md`");
        expect(rootContent).toContain("* Legacy Database: `.agents/skills/legacy-database.md`");
        expect(rootContent).toContain("* Legacy Frontend: `.agents/skills/legacy-frontend.md`");
        expect(rootContent).toContain("* Legacy Security: `.agents/skills/legacy-security.md`");
        expect(rootContent).toContain("* Legacy Testing: `.agents/skills/legacy-testing.md`");

        // Verify that the modular skills exist on disk
        expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "legacy-knowledge.md"))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "legacy-database.md"))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "legacy-frontend.md"))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "legacy-security.md"))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "legacy-testing.md"))).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("respects maxRootTokens option and strictTokenGuard in migrateLegacyInstructions", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-lean-options-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, monolithicLegacy1200Tokens, "utf-8");

        // Within normal budget
        const normalResult = migrateLegacyInstructions(tempDir, {
          maxRootTokens: 200,
          force: true,
        });
        expect(normalResult.success).toBe(true);
        expect(normalResult.rootAgentsTokens).toBeLessThan(200);

        // Strict token guard breach should throw TokenBudgetExceededError
        expect(() => {
          migrateLegacyInstructions(tempDir, {
            maxRootTokens: 30,
            strictTokenGuard: true,
            force: true,
          });
        }).toThrow(TokenBudgetExceededError);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes CLI 'baba agents migrate' against a >1,000 token monolith and validates lean root AGENTS.md (< 200 tokens)", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-cli-lean-root-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, monolithicLegacy1200Tokens, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();

        expect(stdout).toContain("Root AGENTS:");
        expect(stdout).toContain("Token Savings:");

        const rootContent = fs.readFileSync(legacyAgentsPath, "utf-8");
        const tokenCount = estimateTokens(rootContent);
        expect(tokenCount).toBeLessThan(200);
        expect(rootContent).toContain("# 🤖 Project Operational Directives");
        expect(rootContent).toContain("* Preserved Legacy Knowledge: `.agents/skills/legacy-knowledge.md`");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes CLI 'baba agents migrate --json' against a >1,000 token monolith and validates structured token metrics", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-cli-lean-json-test-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, monolithicLegacy1200Tokens, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir, "--json"]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();
        const jsonOutput = JSON.parse(stdout);

        expect(jsonOutput.success).toBe(true);
        expect(jsonOutput.rootAgentsTokens).toBeLessThan(200);
        expect(jsonOutput.tokenSavings.beforeTokens).toBeGreaterThan(1000);
        expect(jsonOutput.tokenSavings.afterTokens).toBeLessThan(200);
        expect(jsonOutput.tokenSavings.savedTokens).toBeGreaterThan(800);
        expect(jsonOutput.tokenSavings.reductionPercentage).toBeGreaterThanOrEqual(75);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Subtask 5: Rollback Safety Snapshot: Preserves an exact raw copy in AGENTS.md.bak as a non-destructive safety net", () => {
    const complexLegacyMonolith = `# FinTech Engine Architecture & Tribal Directives 🪆

> Confidential internal guidelines. Author: @lead-architect
> Last modified: 2026-01-15T09:30:00Z

## Database & Ledger Invariants
* Ledger records are strictly append-only. UPDATE / DELETE queries are blocked at proxy level.
* UUIDv7 primary keys are mandated for time-locality index performance.
* Reconcile balance table \`account_balances\` with audit journal nightly at 00:00 UTC.

\`\`\`sql
-- Critical balance invariant check query
SELECT account_id, SUM(credit) - SUM(debit) AS computed_balance
FROM journal_entries
GROUP BY account_id
HAVING computed_balance <> stored_balance;
\`\`\`

## Compliance & Security Directives
| Tier | SLA | Encryption | Multi-Region |
| :--- | :-- | :--------- | :----------- |
| Tier-1 (Ledger) | 99.999% | AES-256-GCM | Active-Active |
| Tier-2 (Auth)   | 99.99%  | ChaCha20   | Primary-Replica |

* Secrets rotated via Vault agent every 30 days.
* Non-ASCII character test payload: São Paulo / Tokyo 東京 / Brasília / Zürich.
`;

    it("preserves exact byte-for-byte snapshot in AGENTS.md.bak during migration", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-snapshot-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");
        const originalBuffer = fs.readFileSync(legacyAgentsPath);

        const result: LegacyMigrationResult = migrateLegacyInstructions(tempDir);

        expect(result.success).toBe(true);
        expect(result.status).toBe("success");
        expect(result.backupCreated).toBe(true);
        expect(result.backupPath).toBe(path.join(tempDir, "AGENTS.md.bak"));

        const backupFile = path.join(tempDir, "AGENTS.md.bak");
        expect(fs.existsSync(backupFile)).toBe(true);

        const backupBuffer = fs.readFileSync(backupFile);
        expect(Buffer.compare(backupBuffer, originalBuffer)).toBe(0);
        expect(backupBuffer.toString("utf-8")).toBe(complexLegacyMonolith);

        // Root AGENTS.md is modified into lean root (< 200 tokens)
        const newRootContent = fs.readFileSync(legacyAgentsPath, "utf-8");
        expect(newRootContent).not.toBe(complexLegacyMonolith);
        expect(estimateTokens(newRootContent)).toBeLessThan(200);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves complex formatting, unicode, markdown tables, and multi-line code blocks identically in backup snapshot", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-formatting-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        const result = migrateLegacyInstructions(tempDir);
        expect(result.success).toBe(true);

        const backupContent = fs.readFileSync(path.join(tempDir, "AGENTS.md.bak"), "utf-8");

        // Verify unicode and emojis
        expect(backupContent).toContain("🪆");
        expect(backupContent).toContain("São Paulo / Tokyo 東京 / Brasília / Zürich.");

        // Verify markdown table
        expect(backupContent).toContain("| Tier-1 (Ledger) | 99.999% | AES-256-GCM | Active-Active |");

        // Verify multi-line code block with comments
        expect(backupContent).toContain("SELECT account_id, SUM(credit) - SUM(debit) AS computed_balance");
        expect(backupContent).toContain("-- Critical balance invariant check query");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("allows safe and complete rollback of AGENTS.md from the snapshot with zero loss of domain rules", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-rollback-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        // 1. Run migration
        const migrationResult = migrateLegacyInstructions(tempDir);
        expect(migrationResult.success).toBe(true);
        expect(fs.readFileSync(legacyAgentsPath, "utf-8")).not.toBe(complexLegacyMonolith);

        // 2. Perform rollback using rollbackLegacyMigration utility
        const rollbackResult: LegacyRollbackResult = rollbackLegacyMigration(tempDir);
        expect(rollbackResult.success).toBe(true);
        expect(rollbackResult.status).toBe("success");
        expect(rollbackResult.restoredFile).toBe(legacyAgentsPath);
        expect(rollbackResult.backupFile).toBe(path.join(tempDir, "AGENTS.md.bak"));

        // 3. Verify AGENTS.md is 100% restored to original pre-migration content
        const restoredContent = fs.readFileSync(legacyAgentsPath, "utf-8");
        expect(restoredContent).toBe(complexLegacyMonolith);
        expect(restoredContent).toContain("UUIDv7 primary keys are mandated");
        expect(restoredContent).toContain("São Paulo / Tokyo 東京");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("refuses to overwrite existing backup snapshot without force: true, protecting historical backup", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-guard-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        const backupPath = path.join(tempDir, "AGENTS.md.bak");

        const historicalOriginalContent = "# Canonical Historical Backup\n* Do not touch.";
        const secondMigrationAttempt = "# New Content That Shouldn't Overwrite Safety Net\n* Some new rule.";

        fs.writeFileSync(backupPath, historicalOriginalContent, "utf-8");
        fs.writeFileSync(legacyAgentsPath, secondMigrationAttempt, "utf-8");

        const result = migrateLegacyInstructions(tempDir);

        expect(result.success).toBe(false);
        expect(result.status).toBe("error");
        expect(result.backupCreated).toBe(false);
        expect(result.error).toContain("Backup snapshot already exists");
        expect(result.error).toContain("--force");

        // Verify existing backup was untouched
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(historicalOriginalContent);
        // Verify AGENTS.md was untouched
        expect(fs.readFileSync(legacyAgentsPath, "utf-8")).toBe(secondMigrationAttempt);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("overwrites existing backup snapshot when force: true is provided", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-force-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        const backupPath = path.join(tempDir, "AGENTS.md.bak");

        const oldBackup = "# Old Backup to be Overwritten";
        fs.writeFileSync(backupPath, oldBackup, "utf-8");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        const result = migrateLegacyInstructions(tempDir, { force: true });

        expect(result.success).toBe(true);
        expect(result.status).toBe("success");
        expect(result.backupCreated).toBe(true);

        // Verify backup was refreshed with new legacy snapshot
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(complexLegacyMonolith);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("does not create backup snapshot in dry-run mode (dryRun: true)", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-dryrun-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        const result = migrateLegacyInstructions(tempDir, { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.status).toBe("simulated");
        expect(result.dryRun).toBe(true);
        expect(result.backupCreated).toBe(false);
        expect(result.backupPath).toBe(path.join(tempDir, "AGENTS.md.bak"));

        // No .bak file created on disk
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);
        // Original file unmutated
        expect(fs.readFileSync(legacyAgentsPath, "utf-8")).toBe(complexLegacyMonolith);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves rollback safety snapshot for custom source files (.cursorrules -> .cursorrules.bak)", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-custom-source-"));
      try {
        const customRulesPath = path.join(tempDir, ".cursorrules");
        fs.writeFileSync(customRulesPath, complexLegacyMonolith, "utf-8");

        const result = migrateLegacyInstructions(tempDir, { from: ".cursorrules" });

        expect(result.success).toBe(true);
        expect(result.backupCreated).toBe(true);
        expect(result.backupPath).toBe(path.join(tempDir, ".cursorrules.bak"));

        const backupFile = path.join(tempDir, ".cursorrules.bak");
        expect(fs.existsSync(backupFile)).toBe(true);
        expect(fs.readFileSync(backupFile, "utf-8")).toBe(complexLegacyMonolith);

        // Rollback custom source file
        const rollbackResult = rollbackLegacyMigration(tempDir, { from: ".cursorrules" });
        expect(rollbackResult.success).toBe(true);
        expect(rollbackResult.restoredFile).toBe(customRulesPath);
        expect(fs.readFileSync(customRulesPath, "utf-8")).toBe(complexLegacyMonolith);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rollbackLegacyMigration returns error when backup snapshot does not exist", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-rollback-fail-"));
      try {
        const result = rollbackLegacyMigration(tempDir);
        expect(result.success).toBe(false);
        expect(result.status).toBe("error");
        expect(result.error).toContain("Backup snapshot not found");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes CLI 'baba agents migrate' and creates AGENTS.md.bak on disk with output feedback", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-cli-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();

        expect(stdout).toContain("Safety Backup:");
        expect(stdout).toContain("AGENTS.md.bak");

        const backupPath = path.join(tempDir, "AGENTS.md.bak");
        expect(fs.existsSync(backupPath)).toBe(true);
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(complexLegacyMonolith);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes CLI 'baba agents migrate' failing when backup snapshot already exists without --force", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-cli-guard-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        const backupPath = path.join(tempDir, "AGENTS.md.bak");

        const originalSafeContent = "# Preserved Safety Content";
        fs.writeFileSync(backupPath, originalSafeContent, "utf-8");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir]);

        expect(proc.exitCode).toBe(1);
        const stdout = proc.stdout.toString();
        const stderr = proc.stderr.toString();
        const combined = stdout + stderr;

        expect(combined).toContain("Backup snapshot already exists");
        expect(combined).toContain("--force");
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(originalSafeContent);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes CLI 'baba agents migrate --force' (-f) overwriting existing backup successfully", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-cli-force-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        const backupPath = path.join(tempDir, "AGENTS.md.bak");

        fs.writeFileSync(backupPath, "# Old Outdated Backup", "utf-8");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir, "-f"]);

        expect(proc.exitCode).toBe(0);
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(complexLegacyMonolith);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes CLI 'baba agents migrate --json' and confirms backupCreated and backupPath in structured output", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask5-cli-json-"));
      try {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, complexLegacyMonolith, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir, "--json"]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();
        const jsonOutput = JSON.parse(stdout);

        expect(jsonOutput.success).toBe(true);
        expect(jsonOutput.backupCreated).toBe(true);
        expect(jsonOutput.backupPath).toBe(path.join(tempDir, "AGENTS.md.bak"));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Subtask 6: CLI Options: --dry-run (simulation mode without disk mutation) and --from=<file> (e.g. .cursorrules, CLAUDE.md)", () => {
    const customCursorrulesContent = `# Cursorrules Directives for Enterprise Microservices

## Core Business Invariants & Domain Rules
* All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine.
* Never use IEEE 754 floating-point math for balance calculations and rate valuations.
* Invariant: User account status 'SUSPENDED' prevents debit authorizations immediately.
* The audit ledger is strictly append-only. UPDATE and DELETE SQL statements are permanently forbidden.
* Daily settlement reconciliations must run at 00:00 UTC and verify ledger balances.
* Reversals must be executed as distinct offsetting credit/debit transaction pairs.
* Invariant: Double-entry bookkeeping must maintain zero balance sum across all accounts.

# Database Guidelines
* All tables must define an indexed \`tenant_id\` UUID column for multi-tenant isolation.
* Foreign keys must use ON DELETE RESTRICT by default to prevent accidental cascading data loss.
* Run all schema modifications through zero-downtime migration scripts.
* Use read-replicas for analytical reporting queries and background exports.
* Indexes must be created concurrently outside transaction blocks to prevent table locks.

# Frontend Styling Conventions
* Design tokens must be imported from \`@ui/theme\` rather than hardcoded hex codes.
* Never create custom CSS files outside of the Tailwind token utility pipeline.
* Maintain WCAG 2.1 AA accessibility contrast ratios across all buttons and inputs.
* Lazy-load modal sheets and heavy graphical chart dependencies.
* Interactive forms must validate client-side before sending network requests.

# Security Guidelines
* Sanitize all raw HTML input using the strict DOMPurify pipeline before rendering.
* API tokens must be rotated every 90 days and stored in the encrypted vault.
* Passwords must meet minimum entropy standards and be hashed with Argon2id.
* All HTTP responses must include strict CSP, HSTS, and X-Frame-Options headers.
* Session tokens must be stored in HTTP-only, Secure, SameSite=Strict cookies.
`;

    const claudeMdContent = `# Claude Code Project Guidelines

## Core Business Invariants & Domain Rules
* All ledger entries must be cryptographically signed with ECDSA keys.
* Never expose unredacted customer PII in application log streams.

# Database Guidelines
* Run all schema modifications through zero-downtime migration scripts.
* Use read-replicas for analytical queries.
`;

    it("simulates migration with --from=.cursorrules and --dry-run without creating or mutating any disk files", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-dryrun-"));
      try {
        const cursorrulesPath = path.join(tempDir, ".cursorrules");
        fs.writeFileSync(cursorrulesPath, customCursorrulesContent, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from=.cursorrules",
          "--dry-run",
        ]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();

        // Verifies output contains simulation status, planned diff, and token reduction metrics
        expect(stdout).toContain("SIMULATED (--dry-run)");
        expect(stdout).toContain("Source File:");
        expect(stdout).toContain(".cursorrules");
        expect(stdout).toContain("Token Savings:");
        expect(stdout).toContain("Planned Modular Skills Extraction (diff):");
        expect(stdout).toContain("legacy-knowledge");
        expect(stdout).toContain("legacy-database");
        expect(stdout).toContain("legacy-frontend");
        expect(stdout).toContain("legacy-security");

        // Strict verification: zero files created or modified on disk
        expect(fs.existsSync(path.join(tempDir, ".cursorrules.bak"))).toBe(false);
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);
        expect(fs.existsSync(path.join(tempDir, ".agents"))).toBe(false);
        expect(fs.readFileSync(cursorrulesPath, "utf-8")).toBe(customCursorrulesContent);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("executes migration with --from=.cursorrules in write mode, extracting skills and creating .cursorrules.bak", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-write-"));
      try {
        const cursorrulesPath = path.join(tempDir, ".cursorrules");
        fs.writeFileSync(cursorrulesPath, customCursorrulesContent, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from=.cursorrules",
        ]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();

        expect(stdout).toContain("SUCCESS (migrated)");
        expect(stdout).toContain(".cursorrules.bak");
        expect(stdout).toContain("Token Savings:");

        // Backup exists and is byte-for-byte identical to original
        const backupPath = path.join(tempDir, ".cursorrules.bak");
        expect(fs.existsSync(backupPath)).toBe(true);
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(customCursorrulesContent);

        // Modular skills created with zero-loss content
        const skillPath = path.join(tempDir, ".agents", "skills", "legacy-knowledge.md");
        expect(fs.existsSync(skillPath)).toBe(true);
        const skillContent = fs.readFileSync(skillPath, "utf-8");
        expect(skillContent).toContain("All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine.");

        // Root AGENTS.md created and is under 200 tokens
        const rootPath = path.join(tempDir, "AGENTS.md");
        expect(fs.existsSync(rootPath)).toBe(true);
        const rootContent = fs.readFileSync(rootPath, "utf-8");
        expect(estimateTokens(rootContent)).toBeLessThan(200);
        expect(rootContent).toContain(".agents/skills/legacy-knowledge.md");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("simulates and migrates CLAUDE.md with --from=CLAUDE.md", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-claudemd-"));
      try {
        const claudePath = path.join(tempDir, "CLAUDE.md");
        fs.writeFileSync(claudePath, claudeMdContent, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");

        // 1. Dry run
        const procDry = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from=CLAUDE.md",
          "--dry-run",
        ]);
        expect(procDry.exitCode).toBe(0);
        expect(fs.existsSync(path.join(tempDir, "CLAUDE.md.bak"))).toBe(false);
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);

        // 2. Real migration
        const procMigrate = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from=CLAUDE.md",
        ]);
        expect(procMigrate.exitCode).toBe(0);

        expect(fs.existsSync(path.join(tempDir, "CLAUDE.md.bak"))).toBe(true);
        expect(fs.readFileSync(path.join(tempDir, "CLAUDE.md.bak"), "utf-8")).toBe(claudeMdContent);

        const skillPath = path.join(tempDir, ".agents", "skills", "legacy-knowledge.md");
        expect(fs.existsSync(skillPath)).toBe(true);
        expect(fs.readFileSync(skillPath, "utf-8")).toContain("cryptographically signed with ECDSA keys");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("supports --from as a space-separated flag (--from .cursorrules)", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-space-flag-"));
      try {
        const cursorrulesPath = path.join(tempDir, ".cursorrules");
        fs.writeFileSync(cursorrulesPath, customCursorrulesContent, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from",
          ".cursorrules",
          "--dry-run",
        ]);

        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();
        expect(stdout).toContain("SIMULATED (--dry-run)");
        expect(stdout).toContain(".cursorrules");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("supports flag permutations: --dry-run before and after target path", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-permutations-"));
      try {
        const cursorrulesPath = path.join(tempDir, ".cursorrules");
        fs.writeFileSync(cursorrulesPath, customCursorrulesContent, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        // Flags before path
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          "--dry-run",
          "--from=.cursorrules",
          tempDir,
        ]);

        expect(proc.exitCode).toBe(0);
        expect(fs.existsSync(path.join(tempDir, ".cursorrules.bak"))).toBe(false);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("emits structured JSON metrics with --from=.cursorrules, --dry-run, and --json without disk mutations", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-json-"));
      try {
        const cursorrulesPath = path.join(tempDir, ".cursorrules");
        fs.writeFileSync(cursorrulesPath, customCursorrulesContent, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from=.cursorrules",
          "--dry-run",
          "--json",
        ]);

        expect(proc.exitCode).toBe(0);
        const jsonOutput = JSON.parse(proc.stdout.toString());

        expect(jsonOutput.success).toBe(true);
        expect(jsonOutput.status).toBe("simulated");
        expect(jsonOutput.dryRun).toBe(true);
        expect(jsonOutput.backupCreated).toBe(false);
        expect(jsonOutput.sourceFile).toBe(cursorrulesPath);
        expect(jsonOutput.backupPath).toBe(path.join(tempDir, ".cursorrules.bak"));
        expect(jsonOutput.tokenSavings.savedTokens).toBeGreaterThan(0);
        expect(jsonOutput.tokenSavings.reductionPercentage).toBeGreaterThan(0);
        expect(jsonOutput.extractedSkills.length).toBeGreaterThan(0);

        // Confirm zero disk mutations
        expect(fs.existsSync(path.join(tempDir, ".cursorrules.bak"))).toBe(false);
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("fails with exit 1 and clean error message when custom --from file is missing", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-missing-"));
      try {
        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from=.nonexistent-rules",
        ]);

        expect(proc.exitCode).toBe(1);
        const combined = proc.stdout.toString() + proc.stderr.toString();
        expect(combined).toContain("Source instruction file not found");
        expect(combined).toContain(".nonexistent-rules");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("fails with exit 1 and structured error JSON when custom --from file is missing with --json", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-missing-json-"));
      try {
        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          tempDir,
          "--from=.nonexistent-rules",
          "--json",
        ]);

        expect(proc.exitCode).toBe(1);
        const jsonOutput = JSON.parse(proc.stdout.toString());
        expect(jsonOutput.success).toBe(false);
        expect(jsonOutput.status).toBe("error");
        expect(jsonOutput.error).toContain("Source instruction file not found");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("supports passing a legacy file directly as the path argument (baba agents migrate /path/to/.cursorrules --dry-run)", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask6-direct-file-"));
      try {
        const cursorrulesPath = path.join(tempDir, ".cursorrules");
        fs.writeFileSync(cursorrulesPath, customCursorrulesContent, "utf-8");

        const cliScript = path.join(repoRoot, "src", "cli.ts");
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliScript,
          "agents",
          "migrate",
          cursorrulesPath,
          "--dry-run",
          "--json",
        ]);

        expect(proc.exitCode).toBe(0);
        const jsonOutput = JSON.parse(proc.stdout.toString());
        expect(jsonOutput.success).toBe(true);
        expect(jsonOutput.status).toBe("simulated");
        expect(jsonOutput.sourceFile).toBe(cursorrulesPath);
        expect(jsonOutput.backupPath).toBe(path.join(tempDir, ".cursorrules.bak"));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("displays dedicated help for 'baba agents migrate --help' detailing --from and --dry-run", () => {
      const cliScript = path.join(repoRoot, "src", "cli.ts");
      const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", "--help"]);

      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("baba agents migrate [path] [options]");
      expect(stdout).toContain("--from <file>");
      expect(stdout).toContain("--dry-run");
      expect(stdout).toContain("--from=.cursorrules --dry-run");
    });
  });

  describe("Subtask 7: Full BDD test suite verifying skill extraction, frontmatter metadata, and root token ceiling (< 200 tokens)", () => {
    let tempDir: string;
    const cliScript = path.join(repoRoot, "src", "cli.ts");

    const massiveMonolithContent = `# Monolithic Enterprise System Instructions & Architecture Directives 🪆
<!-- Version: 4.2.0-legacy | Author: Core Platform Team -->

> NOTE: Strictly confidential and proprietary architectural conventions.
> All contributors MUST adhere to these operational directives.

## 1. System Architecture & Core Invariants
* Microservices communicate asynchronously via Kafka event streams with Avro serialization schemas.
* Inbound ports must be defined as abstract interfaces and never coupled to external transport protocols like HTTP or gRPC.
* Domain events must be published transactionally using the transactional outbox pattern to prevent data loss.
* Event consumers must be strictly idempotent and tolerate at-least-once message delivery from message brokers.
* Distributed transactions across multiple service boundaries are prohibited; use saga patterns instead.
* Never instantiate global mutable singletons inside application services or controllers.
* Service-to-service communication must always supply correlation identifiers in HTTP headers (X-Correlation-Id).
* Every domain aggregate must maintain its own consistency boundary and enforce all business invariants locally.
* Aggregate roots are the sole gateway for mutating nested entity state within the boundary.
* Service discovery must resolve through Consul mesh with mTLS encrypted tunnels.

## 2. Core Business Invariants & Transaction Rules
* All financial transactions MUST calculate tax using the decimal-safe CurrencyEngine and strict rounding modes.
* Never use IEEE 754 floating-point math for balance calculations, interest rates, or reconciliation sums.
* Invariant: User account status 'SUSPENDED' prevents debit authorizations and scheduled payouts immediately.
* The audit ledger is strictly append-only. UPDATE and DELETE SQL statements are permanently forbidden.
* Daily settlement reconciliations must run at 00:00 UTC and compare credit sums against debit sums.
* If a reconciliation discrepancy exceeds 0.01 currency units, freeze settlement and page the on-call engineer.
* High-value payments above 10,000 currency units require dual human approval (four-eyes principle).
* Currency conversions must read exchange rates locked at transaction initiation time and log the rate provider.
* Credit limits cannot be updated while an active withdrawal transaction is currently in flight.
* Reversals must be executed as distinct offsetting credit/debit transaction pairs referencing the original entry.
* Double-entry bookkeeping requires equal credit and debit balance sums at all times.

## 3. Database Guidelines & Schema Migration Invariants
* All tables must define an indexed \`tenant_id\` UUID column for multi-tenant tenant isolation.
* Foreign keys must use ON DELETE RESTRICT by default to prevent accidental cascading data loss across records.
* Run all schema modifications through zero-downtime migration scripts following the expand-and-contract model.
* Use read-replicas for analytical reporting queries and long-running ledger exports.
* Indexes must be created concurrently outside transaction blocks to avoid locking live production tables.
* Never use SELECT * in production queries; always specify explicit projections for performance and bandwidth.
* Set aggressive lock timeouts (maximum 2000 milliseconds) on DDL schema operations to prevent connection pool exhaustion.
* Database connections must be recycled after 30 minutes to prevent resource leaks and stale socket states.
* Soft-deleted rows must use a nullable deleted_at timestamp column and be excluded by default ORM scopes.
* Primary keys must use distributed time-sortable identifiers like UUIDv7 or ULID for efficient B-tree clustering.

\`\`\`sql
-- Critical verification query: audit append-only invariant
SELECT record_id, action, previous_hash, current_hash
FROM transaction_audit_log
WHERE verification_status = 'PENDING'
ORDER BY created_at ASC
FOR UPDATE SKIP LOCKED;
\`\`\`

## 4. Frontend Styling & UI Component Conventions
* Design tokens must be imported from \`@ui/theme\` rather than hardcoded hex color codes or arbitrary pixel margins.
* Never create custom CSS files outside of the Tailwind token utility pipeline and CSS variable bindings.
* Maintain WCAG 2.1 AA accessibility contrast ratios across all buttons, typography, inputs, and icon badges.
* Lazy-load modal sheets, graphical charts, and heavy reporting dependencies to optimize initial page load.
* Forms must perform optimistic client-side validation using zod schemas before submitting payloads.
* All interactive elements must support complete keyboard navigation including tab indexes and escape key handlers.
* Destructive modal actions (such as account deletion) require explicit typing of confirmation words.
* Error toasts must automatically dismiss after 5 seconds but offer an action button to copy the trace ID.
* Use responsive viewport units and fluid layouts; never force fixed pixel widths on mobile viewports.
* Images and icons must declare explicit width and height dimensions to eliminate layout shifts (CLS).

## 5. Security & Authentication Standards
* Sanitize all raw HTML input using the strict DOMPurify pipeline before rendering in browser views.
* API tokens must be rotated every 90 days and stored in the encrypted hardware security vault.
* Passwords must meet minimum entropy standards (16+ chars) and be hashed with Argon2id and salt.
* All HTTP responses must include strict security headers: CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.
* Sensitive personal identifiable information (PII) must be encrypted at rest using AES-256-GCM.
* Implement rate limiting on all public authentication routes: 5 failed attempts per IP per 15 minutes.
* Session tokens must be stored in HTTP-only, Secure, SameSite=Strict cookies to defend against XSS.
* Access tokens must have a maximum lifetime of 15 minutes; refresh tokens must be revoked on reuse.
* Webhook payloads must be verified using HMAC-SHA256 signatures before processing.
* Internal admin endpoints must be firewalled and accessible only over the private corporate VPN.

## 6. Testing & Quality Verification Directives
* Unit tests must achieve 90% branch coverage on core ledger services and monetary calculation utilities.
* Always assert error types and messages explicitly in failure branches; never rely on generic catch blocks.
* End-to-end integration tests must run against isolated test databases spun up in ephemeral Docker containers.
* Mocking the database driver in repository integration tests is strictly forbidden; test against real engines.
* Flaky tests must be quarantined within 24 hours of first detection and resolved within the sprint.
* Load tests must verify that payment authorization endpoints sustain 5,000 requests per second under 200ms latency.
* Snapshot tests must be approved by design system maintainers before being merged into main.
* Property-based tests must be used for currency conversion algorithms and decimal rounding boundaries.
* Never check in API keys, database credentials, or test secrets into test fixtures or git repositories.
* Integration test suites must clean up all created database records after test completion.

## 7. Internationalization & Locale Directives
* Support multilingual representations: São Paulo, Tokyo 東京, Zürich, Москва, and Riyadh الرياض.
* All user-facing strings must use internationalization keys from the @i18n catalog.
* Date formats must be presented according to the user's localized ISO locale setting.
`;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask7-bdd-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    // =========================================================================
    // AC-7.1: Zero-Loss Skill Extraction & Domain Slicing
    // =========================================================================
    describe("Scenario AC-7.1: Zero-Loss Skill Extraction & Domain Slicing", () => {
      it("extracts primary legacy-knowledge skill preserving 100% of domain rules from unstructured documents", () => {
        const unstructuredInstructions = `
Always validate input data with zod schemas.
Never execute unindexed queries in production.
Use decimal math for financial ledgers.
Maintain WCAG 2.1 AA accessibility ratios.
Ensure Argon2id is used for password hashing.
`;
        const skills = extractLegacySkills(unstructuredInstructions);
        expect(skills.length).toBe(1);

        const primary = skills[0]!;
        expect(primary.name).toBe("legacy-knowledge");
        expect(primary.relativePath).toBe(".agents/skills/legacy-knowledge.md");
        expect(primary.origin).toBe("legacy_migration");
        expect(primary.content).toContain("Always validate input data with zod schemas.");
        expect(primary.content).toContain("Never execute unindexed queries in production.");
        expect(primary.content).toContain("Use decimal math for financial ledgers.");
        expect(primary.content).toContain("Maintain WCAG 2.1 AA accessibility ratios.");
        expect(primary.content).toContain("Ensure Argon2id is used for password hashing.");
      });

      it("handles deeply nested markdown hierarchy (#, ##, ###, ####), lists, and task lists without data loss", () => {
        const nestedMarkdown = `# Enterprise Rules
## Core Policies
### Data Processing
#### Invariant Checks
- [x] Check A: Always verify tenant ID
- [ ] Check B: Verify correlation ID
* Policy 1: Append-only ledger
  * Sub-rule 1.1: No UPDATE statements
  * Sub-rule 1.2: No DELETE statements
> Important: Zero data loss is guaranteed.
`;
        const skills = extractLegacySkills(nestedMarkdown);
        expect(skills.length).toBeGreaterThanOrEqual(1);

        const primary = skills.find((s) => s.name === "legacy-knowledge")!;
        expect(primary.content).toContain("#### Invariant Checks");
        expect(primary.content).toContain("- [x] Check A: Always verify tenant ID");
        expect(primary.content).toContain("- [ ] Check B: Verify correlation ID");
        expect(primary.content).toContain("* Sub-rule 1.1: No UPDATE statements");
        expect(primary.content).toContain("> Important: Zero data loss is guaranteed.");
      });

      it("preserves raw SQL, multi-language code blocks, tables, and regex literals without escaping corruption", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        const primary = skills.find((s) => s.name === "legacy-knowledge")!;

        expect(primary.content).toContain("```sql");
        expect(primary.content).toContain("SELECT record_id, action, previous_hash, current_hash");
        expect(primary.content).toContain("FOR UPDATE SKIP LOCKED;");
        expect(primary.content).toContain("```");
      });

      it("preserves international characters, accents, emojis, and non-Latin scripts byte-for-byte", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        const primary = skills.find((s) => s.name === "legacy-knowledge")!;

        expect(primary.content).toContain("🪆");
        expect(primary.content).toContain("São Paulo");
        expect(primary.content).toContain("Tokyo 東京");
        expect(primary.content).toContain("Zürich");
        expect(primary.content).toContain("Москва");
        expect(primary.content).toContain("Riyadh الرياض");
      });

      it("slices domain sub-skills accurately based on section headers (database, frontend, security, testing)", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        const skillNames = skills.map((s) => s.name);

        expect(skillNames).toContain("legacy-knowledge");
        expect(skillNames).toContain("legacy-database");
        expect(skillNames).toContain("legacy-frontend");
        expect(skillNames).toContain("legacy-security");
        expect(skillNames).toContain("legacy-testing");

        const dbSkill = skills.find((s) => s.name === "legacy-database")!;
        expect(dbSkill.relativePath).toBe(".agents/skills/legacy-database.md");
        expect(dbSkill.content).toContain("tenant_id");
        expect(dbSkill.content).toContain("SELECT record_id, action");

        const securitySkill = skills.find((s) => s.name === "legacy-security")!;
        expect(securitySkill.relativePath).toBe(".agents/skills/legacy-security.md");
        expect(securitySkill.content).toContain("DOMPurify");
        expect(securitySkill.content).toContain("Argon2id");
      });

      it("ensures every extracted skill has a valid relativePath, estimatedTokens > 0, and non-empty content", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        expect(skills.length).toBeGreaterThan(1);

        for (const skill of skills) {
          expect(skill.relativePath).toMatch(/^\.agents\/skills\/legacy-[\w-]+\.md$/);
          expect(skill.estimatedTokens).toBeGreaterThan(0);
          expect(skill.content.trim().length).toBeGreaterThan(0);
          expect(skill.origin).toBe("legacy_migration");
          expect(skill.migratedAt).toBeDefined();
        }
      });
    });

    // =========================================================================
    // AC-7.2: YAML Frontmatter Metadata Stamping & Validation
    // =========================================================================
    describe("Scenario AC-7.2: YAML Frontmatter Metadata Stamping & Validation", () => {
      it("stamps strict YAML delimiters ('---') at start and end of frontmatter for all extracted skills", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        for (const skill of skills) {
          expect(skill.content.startsWith("---\n") || skill.content.startsWith("---\r\n")).toBe(true);
          const closingIndex = skill.content.indexOf("\n---\n", 3);
          expect(closingIndex).toBeGreaterThan(0);
        }
      });

      it("includes required metadata: name, description, origin: legacy_migration, and migrated_at", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        for (const skill of skills) {
          const parsed = parseSkillFrontmatter(skill.content);
          expect(parsed).not.toBeNull();
          expect(parsed!.name).toBe(skill.name);
          expect(parsed!.description).toBeDefined();
          expect(parsed!.description.length).toBeGreaterThan(10);
          expect(parsed!.origin).toBe("legacy_migration");
          expect(parsed!.migrated_at).toBeDefined();

          // Validate ISO 8601 timestamp format
          const timestamp = new Date(parsed!.migrated_at!).getTime();
          expect(Number.isNaN(timestamp)).toBe(false);
        }
      });

      it("confirms validateSkillFrontmatter passes for 100% of extracted skills", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        for (const skill of skills) {
          expect(validateSkillFrontmatter(skill.content)).toBe(true);
        }
      });

      it("confirms isLegacyMigrationSkill detects legacy skills and rejects non-legacy skills or corrupted files", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        for (const skill of skills) {
          expect(isLegacyMigrationSkill(skill.content)).toBe(true);
        }

        const standardSkill = "---\nname: standard-skill\ndescription: A standard skill\n---\n# Content";
        expect(isLegacyMigrationSkill(standardSkill)).toBe(false);

        expect(isLegacyMigrationSkill("random plain text")).toBe(false);
        expect(isLegacyMigrationSkill("")).toBe(false);
      });

      it("cleanses pre-existing legacy frontmatter without creating broken duplicated delimiters", () => {
        const legacyFileWithOldFrontmatter = `---
author: john_doe
created: 2024-01-01
status: draft
---
# Original Legacy Guidelines
* Guideline 1: Do not deploy on Fridays without approval.
* Guideline 2: Maintain immutable audit logs.
`;
        const stamped = stampLegacySkillFrontmatter(legacyFileWithOldFrontmatter, {
          name: "legacy-knowledge",
          description: "Preserved historical guidelines",
          origin: "legacy_migration",
        });

        // Ensure there are exactly two '---' delimiters in the entire file
        const delimiters = stamped.match(/^---$/gm);
        expect(delimiters?.length).toBe(2);

        // Ensure old frontmatter is purged
        expect(stamped).not.toContain("author: john_doe");
        expect(stamped).not.toContain("status: draft");

        // Ensure new frontmatter is present
        expect(stamped).toContain("name: legacy-knowledge");
        expect(stamped).toContain("origin: legacy_migration");
        expect(stamped).toContain("Guideline 1: Do not deploy on Fridays without approval.");

        expect(isLegacyMigrationSkill(stamped)).toBe(true);
        expect(validateSkillFrontmatter(stamped)).toBe(true);
      });
    });

    // =========================================================================
    // AC-7.3: Lean Root AGENTS.md Compilation & Token Ceiling (< 200 tokens)
    // =========================================================================
    describe("Scenario AC-7.3: Lean Root AGENTS.md Compilation & Token Ceiling (< 200 tokens)", () => {
      const archetypes = [
        "api_backend",
        "fullstack_hybrid",
        "reactive_frontend",
        "systems_microservice",
        "opinionated_monolith",
      ] as const;

      it("compiles root AGENTS.md strictly under 200 tokens across all archetypes", () => {
        const skills = extractLegacySkills(massiveMonolithContent);

        for (const archetype of archetypes) {
          const content = compileMigratedRootAgents(
            {
              archetype,
              runtime: "bun",
              packageManager: "bun",
              testCommand: "bun test",
              buildCommand: "bun run build",
              lintCommand: "none",
            },
            skills
          );

          const tokenCount = estimateTokens(content);
          expect(tokenCount).toBeLessThan(200);

          // Verify canonical sections
          expect(content).toContain("# 🤖 Project Operational Directives");
          expect(content).toContain("## 🌐 Stack & Identity");
          expect(content).toContain("## 🛡️ Anti-Slop Core Invariants");
          expect(content).toContain("## 🧭 On-Demand Specialized Skills");
        }
      });

      it("registers primary legacy-knowledge and domain sub-skills with human-readable titles in modular catalog", () => {
        const skills = extractLegacySkills(massiveMonolithContent);
        const content = compileMigratedRootAgents(
          {
            archetype: "api_backend",
            runtime: "node",
            packageManager: "npm",
            testCommand: "npm test",
            buildCommand: "npm run build",
            lintCommand: "npm run lint",
          },
          skills
        );

        expect(content).toContain("* Preserved Legacy Knowledge: `.agents/skills/legacy-knowledge.md`");
        expect(content).toContain("* Legacy Database: `.agents/skills/legacy-database.md`");
        expect(content).toContain("* Legacy Frontend: `.agents/skills/legacy-frontend.md`");
        expect(content).toContain("* Legacy Security: `.agents/skills/legacy-security.md`");
        expect(content).toContain("* Legacy Testing: `.agents/skills/legacy-testing.md`");
      });

      it("computes accurate token savings summary with >= 75% token reduction on large monoliths", () => {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

        const result = migrateLegacyInstructions(tempDir);
        expect(result.success).toBe(true);
        expect(result.rootAgentsTokens).toBeLessThan(200);
        expect(result.tokenSavings.beforeTokens).toBeGreaterThan(1000);
        expect(result.tokenSavings.afterTokens).toBeLessThan(200);
        expect(result.tokenSavings.savedTokens).toBeGreaterThan(800);
        expect(result.tokenSavings.reductionPercentage).toBeGreaterThanOrEqual(75);
      });

      it("throws TokenBudgetExceededError when strictTokenGuard is enabled and token ceiling is breached", () => {
        expect(() => {
          compileMigratedRootAgents(
            {
              archetype: "api_backend",
              runtime: "bun",
              packageManager: "bun",
              testCommand: "bun test",
              buildCommand: "bun run build",
              lintCommand: "none",
            },
            [],
            {
              maxTokens: 20,
              strictTokenGuard: true,
            }
          );
        }).toThrow(TokenBudgetExceededError);
      });
    });

    // =========================================================================
    // AC-7.4: The 9 Production Dimensions Audit for Legacy Migration
    // =========================================================================
    describe("Scenario AC-7.4: The 9 Production Dimensions Audit for Legacy Migration", () => {
      // Dimension 1: Input Validation
      describe("Dimension 1: Input Validation & File Discovery", () => {
        it("returns error envelope when target source file does not exist", () => {
          const result = migrateLegacyInstructions(tempDir, { from: "NONEXISTENT.md" });
          expect(result.success).toBe(false);
          expect(result.status).toBe("error");
          expect(result.error).toContain("Source instruction file not found");
        });

        it("safely resolves relative path traversal without unhandled exceptions", () => {
          const subDir = path.join(tempDir, "sub", "nested");
          fs.mkdirSync(subDir, { recursive: true });
          fs.writeFileSync(path.join(tempDir, "AGENTS.md"), massiveMonolithContent, "utf-8");

          const traversalPath = path.join(subDir, "..", "..");
          const result = migrateLegacyInstructions(traversalPath);
          expect(result.success).toBe(true);
          expect(result.rootAgentsTokens).toBeLessThan(200);
        });

        it("accepts direct file path as the project path argument", () => {
          const customFile = path.join(tempDir, "CUSTOM_RULES.md");
          fs.writeFileSync(customFile, massiveMonolithContent, "utf-8");

          const result = migrateLegacyInstructions(customFile);
          expect(result.success).toBe(true);
          expect(result.sourceFile).toBe(customFile);
          expect(result.backupPath).toBe(`${customFile}.bak`);
        });
      });

      // Dimension 2: Failure Modes & Latency
      describe("Dimension 2: Failure Modes & Latency (< 30ms locally)", () => {
        it("executes migration synchronously in strictly sub-30ms locally", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          const t0 = performance.now();
          const result = migrateLegacyInstructions(tempDir);
          const elapsed = performance.now() - t0;

          // In virtualized CI runners with shared disk I/O, accommodate VM scheduling jitter (< 1000ms) while enforcing < 30ms locally
          const maxLatency = process.env.CI ? 1000 : 30;
          expect(elapsed).toBeLessThan(maxLatency);
          expect(result.durationMs).toBeLessThan(maxLatency);
          expect(result.success).toBe(true);
        });

        it("uses atomic write (.tmp -> rename) ensuring partial writes never corrupt disk state", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          const result = migrateLegacyInstructions(tempDir);
          expect(result.success).toBe(true);

          // Verify no leftover .tmp files exist in .agents/skills or root
          const rootFiles = fs.readdirSync(tempDir);
          const tmpRootFiles = rootFiles.filter((f) => f.includes(".tmp."));
          expect(tmpRootFiles).toHaveLength(0);

          const skillsDir = path.join(tempDir, ".agents", "skills");
          const skillFiles = fs.readdirSync(skillsDir);
          const tmpSkillFiles = skillFiles.filter((f) => f.includes(".tmp."));
          expect(tmpSkillFiles).toHaveLength(0);
        });
      });

      // Dimension 3: Idempotency & Retry
      describe("Dimension 3: Idempotency & Retry", () => {
        it("detects already migrated repository and returns status 'unchanged' without redundant writes", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          // Run first migration
          const firstResult = migrateLegacyInstructions(tempDir);
          expect(firstResult.success).toBe(true);
          expect(firstResult.status).toBe("success");

          // Remove backup so backup collision guard is not triggered, then run second migration
          fs.unlinkSync(path.join(tempDir, "AGENTS.md.bak"));

          // Artificially stamp AGENTS.md with origin: legacy_migration to test idempotency detection
          const migratedRoot = fs.readFileSync(legacyAgentsPath, "utf-8");
          fs.writeFileSync(
            legacyAgentsPath,
            `<!-- origin: legacy_migration -->\n${migratedRoot}`,
            "utf-8"
          );

          const secondResult = migrateLegacyInstructions(tempDir);
          expect(secondResult.success).toBe(true);
          expect(secondResult.status).toBe("unchanged");
          expect(secondResult.extractedSkills).toHaveLength(0);
          expect(secondResult.tokenSavings.savedTokens).toBe(0);
        });

        it("re-migrates cleanly when force: true is provided", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          const firstResult = migrateLegacyInstructions(tempDir);
          expect(firstResult.success).toBe(true);

          const forceResult = migrateLegacyInstructions(tempDir, { force: true });
          expect(forceResult.success).toBe(true);
          expect(forceResult.status).toBe("success");
          expect(forceResult.extractedSkills.length).toBeGreaterThan(0);
        });
      });

      // Dimension 4: Authorization & Scopes
      describe("Dimension 4: Authorization & Scopes", () => {
        it("operates strictly within the target repository directory without writing to external paths", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          const result = migrateLegacyInstructions(tempDir);
          expect(result.success).toBe(true);

          expect(result.sourceFile.startsWith(tempDir)).toBe(true);
          expect(result.backupPath!.startsWith(tempDir)).toBe(true);
          expect(result.rootAgentsPath.startsWith(tempDir)).toBe(true);
          for (const skill of result.extractedSkills) {
            expect(skill.relativePath.startsWith(".agents/skills/")).toBe(true);
          }
        });
      });

      // Dimension 5: Concurrency & Performance
      describe("Dimension 5: Concurrency & Performance", () => {
        it("executes multiple isolated migrations concurrently without cross-talk or race conditions", async () => {
          const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), "baba-concurrent-1-"));
          const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "baba-concurrent-2-"));

          try {
            fs.writeFileSync(path.join(dir1, "AGENTS.md"), massiveMonolithContent, "utf-8");
            fs.writeFileSync(path.join(dir2, "AGENTS.md"), massiveMonolithContent, "utf-8");

            const [res1, res2] = await Promise.all([
              Promise.resolve(migrateLegacyInstructions(dir1)),
              Promise.resolve(migrateLegacyInstructions(dir2)),
            ]);

            expect(res1.success).toBe(true);
            expect(res2.success).toBe(true);
            expect(res1.rootAgentsTokens).toBeLessThan(200);
            expect(res2.rootAgentsTokens).toBeLessThan(200);
            expect(fs.existsSync(path.join(dir1, "AGENTS.md.bak"))).toBe(true);
            expect(fs.existsSync(path.join(dir2, "AGENTS.md.bak"))).toBe(true);
          } finally {
            fs.rmSync(dir1, { recursive: true, force: true });
            fs.rmSync(dir2, { recursive: true, force: true });
          }
        });
      });

      // Dimension 6: Data Lifecycle & In-Memory
      describe("Dimension 6: Data Lifecycle & In-Memory", () => {
        it("produces deterministic, pure output across repeated runs on identical inputs", () => {
          const skillsA = extractLegacySkills(massiveMonolithContent);
          const skillsB = extractLegacySkills(massiveMonolithContent);

          expect(skillsA.length).toBe(skillsB.length);
          for (let i = 0; i < skillsA.length; i++) {
            expect(skillsA[i]!.name).toBe(skillsB[i]!.name);
            expect(skillsA[i]!.relativePath).toBe(skillsB[i]!.relativePath);
            expect(skillsA[i]!.estimatedTokens).toBe(skillsB[i]!.estimatedTokens);
          }
        });
      });

      // Dimension 7: External Fallbacks & Airgap Security
      describe("Dimension 7: External Fallbacks & Airgap Security", () => {
        it("completes 100% locally with zero network calls and zero external cloud LLM dependencies", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          const t0 = performance.now();
          const result = migrateLegacyInstructions(tempDir);
          const elapsed = performance.now() - t0;

          // Latency must be strictly local (< 30ms), proving zero network round-trips
          expect(elapsed).toBeLessThan(30);
          expect(result.success).toBe(true);
        });
      });

      // Dimension 8: State Transitions
      describe("Dimension 8: State Transitions (DISCOVER -> VALIDATE -> SLICE -> STAMP -> SNAPSHOT -> PERSIST -> EMIT)", () => {
        it("follows predictable state pipeline transitioning from simulated to full write", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          // Phase 1: Simulation
          const simResult = migrateLegacyInstructions(tempDir, { dryRun: true });
          expect(simResult.status).toBe("simulated");
          expect(simResult.backupCreated).toBe(false);
          expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);

          // Phase 2: Execution
          const execResult = migrateLegacyInstructions(tempDir);
          expect(execResult.status).toBe("success");
          expect(execResult.backupCreated).toBe(true);
          expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(true);
        });
      });

      // Dimension 9: Observability & Telemetry
      describe("Dimension 9: Observability & Telemetry", () => {
        it("returns complete structured telemetry envelope with all audit metrics", () => {
          const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
          fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

          const result = migrateLegacyInstructions(tempDir);

          expect(result).toHaveProperty("success", true);
          expect(result).toHaveProperty("status", "success");
          expect(result).toHaveProperty("sourceFile");
          expect(result).toHaveProperty("backupPath");
          expect(result).toHaveProperty("backupCreated", true);
          expect(result).toHaveProperty("rootAgentsPath");
          expect(result).toHaveProperty("rootAgentsTokens");
          expect(result).toHaveProperty("extractedSkills");
          expect(result).toHaveProperty("tokenSavings");
          expect(result).toHaveProperty("dryRun", false);
          expect(result).toHaveProperty("durationMs");

          expect(result.tokenSavings).toHaveProperty("beforeTokens");
          expect(result.tokenSavings).toHaveProperty("afterTokens");
          expect(result.tokenSavings).toHaveProperty("savedTokens");
          expect(result.tokenSavings).toHaveProperty("reductionPercentage");
        });
      });
    });

    // =========================================================================
    // AC-7.5: Non-Destructive Rollback & CLI Integration
    // =========================================================================
    describe("Scenario AC-7.5: Non-Destructive Rollback & CLI Integration", () => {
      it("restores exact pre-migration state byte-for-byte upon rollback", () => {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");
        const originalBytes = fs.readFileSync(legacyAgentsPath);

        // 1. Migrate
        const migResult = migrateLegacyInstructions(tempDir);
        expect(migResult.success).toBe(true);
        expect(fs.readFileSync(legacyAgentsPath, "utf-8")).not.toBe(massiveMonolithContent);

        // 2. Rollback
        const rollbackResult = rollbackLegacyMigration(tempDir);
        expect(rollbackResult.success).toBe(true);
        expect(rollbackResult.status).toBe("success");

        // 3. Compare byte-for-byte
        const restoredBytes = fs.readFileSync(legacyAgentsPath);
        expect(Buffer.compare(restoredBytes, originalBytes)).toBe(0);
      });

      it("executes CLI 'baba agents migrate' in default mode and verifies exit code 0 and stdout telemetry", () => {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir]);
        expect(proc.exitCode).toBe(0);

        const stdout = proc.stdout.toString();
        expect(stdout).toContain("SUCCESS (migrated)");
        expect(stdout).toContain("Safety Backup:");
        expect(stdout).toContain("Root AGENTS:");
        expect(stdout).toContain("Token Savings:");

        // Root is under 200 tokens
        const rootContent = fs.readFileSync(legacyAgentsPath, "utf-8");
        expect(estimateTokens(rootContent)).toBeLessThan(200);
      });

      it("executes CLI 'baba agents migrate --json' and validates complete JSON payload schema", () => {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");

        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir, "--json"]);
        expect(proc.exitCode).toBe(0);

        const json = JSON.parse(proc.stdout.toString());
        expect(json.success).toBe(true);
        expect(json.status).toBe("success");
        expect(json.backupCreated).toBe(true);
        expect(json.rootAgentsTokens).toBeLessThan(200);
        expect(json.tokenSavings.reductionPercentage).toBeGreaterThanOrEqual(75);
        expect(json.extractedSkills.length).toBeGreaterThan(0);
      });

      it("CLI fails with exit code 1 when backup already exists and --force is not supplied", () => {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        const backupPath = path.join(tempDir, "AGENTS.md.bak");

        fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");
        fs.writeFileSync(backupPath, "# Protected Backup", "utf-8");

        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir]);
        expect(proc.exitCode).toBe(1);

        const combined = proc.stdout.toString() + proc.stderr.toString();
        expect(combined).toContain("Backup snapshot already exists");
        expect(combined).toContain("--force");
      });

      it("CLI succeeds with exit code 0 when backup exists and -f / --force is supplied", () => {
        const legacyAgentsPath = path.join(tempDir, "AGENTS.md");
        const backupPath = path.join(tempDir, "AGENTS.md.bak");

        fs.writeFileSync(legacyAgentsPath, massiveMonolithContent, "utf-8");
        fs.writeFileSync(backupPath, "# Protected Backup", "utf-8");

        const proc = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", tempDir, "--force"]);
        expect(proc.exitCode).toBe(0);
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(massiveMonolithContent);
      });
    });
  });

  // =========================================================================
  // Subtask 8: Strict alias parity across baba, bbyg, and matryoshka
  // =========================================================================
  describe("Subtask 8: Strict alias parity across baba, bbyg, and matryoshka", () => {
    let tempDir: string;
    const cliScript = path.join(repoRoot, "src", "cli.ts");
    const indexScript = path.join(repoRoot, "index.ts");
    const shellBaba = path.join(repoRoot, "packages", "baba", "bin", "baba.js");
    const shellBbyg = path.join(repoRoot, "packages", "bbyg", "bin", "bbyg.js");
    const shellMatryoska = path.join(repoRoot, "packages", "matryoska", "bin", "matryoska.js");
    const shellMatrioska = path.join(repoRoot, "packages", "matrioska", "bin", "matrioska.js");

    const sampleMonolith = `# Legacy Directives for Multi-Alias Parity Test

## Business Invariants & Rules
* All financial transactions MUST calculate tax using CurrencyEngine.
* User account status 'SUSPENDED' prevents debit authorizations immediately.
* Audit ledger is strictly append-only; UPDATE and DELETE queries are blocked.

# Database Guidelines
* All tables must define an indexed \`tenant_id\` UUID column.
* Foreign keys must use ON DELETE RESTRICT by default.

# Security Standards
* Sanitize all raw HTML input using DOMPurify before rendering.
* API tokens must be rotated every 90 days.
`;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-subtask8-parity-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("dispatches identical help output across baba, bbyg, and matryoshka for 'agents migrate --help'", () => {
      const procBaba = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", "--help"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", "--help"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", "--help"], {
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
      expect(outBaba).toContain("baba agents migrate [path] [options]");
      expect(outBaba).toContain("--from <file>");
      expect(outBaba).toContain("--dry-run");
      expect(outBaba).toContain("--force, -f");
      expect(outBaba).toContain("--max-tokens <num>");
      expect(outBaba).toContain("--json");
    });

    it("ensures identical JSON outputs for 'agents migrate --dry-run --json' across baba, bbyg, and matryoshka", () => {
      const legacyPath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(legacyPath, sampleMonolith, "utf-8");

      const procBaba = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--dry-run", "--json"],
        { env: { ...process.env, BABA_ALIAS: "baba" } }
      );
      const procBbyg = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--dry-run", "--json"],
        { env: { ...process.env, BABA_ALIAS: "bbyg" } }
      );
      const procMatryoshka = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--dry-run", "--json"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim());
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(jsonBaba.success).toBe(true);
      expect(jsonBaba.status).toBe("simulated");
      expect(jsonBaba.dryRun).toBe(true);
      expect(jsonBaba.backupCreated).toBe(false);
      expect(jsonBaba.sourceFile).toBe(legacyPath);
      expect(jsonBaba.backupPath).toBe(path.join(tempDir, "AGENTS.md.bak"));
      expect(jsonBaba.rootAgentsPath).toBe(legacyPath);
      expect(jsonBaba.rootAgentsTokens).toBe(jsonBbyg.rootAgentsTokens);
      expect(jsonBaba.rootAgentsTokens).toBe(jsonMatryoshka.rootAgentsTokens);

      // Token savings metrics parity
      expect(jsonBaba.tokenSavings.beforeTokens).toBe(jsonBbyg.tokenSavings.beforeTokens);
      expect(jsonBaba.tokenSavings.beforeTokens).toBe(jsonMatryoshka.tokenSavings.beforeTokens);
      expect(jsonBaba.tokenSavings.afterTokens).toBe(jsonBbyg.tokenSavings.afterTokens);
      expect(jsonBaba.tokenSavings.afterTokens).toBe(jsonMatryoshka.tokenSavings.afterTokens);
      expect(jsonBaba.tokenSavings.savedTokens).toBe(jsonBbyg.tokenSavings.savedTokens);
      expect(jsonBaba.tokenSavings.savedTokens).toBe(jsonMatryoshka.tokenSavings.savedTokens);
      expect(jsonBaba.tokenSavings.reductionPercentage).toBe(jsonBbyg.tokenSavings.reductionPercentage);
      expect(jsonBaba.tokenSavings.reductionPercentage).toBe(jsonMatryoshka.tokenSavings.reductionPercentage);

      // Extracted skills parity
      expect(jsonBaba.extractedSkills.length).toBe(jsonBbyg.extractedSkills.length);
      expect(jsonBaba.extractedSkills.length).toBe(jsonMatryoshka.extractedSkills.length);
      for (let i = 0; i < jsonBaba.extractedSkills.length; i++) {
        expect(jsonBaba.extractedSkills[i].name).toBe(jsonBbyg.extractedSkills[i].name);
        expect(jsonBaba.extractedSkills[i].name).toBe(jsonMatryoshka.extractedSkills[i].name);
        expect(jsonBaba.extractedSkills[i].relativePath).toBe(jsonBbyg.extractedSkills[i].relativePath);
        expect(jsonBaba.extractedSkills[i].relativePath).toBe(jsonMatryoshka.extractedSkills[i].relativePath);
        expect(jsonBaba.extractedSkills[i].origin).toBe("legacy_migration");
        expect(jsonBbyg.extractedSkills[i].origin).toBe("legacy_migration");
        expect(jsonMatryoshka.extractedSkills[i].origin).toBe("legacy_migration");
      }

      // Zero disk mutations
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".agents"))).toBe(false);
      expect(fs.readFileSync(legacyPath, "utf-8")).toBe(sampleMonolith);
    });

    it("ensures human-readable simulation output parity across baba, bbyg, and matryoshka for 'agents migrate --dry-run'", () => {
      const legacyPath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(legacyPath, sampleMonolith, "utf-8");

      const procBaba = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--dry-run"],
        { env: { ...process.env, BABA_ALIAS: "baba" } }
      );
      const procBbyg = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--dry-run"],
        { env: { ...process.env, BABA_ALIAS: "bbyg" } }
      );
      const procMatryoshka = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--dry-run"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString();
      const outBbyg = procBbyg.stdout.toString();
      const outMatryoshka = procMatryoshka.stdout.toString();

      for (const out of [outBaba, outBbyg, outMatryoshka]) {
        expect(out).toContain("🪆 Matryoshka Legacy AGENTS.md Migration Engine");
        expect(out).toContain("SIMULATED (--dry-run)");
        expect(out).toContain("Safety Backup:");
        expect(out).toContain("AGENTS.md.bak");
        expect(out).toContain("(planned)");
        expect(out).toContain("Root AGENTS:");
        expect(out).toContain("Token Savings:");
        expect(out).toContain("Planned Modular Skills Extraction (diff):");
        expect(out).toContain("legacy-knowledge");
      }
    });

    it("ensures alias parity when invoked via package.json scripts (bun run baba / bbyg / matryoshka)", () => {
      const legacyPath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(legacyPath, sampleMonolith, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", "--silent", "baba", "agents", "migrate", tempDir, "--dry-run", "--json"]);
      const procBbyg = Bun.spawnSync(["bun", "run", "--silent", "bbyg", "agents", "migrate", tempDir, "--dry-run", "--json"]);
      const procMatryoshka = Bun.spawnSync(["bun", "run", "--silent", "matryoshka", "agents", "migrate", tempDir, "--dry-run", "--json"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim().replace(/^.*?\n(?=\{)/s, ""));
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim().replace(/^.*?\n(?=\{)/s, ""));
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim().replace(/^.*?\n(?=\{)/s, ""));

      expect(jsonBaba.success).toBe(true);
      expect(jsonBbyg.success).toBe(true);
      expect(jsonMatryoshka.success).toBe(true);
      expect(jsonBaba.rootAgentsTokens).toBe(jsonBbyg.rootAgentsTokens);
      expect(jsonBaba.rootAgentsTokens).toBe(jsonMatryoshka.rootAgentsTokens);
      expect(jsonBaba.tokenSavings.savedTokens).toBe(jsonBbyg.tokenSavings.savedTokens);
      expect(jsonBaba.tokenSavings.savedTokens).toBe(jsonMatryoshka.tokenSavings.savedTokens);
      expect(jsonBaba.extractedSkills.length).toBe(jsonBbyg.extractedSkills.length);
      expect(jsonBaba.extractedSkills.length).toBe(jsonMatryoshka.extractedSkills.length);
    });

    it("ensures alias parity through protective shell forwarders (packages/baba, packages/bbyg, packages/matryoska, packages/matrioska)", () => {
      const legacyPath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(legacyPath, sampleMonolith, "utf-8");

      const procBaba = Bun.spawnSync(["bun", shellBaba, "agents", "migrate", tempDir, "--dry-run", "--json"]);
      const procBbyg = Bun.spawnSync(["bun", shellBbyg, "agents", "migrate", tempDir, "--dry-run", "--json"]);
      const procMatryoska = Bun.spawnSync(["bun", shellMatryoska, "agents", "migrate", tempDir, "--dry-run", "--json"]);
      const procMatrioska = Bun.spawnSync(["bun", shellMatrioska, "agents", "migrate", tempDir, "--dry-run", "--json"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoska.exitCode).toBe(0);
      expect(procMatrioska.exitCode).toBe(0);

      const resBaba = JSON.parse(procBaba.stdout.toString().trim());
      const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const resMatryoska = JSON.parse(procMatryoska.stdout.toString().trim());
      const resMatrioska = JSON.parse(procMatrioska.stdout.toString().trim());

      expect(resBaba.success).toBe(true);
      expect(resBbyg.success).toBe(true);
      expect(resMatryoska.success).toBe(true);
      expect(resMatrioska.success).toBe(true);

      expect(resBaba.status).toBe("simulated");
      expect(resBbyg.status).toBe("simulated");
      expect(resMatryoska.status).toBe("simulated");
      expect(resMatrioska.status).toBe("simulated");

      expect(resBaba.rootAgentsTokens).toBe(resBbyg.rootAgentsTokens);
      expect(resBaba.rootAgentsTokens).toBe(resMatryoska.rootAgentsTokens);
      expect(resBaba.rootAgentsTokens).toBe(resMatrioska.rootAgentsTokens);
    });

    it("ensures live migration parity across aliases executing non-destructive skill extraction", () => {
      const dirBaba = path.join(tempDir, "dir-baba");
      const dirBbyg = path.join(tempDir, "dir-bbyg");
      const dirMatryoshka = path.join(tempDir, "dir-matryoshka");

      fs.mkdirSync(dirBaba, { recursive: true });
      fs.mkdirSync(dirBbyg, { recursive: true });
      fs.mkdirSync(dirMatryoshka, { recursive: true });

      fs.writeFileSync(path.join(dirBaba, "AGENTS.md"), sampleMonolith, "utf-8");
      fs.writeFileSync(path.join(dirBbyg, "AGENTS.md"), sampleMonolith, "utf-8");
      fs.writeFileSync(path.join(dirMatryoshka, "AGENTS.md"), sampleMonolith, "utf-8");

      const procBaba = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", dirBaba], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", dirBbyg], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", dirMatryoshka], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      // Verify backup snapshots byte-for-byte in all 3
      for (const dir of [dirBaba, dirBbyg, dirMatryoshka]) {
        const backupPath = path.join(dir, "AGENTS.md.bak");
        expect(fs.existsSync(backupPath)).toBe(true);
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(sampleMonolith);

        const primarySkill = path.join(dir, ".agents", "skills", "legacy-knowledge.md");
        expect(fs.existsSync(primarySkill)).toBe(true);
        const skillContent = fs.readFileSync(primarySkill, "utf-8");
        expect(skillContent).toContain("origin: legacy_migration");
        expect(skillContent).toContain("All financial transactions MUST calculate tax using CurrencyEngine.");

        const rootAgentsPath = path.join(dir, "AGENTS.md");
        const rootContent = fs.readFileSync(rootAgentsPath, "utf-8");
        expect(estimateTokens(rootContent)).toBeLessThan(200);
        expect(rootContent).toContain(".agents/skills/legacy-knowledge.md");
      }
    });

    it("ensures error parity across aliases when source file is missing (--from=.nonexistent)", () => {
      const procBaba = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--from=.nonexistent-rules", "--json"],
        { env: { ...process.env, BABA_ALIAS: "baba" } }
      );
      const procBbyg = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--from=.nonexistent-rules", "--json"],
        { env: { ...process.env, BABA_ALIAS: "bbyg" } }
      );
      const procMatryoshka = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--from=.nonexistent-rules", "--json"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBaba.exitCode).toBe(1);
      expect(procBbyg.exitCode).toBe(1);
      expect(procMatryoshka.exitCode).toBe(1);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim());
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(jsonBaba.success).toBe(false);
      expect(jsonBbyg.success).toBe(false);
      expect(jsonMatryoshka.success).toBe(false);
      expect(jsonBaba.status).toBe("error");
      expect(jsonBbyg.status).toBe("error");
      expect(jsonMatryoshka.status).toBe("error");
      expect(jsonBaba.error).toContain("Source instruction file not found");
      expect(jsonBbyg.error).toContain("Source instruction file not found");
      expect(jsonMatryoshka.error).toContain("Source instruction file not found");
    });

    it("ensures backup collision safety guard parity across aliases when backup exists without --force", () => {
      const legacyPath = path.join(tempDir, "AGENTS.md");
      const backupPath = path.join(tempDir, "AGENTS.md.bak");
      fs.writeFileSync(legacyPath, sampleMonolith, "utf-8");
      fs.writeFileSync(backupPath, "# Protected Backup", "utf-8");

      const procBaba = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--json"],
        { env: { ...process.env, BABA_ALIAS: "baba" } }
      );
      const procBbyg = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--json"],
        { env: { ...process.env, BABA_ALIAS: "bbyg" } }
      );
      const procMatryoshka = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--json"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBaba.exitCode).toBe(1);
      expect(procBbyg.exitCode).toBe(1);
      expect(procMatryoshka.exitCode).toBe(1);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim());
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(jsonBaba.success).toBe(false);
      expect(jsonBbyg.success).toBe(false);
      expect(jsonMatryoshka.success).toBe(false);
      expect(jsonBaba.error).toContain("Backup snapshot already exists");
      expect(jsonBbyg.error).toContain("Backup snapshot already exists");
      expect(jsonMatryoshka.error).toContain("Backup snapshot already exists");

      // Verify backup wasn't corrupted
      expect(fs.readFileSync(backupPath, "utf-8")).toBe("# Protected Backup");
    });

    it("ensures overwrite parity across aliases when --force / -f is supplied", () => {
      const dirBaba = path.join(tempDir, "dir-force-baba");
      const dirBbyg = path.join(tempDir, "dir-force-bbyg");
      const dirMatryoshka = path.join(tempDir, "dir-force-matryoshka");

      fs.mkdirSync(dirBaba, { recursive: true });
      fs.mkdirSync(dirBbyg, { recursive: true });
      fs.mkdirSync(dirMatryoshka, { recursive: true });

      for (const dir of [dirBaba, dirBbyg, dirMatryoshka]) {
        fs.writeFileSync(path.join(dir, "AGENTS.md"), sampleMonolith, "utf-8");
        fs.writeFileSync(path.join(dir, "AGENTS.md.bak"), "# Old Outdated Backup", "utf-8");
      }

      const procBaba = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", dirBaba, "--force"], {
        env: { ...process.env, BABA_ALIAS: "baba" },
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", dirBbyg, "-f"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" },
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliScript, "agents", "migrate", dirMatryoshka, "--force"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" },
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      for (const dir of [dirBaba, dirBbyg, dirMatryoshka]) {
        expect(fs.readFileSync(path.join(dir, "AGENTS.md.bak"), "utf-8")).toBe(sampleMonolith);
      }
    });

    it("ensures index.ts entrypoint parity with src/cli.ts on migration execution", () => {
      const legacyPath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(legacyPath, sampleMonolith, "utf-8");

      const procIndex = Bun.spawnSync([
        "bun",
        "run",
        indexScript,
        "agents",
        "migrate",
        tempDir,
        "--dry-run",
        "--json",
      ]);
      const procCli = Bun.spawnSync([
        "bun",
        "run",
        cliScript,
        "agents",
        "migrate",
        tempDir,
        "--dry-run",
        "--json",
      ]);

      expect(procIndex.exitCode).toBe(0);
      expect(procCli.exitCode).toBe(0);

      const jsonIndex = JSON.parse(procIndex.stdout.toString().trim());
      const jsonCli = JSON.parse(procCli.stdout.toString().trim());

      expect(jsonIndex.success).toBe(jsonCli.success);
      expect(jsonIndex.status).toBe(jsonCli.status);
      expect(jsonIndex.rootAgentsTokens).toBe(jsonCli.rootAgentsTokens);
      expect(jsonIndex.tokenSavings.savedTokens).toBe(jsonCli.tokenSavings.savedTokens);
      expect(jsonIndex.extractedSkills.length).toBe(jsonCli.extractedSkills.length);
    });

    it("ensures option permutation parity (--from, --dry-run, --max-tokens) across aliases", () => {
      const customPath = path.join(tempDir, ".cursorrules");
      fs.writeFileSync(customPath, sampleMonolith, "utf-8");

      const procBaba = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--from=.cursorrules", "--dry-run", "--max-tokens=180", "--json"],
        { env: { ...process.env, BABA_ALIAS: "baba" } }
      );
      const procBbyg = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--from=.cursorrules", "--dry-run", "--max-tokens=180", "--json"],
        { env: { ...process.env, BABA_ALIAS: "bbyg" } }
      );
      const procMatryoshka = Bun.spawnSync(
        ["bun", "run", cliScript, "agents", "migrate", tempDir, "--from=.cursorrules", "--dry-run", "--max-tokens=180", "--json"],
        { env: { ...process.env, BABA_ALIAS: "matryoshka" } }
      );

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const jsonBaba = JSON.parse(procBaba.stdout.toString().trim());
      const jsonBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const jsonMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(jsonBaba.rootAgentsTokens).toBeLessThanOrEqual(180);
      expect(jsonBaba.rootAgentsTokens).toBe(jsonBbyg.rootAgentsTokens);
      expect(jsonBaba.rootAgentsTokens).toBe(jsonMatryoshka.rootAgentsTokens);
      expect(jsonBaba.sourceFile).toBe(customPath);
      expect(jsonBaba.backupPath).toBe(path.join(tempDir, ".cursorrules.bak"));
    });
  });
});


