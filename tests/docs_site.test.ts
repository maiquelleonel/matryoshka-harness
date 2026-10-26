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

  describe("Subtask 2: Author Getting Started guides in docs/guide/getting-started/ (installation.md, quickstart.md)", () => {
    const gettingStartedDir = path.join(repoRoot, "docs", "guide", "getting-started");
    const installationPath = path.join(gettingStartedDir, "installation.md");
    const quickstartPath = path.join(gettingStartedDir, "quickstart.md");

    it("verifies getting-started directory and guides exist", () => {
      expect(fs.existsSync(gettingStartedDir)).toBe(true);
      expect(fs.existsSync(installationPath)).toBe(true);
      expect(fs.existsSync(quickstartPath)).toBe(true);
    });

    describe("installation.md content verification", () => {
      it("contains structured installation guide with zero-install methods", () => {
        const content = fs.readFileSync(installationPath, "utf-8");
        expect(content).toMatch(/# .*Installation/i);
        expect(content).toContain("bunx @maiquelleonel/matryoshka");
        expect(content).toContain("npx @maiquelleonel/matryoshka");
      });

      it("documents standalone compiled binary downloads and checksum verification", () => {
        const content = fs.readFileSync(installationPath, "utf-8");
        expect(content).toContain("baba-linux-x64");
        expect(content).toContain("baba-linux-arm64");
        expect(content).toContain("baba-darwin-arm64");
        expect(content).toContain("baba-darwin-x64");
        expect(content).toContain("baba-windows-x64.exe");
        expect(content).toContain("checksums.txt");
        expect(content).toContain("sha256sum");
        expect(content).toContain("chmod +x");
      });

      it("documents package manager installations and CLI alias parity", () => {
        const content = fs.readFileSync(installationPath, "utf-8");
        expect(content).toContain("bun add -g @maiquelleonel/matryoshka");
        expect(content).toContain("npm install -g @maiquelleonel/matryoshka");
        expect(content).toContain("baba");
        expect(content).toContain("bbyg");
        expect(content).toContain("matryoshka");
        expect(content).toContain("@maiquelleonel/baba");
        expect(content).toContain("@maiquelleonel/bbyg");
      });

      it("documents verification commands and contains no placeholders", () => {
        const content = fs.readFileSync(installationPath, "utf-8");
        expect(content).toContain("baba --help");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("quickstart.md content verification", () => {
      it("contains 5-minute hands-on walkthrough covering all 5 concentric layers", () => {
        const content = fs.readFileSync(quickstartPath, "utf-8");
        expect(content).toMatch(/# .*Quickstart/i);
        // Step 1: Detect stack
        expect(content).toContain("baba detect");
        // Step 2: Scan maturity & badge
        expect(content).toContain("baba scan");
        expect(content).toContain("--badge");
        // Step 3: Adaptive agents
        expect(content).toContain("baba agents generate");
        expect(content).toContain("AGENTS.md");
        // Step 4: Polyglot AST wrap
        expect(content).toContain("baba wrap");
        expect(content).toContain("DIAGNOSTIC.md");
        // Step 5: MCP wire & serve
        expect(content).toContain("baba mcp wire");
        expect(content).toContain("baba mcp serve");
      });

      it("contains valid relative links and clean code snippets with zero placeholders", () => {
        const content = fs.readFileSync(quickstartPath, "utf-8");
        expect(content).toContain("installation.md");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    it("verifies architectural decision is documented in docs/EXPERIENCE.md", () => {
      const experiencePath = path.join(repoRoot, "docs", "EXPERIENCE.md");
      const expContent = fs.readFileSync(experiencePath, "utf-8");
      expect(expContent).toContain("[getting-started-guides]");
      expect(expContent).toContain("installation.md");
      expect(expContent).toContain("quickstart.md");
    });
  });

  describe("Subtask 3: Author Core Concepts in docs/guide/concepts/ (concentric-layers.md, ast-engine.md, adaptive-agents.md)", () => {
    const conceptsDir = path.join(repoRoot, "docs", "guide", "concepts");
    const concentricLayersPath = path.join(conceptsDir, "concentric-layers.md");
    const astEnginePath = path.join(conceptsDir, "ast-engine.md");
    const adaptiveAgentsPath = path.join(conceptsDir, "adaptive-agents.md");

    it("verifies concepts directory and core concept pages exist", () => {
      expect(fs.existsSync(conceptsDir)).toBe(true);
      expect(fs.existsSync(concentricLayersPath)).toBe(true);
      expect(fs.existsSync(astEnginePath)).toBe(true);
      expect(fs.existsSync(adaptiveAgentsPath)).toBe(true);
    });

    describe("concentric-layers.md content verification", () => {
      it("contains comprehensive explanation of the Russian Doll mental model and all 5 layers", () => {
        const content = fs.readFileSync(concentricLayersPath, "utf-8");
        expect(content).toMatch(/# .*Concentric Layers/i);
        // Layer 1
        expect(content).toContain("Layer 1");
        expect(content).toContain("baba scan");
        expect(content).toContain("harness-score");
        // Layer 2
        expect(content).toContain("Layer 2");
        expect(content).toContain("codebase-memory");
        // Layer 3
        expect(content).toContain("Layer 3");
        expect(content).toContain("baba agents");
        expect(content).toContain("AGENTS.md");
        // Layer 4
        expect(content).toContain("Layer 4");
        expect(content).toContain("baba wrap");
        expect(content).toContain("Tree-sitter WASM");
        // Layer 5
        expect(content).toContain("Layer 5");
        expect(content).toContain("baba mcp");
        expect(content).toContain("stdio");
      });

      it("contains Mermaid diagram visualising concentric governance architecture", () => {
        const content = fs.readFileSync(concentricLayersPath, "utf-8");
        expect(content).toContain("```mermaid");
        expect(content).toMatch(/flowchart|graph/);
      });

      it("contains valid cross-references and zero placeholders", () => {
        const content = fs.readFileSync(concentricLayersPath, "utf-8");
        expect(content).toContain("ast-engine.md");
        expect(content).toContain("adaptive-agents.md");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("ast-engine.md content verification", () => {
      it("contains detailed documentation of the Polyglot AST Engine architecture", () => {
        const content = fs.readFileSync(astEnginePath, "utf-8");
        expect(content).toMatch(/# .*Polyglot AST Engine/i);
        expect(content).toContain("Tree-sitter");
        expect(content).toContain("WebAssembly");
        expect(content).toContain("baba wrap");
      });

      it("documents all 3 core AST antipattern rules in detail", () => {
        const content = fs.readFileSync(astEnginePath, "utf-8");
        // Rule 1: raw-sql / SQL injection
        expect(content).toContain("raw-sql");
        expect(content).toContain("CWE-89");
        // Rule 2: assertionless-test
        expect(content).toContain("assertionless-test");
        // Rule 3: hardcoded-credential
        expect(content).toContain("hardcoded-credential");
        expect(content).toContain("entropy");
      });

      it("documents composite scoring formula and DIAGNOSTIC.md compiler", () => {
        const content = fs.readFileSync(astEnginePath, "utf-8");
        expect(content).toContain("0.4");
        expect(content).toContain("0.6");
        expect(content).toContain("DIAGNOSTIC.md");
        expect(content).toContain("1,500");
      });

      it("documents CLI flags and contains zero placeholders", () => {
        const content = fs.readFileSync(astEnginePath, "utf-8");
        expect(content).toContain("--strict");
        expect(content).toContain("--threshold");
        expect(content).toContain("--output");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("adaptive-agents.md content verification", () => {
      it("contains detailed documentation of Adaptive Context-Fencing and prompt bloat problem", () => {
        const content = fs.readFileSync(adaptiveAgentsPath, "utf-8");
        expect(content).toMatch(/# .*Adaptive Agents/i);
        expect(content).toContain("AGENTS.md");
        expect(content).toContain("200");
        expect(content).toContain("250");
      });

      it("documents modular skills architecture and mandatory YAML frontmatter guardrail", () => {
        const content = fs.readFileSync(adaptiveAgentsPath, "utf-8");
        expect(content).toContain(".agents/skills/");
        expect(content).toContain("YAML frontmatter");
        expect(content).toContain("skill-backend.md");
        expect(content).toContain("skill-frontend.md");
        expect(content).toContain("skill-database.md");
        expect(content).toContain("skill-security.md");
        expect(content).toContain("skill-testing.md");
      });

      it("documents archetype classification taxonomy and CLI commands", () => {
        const content = fs.readFileSync(adaptiveAgentsPath, "utf-8");
        expect(content).toContain("api_backend");
        expect(content).toContain("opinionated_monolith");
        expect(content).toContain("reactive_frontend");
        expect(content).toContain("systems_microservice");
        expect(content).toContain("fullstack_hybrid");
        expect(content).toContain("baba agents generate");
        expect(content).toContain("baba agents check");
        expect(content).toContain("baba agents profile");
      });

      it("documents non-negotiable anti-slop core invariants and contains zero placeholders", () => {
        const content = fs.readFileSync(adaptiveAgentsPath, "utf-8");
        expect(content).toContain("YAGNI");
        expect(content).toContain("DRY");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    it("verifies architectural decision is documented in docs/EXPERIENCE.md", () => {
      const experiencePath = path.join(repoRoot, "docs", "EXPERIENCE.md");
      const expContent = fs.readFileSync(experiencePath, "utf-8");
      expect(expContent).toContain("[core-concepts]");
      expect(expContent).toContain("concentric-layers.md");
      expect(expContent).toContain("ast-engine.md");
      expect(expContent).toContain("adaptive-agents.md");
    });
  });
});
