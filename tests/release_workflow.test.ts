import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  determineSemverBump,
  formatReleaseTag,
  generateStructuredChangelog,
  incrementVersion,
  parseConventionalCommit,
} from "../src/release";

describe("SPEC-5: Subtask 3 - Automated SemVer Release Pipeline", () => {
  const rootDir = process.cwd();
  const releaseWorkflowPath = join(
    rootDir,
    ".github",
    "workflows",
    "release.yml",
  );
  const packageJsonPath = join(rootDir, "package.json");

  describe("Workflow file declaration & configuration", () => {
    it("should have .github/workflows/release.yml present", () => {
      expect(existsSync(releaseWorkflowPath)).toBe(true);
    });

    it("should trigger on push to main branch", () => {
      const content = readFileSync(releaseWorkflowPath, "utf-8");
      expect(content).toContain("push:");
      expect(content).toMatch(/branches:.*main/s);
    });

    it("should configure contents: write permission for GitHub Releases", () => {
      const content = readFileSync(releaseWorkflowPath, "utf-8");
      expect(content).toContain("permissions:");
      expect(content).toMatch(/contents:\s*write/);
    });

    it("should run on ubuntu-latest and checkout with fetch-depth: 0", () => {
      const content = readFileSync(releaseWorkflowPath, "utf-8");
      expect(content).toContain("runs-on: ubuntu-latest");
      expect(content).toContain("actions/checkout@v4");
      expect(content).toMatch(/fetch-depth:\s*0/);
    });

    it("should set up Bun runtime and run frozen-lockfile install", () => {
      const content = readFileSync(releaseWorkflowPath, "utf-8");
      expect(content).toContain("oven-sh/setup-bun@v2");
      expect(content).toContain("bun install --frozen-lockfile");
    });

    it("should have release script defined in package.json or workflow step executing release", () => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      const workflowContent = readFileSync(releaseWorkflowPath, "utf-8");
      const hasScript = pkg.scripts && pkg.scripts.release;
      const hasStep = workflowContent.includes("release.ts") || workflowContent.includes("bun run release");
      expect(hasScript || hasStep).toBe(true);
    });
  });

  describe("Conventional Commit parsing", () => {
    it("should parse standard feat commit", () => {
      const parsed = parseConventionalCommit("feat: add automated release pipeline");
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe("feat");
      expect(parsed?.scope).toBeNull();
      expect(parsed?.description).toBe("add automated release pipeline");
      expect(parsed?.breaking).toBe(false);
    });

    it("should parse fix commit with scope", () => {
      const parsed = parseConventionalCommit("fix(ci): repair workflow checkout depth");
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe("fix");
      expect(parsed?.scope).toBe("ci");
      expect(parsed?.description).toBe("repair workflow checkout depth");
      expect(parsed?.breaking).toBe(false);
    });

    it("should detect breaking change via exclamation mark in type/scope", () => {
      const parsed = parseConventionalCommit("feat(api)!: migrate to rest endpoints");
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe("feat");
      expect(parsed?.scope).toBe("api");
      expect(parsed?.breaking).toBe(true);
    });

    it("should detect breaking change via BREAKING CHANGE footer/body", () => {
      const message = "fix: drop deprecated method\n\nBREAKING CHANGE: remove legacy auth v1";
      const parsed = parseConventionalCommit(message);
      expect(parsed).not.toBeNull();
      expect(parsed?.breaking).toBe(true);
    });

    it("should parse chores and maintenance commits", () => {
      const parsed = parseConventionalCommit("chore(deps): update bun runtime to latest");
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe("chore");
      expect(parsed?.scope).toBe("deps");
      expect(parsed?.breaking).toBe(false);
    });
  });

  describe("SemVer bump calculation", () => {
    it("should determine major bump if any breaking change is present", () => {
      const commits = [
        "feat: new feature",
        "fix: minor bug",
        "feat(core)!: breaking architecture update",
      ];
      expect(determineSemverBump(commits)).toBe("major");
    });

    it("should determine minor bump if features are present without breaking changes", () => {
      const commits = [
        "feat: add feature a",
        "fix: resolve issue b",
        "chore: clean up",
      ];
      expect(determineSemverBump(commits)).toBe("minor");
    });

    it("should determine patch bump if only fixes are present", () => {
      const commits = [
        "fix: resolve memory leak",
        "fix(gate): fix regex matching",
      ];
      expect(determineSemverBump(commits)).toBe("patch");
    });

    it("should determine patch bump if only chores or maintenance commits are present", () => {
      const commits = [
        "chore: update dependencies",
        "docs: update readme",
      ];
      expect(determineSemverBump(commits)).toBe("patch");
    });

    it("should return null when commits array is empty", () => {
      expect(determineSemverBump([])).toBeNull();
    });
  });

  describe("SemVer version increment & tag formatting", () => {
    it("should increment patch version correctly", () => {
      expect(incrementVersion("0.1.0", "patch")).toBe("0.1.1");
      expect(incrementVersion("v1.2.3", "patch")).toBe("1.2.4");
    });

    it("should increment minor version correctly", () => {
      expect(incrementVersion("0.1.4", "minor")).toBe("0.2.0");
      expect(incrementVersion("1.2.3", "minor")).toBe("1.3.0");
    });

    it("should increment major version correctly", () => {
      expect(incrementVersion("0.3.2", "major")).toBe("1.0.0");
      expect(incrementVersion("1.2.3", "major")).toBe("2.0.0");
    });

    it("should format release tags with v prefix", () => {
      expect(formatReleaseTag("0.1.1")).toBe("v0.1.1");
      expect(formatReleaseTag("v1.0.0")).toBe("v1.0.0");
    });
  });

  describe("Structured changelog generation", () => {
    it("should generate markdown changelog grouped by categories", () => {
      const commits = [
        "feat(governance): add maintainer gate workflow",
        "fix(ci): fix yaml indentation",
        "chore: bump dependencies",
        "feat(core)!: replace legacy engine",
      ];

      const changelog = generateStructuredChangelog({
        version: "1.0.0",
        date: "2026-10-20",
        commits,
      });

      expect(changelog).toContain("## [1.0.0]");
      expect(changelog).toContain("2026-10-20");
      expect(changelog).toContain("### 💥 Breaking Changes");
      expect(changelog).toContain("### 🚀 Features");
      expect(changelog).toContain("### 🐛 Bug Fixes");
      expect(changelog).toContain("### 🔧 Maintenance");
      expect(changelog).toContain("replace legacy engine");
      expect(changelog).toContain("add maintainer gate workflow");
      expect(changelog).toContain("fix yaml indentation");
    });
  });
});
