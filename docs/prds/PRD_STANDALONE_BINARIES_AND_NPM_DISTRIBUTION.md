# 📦 PRD: Standalone Binaries Compilation & NPM Universal Distribution

## 🎯 1. Context & Executive Summary
With the core Polyglot AST Engine (Phase 4) and Native MCP Server (Phase 5.1) completed and verified, **Matryoshka-Harness** (`baba` / `bbyg` / `matryoshka`) must be packaged for universal, zero-friction consumption by developers and autonomous agent sandboxes worldwide.

This PRD specifies:
1. **Deterministic Standalone Compilation:** Compiling self-contained, zero-dependency native executables using Bun's native compiler (`bun build --compile`) across target architectures.
2. **NPM Scoped Registry Publishing:** Publishing the canonical `@maiquelleonel/matryoshka` package with exposed binary aliases (`matryoshka`, `baba`, `bbyg`) executable on-demand via `npx` or `bunx`.
3. **Typosquatting Protective Shells:** Automatic publishing of alias shells (`@maiquelleonel/baba`, `@maiquelleonel/bbyg`, `@maiquelleonel/matrioska`) delegating seamlessly to the canonical package.
4. **Automated Release Pipeline:** An automated GitHub Actions release workflow triggering on version tags, building platform artifacts, publishing GitHub Releases with SHA-256 checksums, and pushing packages to NPM via `NPM_TOKEN`.

---

## 🏗️ 2. Architectural Design & Deliverables

### 2.1 Multi-Target Standalone Binaries
Using `bun build --compile --minify`, Matryoshka will compile single executable binaries embedding the JavaScript/TypeScript runtime, CLI logic, and Tree-sitter WASM grammars:

| Target Platform | Binary Output Name | Target Triplet | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **Linux x64** | `baba-linux-x64` | `bun-linux-x64` | CI/CD pipelines, Docker sandboxes, Linux workstations |
| **Linux ARM64** | `baba-linux-arm64` | `bun-linux-arm64` | AWS Graviton, Raspberry Pi, Cloud ARM instances |
| **macOS Apple Silicon** | `baba-darwin-arm64` | `bun-darwin-arm64` | M1/M2/M3/M4 macOS developer workstations |
| **Windows x64** | `baba-windows-x64.exe` | `bun-windows-x64` | Windows developer workstations |

### 2.2 Canonical Package Architecture (`@maiquelleonel/matryoshka`)
* **Registry:** `https://registry.npmjs.org/`
* **Access Level:** `public`
* **Manifest (`package.json`):**
  ```json
  {
    "name": "@maiquelleonel/matryoshka",
    "version": "0.4.0",
    "description": "Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation for Coding Agents",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "bin": {
      "matryoshka": "dist/cli.js",
      "baba": "dist/cli.js",
      "bbyg": "dist/cli.js"
    },
    "publishConfig": {
      "access": "public"
    }
  }
  ```
* **Execution Ergonomics:**
  * `bunx @maiquelleonel/matryoshka wrap`
  * `npx @maiquelleonel/matryoshka detect`
  * `baba` / `bbyg` when installed globally (`npm install -g @maiquelleonel/matryoshka`).

### 2.3 Protective Typosquatting Shells
To protect the ecosystem against supply-chain attacks, namespace confusion, and typosquatting, lightweight forwarding packages will be published under the `@maiquelleonel` scope:
* `@maiquelleonel/baba`
* `@maiquelleonel/bbyg`
* `@maiquelleonel/matrioska`
* `@maiquelleonel/matryoska`

Each shell package declares `@maiquelleonel/matryoshka` as a direct dependency and forwards CLI invocations directly to the canonical binary.

---

## ⚙️ 3. Release Automation & GitHub Actions Pipeline

The release workflow (`.github/workflows/release.yml`) operates under strict maintainer approval and runs upon pushing semantic tags (`v*.*.*`):

```
┌────────────────────────────────────────────────────────┐
│ Tag Pushed (v0.4.0)                                    │
├────────────────────────────────────────────────────────┤
│ 1. Verification Gate (Lint, AST Check, Bun Tests)     │
│ 2. Multi-Target Standalone Compilation (Linux/Darwin) │
│ 3. SHA-256 Checksums Generation (`checksums.txt`)      │
│ 4. GitHub Release Creation with Artifacts              │
│ 5. NPM Registry Authentication via `NPM_TOKEN`         │
│ 6. Scoped Public Release: `@maiquelleonel/matryoshka`  │
│ 7. Typosquatting Shells Release                       │
└────────────────────────────────────────────────────────┘
```

---

## 🥒 4. Behavior-Driven Verification (BDD Gherkin)

```gherkin
Feature: Standalone Binary Execution & NPM Package Distribution

  Scenario: Standalone compiled binary executes without host toolchain
    Given a compiled standalone binary "baba-linux-x64"
    When the binary is executed in a minimal environment without Bun or Node.js
    Then it should print valid help text for "--help"
    And it should execute "detect" within 50ms returning valid stack information
    And it should successfully parse WebAssembly Tree-sitter grammars

  Scenario: Canonical package is executable via standard package runners
    Given the package "@maiquelleonel/matryoshka" published to the NPM registry
    When an external project invokes "bunx @maiquelleonel/matryoshka --version"
    Or an external project invokes "npx @maiquelleonel/matryoshka --version"
    Then it should exit with code 0
    And return the matching SemVer version string

  Scenario: All three binary aliases are exposed and operational
    Given "@maiquelleonel/matryoshka" installed globally or executed locally
    When invoking "matryoshka --version"
    And invoking "baba --version"
    And invoking "bbyg --version"
    Then all three commands should execute identical logic
    And resolve the same version and CLI command dispatcher
```

---

## 📋 5. Acceptance & Quality Gates
1. [ ] Standalone build script in `scripts/build-binaries.ts` producing valid binaries for Linux and macOS.
2. [ ] Binary sizes verified under 100MB per executable.
3. [ ] GitHub Actions release workflow updated to consume `NPM_TOKEN` with `--access public`.
4. [ ] Build artifact hashes generated and published in `checksums.txt`.
5. [ ] Release tested locally in a clean, isolated container prior to remote tag execution.
