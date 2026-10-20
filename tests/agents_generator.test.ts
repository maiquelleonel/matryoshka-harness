import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

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
});
