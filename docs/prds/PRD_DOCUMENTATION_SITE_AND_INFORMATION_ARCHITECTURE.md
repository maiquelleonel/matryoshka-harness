# 📚 PRD: Technical Documentation Site & Information Architecture

## 🎯 1. Context & Executive Summary
As **Matryoshka-Harness** (`baba` / `bbyg` / `matryoshka`) approaches its official public open-source launch (v0.4.0 / v1.0.0), it requires a world-class, accessible, and comprehensive documentation portal.

To guarantee zero vendor lock-in, extreme durability, and maximum rendering flexibility, this PRD establishes the **Agnostic Markdown Information Architecture**:
1. **Sovereign Pure Markdown:** All documentation is authored in clean, standard Markdown (`docs/**/*.md`) without proprietary dialect coupling.
2. **Dual-Engine Compatibility:** 100% interoperable with **MkDocs Material** (`uvx mkdocs-material serve`) as the primary zero-setup engine, while remaining directly mountable in **Astro Starlight** or **VitePress**.
3. **Developer-First Content Strategy:** Focused on immediate time-to-value (< 30 seconds), copy-pasteable snippets, actionable CLI guides, and MCP IDE setups.

---

## 🏛️ 2. Information Architecture (IA)

```
docs/
├── index.md                      # Overview, Manifesto & "The AI-Slop Crisis"
├── getting-started/
│   ├── installation.md           # Standalone binaries, npx, bunx & global install
│   └── quickstart.md             # 5-minute hands-on walkthrough
├── core-concepts/
│   ├── concentric-layers.md      # The Russian Doll mental model (Layers 1 to 5)
│   ├── polyglot-ast-engine.md    # Tree-sitter WASM & antipattern inspection
│   └── adaptive-agents.md        # Token budgeting (< 200 tokens) & modular skills
├── cli-reference/
│   ├── detect.md                 # baba detect: Stack & archetype discovery
│   ├── scan.md                   # baba scan: L1-L4 maturity scoring & SVG badges
│   ├── agents.md                 # baba agents: generate, check, profile, skill
│   └── wrap.md                   # baba wrap: Harness² verification & DIAGNOSTIC.md
├── integrations/
│   ├── mcp-server.md             # Native stdio MCP for Cursor, Claude & Gemini CLI
│   └── ci-cd-gates.md            # GitHub Actions 5-gate pipeline integration
└── community/
    ├── contributing.md           # Local setup, running tests & PR workflows
    └── ouroboros-heritage.md     # Built with mathematical rigor by Ouroboros Engine
```

---

## 🛠️ 3. Primary Rendering Engine: MkDocs Material

### 3.1 Zero-Install Local Execution
Using Python's `uv` runtime already standard in the LeonelLabs ecosystem:
```bash
# Preview live docs with hot-reloading:
uvx --with mkdocs-material mkdocs serve

# Build static HTML site:
uvx --with mkdocs-material mkdocs build --strict
```

### 3.2 Canonical Configuration (`mkdocs.yml`)
* **Strict Directory Isolation:**
  * `docs_dir: docs/guide` (Isolates public documentation from internal PRDs, SPECs, and EXPERIENCE).
  * `site_dir: site-docs` (Guarantees zero collisions with the existing interactive hotsite in `site/`).
* Theme: `material` with dark slate/emerald palette matching the Ouroboros design language.
* Features:
  * Instant search (`navigation.instant`, `search.highlight`).
  * Code copy buttons and multi-language tabs (`content.code.copy`, `content.tabs.link`).
  * Mermaid.js diagrams for architecture visualization.
  * Admonitions (`note`, `warning`, `tip`, `danger`).

---

## 🥒 4. Behavior-Driven Verification (BDD Gherkin)

```gherkin
Feature: Documentation Site Integrity & Interoperability

  Scenario: All documented internal links are valid and resolvable
    Given the documentation directory "docs/"
    When scanning all markdown files for relative internal links
    Then every relative link must point to an existing file or section anchor
    And zero dead links or 404 targets must be reported

  Scenario: Code snippets are syntactically valid and non-hallucinated
    Given documentation pages containing CLI invocation examples
    When extracting commands starting with "baba", "bbyg", or "matryoshka"
    Then all command flags and subcommands must match the active CLI parser

  Scenario: MkDocs builds in strict mode without warnings
    Given the configuration file "mkdocs.yml"
    When executing "mkdocs build --strict"
    Then the process must exit with code 0
    And generate clean static assets in the "site/" directory
```

---

## 📋 5. Acceptance Criteria
1. [ ] Complete suite of Markdown pages authored in `docs/guide/` covering all 5 CLI commands and MCP integration.
2. [ ] Minimal, maintainable `mkdocs.yml` configured with dark mode and search.
3. [ ] Automated documentation build test added to CI (`bun test` or GitHub Actions).
4. [ ] Zero proprietary extensions preventing future migration to Astro Starlight or VitePress.
