import { describe, expect, it } from "bun:test";
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
  stampLegacySkillFrontmatter,
  validateSkillFrontmatter,
} from "../src/agents";
import type {
  ExtractedSkill,
  LegacyMigrationOptions,
  LegacyMigrationResult,
  LegacySkillMetadata,
  MigratedRootAgentsOptions,
  SkillFrontmatter,
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
});
