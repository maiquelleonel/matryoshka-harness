import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PassThrough } from "node:stream";
import {
  profileArchetype,
  generateAgents,
  SKILL_DEFINITIONS,
  type ArchetypeProfile,
  type SkillName
} from "../src/agents";
import {
  formatArchetypeProfileReview,
  runInteractiveSkillSelector,
  MODULAR_SKILLS_CATALOG,
  calculateTokenFootprint,
  formatTokenFootprint,
  extractDontVsDoGuidelines,
  extractAllSelectedGuidelines,
  type InteractiveSelectorOptions,
  type TokenFootprintReport,
  type DontVsDoSummary
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
      expect(MODULAR_SKILLS_CATALOG.some(s => s.name === "custom-instructions")).toBe(true);
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

    it("allows toggling skills and previewing skill content before confirming", async () => {
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Inspect skill ('p'), then exit preview ('\r'), then confirm ('\r')
      setTimeout(() => {
        stdin.write("p");
      }, 30);
      setTimeout(() => {
        stdin.write("\r");
      }, 60);
      setTimeout(() => {
        stdin.write("\r");
      }, 90);

      const result = await selectorPromise;
      expect(output).toContain("Skill Preview:");
      expect(output).toContain("Estimated:");
      expect(result.confirmed).toBe(true);
    });

    it("persists only selected skills when generateAgents is supplied with selectedSkills", () => {
      // Given a repository with custom selected skills
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "selective-skills-app",
          scripts: { test: "bun test" }
        })
      );

      const selectedSkills: SkillName[] = ["skill-backend", "custom-instructions"];
      const result = generateAgents(tempDir, {
        selectedSkills,
        force: true
      });

      expect(result.status).toBe("success");
      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "custom-instructions.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-frontend.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-testing.md"))).toBe(false);

      const customContent = fs.readFileSync(path.join(skillsDir, "custom-instructions.md"), "utf-8");
      expect(customContent).toContain("name: custom-instructions");
      expect(customContent).toContain("description:");
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

    it("supports -y shorthand flag to bypass interactive prompts in CLI", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "cli-short-y-test",
          scripts: { test: "bun test" }
        })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "-y"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
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

describe("SPEC-26 Subtask 2: Selectively Toggle Specialized Skills Using Arrow Keys and Spacebar", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-subtask2-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Arrow Key Navigation and Cursor Movement", () => {
    it("navigates down and up using arrow keys (↓ / ↑)", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "nav-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Press Down arrow twice (\u001b[B), then Up arrow once (\u001b[A), then toggle space, then Enter
      // Initial items: 0: skill-backend (rec: true), 1: skill-database (rec: true), 2: skill-frontend (rec: false)...
      // Down -> index 1 (skill-database)
      // Down -> index 2 (skill-frontend)
      // Up -> index 1 (skill-database)
      // Space -> toggle skill-database (was true, now false)
      // Enter -> confirm
      setTimeout(() => stdin.write("\u001b[B"), 20);
      setTimeout(() => stdin.write("\u001b[B"), 40);
      setTimeout(() => stdin.write("\u001b[A"), 60);
      setTimeout(() => stdin.write(" "), 80);
      setTimeout(() => stdin.write("\r"), 100);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).not.toContain("skill-database");
      expect(result.selectedSkills).toContain("skill-backend");
      expect(result.items).toBeDefined();
      expect(result.items?.find(it => it.name === "skill-database")?.selected).toBe(false);
    });

    it("wraps around when moving up from index 0 and down from the last index", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "wrap-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // At index 0, Up arrow wraps to last item (custom-instructions, rec: false)
      // Space -> toggle custom-instructions ON
      // Enter -> confirm
      setTimeout(() => stdin.write("\u001b[A"), 20);
      setTimeout(() => stdin.write(" "), 40);
      setTimeout(() => stdin.write("\r"), 60);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).toContain("custom-instructions");
    });

    it("supports vim-style navigation keys (j / k) equivalently to arrow keys", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "vim-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Press 'j' (down to index 1), 'j' (down to index 2: skill-frontend), Space (toggle ON), 'k' (up to index 1), Enter
      setTimeout(() => stdin.write("j"), 20);
      setTimeout(() => stdin.write("j"), 40);
      setTimeout(() => stdin.write(" "), 60);
      setTimeout(() => stdin.write("\r"), 80);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).toContain("skill-frontend");
    });

    it("renders visual pointer ❯ on the active skill row", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "pointer-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      setTimeout(() => stdin.write("\u001b[B"), 20); // Move down
      setTimeout(() => stdin.write("\r"), 40);

      await selectorPromise;
      expect(output).toContain("❯");
      expect(output).toContain("Interactive Skills Checklist:");
    });
  });

  describe("AC-2: Selective Toggling via Spacebar", () => {
    it("toggles an initially recommended skill OFF using spacebar", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "toggle-off-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Cursor is at index 0 (skill-backend, which is recommended).
      // Press Space to toggle it OFF, then Enter.
      setTimeout(() => stdin.write(" "), 20);
      setTimeout(() => stdin.write("\r"), 40);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).not.toContain("skill-backend");
    });

    it("toggles an optional skill ON using spacebar", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "toggle-on-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Navigate down to index 2 (skill-frontend, optional in backend project)
      // Down, Down, Space (toggle ON), Enter
      setTimeout(() => stdin.write("\u001b[B"), 20);
      setTimeout(() => stdin.write("\u001b[B"), 40);
      setTimeout(() => stdin.write(" "), 60);
      setTimeout(() => stdin.write("\r"), 80);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).toContain("skill-frontend");
    });

    it("allows toggling multiple skills across different positions using arrow keys and spacebar", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "multi-toggle-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // 0: skill-backend (toggle OFF)
      // Down -> 1: skill-database (leave ON)
      // Down -> 2: skill-frontend (toggle ON)
      // Down -> 3: skill-security (toggle OFF)
      // Enter
      setTimeout(() => stdin.write(" "), 20);
      setTimeout(() => stdin.write("\u001b[B"), 40);
      setTimeout(() => stdin.write("\u001b[B"), 60);
      setTimeout(() => stdin.write(" "), 80);
      setTimeout(() => stdin.write("\u001b[B"), 100);
      setTimeout(() => stdin.write(" "), 120);
      setTimeout(() => stdin.write("\r"), 140);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).not.toContain("skill-backend");
      expect(result.selectedSkills).toContain("skill-database");
      expect(result.selectedSkills).toContain("skill-frontend");
      expect(result.selectedSkills).not.toContain("skill-security");
    });

    it("toggles all skills using 'a' key shortcut", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "toggle-all-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Press 'a' (some unselected, so selects all), then 'a' again (all selected, so deselects all),
      // then Space on current item (toggles index 0 ON), Enter
      setTimeout(() => stdin.write("a"), 20);
      setTimeout(() => stdin.write("a"), 40);
      setTimeout(() => stdin.write(" "), 60);
      setTimeout(() => stdin.write("\r"), 80);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).toEqual(["skill-backend"]);
    });

    it("reflects toggled state visually with ◉ (selected) and ◯ (unselected)", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "visual-toggle-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      setTimeout(() => stdin.write(" "), 20); // Toggle index 0 OFF
      setTimeout(() => stdin.write("\r"), 40);

      await selectorPromise;
      expect(output).toContain("◉");
      expect(output).toContain("◯");
    });
  });

  describe("AC-3: Selective Persistence and Cancellation", () => {
    it("persists strictly the selected skills after interactive toggling", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "persistence-test", scripts: { test: "bun test" } })
      );

      const selectedSkills: SkillName[] = ["skill-frontend", "custom-instructions"];
      const result = generateAgents(tempDir, {
        selectedSkills,
        force: true
      });

      expect(result.status).toBe("success");
      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-frontend.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "custom-instructions.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-database.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-security.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-testing.md"))).toBe(false);
    });

    it("persists no skill files when all skills are toggled off", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "empty-skills-test", scripts: { test: "bun test" } })
      );

      const result = generateAgents(tempDir, {
        selectedSkills: [],
        force: true
      });

      expect(result.status).toBe("success");
      const skillsDir = path.join(tempDir, ".agents", "skills");
      if (fs.existsSync(skillsDir)) {
        const files = fs.readdirSync(skillsDir);
        expect(files.filter(f => f.endsWith(".md")).length).toBe(0);
      }
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("aborts and returns confirmed: false when q or escape is pressed", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "abort-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      setTimeout(() => stdin.write("q"), 20);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(false);
      expect(result.selectedSkills).toEqual([]);
    });
  });
});

describe("SPEC-26 Subtask 3: Live-preview Generated Don't vs Do Guidelines and Token Footprint", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-subtask3-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Token Footprint Calculation and Live Preview", () => {
    it("calculates accurate token footprint for selected skills and root AGENTS.md", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "footprint-test" }));
      const profile = profileArchetype(tempDir);
      const selectedSkills: SkillName[] = ["skill-backend", "skill-database"];

      const footprint = calculateTokenFootprint(selectedSkills, {
        profile,
        projectPath: tempDir,
        tokenBudget: 2500,
      });

      expect(footprint.rootTokens).toBeGreaterThan(0);
      expect(footprint.skillsTokens["skill-backend"]).toBeGreaterThan(0);
      expect(footprint.skillsTokens["skill-database"]).toBeGreaterThan(0);
      expect(footprint.totalSkillsTokens).toBe(
        footprint.skillsTokens["skill-backend"] + footprint.skillsTokens["skill-database"]
      );
      expect(footprint.totalTokens).toBe(footprint.rootTokens + footprint.totalSkillsTokens);
      expect(footprint.selectedSkillsCount).toBe(2);
      expect(footprint.totalAvailableSkillsCount).toBe(6);
      expect(footprint.tokenBudget).toBe(2500);
      expect(footprint.budgetPercentage).toBeGreaterThan(0);
      expect(footprint.isWithinBudget).toBe(true);
      expect(footprint.savingsVsMonolithic.savedTokens).toBeGreaterThan(0);
    });

    it("formats live token footprint display with visual budget and FinOps breakdown", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "footprint-fmt-test" }));
      const profile = profileArchetype(tempDir);
      const selectedSkills: SkillName[] = ["skill-backend", "skill-security"];

      const footprint = calculateTokenFootprint(selectedSkills, {
        profile,
        projectPath: tempDir,
        tokenBudget: 2500,
      });

      const formatted = formatTokenFootprint(footprint);
      expect(formatted).toContain("Token Footprint");
      expect(formatted).toContain("Root AGENTS.md");
      expect(formatted).toContain("Selected Skills");
      expect(formatted).toContain("budget");
      expect(formatted).toContain("Within budget");
    });

    it("dynamically updates live token footprint in TUI as skills are toggled", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "live-footprint-tui-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Initially renders footprint
      // Press space to toggle skill-backend OFF (decreasing token footprint)
      // Press enter to confirm
      setTimeout(() => stdin.write(" "), 30);
      setTimeout(() => stdin.write("\r"), 60);

      const result = await selectorPromise;
      expect(output).toContain("Token Footprint");
      expect(result.footprint).toBeDefined();
      expect(result.footprint?.selectedSkillsCount).toBe(result.selectedSkills.length);
      expect(result.footprint?.totalTokens).toBeGreaterThan(0);
    });

    it("returns computed token footprint report in selector result upon confirmation", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "result-footprint-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true,
        initialSelectedSkills: ["skill-backend", "skill-testing"]
      });

      setTimeout(() => stdin.write("\r"), 30);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.footprint).toBeDefined();
      expect(result.footprint?.selectedSkillsCount).toBe(2);
      expect(result.footprint?.skillsTokens["skill-backend"]).toBeGreaterThan(0);
      expect(result.footprint?.skillsTokens["skill-testing"]).toBeGreaterThan(0);
    });
  });

  describe("AC-2: Don't vs Do Guidelines Extraction & Classification", () => {
    it("extracts and categorizes rules into DO and DON'T directives from skill markdown content", () => {
      const sampleSkill = `---
name: skill-sample
description: Sample skill
---
# Sample Skill

## 1. Safety Rules
* Never mutate shared state directly in background tasks.
* Avoid blocking synchronous calls in asynchronous workers.
* Always wrap database transactions in explicit try-catch blocks.
* Ensure all sensitive payloads are encrypted before persistence.
`;

      const summary = extractDontVsDoGuidelines(sampleSkill, "skill-sample");
      expect(summary.skillName).toBe("skill-sample");
      expect(summary.donts.length).toBe(2);
      expect(summary.donts.some(r => r.includes("Never mutate shared state"))).toBe(true);
      expect(summary.donts.some(r => r.includes("Avoid blocking synchronous"))).toBe(true);
      expect(summary.dos.length).toBe(2);
      expect(summary.dos.some(r => r.includes("Always wrap database transactions"))).toBe(true);
      expect(summary.dos.some(r => r.includes("Ensure all sensitive payloads"))).toBe(true);
      expect(summary.totalRules).toBe(4);
    });

    it("extracts guidelines for all canonical skills (backend, database, frontend, security, testing)", () => {
      const canonicalSkills: SkillName[] = [
        "skill-backend",
        "skill-database",
        "skill-frontend",
        "skill-security",
        "skill-testing"
      ];

      for (const skillName of canonicalSkills) {
        const content = SKILL_DEFINITIONS[skillName].content;
        const summary = extractDontVsDoGuidelines(content, skillName);
        expect(summary.skillName).toBe(skillName);
        expect(summary.dos.length).toBeGreaterThan(0);
        expect(summary.donts.length).toBeGreaterThan(0);
        expect(summary.totalRules).toBeGreaterThan(0);
      }
    });

    it("extracts aggregate guidelines for all selected skills", () => {
      const selected: SkillName[] = ["skill-backend", "skill-database"];
      const summaries = extractAllSelectedGuidelines(selected, tempDir);
      expect(summaries.length).toBe(2);
      expect(summaries[0].skillName).toBe("skill-backend");
      expect(summaries[1].skillName).toBe("skill-database");
      expect(summaries[0].dos.length).toBeGreaterThan(0);
      expect(summaries[0].donts.length).toBeGreaterThan(0);
    });
  });

  describe("AC-3: Interactive Skill Preview Modal with Frontmatter, Footprint, and Guidelines", () => {
    it("renders comprehensive preview modal with frontmatter, token footprint, and Don't vs Do breakdown when pressing 'p' or 'i'", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "modal-preview-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Press 'p' to open preview modal, then return with Enter, then confirm
      setTimeout(() => stdin.write("p"), 30);
      setTimeout(() => stdin.write("\r"), 60);
      setTimeout(() => stdin.write("\r"), 90);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);

      // Verify preview modal includes YAML frontmatter, token footprint, and Don't vs Do breakdown
      expect(output).toContain("Skill Preview:");
      expect(output).toContain("YAML Frontmatter");
      expect(output).toContain("Token Footprint");
      expect(output).toContain("Don't vs Do Guidelines");
      expect(output).toContain("DO");
      expect(output).toContain("DON'T");
    });

    it("allows opening full aggregate Don't vs Do guidelines preview modal via 'g' key", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "guidelines-modal-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true
      });

      // Press 'g' to open aggregate guidelines modal, then return with Enter, then confirm
      setTimeout(() => stdin.write("g"), 30);
      setTimeout(() => stdin.write("\r"), 60);
      setTimeout(() => stdin.write("\r"), 90);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(output).toContain("Don't vs Do Guidelines Preview");
      expect(output).toContain("skill-backend");
    });

    it("includes guidelines summary in interactive selector result", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "summary-result-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true,
        initialSelectedSkills: ["skill-backend", "skill-security"]
      });

      setTimeout(() => stdin.write("\r"), 30);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.guidelinesSummary).toBeDefined();
      expect(result.guidelinesSummary?.length).toBe(2);
      expect(result.guidelinesSummary?.find(g => g.skillName === "skill-backend")).toBeDefined();
    });
  });
});


