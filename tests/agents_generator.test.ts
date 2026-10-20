import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  compileRootAgents,
  estimateTokens,
  parseSkillFrontmatter,
  validateSkillFrontmatter,
  buildSkillsMetadataIndex,
  loadSkillOnDemand,
  discoverSeams,
  profileArchetype,
  SKILL_DEFINITIONS,
  type AgentArchetype,
  type SkillName,
  type ArchetypeProfile,
  type DiscoveredSeams
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
});
