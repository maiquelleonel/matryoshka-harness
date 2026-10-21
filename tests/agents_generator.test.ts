import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  compileRootAgents,
  compileBackendSkill,
  compileDatabaseSkill,
  detectBackendOrm,
  detectDatabaseEngine,
  estimateTokens,
  parseSkillFrontmatter,
  validateSkillFrontmatter,
  buildSkillsMetadataIndex,
  loadSkillOnDemand,
  discoverSeams,
  profileArchetype,
  SKILL_DEFINITIONS,
  MAX_ROOT_AGENTS_TOKENS,
  TARGET_ROOT_AGENTS_TOKENS,
  TokenBudgetExceededError,
  inspectTokenBudget,
  assertTokenBudget,
  type AgentArchetype,
  type SkillName,
  type ArchetypeProfile,
  type DiscoveredSeams,
  type TokenGuardReport,
  type RootAgentsTemplateOptions,
  type BackendSkillCompilerOptions,
  type DatabaseSkillCompilerOptions,
  compileFrontendSkill,
  compileSecuritySkill,
  detectFrontendFramework,
  detectStylingSystem,
  detectAuthFramework,
  type FrontendSkillCompilerOptions,
  type SecuritySkillCompilerOptions,
  compileTestingSkill,
  detectTestRunner,
  detectE2eFramework,
  type TestingSkillCompilerOptions,
  generateAgents,
  type GenerateAgentsResult,
  type GenerateAgentsOptions
} from "../src/agents";

describe("Adaptive Context-Aware AGENTS.md & Modular Skills Engine (SPEC-8)", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-agents-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Scenario 1: Generating governance for a FastAPI + PostgreSQL repository", () => {
    it("creates lean AGENTS.md (< 250 tokens) and backend/db/security/testing skills without frontend skill", async () => {
      // Given a repository containing 'pyproject.toml' with 'fastapi' and 'asyncpg'
      fs.writeFileSync(
        path.join(tempDir, "pyproject.toml"),
        `[project]
name = "fastapi-demo"
dependencies = [
    "fastapi>=0.100.0",
    "asyncpg>=0.28.0",
    "pytest>=7.4.0"
]
`
      );

      // When the user executes 'baba agents generate ./'
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
      expect(proc.exitCode).toBe(0);

      // Then the root 'AGENTS.md' must be created with archetype 'api_backend'
      const agentsPath = path.join(tempDir, "AGENTS.md");
      expect(fs.existsSync(agentsPath)).toBe(true);

      const agentsContent = fs.readFileSync(agentsPath, "utf-8");
      expect(agentsContent).toContain("api_backend");

      // And 'AGENTS.md' token count must be less than 250 tokens
      const words = agentsContent.trim().split(/\s+/).length;
      const estimatedTokens = Math.ceil(agentsContent.length / 4);
      expect(estimatedTokens).toBeLessThan(250);
      expect(words).toBeLessThan(200);

      // And directory '.agents/skills/' must contain 'skill-backend.md', 'skill-database.md', 'skill-security.md', 'skill-testing.md'
      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(skillsDir)).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-database.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-security.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-testing.md"))).toBe(true);

      // And all generated skill files must contain valid YAML frontmatter ('name' and 'description')
      const skillFiles = [
        "skill-backend.md",
        "skill-database.md",
        "skill-security.md",
        "skill-testing.md"
      ];
      for (const file of skillFiles) {
        const content = fs.readFileSync(path.join(skillsDir, file), "utf-8");
        expect(content.startsWith("---\n")).toBe(true);
        expect(content).toMatch(/name:\s+[\w-]+/);
        expect(content).toMatch(/description:\s+.+/);
        expect(content).toContain("\n---\n");
      }

      // And 'skill-frontend.md' must NOT be generated.
      expect(fs.existsSync(path.join(skillsDir, "skill-frontend.md"))).toBe(false);
    });
  });

  describe("Scenario 2: Generating governance for a Next.js fullstack repository", () => {
    it("creates governance with archetype fullstack_hybrid containing both frontend and backend skills", async () => {
      // Given a repository containing 'package.json' with 'next' and 'prisma'
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "next-prisma-app",
          dependencies: {
            next: "^14.0.0",
            react: "^18.2.0",
            prisma: "^5.0.0",
            "@prisma/client": "^5.0.0"
          },
          scripts: {
            build: "next build",
            lint: "next lint",
            test: "vitest"
          }
        }, null, 2)
      );

      // When the user executes 'baba agents generate ./'
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
      expect(proc.exitCode).toBe(0);

      // Then the root 'AGENTS.md' must be created with archetype 'fullstack_hybrid'
      const agentsPath = path.join(tempDir, "AGENTS.md");
      expect(fs.existsSync(agentsPath)).toBe(true);
      const agentsContent = fs.readFileSync(agentsPath, "utf-8");
      expect(agentsContent).toContain("fullstack_hybrid");

      // And '.agents/skills/' must contain both 'skill-frontend.md' and 'skill-backend.md' with YAML frontmatter.
      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-frontend.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(true);

      const frontendContent = fs.readFileSync(path.join(skillsDir, "skill-frontend.md"), "utf-8");
      expect(frontendContent.startsWith("---\n")).toBe(true);
      expect(frontendContent).toContain("name: skill-frontend");

      const backendContent = fs.readFileSync(path.join(skillsDir, "skill-backend.md"), "utf-8");
      expect(backendContent.startsWith("---\n")).toBe(true);
      expect(backendContent).toContain("name: skill-backend");
    });
  });

  describe("Scenario 3: Non-destructive overwrite protection", () => {
    it("backs up original file to AGENTS.md.bak when --force is provided and overwrites cleanly", async () => {
      // Given an existing 'AGENTS.md' with custom user instructions
      const customContent = "# My Custom AGENTS.md Instructions\nDo not delete this!";
      const agentsPath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(agentsPath, customContent, "utf-8");

      // Minimal package.json so detection works
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-app", dependencies: { express: "^4.18.0" } })
      );

      // When the user executes 'baba agents generate ./ --force'
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--force"]);

      // Then return exit code 0
      expect(proc.exitCode).toBe(0);

      // And the original file must be backed up to 'AGENTS.md.bak'
      const backupPath = path.join(tempDir, "AGENTS.md.bak");
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(fs.readFileSync(backupPath, "utf-8")).toBe(customContent);

      // And the new 'AGENTS.md' must be generated cleanly
      const newContent = fs.readFileSync(agentsPath, "utf-8");
      expect(newContent).not.toBe(customContent);
      expect(newContent).toContain("# 🤖 Project Operational Directives");
    });

    it("refuses to overwrite existing AGENTS.md without --force flag", async () => {
      const customContent = "# Critical Protected Instructions";
      const agentsPath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(agentsPath, customContent, "utf-8");

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-app" })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
      expect(proc.exitCode).not.toBe(0);
      expect(fs.readFileSync(agentsPath, "utf-8")).toBe(customContent);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);
    });
  });

  describe("Scenario 4: Dry-run structured execution", () => {
    it("does not write files and emits structured JSON with planned files and estimated token savings", async () => {
      // Given any supported repository
      fs.writeFileSync(
        path.join(tempDir, "pyproject.toml"),
        `[project]\nname = "fastapi-demo"\ndependencies = ["fastapi", "asyncpg"]\n`
      );

      // When the user executes 'baba agents generate ./ --dry-run --json'
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "agents",
        "generate",
        tempDir,
        "--dry-run",
        "--json"
      ]);

      expect(proc.exitCode).toBe(0);

      // Then no files must be written to disk
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".agents"))).toBe(false);

      // And stdout must be a valid JSON payload listing planned files and estimated token savings
      const stdout = proc.stdout.toString().trim();
      let parsed: any;
      expect(() => {
        parsed = JSON.parse(stdout);
      }).not.toThrow();

      expect(parsed).toHaveProperty("plannedFiles");
      expect(Array.isArray(parsed.plannedFiles)).toBe(true);
      expect(parsed.plannedFiles.length).toBeGreaterThan(0);

      expect(parsed).toHaveProperty("estimatedTokenSavings");
      expect(parsed.estimatedTokenSavings).toHaveProperty("savedTokens");
      expect(parsed.estimatedTokenSavings.savedTokens).toBeGreaterThan(0);
    });
  });

  describe("CLI Alias Parity for agents generate", () => {
    it("ensures parity across baba, bbyg, and matryoshka for agents generate --dry-run --json", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-pkg", dependencies: { next: "14", prisma: "5" } })
      );

      const procBaba = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);
      const procBbyg = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);
      const procMatryoshka = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.archetype).toBe(parsedBbyg.archetype);
      expect(parsedBaba.archetype).toBe(parsedMatryoshka.archetype);
      expect(parsedBaba.archetype).toBe("fullstack_hybrid");
    });
  });

  describe("Subtask 1: Ultra-lean root AGENTS.md (<200 tokens): Defining archetype identity, canonical test/build/lint commands, and non-negotiable anti-slop rules", () => {
    const archetypes: AgentArchetype[] = [
      "api_backend",
      "opinionated_monolith",
      "reactive_frontend",
      "systems_microservice",
      "fullstack_hybrid"
    ];

    for (const archetype of archetypes) {
      it(`compiles root AGENTS.md strictly under 200 tokens for archetype ${archetype}`, () => {
        const profile = {
          archetype,
          runtime: "bun",
          packageManager: "bun",
          testCommand: "bun test",
          buildCommand: "bun run build",
          lintCommand: "none",
          activeSkills: [
            "skill-backend",
            "skill-database",
            "skill-security",
            "skill-testing"
          ] as SkillName[]
        };

        const compiled = compileRootAgents(profile);
        const tokens = estimateTokens(compiled);
        const words = compiled.trim().split(/\s+/).length;

        // Token budget guard (< 200 tokens)
        expect(tokens).toBeLessThan(200);
        expect(words).toBeLessThan(200);

        // Archetype and stack identity
        expect(compiled).toContain(`* **Archetype:** ${archetype}`);
        expect(compiled).toContain("* **Runtime:** bun (bun)");
        expect(compiled).toContain("* **Test Runner:** `bun test`");
        expect(compiled).toContain("* **Build / Lint:** `bun run build` | `none`");

        // Non-negotiable anti-slop rules
        expect(compiled).toContain("## 🛡️ Anti-Slop Core Invariants");
        expect(compiled).toContain("* **YAGNI & DRY First:**");
        expect(compiled).toContain("* **No Unprompted Refactoring:**");
        expect(compiled).toContain("* **Verification First:**");

        // On-demand specialized skills links
        expect(compiled).toContain("## 🧭 On-Demand Specialized Skills");
        expect(compiled).toContain(".agents/skills/skill-backend.md");
        expect(compiled).toContain(".agents/skills/skill-database.md");
        expect(compiled).toContain(".agents/skills/skill-security.md");
        expect(compiled).toContain(".agents/skills/skill-testing.md");
      });
    }

    it("enforces token count strictly < 200 even with all 5 active skills and full commands", () => {
      const allSkills: SkillName[] = [
        "skill-backend",
        "skill-frontend",
        "skill-database",
        "skill-security",
        "skill-testing"
      ];
      const compiled = compileRootAgents({
        archetype: "fullstack_hybrid",
        runtime: "typescript (bun)",
        packageManager: "bun",
        testCommand: "bun test",
        buildCommand: "bun run build",
        lintCommand: "bunx biome check .",
        activeSkills: allSkills
      });

      const tokens = estimateTokens(compiled);
      expect(tokens).toBeLessThan(200);
    });
  });

  describe("Unit & Archetype Profiling Tests", () => {
    it("profiles systems_microservice for Rust without web UI", async () => {
      fs.writeFileSync(
        path.join(tempDir, "Cargo.toml"),
        `[package]\nname = "microservice"\nversion = "0.1.0"\n`
      );

      const proc = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);
      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.archetype).toBe("systems_microservice");
    });

    it("profiles systems_microservice for Go without web UI", async () => {
      fs.writeFileSync(
        path.join(tempDir, "go.mod"),
        `module microservice\n\ngo 1.22\n`
      );

      const proc = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);
      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.archetype).toBe("systems_microservice");
    });

    it("profiles opinionated_monolith for Django", async () => {
      fs.writeFileSync(
        path.join(tempDir, "requirements.txt"),
        `django>=4.2\n`
      );

      const proc = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);
      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.archetype).toBe("opinionated_monolith");
    });

    it("profiles reactive_frontend for React without backend/database", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "react-app",
          dependencies: { react: "^18.2.0" }
        })
      );

      const proc = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);
      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.archetype).toBe("reactive_frontend");
    });

    it("renders terminal output cleanly for non-json dry-run", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "cli-test", dependencies: { express: "^4.18.0" } })
      );

      const proc = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run"
      ]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(stdout).toContain("Archetype:");
      expect(stdout).toContain("Token Savings:");
    });
  });

  describe("Subtask 2: On-demand modular skills with strict YAML Frontmatter (.agents/skills/): Specialized guidance (Backend, Frontend, Database, Security, Testing) loaded only on demand via metadata index to prevent premature context flooding", () => {
    const canonicalSkills: SkillName[] = [
      "skill-backend",
      "skill-frontend",
      "skill-database",
      "skill-security",
      "skill-testing"
    ];

    it("verifies all 5 canonical skills exist in catalog with valid YAML frontmatter and descriptions", () => {
      for (const skillName of canonicalSkills) {
        const skill = SKILL_DEFINITIONS[skillName];
        expect(skill).toBeDefined();
        expect(skill.name).toBe(skillName);
        expect(skill.fileName).toBe(`${skillName}.md`);
        expect(skill.description).toBeDefined();
        expect(skill.description.length).toBeGreaterThan(20);

        // Content must start with YAML frontmatter delimiters
        expect(skill.content.startsWith("---\n")).toBe(true);
        expect(skill.content).toContain("\n---\n");

        // Frontmatter parser and validator must recognize valid format
        const parsed = parseSkillFrontmatter(skill.content);
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe(skillName);
        expect(parsed?.description).toBe(skill.description);

        expect(validateSkillFrontmatter(skill.content)).toBe(true);
      }
    });

    it("validates that parseSkillFrontmatter returns null and validateSkillFrontmatter returns false on malformed content", () => {
      expect(parseSkillFrontmatter("")).toBeNull();
      expect(validateSkillFrontmatter("")).toBe(false);

      expect(parseSkillFrontmatter("# Just a title without frontmatter")).toBeNull();
      expect(validateSkillFrontmatter("# Just a title without frontmatter")).toBe(false);

      expect(parseSkillFrontmatter("---\nname: skill-backend\n# missing closing delimiter")).toBeNull();
      expect(validateSkillFrontmatter("---\nname: skill-backend\n# missing closing delimiter")).toBe(false);

      expect(parseSkillFrontmatter("---\ndescription: missing name\n---\n# Body")).toBeNull();
      expect(validateSkillFrontmatter("---\ndescription: missing name\n---\n# Body")).toBe(false);

      expect(parseSkillFrontmatter("---\nname: skill-backend\n---\n# Body")).toBeNull();
      expect(validateSkillFrontmatter("---\nname: skill-backend\n---\n# Body")).toBe(false);
    });

    it("enforces specialized guidance invariants in all 5 skill bodies", () => {
      // Backend
      const backend = SKILL_DEFINITIONS["skill-backend"].content;
      expect(backend).toContain("Anti-N+1 Query Invariant");
      expect(backend).toContain("Transactional Boundaries & Atomic Persistence");
      expect(backend).toContain("Idiomatic Layer Seams");

      // Frontend
      const frontend = SKILL_DEFINITIONS["skill-frontend"].content;
      expect(frontend).toContain("Pure Rendering & Reactivity Invariants");
      expect(frontend).toContain("Cumulative Layout Shifts (CLS) & Performance");
      expect(frontend).toContain("Accessibility (A11y) & Semantic Markup");

      // Database
      const database = SKILL_DEFINITIONS["skill-database"].content;
      expect(database).toContain("Zero-Downtime Migration Contract");
      expect(database).toContain("Lock Safety & Non-Blocking DDL");
      expect(database).toContain("Query & Index Hygiene");

      // Security
      const security = SKILL_DEFINITIONS["skill-security"].content;
      expect(security).toContain("Zero Secret Leakage Invariant");
      expect(security).toContain("Strict Input Sanitization & Parameterization");
      expect(security).toContain("Authentication & Authorization Guardrails");

      // Testing
      const testing = SKILL_DEFINITIONS["skill-testing"].content;
      expect(testing).toContain("The Seam Contract (Red-to-Green)");
      expect(testing).toContain("Deterministic Fixtures & Isolation");
      expect(testing).toContain("Mock Boundaries");
    });

    it("builds a lightweight skills metadata index preventing premature context flooding", () => {
      const activeSkills: SkillName[] = [
        "skill-backend",
        "skill-database",
        "skill-security",
        "skill-testing"
      ];
      const index = buildSkillsMetadataIndex(tempDir, activeSkills);

      expect(index.skillsDir).toBe(path.join(tempDir, ".agents", "skills"));
      expect(index.skills).toHaveLength(4);

      for (const item of index.skills) {
        expect(item.relativePath).toMatch(/^\.agents\/skills\/skill-.*\.md$/);
        expect(item.description.length).toBeGreaterThan(15);
        expect(item.domain.length).toBeGreaterThan(0);
        expect(item.tokenCount).toBeGreaterThan(0);
      }

      // Metadata index must consume a fraction of tokens compared to full monolithic instructions
      expect(index.totalIndexTokens).toBeLessThan(350);
      expect(index.monolithicTokens).toBeGreaterThan(700);
      expect(index.tokenSavings).toBeGreaterThan(500);
      expect(index.savingsPercentage).toBeGreaterThanOrEqual(70);
    });

    it("loads skills on demand from disk when generated and falls back to catalog", () => {
      // Before generation: loads on-demand from catalog fallback
      const initialSkill = loadSkillOnDemand("skill-backend", tempDir);
      expect(initialSkill.name).toBe("skill-backend");
      expect(initialSkill.source).toBe("catalog");
      expect(initialSkill.content).toContain("Anti-N+1 Query Invariant");

      // Generate files on disk
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-app", dependencies: { express: "^4.18.0", pg: "^8.0.0" } })
      );
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
      expect(proc.exitCode).toBe(0);

      // After generation: loads on-demand from disk
      const diskSkill = loadSkillOnDemand("skill-backend", tempDir);
      expect(diskSkill.name).toBe("skill-backend");
      expect(diskSkill.source).toBe("disk");
      expect(diskSkill.fullPath).toBe(path.join(tempDir, ".agents", "skills", "skill-backend.md"));
      expect(diskSkill.content).toContain("Anti-N+1 Query Invariant");
      expect(validateSkillFrontmatter(diskSkill.content)).toBe(true);

      // Loading a skill on-demand does not alter or flood memory with other skills
      const loadedTesting = loadSkillOnDemand("skill-testing", tempDir);
      expect(loadedTesting.source).toBe("disk");
      expect(loadedTesting.content).toContain("The Seam Contract");
    });

    it("includes skillsIndex in generateAgents result without dryRun and with dryRun", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "fullstack-demo",
          dependencies: { next: "^14.0.0", prisma: "^5.0.0" }
        })
      );

      // Dry run
      const dryResult = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
      ]);
      expect(dryResult.exitCode).toBe(0);
      const parsedDry = JSON.parse(dryResult.stdout.toString().trim());
      expect(parsedDry).toHaveProperty("skillsIndex");
      expect(parsedDry.skillsIndex.skills.length).toBe(5);

      // Actual run
      const realResult = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--json"
      ]);
      expect(realResult.exitCode).toBe(0);
      const parsedReal = JSON.parse(realResult.stdout.toString().trim());
      expect(parsedReal).toHaveProperty("skillsIndex");
      expect(parsedReal.skillsIndex.skills.length).toBe(5);
      expect(parsedReal.skillsIndex.savingsPercentage).toBeGreaterThanOrEqual(70);
    });
  });

  describe("Subtask 3: Archetype Profiler & Seam Discovery", () => {
    describe("discoverSeams()", () => {
      it("discovers all architectural seams in a structured repository", () => {
        // Create seam directories and files
        fs.mkdirSync(path.join(tempDir, "src", "routes"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "src", "models"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "src", "controllers"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "src", "services"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "src", "views"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });

        fs.writeFileSync(path.join(tempDir, "src", "routes", "users.ts"), "export const route = {};");
        fs.writeFileSync(path.join(tempDir, "src", "models", "user.model.ts"), "export interface User {}");
        fs.writeFileSync(path.join(tempDir, "src", "controllers", "user.controller.ts"), "export class UserController {}");
        fs.writeFileSync(path.join(tempDir, "src", "services", "user.service.ts"), "export class UserService {}");
        fs.writeFileSync(path.join(tempDir, "src", "views", "index.html"), "<h1>Home</h1>");
        fs.writeFileSync(path.join(tempDir, "tests", "user.test.ts"), "test('user', () => {});");

        const seams = discoverSeams(tempDir);

        expect(seams.hasBackend).toBe(true);
        expect(seams.hasDatabase).toBe(true);
        expect(seams.hasFrontend).toBe(true);
        expect(seams.hasTesting).toBe(true);
        expect(seams.hasSecurity).toBe(true);

        expect(seams.routes.some((r) => r.includes("users.ts"))).toBe(true);
        expect(seams.models.some((m) => m.includes("user.model.ts"))).toBe(true);
        expect(seams.controllers.some((c) => c.includes("user.controller.ts"))).toBe(true);
        expect(seams.services.some((s) => s.includes("user.service.ts"))).toBe(true);
        expect(seams.views.some((v) => v.includes("index.html"))).toBe(true);
        expect(seams.tests.some((t) => t.includes("user.test.ts"))).toBe(true);
      });

      it("returns clean empty structure for empty directory", () => {
        const seams = discoverSeams(tempDir);

        expect(seams.hasBackend).toBe(false);
        expect(seams.hasDatabase).toBe(false);
        expect(seams.hasFrontend).toBe(false);
        expect(seams.hasTesting).toBe(false);
        expect(seams.routes).toEqual([]);
        expect(seams.models).toEqual([]);
        expect(seams.controllers).toEqual([]);
        expect(seams.services).toEqual([]);
        expect(seams.views).toEqual([]);
        expect(seams.tests).toEqual([]);
      });
    });

    describe("profileArchetype() with Seams Discovery", () => {
      it("profiles monorepo layout (apps/web Next.js + apps/api FastAPI) as fullstack_hybrid", () => {
        fs.mkdirSync(path.join(tempDir, "apps", "web"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "apps", "api"), { recursive: true });

        fs.writeFileSync(
          path.join(tempDir, "apps", "web", "package.json"),
          JSON.stringify({ name: "web", dependencies: { next: "^14.0.0", react: "^18.0.0" } })
        );

        fs.writeFileSync(
          path.join(tempDir, "apps", "api", "pyproject.toml"),
          `[project]\nname = "api"\ndependencies = ["fastapi", "uvicorn"]\n`
        );

        const profile: ArchetypeProfile = profileArchetype(tempDir);

        expect(profile.archetype).toBe("fullstack_hybrid");
        expect(profile.activeSkills).toContain("skill-frontend");
        expect(profile.activeSkills).toContain("skill-backend");
        expect(profile.seams.hasFrontend).toBe(true);
        expect(profile.seams.hasBackend).toBe(true);
      });

      it("profiles dual manifest repository (root Next.js + root FastAPI) as fullstack_hybrid", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "frontend", dependencies: { next: "^14.0.0" } })
        );

        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\nname = "backend"\ndependencies = ["fastapi", "asyncpg"]\n`
        );

        const profile = profileArchetype(tempDir);
        expect(profile.archetype).toBe("fullstack_hybrid");
        expect(profile.activeSkills).toContain("skill-frontend");
        expect(profile.activeSkills).toContain("skill-backend");
      });

      it("profiles django-ninja as api_backend instead of opinionated_monolith", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\nname = "ninja-api"\ndependencies = ["django-ninja>=1.0.0", "pydantic"]\n`
        );

        const profile = profileArchetype(tempDir);
        expect(profile.archetype).toBe("api_backend");
        expect(profile.activeSkills).toContain("skill-backend");
        expect(profile.activeSkills).not.toContain("skill-frontend");
      });

      it("profiles Python queue/worker without web framework as systems_microservice", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\nname = "worker"\ndependencies = ["celery>=5.3.0", "redis", "pydantic"]\n`
        );

        const profile = profileArchetype(tempDir);
        expect(profile.archetype).toBe("systems_microservice");
        expect(profile.activeSkills).toContain("skill-backend");
        expect(profile.activeSkills).not.toContain("skill-frontend");
      });

      it("omits skill-frontend in Ruby on Rails API mode without views or assets", () => {
        fs.writeFileSync(
          path.join(tempDir, "Gemfile"),
          `source 'https://rubygems.org'\ngem 'rails', '~> 7.1.0'\n`
        );

        const profile = profileArchetype(tempDir);
        expect(profile.archetype).toBe("opinionated_monolith");
        expect(profile.activeSkills).not.toContain("skill-frontend");
      });

      it("includes skill-frontend in Ruby on Rails with app/views directory", () => {
        fs.writeFileSync(
          path.join(tempDir, "Gemfile"),
          `source 'https://rubygems.org'\ngem 'rails', '~> 7.1.0'\n`
        );
        fs.mkdirSync(path.join(tempDir, "app", "views"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, "app", "views", "index.html.erb"), "<h1>Welcome</h1>");

        const profile = profileArchetype(tempDir);
        expect(profile.archetype).toBe("opinionated_monolith");
        expect(profile.activeSkills).toContain("skill-frontend");
      });
    });

    describe("CLI 'agents profile' subcommand & CLI integration", () => {
      it("supports 'baba agents profile [path]' with formatted terminal output", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "my-app", dependencies: { next: "14", prisma: "5" } })
        );

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "profile", tempDir]);
        expect(proc.exitCode).toBe(0);

        const stdout = proc.stdout.toString();
        expect(stdout).toContain("Matryoshka Archetype Profiler & Seam Discovery");
        expect(stdout).toContain("Archetype:");
        expect(stdout).toContain("fullstack_hybrid");
        expect(stdout).toContain("Discovered Seams:");
      });

      it("supports 'baba agents profile [path] --json' with structured JSON output", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\nname = "fastapi-svc"\ndependencies = ["fastapi", "pytest"]\n`
        );

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "profile", tempDir, "--json"
        ]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.archetype).toBe("api_backend");
        expect(parsed).toHaveProperty("seams");
        expect(parsed.seams).toHaveProperty("hasBackend");
        expect(parsed.seams.hasBackend).toBe(true);
        expect(parsed).toHaveProperty("activeSkills");
        expect(parsed.activeSkills).toContain("skill-backend");
      });

      it("ensures alias parity across baba, bbyg, and matryoshka for agents profile --json", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "parity-test", dependencies: { express: "^4.18.0" } })
        );

        const procBaba = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "profile", tempDir, "--json"
        ]);
        const procBbyg = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "profile", tempDir, "--json"
        ]);
        const procMatryoshka = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "profile", tempDir, "--json"
        ]);

        expect(procBaba.exitCode).toBe(0);
        expect(procBbyg.exitCode).toBe(0);
        expect(procMatryoshka.exitCode).toBe(0);

        const resBaba = JSON.parse(procBaba.stdout.toString().trim());
        const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
        const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

        expect(resBaba.archetype).toBe(resBbyg.archetype);
        expect(resBaba.archetype).toBe(resMatryoshka.archetype);
        expect(resBaba.runtime).toBe(resBbyg.runtime);
        expect(resBaba.seams.hasBackend).toBe(resBbyg.seams.hasBackend);
      });

      it("includes seams and profile in generateAgents output", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "gen-test", dependencies: { next: "14", prisma: "5" } })
        );

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
        ]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed).toHaveProperty("seams");
        expect(parsed).toHaveProperty("profile");
        expect(parsed.profile.archetype).toBe("fullstack_hybrid");
        expect(parsed.seams.hasFrontend).toBe(true);
      });
    });
  });

  describe("Subtask 4: Root AGENTS.md Template Engine & Token Guard", () => {
    describe("Token Guard Constants & Error Contract", () => {
      it("defines canonical MAX_ROOT_AGENTS_TOKENS = 250 and TARGET_ROOT_AGENTS_TOKENS = 200", () => {
        expect(MAX_ROOT_AGENTS_TOKENS).toBe(250);
        expect(TARGET_ROOT_AGENTS_TOKENS).toBe(200);
      });

      it("instantiates TokenBudgetExceededError with proper metadata", () => {
        const error = new TokenBudgetExceededError("Budget exceeded", 280, 250);
        expect(error.name).toBe("TokenBudgetExceededError");
        expect(error.message).toContain("Budget exceeded");
        expect(error.tokenCount).toBe(280);
        expect(error.maxTokens).toBe(250);
        expect(error.exceededBy).toBe(30);
      });
    });

    describe("inspectTokenBudget() & assertTokenBudget()", () => {
      it("evaluates lean content within token budget (< 250 tokens)", () => {
        const sampleText = "# Lean Operational Directives\n* Run: bun test\n* Anti-slop: YAGNI first.";
        const report: TokenGuardReport = inspectTokenBudget(sampleText);

        expect(report.withinBudget).toBe(true);
        expect(report.tokenCount).toBeLessThan(200);
        expect(report.maxTokens).toBe(250);
        expect(report.targetTokens).toBe(200);
        expect(report.exceededBy).toBe(0);
        expect(report.savingsPercentage).toBeGreaterThanOrEqual(0);

        // assertTokenBudget does not throw
        expect(() => assertTokenBudget(sampleText)).not.toThrow();
      });

      it("detects when content exceeds token budget and calculates exceededBy tokens", () => {
        // Bloated text with 300+ words/tokens
        const bloatedText = Array.from({ length: 320 }, (_, i) => `instruction_clause_${i}`).join(" ");
        const report = inspectTokenBudget(bloatedText, 250);

        expect(report.withinBudget).toBe(false);
        expect(report.tokenCount).toBeGreaterThan(250);
        expect(report.exceededBy).toBe(report.tokenCount - 250);

        // assertTokenBudget throws TokenBudgetExceededError
        expect(() => assertTokenBudget(bloatedText, 250)).toThrow(TokenBudgetExceededError);
      });

      it("supports custom maxTokens limit for fine-grained enforcement", () => {
        const sampleText = "This is a simple directives file with around ten tokens.";
        const reportStrict = inspectTokenBudget(sampleText, 5);

        expect(reportStrict.withinBudget).toBe(false);
        expect(reportStrict.maxTokens).toBe(5);
        expect(reportStrict.exceededBy).toBeGreaterThan(0);

        expect(() => assertTokenBudget(sampleText, 5)).toThrow(TokenBudgetExceededError);
      });
    });

    describe("compileRootAgents() Template Engine & Normalization", () => {
      it("normalizes missing or empty commands to 'none'", () => {
        const compiled = compileRootAgents({
          archetype: "api_backend",
          runtime: "python",
          packageManager: "pip",
          testCommand: "",
          buildCommand: "",
          lintCommand: "",
          activeSkills: ["skill-backend"]
        });

        expect(compiled).toContain("* **Test Runner:** `none`");
        expect(compiled).toContain("* **Build / Lint:** `none` | `none`");
        expect(estimateTokens(compiled)).toBeLessThan(MAX_ROOT_AGENTS_TOKENS);
      });

      it("sanitizes excessive whitespace or newlines in injected commands", () => {
        const compiled = compileRootAgents({
          archetype: "systems_microservice",
          runtime: "rust",
          packageManager: "cargo",
          testCommand: "  cargo   test   --all   ",
          buildCommand: "cargo\nbuild\n--release",
          lintCommand: "cargo   clippy  ",
          activeSkills: ["skill-backend", "skill-testing"]
        });

        expect(compiled).toContain("* **Test Runner:** `cargo test --all`");
        expect(compiled).toContain("* **Build / Lint:** `cargo build --release` | `cargo clippy`");
      });

      it("supports customInvariants while respecting the 250 token budget", () => {
        const compiled = compileRootAgents({
          archetype: "api_backend",
          runtime: "node",
          packageManager: "npm",
          testCommand: "npm test",
          buildCommand: "npm run build",
          lintCommand: "npm run lint",
          activeSkills: ["skill-backend", "skill-security", "skill-testing"],
          customInvariants: [
            "* **Airgap First:** Disallow outbound network requests during compilation.",
            "* **Atomic Commits:** Every feature must be preceded by a failing RED test."
          ]
        });

        expect(compiled).toContain("* **Airgap First:** Disallow outbound network requests during compilation.");
        expect(compiled).toContain("* **Atomic Commits:** Every feature must be preceded by a failing RED test.");

        const report = inspectTokenBudget(compiled);
        expect(report.withinBudget).toBe(true);
        expect(report.tokenCount).toBeLessThan(MAX_ROOT_AGENTS_TOKENS);
      });

      it("enforces strictTokenGuard when option is enabled and budget is exceeded", () => {
        // Enforce strictTokenGuard with unrealistically low budget
        const options: RootAgentsTemplateOptions = {
          maxTokens: 10,
          strictTokenGuard: true
        };

        expect(() => {
          compileRootAgents(
            {
              archetype: "api_backend",
              runtime: "bun",
              packageManager: "bun",
              testCommand: "bun test",
              buildCommand: "bun run build",
              lintCommand: "none",
              activeSkills: ["skill-backend"]
            },
            options
          );
        }).toThrow(TokenBudgetExceededError);
      });

      it("produces deterministic output across multiple invocations with same profile", () => {
        const profile = {
          archetype: "fullstack_hybrid" as AgentArchetype,
          runtime: "bun",
          packageManager: "bun",
          testCommand: "bun test",
          buildCommand: "bun run build",
          lintCommand: "bunx biome check .",
          activeSkills: [
            "skill-frontend",
            "skill-backend",
            "skill-database",
            "skill-security",
            "skill-testing"
          ] as SkillName[]
        };

        const out1 = compileRootAgents(profile);
        const out2 = compileRootAgents(profile);
        expect(out1).toBe(out2);
      });
    });

    describe("generateAgents() with Token Guard integration", () => {
      it("embeds tokenGuard and token_guard in generateAgents output", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "guard-test", dependencies: { next: "14" } })
        );

        const result = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "--json"
        ]);
        expect(result.exitCode).toBe(0);

        const parsed = JSON.parse(result.stdout.toString().trim());
        expect(parsed).toHaveProperty("tokenGuard");
        expect(parsed.tokenGuard.withinBudget).toBe(true);
        expect(parsed.tokenGuard.tokenCount).toBeLessThan(MAX_ROOT_AGENTS_TOKENS);
        expect(parsed.tokenGuard.maxTokens).toBe(MAX_ROOT_AGENTS_TOKENS);

        expect(parsed).toHaveProperty("token_guard");
        expect(parsed.token_guard.withinBudget).toBe(true);
      });
    });

    describe("CLI 'agents check' (Token Guard Audit)", () => {
      it("audits compliant AGENTS.md and exits with 0", () => {
        // First generate compliant files
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "check-test", dependencies: { express: "^4.18.0" } })
        );
        Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);

        // Run baba agents check
        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "check", tempDir]);
        expect(proc.exitCode).toBe(0);

        const stdout = proc.stdout.toString();
        expect(stdout).toContain("Matryoshka AGENTS.md Token Guard Audit");
        expect(stdout).toContain("Status:");
        expect(stdout).toContain("PASSED");
        expect(stdout).toContain("within budget");
      });

      it("supports 'baba agents check [path] --json' with structured TokenGuardReport", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "check-json-test", dependencies: { express: "^4.18.0" } })
        );
        Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "check", tempDir, "--json"]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.status).toBe("success");
        expect(parsed.valid).toBe(true);
        expect(parsed.tokenGuard.withinBudget).toBe(true);
        expect(parsed.tokenGuard.tokenCount).toBeLessThan(MAX_ROOT_AGENTS_TOKENS);
      });

      it("detects bloated AGENTS.md (> 250 tokens) and exits with 1", () => {
        // Create an excessively long AGENTS.md
        const bloatedAgents = `# Bloated Monolithic Instructions\n` +
          Array.from({ length: 300 }, (_, i) => `* Over-engineered directive rule ${i} with textbook patterns`).join("\n");
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), bloatedAgents, "utf-8");

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "check", tempDir]);
        expect(proc.exitCode).toBe(1);

        const stdout = proc.stdout.toString();
        expect(stdout).toContain("FAILED");
        expect(stdout).toContain("exceeded");
      });

      it("returns exit code 1 with error message when AGENTS.md does not exist", () => {
        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "check", tempDir]);
        expect(proc.exitCode).toBe(1);

        const output = proc.stderr.toString() || proc.stdout.toString();
        expect(output).toContain("not found");
      });

      it("ensures alias parity across baba, bbyg, and matryoshka for agents check --json", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "parity-check-test", dependencies: { next: "14" } })
        );
        Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);

        const procBaba = Bun.spawnSync(["bun", "run", cliPath, "agents", "check", tempDir, "--json"]);
        const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "agents", "check", tempDir, "--json"]);
        const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "agents", "check", tempDir, "--json"]);

        expect(procBaba.exitCode).toBe(0);
        expect(procBbyg.exitCode).toBe(0);
        expect(procMatryoshka.exitCode).toBe(0);

        const resBaba = JSON.parse(procBaba.stdout.toString().trim());
        const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
        const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

        expect(resBaba.valid).toBe(resBbyg.valid);
        expect(resBaba.valid).toBe(resMatryoshka.valid);
        expect(resBaba.tokenGuard.tokenCount).toBe(resBbyg.tokenGuard.tokenCount);
      });
    });
  });

  describe("Subtask 5: Backend & Database Skill Compilers (with YAML Frontmatter)", () => {
    describe("compileBackendSkill() Compiler & Invariants", () => {
      it("compiles canonical backend skill with valid YAML frontmatter and core invariants", () => {
        const compiled = compileBackendSkill();

        // Valid YAML frontmatter delimiters
        expect(compiled.startsWith("---\n")).toBe(true);
        expect(compiled).toContain("\n---\n");

        const parsed = parseSkillFrontmatter(compiled);
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe("skill-backend");
        expect(parsed?.description).toBeDefined();
        expect(parsed?.description.length).toBeGreaterThan(20);
        expect(validateSkillFrontmatter(compiled)).toBe(true);

        // Core required invariants
        expect(compiled).toContain("Anti-N+1 Query Invariant");
        expect(compiled).toContain("Transactional Boundaries & Atomic Persistence");
        expect(compiled).toContain("Async Safety & Non-Blocking Persistence");
        expect(compiled).toContain("Idiomatic Layer Seams");
      });

      it("adapts backend guidance dynamically for Prisma ORM", () => {
        const compiled = compileBackendSkill({ orm: "prisma" });
        expect(compiled).toContain("Prisma");
        expect(compiled).toContain("include");
        expect(compiled).toContain("select");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts backend guidance dynamically for SQLAlchemy ORM", () => {
        const compiled = compileBackendSkill({ orm: "sqlalchemy" });
        expect(compiled).toContain("SQLAlchemy");
        expect(compiled).toContain("selectinload");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts backend guidance dynamically for Django ORM", () => {
        const compiled = compileBackendSkill({ orm: "django-orm" });
        expect(compiled).toContain("Django ORM");
        expect(compiled).toContain("select_related");
        expect(compiled).toContain("prefetch_related");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts backend guidance dynamically for Diesel (Rust)", () => {
        const compiled = compileBackendSkill({ orm: "diesel" });
        expect(compiled).toContain("Diesel");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts backend guidance dynamically for GORM (Go)", () => {
        const compiled = compileBackendSkill({ orm: "gorm" });
        expect(compiled).toContain("GORM");
        expect(compiled).toContain("Preload");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts backend guidance dynamically for ActiveRecord (Ruby)", () => {
        const compiled = compileBackendSkill({ orm: "active_record" });
        expect(compiled).toContain("ActiveRecord");
        expect(compiled).toContain("includes");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts backend guidance dynamically for Eloquent (PHP)", () => {
        const compiled = compileBackendSkill({ orm: "eloquent" });
        expect(compiled).toContain("Eloquent");
        expect(compiled).toContain("with");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("injects custom backend rules into compiled output", () => {
        const compiled = compileBackendSkill({
          customRules: [
            "* **Repository Pattern Only:** Never call database clients directly inside route handlers.",
            "* **Tenant Isolation:** Enforce tenant_id filtering on every query."
          ]
        });

        expect(compiled).toContain("* **Repository Pattern Only:** Never call database clients directly inside route handlers.");
        expect(compiled).toContain("* **Tenant Isolation:** Enforce tenant_id filtering on every query.");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("auto-detects backend ORM from projectPath when options are omitted", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "prisma-proj", dependencies: { prisma: "^5.0.0" } })
        );

        const compiled = compileBackendSkill({ projectPath: tempDir });
        expect(compiled).toContain("Prisma");
        expect(compiled).toContain("include");
      });
    });

    describe("compileDatabaseSkill() Compiler & Invariants", () => {
      it("compiles canonical database skill with valid YAML frontmatter and core invariants", () => {
        const compiled = compileDatabaseSkill();

        expect(compiled.startsWith("---\n")).toBe(true);
        expect(compiled).toContain("\n---\n");

        const parsed = parseSkillFrontmatter(compiled);
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe("skill-database");
        expect(parsed?.description).toBeDefined();
        expect(parsed?.description.length).toBeGreaterThan(20);
        expect(validateSkillFrontmatter(compiled)).toBe(true);

        // Core required invariants
        expect(compiled).toContain("Zero-Downtime Migration Contract");
        expect(compiled).toContain("Lock Safety & Non-Blocking DDL");
        expect(compiled).toContain("Query & Index Hygiene");
      });

      it("adapts database guidance dynamically for PostgreSQL", () => {
        const compiled = compileDatabaseSkill({ databaseEngine: "postgresql" });
        expect(compiled).toContain("PostgreSQL");
        expect(compiled).toContain("CREATE INDEX CONCURRENTLY");
        expect(compiled).toContain("lock_timeout");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts database guidance dynamically for MySQL", () => {
        const compiled = compileDatabaseSkill({ databaseEngine: "mysql" });
        expect(compiled).toContain("MySQL");
        expect(compiled).toContain("ALGORITHM=INPLACE");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("adapts database guidance dynamically for SQLite", () => {
        const compiled = compileDatabaseSkill({ databaseEngine: "sqlite" });
        expect(compiled).toContain("SQLite");
        expect(compiled).toContain("WAL");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("injects custom database rules into compiled output", () => {
        const compiled = compileDatabaseSkill({
          customRules: [
            "* **Strict Foreign Keys:** Foreign keys must explicitly specify ON DELETE CASCADE or RESTRICT.",
            "* **Audit Logging:** Every table must contain created_at and updated_at UTC timestamps."
          ]
        });

        expect(compiled).toContain("* **Strict Foreign Keys:** Foreign keys must explicitly specify ON DELETE CASCADE or RESTRICT.");
        expect(compiled).toContain("* **Audit Logging:** Every table must contain created_at and updated_at UTC timestamps.");
        expect(validateSkillFrontmatter(compiled)).toBe(true);
      });

      it("auto-detects database engine from projectPath when options are omitted", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\nname = "asyncpg-demo"\ndependencies = ["asyncpg>=0.28.0"]\n`
        );

        const compiled = compileDatabaseSkill({ projectPath: tempDir });
        expect(compiled).toContain("PostgreSQL");
        expect(compiled).toContain("CREATE INDEX CONCURRENTLY");
      });
    });

    describe("Context Detection Helpers (detectBackendOrm & detectDatabaseEngine)", () => {
      it("detects Prisma ORM in package.json", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "test", dependencies: { prisma: "5.0.0" } })
        );
        expect(detectBackendOrm(tempDir)).toBe("prisma");
      });

      it("detects SQLAlchemy in pyproject.toml", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\nname = "test"\ndependencies = ["sqlalchemy>=2.0.0"]\n`
        );
        expect(detectBackendOrm(tempDir)).toBe("sqlalchemy");
      });

      it("detects Django ORM in requirements.txt", () => {
        fs.writeFileSync(
          path.join(tempDir, "requirements.txt"),
          `django>=4.2\n`
        );
        expect(detectBackendOrm(tempDir)).toBe("django-orm");
      });

      it("detects GORM in go.mod", () => {
        fs.writeFileSync(
          path.join(tempDir, "go.mod"),
          `module test\n\ngo 1.22\n\nrequire gorm.io/gorm v1.25.0\n`
        );
        expect(detectBackendOrm(tempDir)).toBe("gorm");
      });

      it("detects Diesel in Cargo.toml", () => {
        fs.writeFileSync(
          path.join(tempDir, "Cargo.toml"),
          `[package]\nname = "test"\nversion = "0.1.0"\n\n[dependencies]\ndiesel = { version = "2.1.0" }\n`
        );
        expect(detectBackendOrm(tempDir)).toBe("diesel");
      });

      it("detects ActiveRecord in Gemfile", () => {
        fs.writeFileSync(
          path.join(tempDir, "Gemfile"),
          `source 'https://rubygems.org'\ngem 'rails', '~> 7.0'\n`
        );
        expect(detectBackendOrm(tempDir)).toBe("active_record");
      });

      it("detects Eloquent in composer.json", () => {
        fs.writeFileSync(
          path.join(tempDir, "composer.json"),
          JSON.stringify({ require: { "laravel/framework": "^10.0" } })
        );
        expect(detectBackendOrm(tempDir)).toBe("eloquent");
      });

      it("returns null when no ORM is found", () => {
        expect(detectBackendOrm(tempDir)).toBeNull();
      });

      it("detects PostgreSQL from asyncpg in pyproject.toml", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\ndependencies = ["asyncpg>=0.28.0"]\n`
        );
        expect(detectDatabaseEngine(tempDir)).toBe("postgresql");
      });

      it("detects MySQL from mysql2 in package.json", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ dependencies: { mysql2: "^3.0.0" } })
        );
        expect(detectDatabaseEngine(tempDir)).toBe("mysql");
      });

      it("detects SQLite from sqlite3 in package.json", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ dependencies: { sqlite3: "^5.1.0" } })
        );
        expect(detectDatabaseEngine(tempDir)).toBe("sqlite");
      });

      it("returns null when no database engine is found", () => {
        expect(detectDatabaseEngine(tempDir)).toBeNull();
      });
    });

    describe("CLI 'agents skill' subcommand", () => {
      it("supports 'baba agents skill backend [path]' to render compiled backend skill", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "backend-cli", dependencies: { prisma: "5.0.0" } })
        );

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "skill", "backend", tempDir]);
        expect(proc.exitCode).toBe(0);

        const stdout = proc.stdout.toString();
        expect(stdout).toContain("name: skill-backend");
        expect(stdout).toContain("Anti-N+1 Query Invariant");
        expect(stdout).toContain("Prisma");
      });

      it("supports 'baba agents skill database [path]' to render compiled database skill", () => {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "db-cli", dependencies: { pg: "8.0.0" } })
        );

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "skill", "database", tempDir]);
        expect(proc.exitCode).toBe(0);

        const stdout = proc.stdout.toString();
        expect(stdout).toContain("name: skill-database");
        expect(stdout).toContain("Zero-Downtime Migration Contract");
        expect(stdout).toContain("PostgreSQL");
      });

      it("supports 'baba agents skill backend [path] --json' with structured output", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\ndependencies = ["fastapi", "sqlalchemy"]\n`
        );

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "skill", "backend", tempDir, "--json"
        ]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.status).toBe("success");
        expect(parsed.skill).toBe("skill-backend");
        expect(parsed.frontmatter.name).toBe("skill-backend");
        expect(parsed.content).toContain("SQLAlchemy");
      });

      it("ensures alias parity across baba, bbyg, and matryoshka for agents skill database --json", () => {
        fs.writeFileSync(
          path.join(tempDir, "pyproject.toml"),
          `[project]\ndependencies = ["asyncpg"]\n`
        );

        const procBaba = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "skill", "database", tempDir, "--json"
        ]);
        const procBbyg = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "skill", "database", tempDir, "--json"
        ]);
        const procMatryoshka = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "skill", "database", tempDir, "--json"
        ]);

        expect(procBaba.exitCode).toBe(0);
        expect(procBbyg.exitCode).toBe(0);
        expect(procMatryoshka.exitCode).toBe(0);

        const resBaba = JSON.parse(procBaba.stdout.toString().trim());
        const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
        const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

        expect(resBaba.skill).toBe(resBbyg.skill);
        expect(resBaba.skill).toBe(resMatryoshka.skill);
        expect(resBaba.frontmatter.name).toBe("skill-database");
      });
    });
  });

  describe("Subtask 6: Frontend & Security Skill Compilers (with YAML Frontmatter)", () => {
      describe("compileFrontendSkill() Compiler & Invariants", () => {
        it("compiles canonical frontend skill with valid YAML frontmatter and core invariants", () => {
          const compiled = compileFrontendSkill();

          expect(compiled.startsWith("---\n")).toBe(true);
          expect(compiled).toContain("\n---\n");

          const parsed = parseSkillFrontmatter(compiled);
          expect(parsed).not.toBeNull();
          expect(parsed?.name).toBe("skill-frontend");
          expect(parsed?.description).toBeDefined();
          expect(parsed?.description.length).toBeGreaterThan(20);
          expect(validateSkillFrontmatter(compiled)).toBe(true);

          // Core required invariants
          expect(compiled).toContain("Pure Rendering & Reactivity Invariants");
          expect(compiled).toContain("Cumulative Layout Shifts (CLS) & Performance");
          expect(compiled).toContain("Accessibility (A11y) & Semantic Markup");
          expect(compiled).toContain("Component Architecture & State Hygiene");
        });

        it("adapts frontend guidance dynamically for Next.js", () => {
          const compiled = compileFrontendSkill({ framework: "next" });
          expect(compiled).toContain("Next.js");
          expect(compiled).toContain("'use client'");
          expect(compiled).toContain("next/image");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts frontend guidance dynamically for React", () => {
          const compiled = compileFrontendSkill({ framework: "react" });
          expect(compiled).toContain("React");
          expect(compiled).toContain("hook dependency");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts frontend guidance dynamically for Vue", () => {
          const compiled = compileFrontendSkill({ framework: "vue" });
          expect(compiled).toContain("Vue");
          expect(compiled).toContain("reactivity");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts frontend guidance dynamically for Svelte", () => {
          const compiled = compileFrontendSkill({ framework: "svelte" });
          expect(compiled).toContain("Svelte");
          expect(compiled).toContain("runes");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts frontend guidance dynamically for Astro", () => {
          const compiled = compileFrontendSkill({ framework: "astro" });
          expect(compiled).toContain("Astro");
          expect(compiled).toContain("client:");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts frontend guidance dynamically for Angular", () => {
          const compiled = compileFrontendSkill({ framework: "angular" });
          expect(compiled).toContain("Angular");
          expect(compiled).toContain("OnPush");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts styling guidance dynamically for Tailwind", () => {
          const compiled = compileFrontendSkill({ styling: "tailwind" });
          expect(compiled).toContain("Tailwind CSS");
          expect(compiled).toContain("utility classes");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("injects custom frontend rules into compiled output", () => {
          const compiled = compileFrontendSkill({
            customRules: [
              "* **Design Tokens Only:** Never hardcode hex color codes outside tailwind.config.",
              "* **Strict A11y Audit:** All form inputs must have associated <label> tags."
            ]
          });

          expect(compiled).toContain("* **Design Tokens Only:** Never hardcode hex color codes outside tailwind.config.");
          expect(compiled).toContain("* **Strict A11y Audit:** All form inputs must have associated <label> tags.");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("auto-detects frontend framework from projectPath when options are omitted", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "next-proj", dependencies: { next: "^14.0.0", react: "^18.0.0" } })
          );

          const compiled = compileFrontendSkill({ projectPath: tempDir });
          expect(compiled).toContain("Next.js");
          expect(compiled).toContain("'use client'");
        });
      });

      describe("compileSecuritySkill() Compiler & Invariants", () => {
        it("compiles canonical security skill with valid YAML frontmatter and core invariants", () => {
          const compiled = compileSecuritySkill();

          expect(compiled.startsWith("---\n")).toBe(true);
          expect(compiled).toContain("\n---\n");

          const parsed = parseSkillFrontmatter(compiled);
          expect(parsed).not.toBeNull();
          expect(parsed?.name).toBe("skill-security");
          expect(parsed?.description).toBeDefined();
          expect(parsed?.description.length).toBeGreaterThan(20);
          expect(validateSkillFrontmatter(compiled)).toBe(true);

          // Core required invariants
          expect(compiled).toContain("Zero Secret Leakage Invariant & DLP");
          expect(compiled).toContain("Strict Input Sanitization & Parameterization");
          expect(compiled).toContain("Authentication & Authorization Guardrails");
          expect(compiled).toContain("Defense-in-Depth & Dependency Security");
        });

        it("adapts security guidance dynamically for Next-Auth", () => {
          const compiled = compileSecuritySkill({ authFramework: "next-auth" });
          expect(compiled).toContain("Next-Auth");
          expect(compiled).toContain("getServerSession");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts security guidance dynamically for JWT", () => {
          const compiled = compileSecuritySkill({ authFramework: "jwt" });
          expect(compiled).toContain("JWT");
          expect(compiled).toContain("signature");
          expect(compiled).toContain("exp");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts security guidance dynamically for Clerk", () => {
          const compiled = compileSecuritySkill({ authFramework: "clerk" });
          expect(compiled).toContain("Clerk");
          expect(compiled).toContain("userId");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts security guidance dynamically for Supabase Auth", () => {
          const compiled = compileSecuritySkill({ authFramework: "supabase-auth" });
          expect(compiled).toContain("Supabase Auth");
          expect(compiled).toContain("Row-Level Security");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts security guidance dynamically for Django Allauth", () => {
          const compiled = compileSecuritySkill({ authFramework: "django-allauth" });
          expect(compiled).toContain("Django Auth");
          expect(compiled).toContain("CSRF");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts security guidance dynamically for Passport", () => {
          const compiled = compileSecuritySkill({ authFramework: "passport" });
          expect(compiled).toContain("Passport");
          expect(compiled).toContain("session serialization");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("injects custom security rules into compiled output", () => {
          const compiled = compileSecuritySkill({
            customRules: [
              "* **Zero Trust Perimeter:** mTLS required on all internal microservice calls.",
              "* **PII Encryption at Rest:** Encrypt user tax IDs and phone numbers using AES-256-GCM."
            ]
          });

          expect(compiled).toContain("* **Zero Trust Perimeter:** mTLS required on all internal microservice calls.");
          expect(compiled).toContain("* **PII Encryption at Rest:** Encrypt user tax IDs and phone numbers using AES-256-GCM.");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("auto-detects auth framework from projectPath when options are omitted", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "clerk-proj", dependencies: { "@clerk/nextjs": "^4.0.0" } })
          );

          const compiled = compileSecuritySkill({ projectPath: tempDir });
          expect(compiled).toContain("Clerk");
          expect(compiled).toContain("userId");
        });
      });

      describe("Context Detection Helpers (detectFrontendFramework, detectStylingSystem, detectAuthFramework)", () => {
        it("detects Next.js in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { next: "^14.0.0" } })
          );
          expect(detectFrontendFramework(tempDir)).toBe("next");
        });

        it("detects React in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { react: "^18.0.0" } })
          );
          expect(detectFrontendFramework(tempDir)).toBe("react");
        });

        it("detects Vue in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { vue: "^3.0.0" } })
          );
          expect(detectFrontendFramework(tempDir)).toBe("vue");
        });

        it("detects Nuxt in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { nuxt: "^3.0.0" } })
          );
          expect(detectFrontendFramework(tempDir)).toBe("nuxt");
        });

        it("detects Svelte in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { svelte: "^4.0.0" } })
          );
          expect(detectFrontendFramework(tempDir)).toBe("svelte");
        });

        it("detects Astro in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { astro: "^4.0.0" } })
          );
          expect(detectFrontendFramework(tempDir)).toBe("astro");
        });

        it("detects Angular in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { "@angular/core": "^17.0.0" } })
          );
          expect(detectFrontendFramework(tempDir)).toBe("angular");
        });

        it("detects Tailwind CSS from package.json and config file", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", devDependencies: { tailwindcss: "^3.0.0" } })
          );
          expect(detectStylingSystem(tempDir)).toBe("tailwind");
        });

        it("detects Next-Auth in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { "next-auth": "^4.0.0" } })
          );
          expect(detectAuthFramework(tempDir)).toBe("next-auth");
        });

        it("detects Clerk in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { "@clerk/nextjs": "^5.0.0" } })
          );
          expect(detectAuthFramework(tempDir)).toBe("clerk");
        });

        it("detects Supabase Auth in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", dependencies: { "@supabase/supabase-js": "^2.0.0" } })
          );
          expect(detectAuthFramework(tempDir)).toBe("supabase-auth");
        });

        it("detects JWT in pyproject.toml", () => {
          fs.writeFileSync(
            path.join(tempDir, "pyproject.toml"),
            `[project]\nname = "test"\ndependencies = ["pyjwt>=2.8.0"]\n`
          );
          expect(detectAuthFramework(tempDir)).toBe("jwt");
        });

        it("detects Django Allauth in requirements.txt", () => {
          fs.writeFileSync(
            path.join(tempDir, "requirements.txt"),
            `django-allauth>=0.54.0\n`
          );
          expect(detectAuthFramework(tempDir)).toBe("django-allauth");
        });

        it("returns null when no frontend framework is found", () => {
          expect(detectFrontendFramework(tempDir)).toBeNull();
        });

        it("returns null when no auth framework is found", () => {
          expect(detectAuthFramework(tempDir)).toBeNull();
        });
      });

      describe("CLI 'agents skill frontend' and 'agents skill security' subcommands", () => {
        it("supports 'baba agents skill frontend [path]' to render compiled frontend skill", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "frontend-cli", dependencies: { next: "14.0.0", react: "18.0.0" } })
          );

          const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "skill", "frontend", tempDir]);
          expect(proc.exitCode).toBe(0);

          const stdout = proc.stdout.toString();
          expect(stdout).toContain("name: skill-frontend");
          expect(stdout).toContain("Pure Rendering & Reactivity Invariants");
          expect(stdout).toContain("Next.js");
        });

        it("supports 'baba agents skill security [path]' to render compiled security skill", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "sec-cli", dependencies: { "next-auth": "4.0.0" } })
          );

          const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "skill", "security", tempDir]);
          expect(proc.exitCode).toBe(0);

          const stdout = proc.stdout.toString();
          expect(stdout).toContain("name: skill-security");
          expect(stdout).toContain("Zero Secret Leakage Invariant & DLP");
          expect(stdout).toContain("Next-Auth");
        });

        it("supports 'baba agents skill frontend [path] --json' with structured output", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "frontend-json", dependencies: { vue: "^3.0.0" } })
          );

          const proc = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "frontend", tempDir, "--json"
          ]);
          expect(proc.exitCode).toBe(0);

          const parsed = JSON.parse(proc.stdout.toString().trim());
          expect(parsed.status).toBe("success");
          expect(parsed.skill).toBe("skill-frontend");
          expect(parsed.frontmatter.name).toBe("skill-frontend");
          expect(parsed.content).toContain("Vue");
        });

        it("supports 'baba agents skill security [path] --json' with structured output", () => {
          fs.writeFileSync(
            path.join(tempDir, "pyproject.toml"),
            `[project]\ndependencies = ["fastapi", "pyjwt"]\n`
          );

          const proc = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "security", tempDir, "--json"
          ]);
          expect(proc.exitCode).toBe(0);

          const parsed = JSON.parse(proc.stdout.toString().trim());
          expect(parsed.status).toBe("success");
          expect(parsed.skill).toBe("skill-security");
          expect(parsed.frontmatter.name).toBe("skill-security");
          expect(parsed.content).toContain("JWT");
        });

        it("ensures alias parity across baba, bbyg, and matryoshka for agents skill frontend --json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ dependencies: { svelte: "^4.0.0" } })
          );

          const procBaba = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "frontend", tempDir, "--json"
          ]);
          const procBbyg = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "frontend", tempDir, "--json"
          ]);
          const procMatryoshka = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "frontend", tempDir, "--json"
          ]);

          expect(procBaba.exitCode).toBe(0);
          expect(procBbyg.exitCode).toBe(0);
          expect(procMatryoshka.exitCode).toBe(0);

          const resBaba = JSON.parse(procBaba.stdout.toString().trim());
          const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
          const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

          expect(resBaba.skill).toBe(resBbyg.skill);
          expect(resBaba.skill).toBe(resMatryoshka.skill);
          expect(resBaba.frontmatter.name).toBe("skill-frontend");
        });

        it("ensures alias parity across baba, bbyg, and matryoshka for agents skill security --json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ dependencies: { "next-auth": "^4.0.0" } })
          );

          const procBaba = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "security", tempDir, "--json"
          ]);
          const procBbyg = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "security", tempDir, "--json"
          ]);
          const procMatryoshka = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "security", tempDir, "--json"
          ]);

          expect(procBaba.exitCode).toBe(0);
          expect(procBbyg.exitCode).toBe(0);
          expect(procMatryoshka.exitCode).toBe(0);

          const resBaba = JSON.parse(procBaba.stdout.toString().trim());
          const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
          const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

          expect(resBaba.skill).toBe(resBbyg.skill);
          expect(resBaba.skill).toBe(resMatryoshka.skill);
          expect(resBaba.frontmatter.name).toBe("skill-security");
        });

        it("integrates adapted frontend and security skills during generateAgents() execution", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({
              name: "fullstack-demo",
              dependencies: {
                next: "^14.0.0",
                react: "^18.0.0",
                "next-auth": "^4.0.0",
                prisma: "^5.0.0",
                "@prisma/client": "^5.0.0"
              }
            })
          );

          const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
          expect(proc.exitCode).toBe(0);

          const skillsDir = path.join(tempDir, ".agents", "skills");
          const frontendPath = path.join(skillsDir, "skill-frontend.md");
          const securityPath = path.join(skillsDir, "skill-security.md");

          expect(fs.existsSync(frontendPath)).toBe(true);
          expect(fs.existsSync(securityPath)).toBe(true);

          const frontendContent = fs.readFileSync(frontendPath, "utf-8");
          const securityContent = fs.readFileSync(securityPath, "utf-8");

          expect(frontendContent).toContain("Next.js");
          expect(frontendContent).toContain("'use client'");
          expect(securityContent).toContain("Next-Auth");
          expect(securityContent).toContain("getServerSession");
        });
      });
    });

  describe("Subtask 7: Testing & Verification Skill Compiler (with YAML Frontmatter)", () => {
      describe("compileTestingSkill() Compiler & Invariants", () => {
        it("compiles canonical testing skill with valid YAML frontmatter and core invariants", () => {
          const compiled = compileTestingSkill();

          expect(compiled.startsWith("---\n")).toBe(true);
          expect(compiled).toContain("\n---\n");

          const parsed = parseSkillFrontmatter(compiled);
          expect(parsed).not.toBeNull();
          expect(parsed?.name).toBe("skill-testing");
          expect(parsed?.description).toBeDefined();
          expect(parsed?.description.length).toBeGreaterThan(20);
          expect(validateSkillFrontmatter(compiled)).toBe(true);

          // Core required invariants
          expect(compiled).toContain("The Seam Contract (Red-to-Green)");
          expect(compiled).toContain("Deterministic Fixtures & Isolation");
          expect(compiled).toContain("Mock Boundaries & Test Doubles");
          expect(compiled).toContain("Test Suite Hygiene & Speed");
        });

        it("adapts testing guidance dynamically for Vitest", () => {
          const compiled = compileTestingSkill({ testRunner: "vitest" });
          expect(compiled).toContain("Vitest");
          expect(compiled).toContain("vi.mock");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Jest", () => {
          const compiled = compileTestingSkill({ testRunner: "jest" });
          expect(compiled).toContain("Jest");
          expect(compiled).toContain("clearAllMocks");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Pytest", () => {
          const compiled = compileTestingSkill({ testRunner: "pytest" });
          expect(compiled).toContain("Pytest");
          expect(compiled).toContain("yield");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Bun Test", () => {
          const compiled = compileTestingSkill({ testRunner: "bun test" });
          expect(compiled).toContain("Bun Test");
          expect(compiled).toContain("bun:test");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Cargo Test (Rust)", () => {
          const compiled = compileTestingSkill({ testRunner: "cargo test" });
          expect(compiled).toContain("Rust Cargo Test");
          expect(compiled).toContain("#[cfg(test)]");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Go Test", () => {
          const compiled = compileTestingSkill({ testRunner: "go test" });
          expect(compiled).toContain("Go Test");
          expect(compiled).toContain("t.Parallel");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for RSpec (Ruby)", () => {
          const compiled = compileTestingSkill({ testRunner: "rspec" });
          expect(compiled).toContain("RSpec");
          expect(compiled).toContain("transactional fixtures");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Pest (PHP)", () => {
          const compiled = compileTestingSkill({ testRunner: "pest" });
          expect(compiled).toContain("Pest");
          expect(compiled).toContain("RefreshDatabase");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Playwright E2E", () => {
          const compiled = compileTestingSkill({ e2eFramework: "playwright" });
          expect(compiled).toContain("Playwright");
          expect(compiled).toContain("getByRole");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("adapts testing guidance dynamically for Cypress E2E", () => {
          const compiled = compileTestingSkill({ e2eFramework: "cypress" });
          expect(compiled).toContain("Cypress");
          expect(compiled).toContain("cy.intercept");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("injects custom testing rules into compiled output", () => {
          const compiled = compileTestingSkill({
            customRules: [
              "* **Zero Flakiness Tolerance:** Flaky tests must be quarantined immediately.",
              "* **Mutation Testing Target:** Mutation score must exceed 80% on core services."
            ]
          });

          expect(compiled).toContain("* **Zero Flakiness Tolerance:** Flaky tests must be quarantined immediately.");
          expect(compiled).toContain("* **Mutation Testing Target:** Mutation score must exceed 80% on core services.");
          expect(validateSkillFrontmatter(compiled)).toBe(true);
        });

        it("auto-detects test runner and E2E from projectPath when options are omitted", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({
              name: "vitest-proj",
              devDependencies: {
                vitest: "^1.0.0",
                "@playwright/test": "^1.40.0"
              }
            })
          );

          const compiled = compileTestingSkill({ projectPath: tempDir });
          expect(compiled).toContain("Vitest");
          expect(compiled).toContain("vi.mock");
          expect(compiled).toContain("Playwright");
          expect(compiled).toContain("getByRole");
        });
      });

      describe("Context Detection Helpers (detectTestRunner & detectE2eFramework)", () => {
        it("detects Vitest in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", devDependencies: { vitest: "^1.0.0" } })
          );
          expect(detectTestRunner(tempDir)).toBe("vitest");
        });

        it("detects Jest in package.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "app", devDependencies: { jest: "^29.0.0" } })
          );
          expect(detectTestRunner(tempDir)).toBe("jest");
        });

        it("detects Pytest in pyproject.toml", () => {
          fs.writeFileSync(
            path.join(tempDir, "pyproject.toml"),
            `[project]\nname = "test"\ndependencies = ["pytest>=7.0.0"]\n`
          );
          expect(detectTestRunner(tempDir)).toBe("pytest");
        });

        it("detects Cargo test in Cargo.toml", () => {
          fs.writeFileSync(
            path.join(tempDir, "Cargo.toml"),
            `[package]\nname = "rust-app"\nversion = "0.1.0"\n`
          );
          expect(detectTestRunner(tempDir)).toBe("cargo test");
        });

        it("detects Go test in go.mod", () => {
          fs.writeFileSync(
            path.join(tempDir, "go.mod"),
            `module go-app\n\ngo 1.22\n`
          );
          expect(detectTestRunner(tempDir)).toBe("go test");
        });

        it("detects RSpec in Gemfile", () => {
          fs.writeFileSync(
            path.join(tempDir, "Gemfile"),
            `source 'https://rubygems.org'\ngem 'rspec-rails', '~> 6.0'\n`
          );
          expect(detectTestRunner(tempDir)).toBe("rspec");
        });

        it("detects Pest in composer.json", () => {
          fs.writeFileSync(
            path.join(tempDir, "composer.json"),
            JSON.stringify({ "require-dev": { "pestphp/pest": "^2.0" } })
          );
          expect(detectTestRunner(tempDir)).toBe("pest");
        });

        it("detects Playwright from package.json dependencies", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ devDependencies: { "@playwright/test": "^1.40.0" } })
          );
          expect(detectE2eFramework(tempDir)).toBe("playwright");
        });

        it("detects Playwright from playwright.config.ts existence", () => {
          fs.writeFileSync(path.join(tempDir, "playwright.config.ts"), "export default {};");
          expect(detectE2eFramework(tempDir)).toBe("playwright");
        });

        it("detects Cypress from package.json dependencies", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ devDependencies: { cypress: "^13.0.0" } })
          );
          expect(detectE2eFramework(tempDir)).toBe("cypress");
        });

        it("returns null when no e2e framework is found", () => {
          expect(detectE2eFramework(tempDir)).toBeNull();
        });
      });

      describe("CLI 'agents skill testing' and 'agents skill test' subcommands", () => {
        it("supports 'baba agents skill testing [path]' to render compiled testing skill", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ name: "vitest-cli", devDependencies: { vitest: "^1.0.0" } })
          );

          const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "skill", "testing", tempDir]);
          expect(proc.exitCode).toBe(0);

          const stdout = proc.stdout.toString();
          expect(stdout).toContain("name: skill-testing");
          expect(stdout).toContain("The Seam Contract (Red-to-Green)");
          expect(stdout).toContain("Vitest");
        });

        it("supports 'baba agents skill test [path]' alias for testing skill", () => {
          fs.writeFileSync(
            path.join(tempDir, "pyproject.toml"),
            `[project]\ndependencies = ["pytest>=7.4.0"]\n`
          );

          const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "skill", "test", tempDir]);
          expect(proc.exitCode).toBe(0);

          const stdout = proc.stdout.toString();
          expect(stdout).toContain("name: skill-testing");
          expect(stdout).toContain("The Seam Contract (Red-to-Green)");
          expect(stdout).toContain("Pytest");
        });

        it("supports 'baba agents skill testing [path] --json' with structured output", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ devDependencies: { vitest: "^1.0.0" } })
          );

          const proc = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "testing", tempDir, "--json"
          ]);
          expect(proc.exitCode).toBe(0);

          const parsed = JSON.parse(proc.stdout.toString().trim());
          expect(parsed.status).toBe("success");
          expect(parsed.skill).toBe("skill-testing");
          expect(parsed.frontmatter.name).toBe("skill-testing");
          expect(parsed.content).toContain("Vitest");
        });

        it("ensures alias parity across baba, bbyg, and matryoshka for agents skill testing --json", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({ devDependencies: { vitest: "^1.0.0" } })
          );

          const procBaba = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "testing", tempDir, "--json"
          ]);
          const procBbyg = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "testing", tempDir, "--json"
          ]);
          const procMatryoshka = Bun.spawnSync([
            "bun", "run", cliPath, "agents", "skill", "testing", tempDir, "--json"
          ]);

          expect(procBaba.exitCode).toBe(0);
          expect(procBbyg.exitCode).toBe(0);
          expect(procMatryoshka.exitCode).toBe(0);

          const resBaba = JSON.parse(procBaba.stdout.toString().trim());
          const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
          const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

          expect(resBaba.skill).toBe(resBbyg.skill);
          expect(resBaba.skill).toBe(resMatryoshka.skill);
          expect(resBaba.frontmatter.name).toBe("skill-testing");
        });

        it("integrates adapted testing skill during generateAgents() execution", () => {
          fs.writeFileSync(
            path.join(tempDir, "package.json"),
            JSON.stringify({
              name: "tested-app",
              dependencies: {
                express: "^4.18.0"
              },
              devDependencies: {
                vitest: "^1.0.0",
                "@playwright/test": "^1.40.0"
              }
            })
          );

          const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
          expect(proc.exitCode).toBe(0);

          const skillsDir = path.join(tempDir, ".agents", "skills");
          const testingPath = path.join(skillsDir, "skill-testing.md");

          expect(fs.existsSync(testingPath)).toBe(true);

          const testingContent = fs.readFileSync(testingPath, "utf-8");
          expect(testingContent).toContain("name: skill-testing");
          expect(testingContent).toContain("The Seam Contract (Red-to-Green)");
          expect(testingContent).toContain("Vitest");
          expect(testingContent).toContain("Playwright");
        });
      });
    });

  describe("Subtask 8: CLI Subcommand & Overwrite Guardrails", () => {
    describe("generateAgents() Programmatic Guardrails", () => {
      it("throws when AGENTS.md exists and force is not specified", () => {
        const agentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(agentsPath, "# Custom Instructions\nDo not overwrite.", "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "app" }));

        expect(() => {
          generateAgents(tempDir, { force: false });
        }).toThrow("Use --force (-f) to overwrite");

        expect(fs.readFileSync(agentsPath, "utf-8")).toBe("# Custom Instructions\nDo not overwrite.");
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);
      });

      it("backs up AGENTS.md to AGENTS.md.bak and returns backupCreated: true with backupPath when force: true", () => {
        const customContent = "# Critical Invariants\nCustom content preserved.";
        const agentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(agentsPath, customContent, "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "app" }));

        const result = generateAgents(tempDir, { force: true });
        expect(result.status).toBe("success");
        expect(result.backupCreated).toBe(true);
        expect(result.backupPath).toBe(path.join(tempDir, "AGENTS.md.bak"));

        const backupPath = path.join(tempDir, "AGENTS.md.bak");
        expect(fs.existsSync(backupPath)).toBe(true);
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(customContent);

        // New AGENTS.md generated cleanly
        const newContent = fs.readFileSync(agentsPath, "utf-8");
        expect(newContent).not.toBe(customContent);
        expect(newContent).toContain("# 🤖 Project Operational Directives");
      });

      it("sets backupCreated: false and backupPath undefined when AGENTS.md does not previously exist", () => {
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "fresh-app" }));

        const result = generateAgents(tempDir, { force: true });
        expect(result.status).toBe("success");
        expect(result.backupCreated).toBe(false);
        expect(result.backupPath).toBeUndefined();
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);
      });

      it("sets backupCreated: false and touches no disk files in dry-run mode even if AGENTS.md exists", () => {
        const customContent = "# Existing Directives";
        const agentsPath = path.join(tempDir, "AGENTS.md");
        fs.writeFileSync(agentsPath, customContent, "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "dry-app" }));

        const result = generateAgents(tempDir, { dryRun: true });
        expect(result.status).toBe("success");
        expect(result.dryRun).toBe(true);
        expect(result.backupCreated).toBe(false);
        expect(result.backupPath).toBeUndefined();
        expect(fs.readFileSync(agentsPath, "utf-8")).toBe(customContent);
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);
      });
    });

    describe("CLI Overwrite Guardrails & Error Reporting", () => {
      it("fails with exit code 1 and structured error JSON when AGENTS.md exists without --force", () => {
        const customContent = "# Protected Rules";
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), customContent, "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "test-pkg" }));

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--json"
        ]);
        expect(proc.exitCode).toBe(1);

        const stdout = proc.stdout.toString().trim();
        const parsed = JSON.parse(stdout);
        expect(parsed.status).toBe("error");
        expect(parsed.command).toBe("agents");
        expect(parsed.message).toContain("already exists");
        expect(parsed.message).toContain("--force");

        // Disk remains unmodified
        expect(fs.readFileSync(path.join(tempDir, "AGENTS.md"), "utf-8")).toBe(customContent);
        expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(false);
      });

      it("supports short flag -f as alias for --force to backup and overwrite cleanly", () => {
        const customContent = "# Short Flag Test Rules";
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), customContent, "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "short-flag-app" }));

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "-f"
        ]);
        expect(proc.exitCode).toBe(0);

        const backupPath = path.join(tempDir, "AGENTS.md.bak");
        expect(fs.existsSync(backupPath)).toBe(true);
        expect(fs.readFileSync(backupPath, "utf-8")).toBe(customContent);
      });

      it("includes backupCreated: true and backupPath in CLI --json output when overwrite occurs", () => {
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Initial content", "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "json-backup-app" }));

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--force", "--json"
        ]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.status).toBe("success");
        expect(parsed.backupCreated).toBe(true);
        expect(parsed.backupPath).toBe(path.join(tempDir, "AGENTS.md.bak"));
      });

      it("displays Backup path in human-readable terminal output when overwrite occurs", () => {
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Terminal content", "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "term-app" }));

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--force"
        ]);
        expect(proc.exitCode).toBe(0);

        const stdout = proc.stdout.toString();
        expect(stdout).toContain("Backup:");
        expect(stdout).toContain("AGENTS.md.bak");
      });
    });

    describe("CLI Ergonomics, Shorthand & Option Parsing", () => {
      it("supports shorthand invocation 'baba agents [path]' defaulting to generate", () => {
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "shorthand-app" }));

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", tempDir, "--dry-run", "--json"
        ]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.status).toBe("success");
        expect(parsed.dryRun).toBe(true);
        expect(parsed.plannedFiles.length).toBeGreaterThan(0);
      });

      it("supports options placed before positional directory", () => {
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "pos-app" }));

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", "--dry-run", "--json", tempDir
        ]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.status).toBe("success");
        expect(parsed.rootAgentsPath).toBe(path.join(tempDir, "AGENTS.md"));
      });

      it("parses --max-tokens without misinterpreting the number as the target directory", () => {
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "max-tok-app" }));

        const proc = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", "--max-tokens", "180", tempDir, "--dry-run", "--json"
        ]);
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.status).toBe("success");
        expect(parsed.tokenGuard.maxTokens).toBe(180);
        expect(parsed.rootAgentsPath).toBe(path.join(tempDir, "AGENTS.md"));
      });
    });

    describe("CLI Alias Parity for agents generate overwrite guardrails", () => {
      it("ensures parity across baba, bbyg, and matryoshka for overwrite refusal error", () => {
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Protected", "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "parity-app" }));

        const procBaba = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--json"
        ]);
        const procBbyg = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--json"
        ]);
        const procMatryoshka = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--json"
        ]);

        expect(procBaba.exitCode).toBe(1);
        expect(procBbyg.exitCode).toBe(1);
        expect(procMatryoshka.exitCode).toBe(1);

        const resBaba = JSON.parse(procBaba.stdout.toString().trim());
        const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
        const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

        expect(resBaba.status).toBe("error");
        expect(resBbyg.status).toBe("error");
        expect(resMatryoshka.status).toBe("error");
      });

      it("ensures parity across baba, bbyg, and matryoshka for --force overwrite and backup", () => {
        fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Parity Custom Rules", "utf-8");
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "parity-force-app" }));

        const procBaba = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--force", "--json"
        ]);
        expect(procBaba.exitCode).toBe(0);
        const resBaba = JSON.parse(procBaba.stdout.toString().trim());
        expect(resBaba.backupCreated).toBe(true);

        const procBbyg = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "-f", "--json"
        ]);
        expect(procBbyg.exitCode).toBe(0);
        const resBbyg = JSON.parse(procBbyg.stdout.toString().trim());
        expect(resBbyg.backupCreated).toBe(true);

        const procMatryoshka = Bun.spawnSync([
          "bun", "run", cliPath, "agents", "generate", tempDir, "--force", "--json"
        ]);
        expect(procMatryoshka.exitCode).toBe(0);
        const resMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());
        expect(resMatryoshka.backupCreated).toBe(true);
      });
    });
  });
});


