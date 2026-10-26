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

  describe("Subtask 4: Author CLI Reference documentation in docs/guide/cli/ (detect.md, scan.md, wrap.md, agents.md, mcp.md)", () => {
    const cliDir = path.join(repoRoot, "docs", "guide", "cli");
    const detectPath = path.join(cliDir, "detect.md");
    const scanPath = path.join(cliDir, "scan.md");
    const wrapPath = path.join(cliDir, "wrap.md");
    const agentsPath = path.join(cliDir, "agents.md");
    const mcpPath = path.join(cliDir, "mcp.md");

    it("verifies cli reference directory and all 5 markdown reference files exist", () => {
      expect(fs.existsSync(cliDir)).toBe(true);
      expect(fs.existsSync(detectPath)).toBe(true);
      expect(fs.existsSync(scanPath)).toBe(true);
      expect(fs.existsSync(wrapPath)).toBe(true);
      expect(fs.existsSync(agentsPath)).toBe(true);
      expect(fs.existsSync(mcpPath)).toBe(true);
    });

    describe("detect.md content verification", () => {
      it("contains comprehensive documentation of baba detect syntax, arguments, and options", () => {
        const content = fs.readFileSync(detectPath, "utf-8");
        expect(content).toMatch(/# .*detect/i);
        expect(content).toContain("baba detect");
        expect(content).toContain("bbyg detect");
        expect(content).toContain("matryoshka detect");
        expect(content).toContain("--json");
      });

      it("documents polyglot stack detection capabilities across languages, frameworks, and test runners", () => {
        const content = fs.readFileSync(detectPath, "utf-8");
        // Languages
        expect(content).toContain("TypeScript");
        expect(content).toContain("Python");
        expect(content).toContain("Go");
        expect(content).toContain("Rust");
        // Frameworks
        expect(content).toContain("Next.js");
        expect(content).toContain("FastAPI");
        expect(content).toContain("Gin");
        // Test runners
        expect(content).toContain("bun test");
        expect(content).toContain("pytest");
      });

      it("documents repository archetype classification and JSON output schema", () => {
        const content = fs.readFileSync(detectPath, "utf-8");
        expect(content).toContain("api_backend");
        expect(content).toContain("opinionated_monolith");
        expect(content).toContain("reactive_frontend");
        expect(content).toContain("systems_microservice");
        expect(content).toContain("fullstack_hybrid");
        expect(content).toContain("```json");
        expect(content).toContain('"status"');
        expect(content).toContain('"stack"');
      });

      it("contains zero placeholders", () => {
        const content = fs.readFileSync(detectPath, "utf-8");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("scan.md content verification", () => {
      it("contains comprehensive documentation of baba scan syntax, options, and arguments", () => {
        const content = fs.readFileSync(scanPath, "utf-8");
        expect(content).toMatch(/# .*scan/i);
        expect(content).toContain("baba scan");
        expect(content).toContain("bbyg scan");
        expect(content).toContain("matryoshka scan");
        expect(content).toContain("--badge");
        expect(content).toContain("--json");
      });

      it("documents L0-L4 maturity scoring model and 5 governance axes based on harness-score oracle", () => {
        const content = fs.readFileSync(scanPath, "utf-8");
        expect(content).toContain("harness-score");
        expect(content).toContain("105");
        expect(content).toContain("L0");
        expect(content).toContain("L4");
        // 5 axes
        expect(content).toContain("Context");
        expect(content).toContain("Skills");
        expect(content).toContain("Guardrails");
        expect(content).toContain("Sensors");
        expect(content).toContain("Hygiene");
      });

      it("documents dynamic SVG badge generation and color calibration", () => {
        const content = fs.readFileSync(scanPath, "utf-8");
        expect(content).toContain("harness-badge.svg");
        expect(content).toContain("#cf222e");
        expect(content).toContain("#2ea44f");
      });

      it("documents human output, structured JSON schema, and contains zero placeholders", () => {
        const content = fs.readFileSync(scanPath, "utf-8");
        expect(content).toContain("```json");
        expect(content).toContain('"oracleScore"');
        expect(content).toContain('"oracleLevel"');
        expect(content).toContain('"remediationIssues"');
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("wrap.md content verification", () => {
      it("contains comprehensive documentation of baba wrap syntax, options, and exit codes", () => {
        const content = fs.readFileSync(wrapPath, "utf-8");
        expect(content).toMatch(/# .*wrap/i);
        expect(content).toContain("baba wrap");
        expect(content).toContain("bbyg wrap");
        expect(content).toContain("matryoshka wrap");
        expect(content).toContain("--output");
        expect(content).toContain("--strict");
        expect(content).toContain("--threshold");
        expect(content).toContain("--max-file-size");
        expect(content).toContain("--dry-run");
        expect(content).toContain("--json");
      });

      it("documents Tree-sitter WASM polyglot AST engine and all 3 core antipattern rules", () => {
        const content = fs.readFileSync(wrapPath, "utf-8");
        expect(content).toContain("Tree-sitter");
        expect(content).toContain("WebAssembly");
        expect(content).toContain("raw-sql");
        expect(content).toContain("CWE-89");
        expect(content).toContain("assertionless-test");
        expect(content).toContain("hardcoded-credential");
      });

      it("documents Harness² composite score calculation and DIAGNOSTIC.md report generation", () => {
        const content = fs.readFileSync(wrapPath, "utf-8");
        expect(content).toContain("0.4");
        expect(content).toContain("0.6");
        expect(content).toContain("DIAGNOSTIC.md");
        expect(content).toContain("1,500");
      });

      it("documents CI quality gate integration with strict failure modes and contains zero placeholders", () => {
        const content = fs.readFileSync(wrapPath, "utf-8");
        expect(content).toContain("exit code 1");
        expect(content).toContain("threshold");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("agents.md content verification", () => {
      it("contains comprehensive documentation of baba agents subcommands and syntax", () => {
        const content = fs.readFileSync(agentsPath, "utf-8");
        expect(content).toMatch(/# .*agents/i);
        expect(content).toContain("baba agents generate");
        expect(content).toContain("baba agents profile");
        expect(content).toContain("baba agents check");
        expect(content).toContain("baba agents skill");
        expect(content).toContain("bbyg agents");
        expect(content).toContain("matryoshka agents");
      });

      it("documents token budgeting invariants and safety backup mechanism", () => {
        const content = fs.readFileSync(agentsPath, "utf-8");
        expect(content).toContain("AGENTS.md");
        expect(content).toContain("200");
        expect(content).toContain("250");
        expect(content).toContain("--force");
        expect(content).toContain("AGENTS.md.bak");
      });

      it("documents modular on-demand skills with mandatory YAML frontmatter", () => {
        const content = fs.readFileSync(agentsPath, "utf-8");
        expect(content).toContain(".agents/skills/");
        expect(content).toContain("YAML frontmatter");
        expect(content).toContain("backend");
        expect(content).toContain("frontend");
        expect(content).toContain("database");
        expect(content).toContain("security");
        expect(content).toContain("testing");
      });

      it("documents archetype profiling and contains zero placeholders", () => {
        const content = fs.readFileSync(agentsPath, "utf-8");
        expect(content).toContain("api_backend");
        expect(content).toContain("YAGNI");
        expect(content).toContain("DRY");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("mcp.md content verification", () => {
      it("contains comprehensive documentation of baba mcp subcommands and syntax", () => {
        const content = fs.readFileSync(mcpPath, "utf-8");
        expect(content).toMatch(/# .*mcp/i);
        expect(content).toContain("baba mcp wire");
        expect(content).toContain("baba mcp serve");
        expect(content).toContain("bbyg mcp");
        expect(content).toContain("matryoshka mcp");
      });

      it("documents auto-wiring across Cursor, Gemini CLI, and Claude Code with deep non-destructive merge", () => {
        const content = fs.readFileSync(mcpPath, "utf-8");
        expect(content).toContain("codebase-memory-mcp");
        expect(content).toContain(".cursor/mcp.json");
        expect(content).toContain(".gemini/settings.json");
        expect(content).toContain(".claude/mcp.json");
        expect(content).toContain("--targets");
        expect(content).toContain("--dry-run");
      });

      it("documents native stdio MCP server tools, resources, and prompts", () => {
        const content = fs.readFileSync(mcpPath, "utf-8");
        expect(content).toContain("stdio");
        expect(content).toContain("detect_stack");
        expect(content).toContain("scan_harness");
        expect(content).toContain("generate_agents");
        expect(content).toContain("wrap_context");
        expect(content).toContain("matryoshka://agents");
        expect(content).toContain("matryoshka://diagnostic");
        expect(content).toContain("audit_repository");
      });

      it("documents stdio isolation, stderr logging guards, and contains zero placeholders", () => {
        const content = fs.readFileSync(mcpPath, "utf-8");
        expect(content).toContain("stderr");
        expect(content).toContain("JSON-RPC 2.0");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    it("verifies architectural decision is documented in docs/EXPERIENCE.md", () => {
      const experiencePath = path.join(repoRoot, "docs", "EXPERIENCE.md");
      const expContent = fs.readFileSync(experiencePath, "utf-8");
      expect(expContent).toContain("[cli-reference-docs]");
      expect(expContent).toContain("detect.md");
      expect(expContent).toContain("scan.md");
      expect(expContent).toContain("wrap.md");
      expect(expContent).toContain("agents.md");
      expect(expContent).toContain("mcp.md");
    });
  });

  describe("Subtask 5: Author Integrations guide in docs/guide/integrations/ (mcp-server.md, ci-cd-gates.md)", () => {
    const integrationsDir = path.join(repoRoot, "docs", "guide", "integrations");
    const mcpServerPath = path.join(integrationsDir, "mcp-server.md");
    const ciCdGatesPath = path.join(integrationsDir, "ci-cd-gates.md");

    it("verifies integrations directory and all markdown reference files exist", () => {
      expect(fs.existsSync(integrationsDir)).toBe(true);
      expect(fs.existsSync(mcpServerPath)).toBe(true);
      expect(fs.existsSync(ciCdGatesPath)).toBe(true);
    });

    describe("mcp-server.md content verification", () => {
      it("contains comprehensive documentation of Model Context Protocol (MCP) server architecture", () => {
        const content = fs.readFileSync(mcpServerPath, "utf-8");
        expect(content).toMatch(/# .*MCP Server/i);
        expect(content).toContain("Model Context Protocol");
        expect(content).toContain("JSON-RPC 2.0");
        expect(content).toContain("stdio");
      });

      it("documents stdio stream isolation and stderr logging guards", () => {
        const content = fs.readFileSync(mcpServerPath, "utf-8");
        expect(content).toContain("stdout");
        expect(content).toContain("stderr");
        expect(content).toContain("installStderrLoggingGuard");
        expect(content).toContain("[matryoshka-mcp]");
      });

      it("documents all 4 native MCP tools in detail", () => {
        const content = fs.readFileSync(mcpServerPath, "utf-8");
        expect(content).toContain("detect_stack");
        expect(content).toContain("scan_harness");
        expect(content).toContain("generate_agents");
        expect(content).toContain("wrap_context");
      });

      it("documents native MCP resources and prompts", () => {
        const content = fs.readFileSync(mcpServerPath, "utf-8");
        expect(content).toContain("matryoshka://agents");
        expect(content).toContain("matryoshka://diagnostic");
        expect(content).toContain("audit_repository");
      });

      it("documents IDE client configuration for Cursor, Claude Code, Gemini CLI, and Zed", () => {
        const content = fs.readFileSync(mcpServerPath, "utf-8");
        expect(content).toContain(".cursor/mcp.json");
        expect(content).toContain(".claude/mcp.json");
        expect(content).toContain(".gemini/settings.json");
        expect(content).toContain("baba mcp wire");
        expect(content).toContain("baba mcp serve");
      });

      it("contains Mermaid architectural diagram and contains zero placeholders", () => {
        const content = fs.readFileSync(mcpServerPath, "utf-8");
        expect(content).toContain("```mermaid");
        expect(content).toMatch(/sequenceDiagram|flowchart|graph/);
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    describe("ci-cd-gates.md content verification", () => {
      it("contains comprehensive documentation of CI/CD Quality Gates pipeline", () => {
        const content = fs.readFileSync(ciCdGatesPath, "utf-8");
        expect(content).toMatch(/# .*CI\/CD/i);
        expect(content).toContain("baba wrap");
        expect(content).toContain("--strict");
        expect(content).toContain("--threshold");
      });

      it("documents exit codes, strict failure modes, and critical AST violation blocking", () => {
        const content = fs.readFileSync(ciCdGatesPath, "utf-8");
        expect(content).toContain("exit code 1");
        expect(content).toContain("exit code 0");
        expect(content).toContain("raw-sql");
        expect(content).toContain("hardcoded-credential");
        expect(content).toContain("assertionless-test");
      });

      it("documents GitHub Actions workflows and configuration examples", () => {
        const content = fs.readFileSync(ciCdGatesPath, "utf-8");
        expect(content).toContain(".github/workflows/ci.yml");
        expect(content).toContain(".github/workflows/maintainer-gate.yml");
        expect(content).toContain(".github/CODEOWNERS");
        expect(content).toContain("@maiquelleonel");
      });

      it("documents automated SemVer release pipeline and binary distribution", () => {
        const content = fs.readFileSync(ciCdGatesPath, "utf-8");
        expect(content).toContain(".github/workflows/release.yml");
        expect(content).toContain("Conventional Commits");
        expect(content).toContain("build:binaries");
        expect(content).toContain("build:shells");
      });

      it("documents remediation workflow and contains zero placeholders", () => {
        const content = fs.readFileSync(ciCdGatesPath, "utf-8");
        expect(content).toContain("DIAGNOSTIC.md");
        expect(content).toContain("```mermaid");
        expect(content).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
      });
    });

    it("verifies architectural decision is documented in docs/EXPERIENCE.md", () => {
      const experiencePath = path.join(repoRoot, "docs", "EXPERIENCE.md");
      const expContent = fs.readFileSync(experiencePath, "utf-8");
      expect(expContent).toContain("[integrations-guide]");
      expect(expContent).toContain("mcp-server.md");
      expect(expContent).toContain("ci-cd-gates.md");
    });
  });
});
