import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PassThrough } from "node:stream";
import {
  profileArchetype,
  generateAgents,
  type ArchetypeProfile,
  type SkillName
} from "../src/agents";
import {
  formatArchetypeProfileReview,
  runInteractiveSkillSelector,
  type InteractiveSelectorOptions
} from "../src/agents-tui";

describe("SPEC-26 Subtask 1: Review Detected Archetype & Stack Profile", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Archetype Profile Review Formatting", () => {
    it("formats a comprehensive, structured review of detected archetype and stack profile", () => {
      // Given a FastAPI backend project structure
      fs.writeFileSync(
        path.join(tempDir, "pyproject.toml"),
        `[project]
name = "fastapi-sample"
dependencies = [
    "fastapi>=0.100.0",
    "sqlalchemy>=2.0.0",
    "pytest>=7.0.0"
]
`
      );
      fs.mkdirSync(path.join(tempDir, "routes"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "routes", "users.py"), "def get_users(): pass");

      // When the profile is generated
      const profile = profileArchetype(tempDir);

      // Then formatArchetypeProfileReview renders all critical architectural seams and stack identity
      const review = formatArchetypeProfileReview(profile, tempDir);

      expect(review).toContain("Archetype:");
      expect(review).toContain("api_backend");
      expect(review).toContain("Runtime:");
      expect(review).toContain("python");
      expect(review).toContain("Test Runner:");
      expect(review).toContain("pytest");
      expect(review).toContain("Discovered Seams:");
      expect(review).toContain("Backend");
      expect(review).toContain("Recommended Skills:");
      expect(review).toContain("skill-backend");
      expect(review).toContain("skill-database");
      expect(review).toContain("skill-security");
      expect(review).toContain("skill-testing");
    });

    it("includes custom-instructions in available modular skills catalog", () => {
      const profile = profileArchetype(tempDir);
      const review = formatArchetypeProfileReview(profile, tempDir);

      expect(review).toContain("custom-instructions");
    });
  });

  describe("AC-2: Interactive Stack Review & Selection Runner", () => {
    it("renders stack profile review to the provided output stream", async () => {
      // Given a Node + Bun TypeScript repository
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "interactive-demo",
          scripts: { test: "bun test", build: "bun build" }
        })
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");

      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      // When running interactive selector and pressing Enter immediately (confirm defaults)
      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Simulate Enter key (\r)
      setTimeout(() => {
        stdin.write("\r");
      }, 50);

      const result = await selectorPromise;

      // Then the output must display the stack profile review
      expect(output).toContain("Archetype");
      expect(output).toContain("Runtime");
      expect(output).toContain("Interactive Skill Inspector");
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).toBeArray();
      expect(result.selectedSkills.length).toBeGreaterThan(0);
    });
  });

  describe("AC-3: Headless & Flag Parity", () => {
    it("supports --yes / -y flag to bypass interactive prompts in CLI", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "cli-yes-test",
          scripts: { test: "bun test" }
        })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--yes"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");

      const agentsPath = path.join(tempDir, "AGENTS.md");
      expect(fs.existsSync(agentsPath)).toBe(true);
    });

    it("displays --interactive and --yes in agents help across baba, bbyg, and matryoshka aliases", () => {
      for (const alias of ["baba", "bbyg", "matryoshka"]) {
        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "--help"], {
          env: { ...process.env, BABA_ALIAS: alias }
        });
        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();
        expect(stdout).toContain("--interactive");
        expect(stdout).toContain("-i");
        expect(stdout).toContain("--yes");
        expect(stdout).toContain("-y");
      }
    });

    it("executes in deterministic batch mode in headless non-TTY environment without hanging", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "ci-headless-test",
          scripts: { test: "bun test" }
        })
      );

      // In Bun.spawnSync, stdin is non-TTY, so it must execute directly
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });
  });
});
