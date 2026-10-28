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
  isHeadlessEnvironment,
  shouldRunInteractivePrompt,
  InteractivePromptSession,
  promptInteractiveSkillSelection,
  getSkillPreviewData,
  formatSkillPreview,
  type SkillPreviewData,
  type InteractiveSelectorOptions,
  type TokenFootprintReport,
  type DontVsDoSummary,
  type InteractivePromptOptions,
  type InteractivePromptResult
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
      expect(summaries[0]?.skillName).toBe("skill-backend");
      expect(summaries[1]?.skillName).toBe("skill-database");
      expect(summaries[0]?.dos.length).toBeGreaterThan(0);
      expect(summaries[0]?.donts.length).toBeGreaterThan(0);
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

describe("SPEC-26 Subtask 4: Smoothly Fallback to Non-Interactive Mode in Headless/CI Environments", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-subtask4-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Headless Environment Auto-Detection and Helper Contracts", () => {
    it("exports isHeadlessEnvironment helper detecting non-TTY and CI environments", () => {
      expect(isHeadlessEnvironment).toBeFunction();
      expect(isHeadlessEnvironment({ stdin: { isTTY: false } })).toBe(true);
      expect(isHeadlessEnvironment({ stdin: { isTTY: true }, env: { CI: "true" } })).toBe(true);
      expect(isHeadlessEnvironment({ stdin: { isTTY: true }, env: { CONTINUOUS_INTEGRATION: "1" } })).toBe(true);
      expect(isHeadlessEnvironment({ stdin: { isTTY: true }, env: { GITHUB_ACTIONS: "true" } })).toBe(true);
      expect(isHeadlessEnvironment({ stdin: { isTTY: true }, env: {} })).toBe(false);
    });

    it("exports shouldRunInteractivePrompt with strict decision logic for TTY, flags, and CI", () => {
      expect(shouldRunInteractivePrompt).toBeFunction();

      // When --yes or -y is supplied, never prompt
      expect(shouldRunInteractivePrompt({ isYes: true, stdin: { isTTY: true }, stdout: { isTTY: true } })).toBe(false);

      // When --json is supplied, never prompt
      expect(shouldRunInteractivePrompt({ isJson: true, stdin: { isTTY: true }, stdout: { isTTY: true } })).toBe(false);

      // When stdin is not a TTY (headless/piped), never prompt
      expect(shouldRunInteractivePrompt({ stdin: { isTTY: false }, stdout: { isTTY: true } })).toBe(false);
      expect(shouldRunInteractivePrompt({ stdin: { isTTY: false }, isInteractive: true })).toBe(false);

      // When running in CI without explicit interactive flag, never prompt
      expect(shouldRunInteractivePrompt({ stdin: { isTTY: true }, stdout: { isTTY: true }, env: { CI: "true" } })).toBe(false);
      expect(shouldRunInteractivePrompt({ stdin: { isTTY: true }, stdout: { isTTY: true }, env: { CONTINUOUS_INTEGRATION: "1" } })).toBe(false);

      // When in interactive TTY terminal and not in CI, should prompt
      expect(shouldRunInteractivePrompt({ stdin: { isTTY: true }, stdout: { isTTY: true }, env: {} })).toBe(true);

      // When --interactive is explicitly set with a TTY terminal, should prompt
      expect(shouldRunInteractivePrompt({ stdin: { isTTY: true }, stdout: { isTTY: true }, isInteractive: true, env: { CI: "true" } })).toBe(true);
    });

    it("supports fallbackNonInteractive option in runInteractiveSkillSelector to resolve immediately without hanging", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "fallback-test" }));
      const profile = profileArchetype(tempDir);

      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const result = await runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        fallbackNonInteractive: true
      });

      expect(result.confirmed).toBe(true);
      expect(result.headlessFallback).toBe(true);
      expect(result.selectedSkills).toEqual(profile.activeSkills);
      expect(result.footprint).toBeDefined();
      expect(result.guidelinesSummary).toBeDefined();
    });
  });

  describe("AC-2: CLI Fallback to Non-Interactive Mode with --yes / -y", () => {
    it("bypasses interactive prompts and generates profile-recommended skills with --yes", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "cli-yes-subtask4",
          dependencies: { express: "^4.18.2" }
        })
      );
      fs.mkdirSync(path.join(tempDir, "src", "routes"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "src", "routes", "index.ts"), "export const r = 1;");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--yes"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);

      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(true);
    });

    it("bypasses interactive prompts and generates profile-recommended skills with -y shorthand", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "cli-shorty-subtask4",
          scripts: { test: "bun test" }
        })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "-y"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("works seamlessly with --dry-run and --yes together", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "cli-dryrun-yes-test",
          scripts: { test: "bun test" }
        })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--yes", "--dry-run"]);
      expect(proc.exitCode).toBe(0);
      expect(proc.stdout.toString()).toContain("Matryoshka Adaptive Agents Generator");
      // In dry-run, AGENTS.md should NOT be created
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);
    });
  });

  describe("AC-3: Headless CI Auto-detection and Non-TTY Fallback", () => {
    it("executes in deterministic batch mode when process.stdin.isTTY is false without interactive flags", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "headless-batch-test",
          dependencies: { fastapi: "^0.100.0" }
        })
      );

      // Child process runs with non-TTY stdin by default in Bun.spawnSync
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "skill-backend.md"))).toBe(true);
    });

    it("smoothly falls back when --interactive is provided in a non-TTY environment", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "interactive-in-headless-test",
          scripts: { test: "bun test" }
        })
      );

      // In non-TTY, --interactive must smoothly fall back to non-interactive mode without hanging
      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--interactive"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Headless environment detected");
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("bypasses prompt automatically when CI environment variable is present", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "ci-env-auto-test",
          scripts: { test: "bun test" }
        })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir], {
        env: { ...process.env, CI: "true" }
      });
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("maintains strict alias parity across baba, bbyg, and matryoshka in headless mode", () => {
      for (const alias of ["baba", "bbyg", "matryoshka"]) {
        const subTemp = path.join(tempDir, `alias-${alias}`);
        fs.mkdirSync(subTemp, { recursive: true });
        fs.writeFileSync(path.join(subTemp, "package.json"), JSON.stringify({ name: `alias-${alias}-test` }));

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", subTemp, "-y"], {
          env: { ...process.env, BABA_ALIAS: alias }
        });
        expect(proc.exitCode).toBe(0);
        expect(fs.existsSync(path.join(subTemp, "AGENTS.md"))).toBe(true);
      }
    });
  });
});

describe("SPEC-26 Subtask 5: Interactive Prompt Interface", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-subtask5-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Interactive Prompt Interface Setup & Stack Profile Presentation", () => {
    it("initializes InteractivePromptSession presenting detected archetype, runtime, and modular checklist", () => {
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
      fs.writeFileSync(path.join(tempDir, "routes", "api.py"), "def route(): pass");

      const profile = profileArchetype(tempDir);
      const session = new InteractivePromptSession({
        profile,
        projectPath: tempDir,
      });

      expect(session).toBeDefined();
      expect(session.getProfile().archetype).toBe("api_backend");
      expect(session.getProfile().runtime).toBe("python");

      // Checklist must contain all 6 modular skills
      const items = session.getItems();
      expect(items.length).toBe(6);
      const names = items.map(it => it.name);
      expect(names).toEqual([
        "skill-backend",
        "skill-database",
        "skill-frontend",
        "skill-security",
        "skill-testing",
        "custom-instructions",
      ]);

      // Recommended skills should be initially selected based on detected profile
      expect(session.getSelectedSkills()).toContain("skill-backend");
      expect(session.getSelectedSkills()).toContain("skill-database");
      expect(session.getSelectedSkills()).toContain("skill-security");
      expect(session.getSelectedSkills()).toContain("skill-testing");

      // Screen rendering must present stack review, checklist, and live footprint
      const screen = session.renderScreen();
      expect(screen).toContain("Matryoshka Interactive Skill Inspector");
      expect(screen).toContain("Archetype:");
      expect(screen).toContain("Runtime:");
      expect(screen).toContain("Interactive Skills Checklist:");
      expect(screen).toContain("Token Footprint:");
      expect(screen).toContain("skill-backend");
      expect(screen).toContain("custom-instructions");
    });
  });

  describe("AC-2: Interactive Prompt Session Primitives and State Transitions", () => {
    it("handles cursor navigation and wrapping correctly", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "cursor-test" }));
      const profile = profileArchetype(tempDir);
      const session = new InteractivePromptSession({ profile, projectPath: tempDir });

      expect(session.getCursor()).toBe(0);
      expect(session.getActiveItem().name).toBe("skill-backend");

      // Move down
      session.moveDown();
      expect(session.getCursor()).toBe(1);
      expect(session.getActiveItem().name).toBe("skill-database");

      // Move up back to 0
      session.moveUp();
      expect(session.getCursor()).toBe(0);

      // Move up wraps to last item (custom-instructions)
      session.moveUp();
      expect(session.getCursor()).toBe(5);
      expect(session.getActiveItem().name).toBe("custom-instructions");

      // Move down wraps to 0
      session.moveDown();
      expect(session.getCursor()).toBe(0);
    });

    it("toggles current item, individual skill, and toggle all state", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "toggle-session-test" }));
      const profile = profileArchetype(tempDir);
      const session = new InteractivePromptSession({
        profile,
        projectPath: tempDir,
        initialSelectedSkills: ["skill-backend"]
      });

      expect(session.getSelectedSkills()).toEqual(["skill-backend"]);

      // Toggle current (at index 0: skill-backend) -> turns OFF
      session.toggleCurrent();
      expect(session.getSelectedSkills()).toEqual([]);

      // Toggle current again -> turns ON
      session.toggleCurrent();
      expect(session.getSelectedSkills()).toEqual(["skill-backend"]);

      // Explicitly toggle a specific skill
      session.toggleSkill("skill-frontend", true);
      expect(session.getSelectedSkills()).toContain("skill-frontend");
      expect(session.getSelectedSkills()).toContain("skill-backend");

      // Toggle all: since not all are selected, toggles all ON
      session.toggleAll();
      expect(session.getSelectedSkills().length).toBe(6);

      // Toggle all again: since all are selected, toggles all OFF
      session.toggleAll();
      expect(session.getSelectedSkills().length).toBe(0);
    });

    it("manages preview and guidelines modal visibility states", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "modals-test" }));
      const profile = profileArchetype(tempDir);
      const session = new InteractivePromptSession({ profile, projectPath: tempDir });

      expect(session.isInPreview()).toBe(false);
      expect(session.isInGuidelines()).toBe(false);

      // Open skill preview
      session.openPreview();
      expect(session.isInPreview()).toBe(true);
      const previewOutput = session.renderScreen();
      expect(previewOutput).toContain("Skill Preview:");
      expect(previewOutput).toContain("YAML Frontmatter");

      session.closePreview();
      expect(session.isInPreview()).toBe(false);

      // Open guidelines modal
      session.openGuidelines();
      expect(session.isInGuidelines()).toBe(true);
      const guidelinesOutput = session.renderScreen();
      expect(guidelinesOutput).toContain("Don't vs Do Guidelines Preview");

      session.closeGuidelines();
      expect(session.isInGuidelines()).toBe(false);
    });
  });

  describe("AC-3: High-Level Orchestrator promptInteractiveSkillSelection Integration", () => {
    it("launches interactive session via streams, responds to user input and confirms selection", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "orchestrator-test", scripts: { test: "bun test" } })
      );
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      (stdin as any).isTTY = true;
      (stdout as any).isTTY = true;
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const promptPromise = promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isInteractive: true,
        env: { CI: "" }
      });

      // Navigate down to skill-frontend (down twice from index 0), toggle it ON (Space), then confirm (Enter)
      setTimeout(() => stdin.write("\u001b[B"), 20);
      setTimeout(() => stdin.write("\u001b[B"), 40);
      setTimeout(() => stdin.write(" "), 60);
      setTimeout(() => stdin.write("\r"), 80);

      const result = await promptPromise;
      expect(result.confirmed).toBe(true);
      expect(result.bypassed).toBe(false);
      expect(result.selectedSkills).toContain("skill-frontend");
      expect(result.profile).toBeDefined();
      expect(result.footprint).toBeDefined();
      expect(output).toContain("Interactive Skills Checklist:");
    });

    it("bypasses interactive prompt immediately when isYes is set to true", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "yes-bypass-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const result = await promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isYes: true,
      });

      expect(result.confirmed).toBe(true);
      expect(result.bypassed).toBe(true);
      expect(result.selectedSkills).toEqual(profile.activeSkills);
      expect(result.footprint).toBeDefined();
    });

    it("bypasses interactive prompt immediately when isJson is set to true", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "json-bypass-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();

      const result = await promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isJson: true,
      });

      expect(result.confirmed).toBe(true);
      expect(result.bypassed).toBe(true);
      expect(result.selectedSkills).toEqual(profile.activeSkills);
    });

    it("falls back gracefully when running in headless environment (non-TTY stdin)", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "headless-session-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      (stdin as any).isTTY = false;
      const stdout = new PassThrough();

      const result = await promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        // without explicit isInteractive
      });

      expect(result.confirmed).toBe(true);
      expect(result.bypassed).toBe(true);
      expect(result.headlessFallback).toBe(true);
      expect(result.selectedSkills).toEqual(profile.activeSkills);
    });

    it("handles user cancellation (q) returning confirmed: false and empty selectedSkills", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "cancel-test" }));
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      (stdin as any).isTTY = true;
      (stdout as any).isTTY = true;

      const promptPromise = promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isInteractive: true,
        env: { CI: "" }
      });

      setTimeout(() => stdin.write("q"), 20);

      const result = await promptPromise;
      expect(result.confirmed).toBe(false);
      expect(result.bypassed).toBe(false);
      expect(result.selectedSkills).toEqual([]);
    });
  });

  describe("AC-4: End-to-End Persistence after Interactive Confirmation", () => {
    it("generates and persists exactly the confirmed skills from interactive prompt", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "e2e-interactive-persistence",
          scripts: { test: "bun test" }
        })
      );
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      (stdin as any).isTTY = true;
      (stdout as any).isTTY = true;

      const promptPromise = promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isInteractive: true,
        env: { CI: "" },
        initialSelectedSkills: ["skill-backend", "custom-instructions"]
      });

      // Press Enter to confirm selection
      setTimeout(() => stdin.write("\r"), 30);

      const promptResult = await promptPromise;
      expect(promptResult.confirmed).toBe(true);

      const genResult = generateAgents(tempDir, {
        selectedSkills: promptResult.selectedSkills,
        force: true
      });

      expect(genResult.status).toBe("success");
      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "custom-instructions.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-database.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-frontend.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-security.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-testing.md"))).toBe(false);
    });
  });
});

describe("SPEC-26 Subtask 6: Skill Content Preview Modal/Screen", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-subtask6-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Skill Content Inspection Data Extraction & Frontmatter Parsing", () => {
    it("extracts comprehensive structured preview data for all modular skills", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "preview-data-test" }));
      const profile = profileArchetype(tempDir);

      for (const skill of MODULAR_SKILLS_CATALOG) {
        const preview = getSkillPreviewData(skill.name, {
          projectPath: tempDir,
          profile,
          cumulativeSelectedSkills: ["skill-backend"],
        });

        expect(preview.skillName).toBe(skill.name);
        expect(preview.title).toBe(skill.title);
        expect(preview.description.length).toBeGreaterThan(0);
        expect(preview.fileName).toContain(".md");
        expect(preview.totalTokens).toBeGreaterThan(0);
        expect(preview.bodyTokens).toBeGreaterThan(0);
        expect(preview.footprint).toBeDefined();
        expect(preview.rawContent.length).toBeGreaterThan(0);
        expect(preview.guidelines).toBeDefined();
      }
    });

    it("parses YAML frontmatter, frontmatter tokens, and body tokens accurately", () => {
      const preview = getSkillPreviewData("skill-backend", {
        projectPath: tempDir,
      });

      expect(preview.frontmatterYaml).toContain("name: skill-backend");
      expect(preview.frontmatterYaml).toContain("description:");
      expect(preview.frontmatterTokens).toBeGreaterThan(0);
      expect(preview.totalTokens).toBe(preview.bodyTokens + preview.frontmatterTokens);
      expect(preview.frontmatter).not.toBeNull();
      expect(preview.frontmatter?.name).toBe("skill-backend");
    });

    it("handles custom instructions skill with repository-specific file overrides", () => {
      const customSkillsDir = path.join(tempDir, ".agents", "skills");
      fs.mkdirSync(customSkillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(customSkillsDir, "custom-instructions.md"),
        `---
name: custom-instructions
description: Custom engineering standards for our monorepo
---
# Monorepo Guidelines
* Never commit secrets to git.
* Always enforce conventional commits.
`
      );

      const preview = getSkillPreviewData("custom-instructions", {
        projectPath: tempDir,
      });

      expect(preview.description).toBe("Custom engineering standards for our monorepo");
      expect(preview.frontmatterYaml).toContain("Custom engineering standards for our monorepo");
      expect(preview.guidelines.donts.some(r => r.includes("Never commit secrets"))).toBe(true);
      expect(preview.guidelines.dos.some(r => r.includes("Always enforce conventional"))).toBe(true);
    });
  });

  describe("AC-2: Terminal Preview Modal Rendering & Visual Composition", () => {
    it("renders formatted preview modal with selection status badge, recommendation badge, and index pagination", () => {
      const output = formatSkillPreview("skill-backend", {
        projectPath: tempDir,
        isSelected: true,
        isRecommended: true,
        currentIndex: 0,
        totalSkills: 6,
        cumulativeSelectedSkills: ["skill-backend", "skill-database"],
        tokenBudget: 2500,
      });

      expect(output).toContain("Skill Preview: skill-backend");
      expect(output).toContain(".agents/skills/skill-backend.md");
      expect(output).toContain("Selected");
      expect(output).toContain("[recommended]");
      expect(output).toContain("[1/6]");
      expect(output).toContain("YAML Frontmatter:");
      expect(output).toContain("Token Footprint:");
      expect(output).toContain("Skill Body:");
      expect(output).toContain("Frontmatter:");
      expect(output).toContain("Cumulative with Selection:");
      expect(output).toContain("Don't vs Do Guidelines:");
      expect(output).toContain("DO (Best Practices");
      expect(output).toContain("DON'T (Anti-Patterns");
      expect(output).toContain("[Space] Toggle selection");
      expect(output).toContain("[←/→]");
    });

    it("renders unselected status badge and optional badge when skill is not selected or recommended", () => {
      const output = formatSkillPreview("custom-instructions", {
        projectPath: tempDir,
        isSelected: false,
        isRecommended: false,
        currentIndex: 5,
        totalSkills: 6,
      });

      expect(output).toContain("Skill Preview: custom-instructions");
      expect(output).toContain("Unselected");
      expect(output).toContain("[optional]");
      expect(output).toContain("[6/6]");
    });
  });

  describe("AC-3: In-Modal Toggling & Skill Traversal Navigation", () => {
    it("allows traversing skills with previewNext and previewPrevious inside InteractivePromptSession", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "modal-nav-test" }));
      const profile = profileArchetype(tempDir);
      const session = new InteractivePromptSession({ profile, projectPath: tempDir });

      session.openPreview();
      expect(session.isInPreview()).toBe(true);
      expect(session.getActiveItem().name).toBe("skill-backend");

      // Next preview
      session.previewNext();
      expect(session.getActiveItem().name).toBe("skill-database");

      // Next preview again
      session.previewNext();
      expect(session.getActiveItem().name).toBe("skill-frontend");

      // Previous preview
      session.previewPrevious();
      expect(session.getActiveItem().name).toBe("skill-database");

      // Previous wraps to last
      session.previewPrevious();
      expect(session.getActiveItem().name).toBe("skill-backend");
      session.previewPrevious();
      expect(session.getActiveItem().name).toBe("custom-instructions");

      // Closes preview cleanly
      session.closePreview();
      expect(session.isInPreview()).toBe(false);
    });

    it("toggles skill selection directly from within preview modal using Space in interactive runner", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "inmodal-toggle-test" }));
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
        dryRun: true,
      });

      // Flow:
      // 1. Open preview with 'p' on skill-backend (initially recommended = true)
      // 2. Press Space to toggle skill-backend OFF while inside preview modal
      // 3. Press 'p' to exit preview modal
      // 4. Press Enter to confirm selection
      setTimeout(() => stdin.write("p"), 20);
      setTimeout(() => stdin.write(" "), 40);
      setTimeout(() => stdin.write("p"), 60);
      setTimeout(() => stdin.write("\r"), 80);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).not.toContain("skill-backend");
    });

    it("navigates skills with arrow keys and vim keys directly inside preview modal", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "modal-keys-nav-test" }));
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
        dryRun: true,
      });

      // Flow:
      // 1. Open preview with 'i' (inspect) on index 0 (skill-backend)
      // 2. Press Right Arrow (\u001b[C) to advance preview to skill-database
      // 3. Press Right Arrow (\u001b[C) to advance preview to skill-frontend
      // 4. Press Space to toggle skill-frontend ON
      // 5. Press Left Arrow (\u001b[D) back to skill-database
      // 6. Press Space to toggle skill-database OFF
      // 7. Press Escape to close preview
      // 8. Press Enter to confirm
      setTimeout(() => stdin.write("i"), 20);
      setTimeout(() => stdin.write("\u001b[C"), 40);
      setTimeout(() => stdin.write("\u001b[C"), 60);
      setTimeout(() => stdin.write(" "), 80);
      setTimeout(() => stdin.write("\u001b[D"), 100);
      setTimeout(() => stdin.write(" "), 120);
      setTimeout(() => stdin.write("\u001b"), 140);
      setTimeout(() => stdin.write("\r"), 160);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(true);
      expect(result.selectedSkills).toContain("skill-frontend");
      expect(result.selectedSkills).not.toContain("skill-database");
      expect(output).toContain("Skill Preview: skill-database");
      expect(output).toContain("Skill Preview: skill-frontend");
    });

    it("exits preview modal via enter without confirming checklist prematurely", async () => {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const profile = profileArchetype(tempDir);

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true,
      });

      // Press 'p' to enter preview, press '\r' to exit preview, then press 'q' to abort checklist
      setTimeout(() => stdin.write("p"), 20);
      setTimeout(() => stdin.write("\r"), 50);
      setTimeout(() => stdin.write("q"), 80);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(false);
    });

    it("exits preview modal via escape key without confirming checklist prematurely", async () => {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const profile = profileArchetype(tempDir);

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true,
      });

      // Press 'p' to enter preview, press '\u001b' to exit preview, then press 'q' to abort checklist
      setTimeout(() => stdin.write("p"), 20);
      setTimeout(() => stdin.write("\u001b"), 50);
      setTimeout(() => stdin.write("q"), 80);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(false);
    });

    it("exits preview modal via p or i key without confirming selection prematurely", async () => {
      for (const exitKey of ["p", "i"]) {
        const stdin = new PassThrough();
        const stdout = new PassThrough();
        const profile = profileArchetype(tempDir);

        const selectorPromise = runInteractiveSkillSelector({
          profile,
          projectPath: tempDir,
          stdin,
          stdout,
          dryRun: true,
        });

        // Open preview with 'p', exit with exitKey, then press 'q' to abort checklist
        setTimeout(() => stdin.write("p"), 20);
        setTimeout(() => stdin.write(exitKey), 50);
        setTimeout(() => stdin.write("q"), 80);

        const result = await selectorPromise;
        expect(result.confirmed).toBe(false);
      }
    });

    it("closes preview modal and returns to checklist when q is pressed inside preview", async () => {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const profile = profileArchetype(tempDir);

      const selectorPromise = runInteractiveSkillSelector({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        dryRun: true,
      });

      // Press 'p' to enter preview, press 'q' to close preview, then press 'q' again to abort checklist
      setTimeout(() => stdin.write("p"), 20);
      setTimeout(() => stdin.write("q"), 50);
      setTimeout(() => stdin.write("q"), 80);

      const result = await selectorPromise;
      expect(result.confirmed).toBe(false);
    });
  });

  describe("AC-4: Interactive Stream Simulation & End-to-End Persistence", () => {
    it("persists filesystem skills reflecting modifications performed inside the preview modal", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "modal-persistence-e2e",
          scripts: { test: "bun test" }
        })
      );
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      (stdin as any).isTTY = true;
      (stdout as any).isTTY = true;

      const promptPromise = promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isInteractive: true,
        env: { CI: "" },
      });

      // 1. Open preview ('p') on skill-backend (recommended)
      // 2. Toggle skill-backend OFF (' ')
      // 3. Move to custom-instructions (Left arrow wraps around to custom-instructions)
      // 4. Toggle custom-instructions ON (' ')
      // 5. Exit preview ('p')
      // 6. Confirm checklist ('\r')
      setTimeout(() => stdin.write("p"), 20);
      setTimeout(() => stdin.write(" "), 40);
      setTimeout(() => stdin.write("\u001b[D"), 60);
      setTimeout(() => stdin.write(" "), 80);
      setTimeout(() => stdin.write("p"), 100);
      setTimeout(() => stdin.write("\r"), 120);

      const promptResult = await promptPromise;
      expect(promptResult.confirmed).toBe(true);
      expect(promptResult.selectedSkills).not.toContain("skill-backend");
      expect(promptResult.selectedSkills).toContain("custom-instructions");

      const genResult = generateAgents(tempDir, {
        selectedSkills: promptResult.selectedSkills,
        force: true
      });

      expect(genResult.status).toBe("success");
      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "custom-instructions.md"))).toBe(true);
    });
  });
});

describe("SPEC-26 Subtask 7: Headless & Flag Parity", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-subtask7-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Interactive Skill Selection in TTY Terminal (--interactive, -i)", () => {
    it("launches interactive prompt when running baba agents generate with --interactive flag in TTY", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "interactive-flag-test", dependencies: { express: "^4.18.2" } })
      );
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      (stdin as any).isTTY = true;
      (stdout as any).isTTY = true;
      let output = "";
      stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      const promptPromise = promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isInteractive: true,
        env: { CI: "" }
      });

      setTimeout(() => stdin.write("\r"), 30);

      const result = await promptPromise;
      expect(result.confirmed).toBe(true);
      expect(result.bypassed).toBe(false);
      expect(result.selectedSkills).toContain("skill-backend");
      expect(output).toContain("Interactive Skills Checklist:");
    });

    it("allows toggling skills and persists only confirmed skills via interactive selection", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "interactive-toggle-persist", dependencies: { fastify: "^4.0.0" } })
      );
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      (stdin as any).isTTY = true;
      (stdout as any).isTTY = true;

      const promptPromise = promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isInteractive: true,
        env: { CI: "" }
      });

      // 0: skill-backend -> toggle off (space)
      // down -> 1: skill-database -> toggle off (space)
      // confirm -> enter
      setTimeout(() => stdin.write(" "), 20);
      setTimeout(() => stdin.write("\u001b[B"), 40);
      setTimeout(() => stdin.write(" "), 60);
      setTimeout(() => stdin.write("\r"), 80);

      const promptResult = await promptPromise;
      expect(promptResult.confirmed).toBe(true);
      expect(promptResult.selectedSkills).not.toContain("skill-backend");
      expect(promptResult.selectedSkills).not.toContain("skill-database");

      const genResult = generateAgents(tempDir, {
        selectedSkills: promptResult.selectedSkills,
        force: true
      });
      expect(genResult.status).toBe("success");
      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, "skill-database.md"))).toBe(false);
    });

    it("aborts cleanly without modifying files when user cancels with q or escape", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "interactive-abort-test" })
      );
      const profile = profileArchetype(tempDir);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      (stdin as any).isTTY = true;
      (stdout as any).isTTY = true;

      const promptPromise = promptInteractiveSkillSelection({
        profile,
        projectPath: tempDir,
        stdin,
        stdout,
        isInteractive: true,
        env: { CI: "" }
      });

      setTimeout(() => stdin.write("q"), 20);

      const promptResult = await promptPromise;
      expect(promptResult.confirmed).toBe(false);
      expect(promptResult.selectedSkills).toEqual([]);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);
    });
  });

  describe("AC-2: Fallback to Non-Interactive Mode with --yes, -y, and --non-interactive", () => {
    it("bypasses prompts and generates all profile-recommended skills directly with --yes", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "yes-flag-test",
          dependencies: { express: "^4.18.2", pg: "^8.11.0" }
        })
      );
      fs.mkdirSync(path.join(tempDir, "routes"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "routes", "api.ts"), "export const a = 1;");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--yes"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");

      const agentsPath = path.join(tempDir, "AGENTS.md");
      expect(fs.existsSync(agentsPath)).toBe(true);

      const skillsDir = path.join(tempDir, ".agents", "skills");
      expect(fs.existsSync(path.join(skillsDir, "skill-backend.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillsDir, "skill-database.md"))).toBe(true);
    });

    it("bypasses prompts identically with -y shorthand flag", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "short-y-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "-y"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("bypasses prompts identically with --non-interactive flag", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "non-interactive-flag-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--non-interactive"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("preserves precedence: --yes overrides --interactive flag to force non-interactive mode", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "yes-overrides-interactive", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--yes", "--interactive"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("works with --dry-run and --yes without creating files on disk", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "dryrun-yes-parity", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--yes", "--dry-run"]);
      expect(proc.exitCode).toBe(0);
      expect(proc.stdout.toString()).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);
    });

    it("works with --force and -y creating a .bak backup when AGENTS.md exists", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "force-backup-parity", scripts: { test: "bun test" } })
      );
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Pre-existing instructions", "utf-8");

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "-y", "--force"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md.bak"))).toBe(true);
      const bakContent = fs.readFileSync(path.join(tempDir, "AGENTS.md.bak"), "utf-8");
      expect(bakContent).toBe("# Pre-existing instructions");
    });
  });

  describe("AC-3: Headless CI Auto-detection & Non-TTY Fallback", () => {
    it("executes in deterministic batch mode in non-TTY environment without hanging", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "headless-autodetect-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("smoothly falls back when --interactive is provided in a non-TTY environment", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "headless-fallback-notice-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--interactive"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Headless environment detected");
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("auto-detects CI environments and executes non-interactively without prompt", () => {
      const ciVariables = [
        { CI: "true" },
        { CONTINUOUS_INTEGRATION: "1" },
        { GITHUB_ACTIONS: "true" },
        { DEBIAN_FRONTEND: "noninteractive" }
      ];

      for (const envVar of ciVariables) {
        const sub = path.join(tempDir, `ci-${Object.keys(envVar)[0]}`);
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(path.join(sub, "package.json"), JSON.stringify({ name: "ci-test" }));

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", sub], {
          env: { ...process.env, ...envVar }
        });
        expect(proc.exitCode).toBe(0);
        expect(fs.existsSync(path.join(sub, "AGENTS.md"))).toBe(true);
      }
    });

    it("preserves pure JSON output without notice contamination when --json is provided in headless", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "json-pure-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync([
        "bun", "run", cliPath, "agents", "generate", tempDir, "--interactive", "--json"
      ]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString().trim();
      expect(() => JSON.parse(stdout)).not.toThrow();
      const parsed = JSON.parse(stdout);
      expect(parsed.status).toBe("success");
      expect(parsed.rootAgentsPath).toBe(path.join(tempDir, "AGENTS.md"));
    });
  });

  describe("AC-4: Strict Alias Parity Across baba, bbyg, and matryoshka", () => {
    it("maintains strict batch generation parity with -y flag across all 3 aliases", () => {
      for (const alias of ["baba", "bbyg", "matryoshka"]) {
        const sub = path.join(tempDir, `alias-batch-${alias}`);
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(
          path.join(sub, "package.json"),
          JSON.stringify({ name: `parity-${alias}`, dependencies: { express: "^4.18.2" } })
        );

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", sub, "-y"], {
          env: { ...process.env, BABA_ALIAS: alias }
        });
        expect(proc.exitCode).toBe(0);
        expect(fs.existsSync(path.join(sub, "AGENTS.md"))).toBe(true);
        expect(fs.existsSync(path.join(sub, ".agents", "skills", "skill-backend.md"))).toBe(true);
      }
    });

    it("maintains strict headless fallback notice parity across all 3 aliases", () => {
      for (const alias of ["baba", "bbyg", "matryoshka"]) {
        const sub = path.join(tempDir, `alias-notice-${alias}`);
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(path.join(sub, "package.json"), JSON.stringify({ name: `notice-${alias}` }));

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", sub, "--interactive"], {
          env: { ...process.env, BABA_ALIAS: alias }
        });
        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();
        expect(stdout).toContain("Headless environment detected");
        expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
        expect(fs.existsSync(path.join(sub, "AGENTS.md"))).toBe(true);
      }
    });

    it("maintains strict JSON output parity across all 3 aliases with --dry-run and -y", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "json-parity-app", dependencies: { fastify: "^4.0.0" } })
      );

      const outputs: any[] = [];
      for (const alias of ["baba", "bbyg", "matryoshka"]) {
        const proc = Bun.spawnSync(
          ["bun", "run", cliPath, "agents", "generate", tempDir, "--dry-run", "-y", "--json"],
          { env: { ...process.env, BABA_ALIAS: alias } }
        );
        expect(proc.exitCode).toBe(0);
        const parsed = JSON.parse(proc.stdout.toString().trim());
        outputs.push(parsed);
      }

      expect(outputs[0].archetype).toBe(outputs[1].archetype);
      expect(outputs[0].archetype).toBe(outputs[2].archetype);
      expect(outputs[0].rootTokens).toBe(outputs[1].rootTokens);
      expect(outputs[0].rootTokens).toBe(outputs[2].rootTokens);
      expect(outputs[0].plannedFiles.length).toBe(outputs[1].plannedFiles.length);
      expect(outputs[0].plannedFiles.length).toBe(outputs[2].plannedFiles.length);
    });

    it("maintains help parity: displays --interactive and --yes flags in agents help and agents generate help", () => {
      for (const alias of ["baba", "bbyg", "matryoshka"]) {
        for (const args of [["agents", "--help"], ["agents", "-h"], ["agents", "help"], ["agents", "generate", "--help"], ["agents", "generate", "help"]]) {
          const proc = Bun.spawnSync(["bun", "run", cliPath, ...args], {
            env: { ...process.env, BABA_ALIAS: alias }
          });
          expect(proc.exitCode).toBe(0);
          const stdout = proc.stdout.toString();
          expect(stdout).toContain("--interactive");
          expect(stdout).toContain("-i");
          expect(stdout).toContain("--yes");
          expect(stdout).toContain("-y");
        }
      }
    });

    it("maintains package.json bin script alias parity for baba, bbyg, and matryoshka", () => {
      for (const binScript of ["baba", "bbyg", "matryoshka"]) {
        const proc = Bun.spawnSync(["bun", "run", binScript, "agents", "--help"]);
        expect(proc.exitCode).toBe(0);
        const stdout = proc.stdout.toString();
        expect(stdout).toContain("--interactive");
        expect(stdout).toContain("--yes");
      }
    });

    it("maintains protective shell script alias parity in packages/ forwarders", () => {
      const shells = [
        path.resolve(__dirname, "../packages/baba/bin/baba.js"),
        path.resolve(__dirname, "../packages/bbyg/bin/bbyg.js"),
        path.resolve(__dirname, "../packages/matrioska/bin/matrioska.js"),
        path.resolve(__dirname, "../packages/matryoska/bin/matryoska.js"),
      ];

      for (const shellPath of shells) {
        expect(fs.existsSync(shellPath)).toBe(true);
        const content = fs.readFileSync(shellPath, "utf-8");
        expect(content).toContain("resolveCanonicalCli");
        expect(content).toContain("forwardCli");
        expect(content).toContain("spawnSync");
      }
    });
  });
});


describe("SPEC-26 Subtask 7: Headless & Flag Parity", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-spec26-subtask7-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Flag Parity --interactive & -i Shorthand in Headless Environments", () => {
    it("falls back to deterministic generation when --interactive is run in non-TTY environment", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "interactive-flag-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--interactive"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Notice: Headless environment detected");
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "skill-testing.md"))).toBe(true);
    });

    it("falls back to deterministic generation when -i shorthand is run in non-TTY environment", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "i-shorthand-test", dependencies: { express: "^4.18.2" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "-i"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Notice: Headless environment detected");
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".agents", "skills", "skill-backend.md"))).toBe(true);
    });

    it("handles implicit generate command when invoked as 'baba agents --interactive' or 'baba agents -i'", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "implicit-agents-interactive", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", tempDir, "-i"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });
  });

  describe("AC-2: Flag Precedence and Non-Interactive Batch Modes (--yes, -y, --json)", () => {
    it("--yes overrides --interactive flag and generates directly without headless notice", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "precedence-yes-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--interactive", "--yes"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).not.toContain("Notice: Headless environment detected");
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("-y shorthand overrides -i shorthand and generates directly without headless notice", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "precedence-shorty-test", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "-i", "-y"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).not.toContain("Notice: Headless environment detected");
      expect(stdout).toContain("Matryoshka Adaptive Agents Generator");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("handles implicit generate command with 'baba agents -y' and 'baba agents --yes'", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "implicit-agents-yes", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", tempDir, "-y"]);
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("--json overrides --interactive flag and outputs strictly valid JSON without prompts or notices", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "precedence-json-test", dependencies: { express: "^4.18.2" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir, "--interactive", "--json"]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString().trim();
      expect(stdout).not.toContain("Notice: Headless environment detected");
      const parsed = JSON.parse(stdout);
      expect(parsed.status).toBe("success");
      expect(parsed.rootAgentsPath).toBeDefined();
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });
  });

  describe("AC-3: Strict Alias Parity Across baba, bbyg, matryoshka and matrioska", () => {
    it("produces byte-identical AGENTS.md and skills across baba, bbyg, and matryoshka aliases in batch mode", () => {
      const aliases = ["baba", "bbyg", "matryoshka"];
      const generatedArtifacts: Record<string, { agentsMd: string; skills: string[] }> = {};

      for (const alias of aliases) {
        const subProject = path.join(tempDir, `alias-parity-${alias}`);
        fs.mkdirSync(subProject, { recursive: true });
        fs.writeFileSync(
          path.join(subProject, "package.json"),
          JSON.stringify({
            name: `parity-${alias}`,
            dependencies: { express: "^4.18.2", pg: "^8.11.0" },
            scripts: { test: "bun test" }
          })
        );
        fs.mkdirSync(path.join(subProject, "src", "routes"), { recursive: true });
        fs.writeFileSync(path.join(subProject, "src", "routes", "api.ts"), "export const ok = 1;");

        const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", subProject, "-y"], {
          env: { ...process.env, BABA_ALIAS: alias }
        });
        expect(proc.exitCode).toBe(0);

        const agentsMd = fs.readFileSync(path.join(subProject, "AGENTS.md"), "utf-8");
        const skillsDir = path.join(subProject, ".agents", "skills");
        const skills = fs.readdirSync(skillsDir).sort();

        generatedArtifacts[alias] = { agentsMd, skills };
      }

      // Parity check: baba vs bbyg vs matryoshka
      expect(generatedArtifacts.bbyg.skills).toEqual(generatedArtifacts.baba.skills);
      expect(generatedArtifacts.matryoshka.skills).toEqual(generatedArtifacts.baba.skills);
      expect(generatedArtifacts.bbyg.agentsMd).toBe(generatedArtifacts.baba.agentsMd);
      expect(generatedArtifacts.matryoshka.agentsMd).toBe(generatedArtifacts.baba.agentsMd);
    });

    it("supports passing alias as first CLI argument with strict dispatch parity", () => {
      const aliases = ["baba", "bbyg", "matryoshka", "matrioska"];

      for (const alias of aliases) {
        const subProject = path.join(tempDir, `direct-arg-${alias}`);
        fs.mkdirSync(subProject, { recursive: true });
        fs.writeFileSync(
          path.join(subProject, "package.json"),
          JSON.stringify({ name: `direct-${alias}`, scripts: { test: "bun test" } })
        );

        const proc = Bun.spawnSync(["bun", "run", cliPath, alias, "agents", "generate", subProject, "-y"]);
        expect(proc.exitCode).toBe(0);
        expect(fs.existsSync(path.join(subProject, "AGENTS.md"))).toBe(true);
      }
    });

    it("exhibits identical --dry-run behavior across aliases without writing files to disk", () => {
      for (const alias of ["baba", "bbyg", "matryoshka"]) {
        const subProject = path.join(tempDir, `dryrun-${alias}`);
        fs.mkdirSync(subProject, { recursive: true });
        fs.writeFileSync(
          path.join(subProject, "package.json"),
          JSON.stringify({ name: `dryrun-${alias}`, scripts: { test: "bun test" } })
        );

        const proc = Bun.spawnSync(["bun", "run", cliPath, alias, "agents", "generate", subProject, "--dry-run", "-y"]);
        expect(proc.exitCode).toBe(0);
        expect(proc.stdout.toString()).toContain("Matryoshka Adaptive Agents Generator");
        expect(fs.existsSync(path.join(subProject, "AGENTS.md"))).toBe(false);
      }
    });
  });

  describe("AC-4: Headless CI Auto-Detection & Automated Environment Variables", () => {
    it("automatically executes in headless batch mode without hanging when CI=true is set", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "ci-auto-true", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir], {
        env: { ...process.env, CI: "true" }
      });
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("automatically executes in headless batch mode when GITHUB_ACTIONS=true is set", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "ci-github-actions", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir], {
        env: { ...process.env, GITHUB_ACTIONS: "true" }
      });
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });

    it("automatically executes in headless batch mode when DEBIAN_FRONTEND=noninteractive is set", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "ci-debian-noninteractive", scripts: { test: "bun test" } })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "agents", "generate", tempDir], {
        env: { ...process.env, DEBIAN_FRONTEND: "noninteractive" }
      });
      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
    });
  });
});






