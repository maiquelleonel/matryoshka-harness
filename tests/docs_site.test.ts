import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("SPEC-17: Technical Documentation Site & Agnostic Information Architecture", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const mkdocsConfigPath = path.join(repoRoot, "mkdocs.yml");

  describe("Subtask 1: Configure mkdocs.yml with isolated docs_dir, site_dir, dark theme, and navigation schema", () => {
    it("verifies mkdocs.yml exists at the repository root", () => {
      expect(fs.existsSync(mkdocsConfigPath)).toBe(true);
    });

    it("configures strict directory isolation with docs_dir: docs/guide and site_dir: site-docs", () => {
      const content = fs.readFileSync(mkdocsConfigPath, "utf-8");
      expect(content).toMatch(/docs_dir:\s*['"]?docs\/guide['"]?/);
      expect(content).toMatch(/site_dir:\s*['"]?site-docs['"]?/);
    });

    it("configures site metadata and repository links", () => {
      const content = fs.readFileSync(mkdocsConfigPath, "utf-8");
      expect(content).toMatch(/site_name:\s*['"]?Matryoshka-Harness['"]?/);
      expect(content).toContain("https://github.com/maiquelleonel/matryoshka-harness");
      expect(content).toContain("maiquelleonel/matryoshka-harness");
    });

    it("configures Material theme with dark slate/emerald palette", () => {
      const content = fs.readFileSync(mkdocsConfigPath, "utf-8");
      expect(content).toMatch(/theme:\s*\n\s+name:\s*['"]?material['"]?/);
      expect(content).toContain("slate");
      expect(content).toContain("emerald");
    });

    it("configures essential Material UI features (instant nav, code copy, search highlight)", () => {
      const content = fs.readFileSync(mkdocsConfigPath, "utf-8");
      expect(content).toContain("navigation.instant");
      expect(content).toContain("content.code.copy");
      expect(content).toContain("search.highlight");
      expect(content).toContain("content.tabs.link");
    });

    it("configures Mermaid diagram support and Admonitions in markdown extensions", () => {
      const content = fs.readFileSync(mkdocsConfigPath, "utf-8");
      expect(content).toContain("admonition");
      expect(content).toContain("pymdownx.superfences");
      expect(content).toContain("mermaid");
    });

    it("configures complete navigation schema covering all subtask guides and references", () => {
      const content = fs.readFileSync(mkdocsConfigPath, "utf-8");
      expect(content).toContain("nav:");

      // Home / Overview
      expect(content).toContain("index.md");

      // Getting Started (Subtask 2)
      expect(content).toContain("getting-started/installation.md");
      expect(content).toContain("getting-started/quickstart.md");

      // Core Concepts (Subtask 3)
      expect(content).toContain("concepts/concentric-layers.md");
      expect(content).toContain("concepts/ast-engine.md");
      expect(content).toContain("concepts/adaptive-agents.md");

      // CLI Reference (Subtask 4)
      expect(content).toContain("cli/detect.md");
      expect(content).toContain("cli/scan.md");
      expect(content).toContain("cli/wrap.md");
      expect(content).toContain("cli/agents.md");
      expect(content).toContain("cli/mcp.md");

      // Integrations (Subtask 5)
      expect(content).toContain("integrations/mcp-server.md");
      expect(content).toContain("integrations/ci-cd-gates.md");
    });

    it("verifies architectural decision is documented in docs/EXPERIENCE.md", () => {
      const experiencePath = path.join(repoRoot, "docs", "EXPERIENCE.md");
      expect(fs.existsSync(experiencePath)).toBe(true);
      const expContent = fs.readFileSync(experiencePath, "utf-8");
      expect(expContent).toContain("[docs-site]");
      expect(expContent).toContain("docs_dir: docs/guide");
      expect(expContent).toContain("site_dir: site-docs");
    });
  });
});
