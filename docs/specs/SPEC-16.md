# 📐 SPEC-16: feat(release): standalone bun binaries compilation & npm distribution (Phase 5.2)

**Módulo:** Release Engineering / Multi-Platform Distribution  
**Status:** completed (Subtask 3: Implement forwarding wrappers for typosquatting protective shells)  
**Gatilho:** Issue #16  
**Target:** Bun + TypeScript + Standalone Native Executables  

---

## 🎯 1. Objetivo & Escopo
Implement `docs/prds/PRD_STANDALONE_BINARIES_AND_NPM_DISTRIBUTION.md` to package Matryoshka-Harness (`baba` / `bbyg` / `matryoshka`) for universal, zero-friction consumption by developers and autonomous agent sandboxes worldwide.

### Escopo Arquitetural:
1. **Multi-Target Standalone Binaries Compilation (`scripts/build-binaries.ts`) (Subtask 1):**
   - Deterministic compilation of single executable binaries using `bun build --compile --minify`.
   - Supported targets:
     - `linux-x64` (`bun-linux-x64` -> `baba-linux-x64`)
     - `linux-arm64` (`bun-linux-arm64` -> `baba-linux-arm64`)
     - `darwin-arm64` (`bun-darwin-arm64` -> `baba-darwin-arm64`)
     - `darwin-x64` (`bun-darwin-arm64` -> `baba-darwin-x64`)
     - `windows-x64` (`bun-windows-x64` -> `baba-windows-x64.exe`)
   - CLI flags: `--targets`, `--out-dir`, `--no-minify`, `--no-checksums`, `--dry-run`, `--json`.
   - Automatic generation of `checksums.txt` containing SHA-256 hashes in canonical format (`<hash>  <filename>`).
   - Binary size guardrail (< 100MB).
2. **NPM Scoped Registry Publishing (Subtask 2):**
   - Configure `package.json` for canonical package `@maiquelleonel/matryoshka` with public access (`publishConfig.access: "public"`).
   - Remove `"private": true` to allow registry distribution.
   - Configure canonical entrypoints: `main`, `module`, `types`, and `exports` mapping (`dist/index.js` and `dist/index.d.ts`).
   - Expose binary aliases in `bin`: `matryoshka`, `baba`, `bbyg` all dispatching to `dist/cli.js`.
   - Update `build` script to package both library (`index.js`), CLI dispatcher (`cli.js`), and declaration types (`index.d.ts`).
   - Specify distribution whitelist in `files` (`dist`, `README.md`, `LICENSE`).
3. **Protective Typosquatting Forwarding Shells (Subtask 3):**
   - Scaffold forwarding packages (`@maiquelleonel/baba`, `@maiquelleonel/bbyg`, `@maiquelleonel/matrioska`, `@maiquelleonel/matryoska`).
4. **CI/CD Release Automation (Subtask 4):**
   - Update `.github/workflows/release.yml` with multi-target binary building, checksum verification, GitHub Releases attachment, and NPM publishing.
5. **Verification & Acceptance Test Suite (Subtask 5):**
   - Comprehensive tests validating standalone binary compilation, CLI parity, and checksum validation.

---

## 📋 2. Contratos de I/O & Tipagem

### 2.1 Modelos de Dados e Configuração (Subtask 1)

```typescript
export interface BuildTarget {
  name: string;
  platform: "linux" | "darwin" | "windows";
  arch: "x64" | "arm64";
  bunTarget: string;
  outputName: string;
}

export interface BuildOptions {
  targets?: string[];
  outDir?: string;
  entrypoint?: string;
  minify?: boolean;
  generateChecksums?: boolean;
  checksumsFileName?: string;
  dryRun?: boolean;
  cwd?: string;
  silent?: boolean;
}

export interface BuildResult {
  target: BuildTarget;
  outputFile: string;
  outputPath: string;
  sizeBytes: number;
  sha256: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface BuildSummary {
  success: boolean;
  outDir: string;
  results: BuildResult[];
  checksumsPath?: string;
  checksumsContent?: string;
  totalDurationMs: number;
}
```

### 2.2 Contratos de Publicação NPM & Entrypoints (Subtask 2)

```json
{
  "name": "@maiquelleonel/matryoshka",
  "version": "0.4.0",
  "description": "Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation for Coding Agents",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "matryoshka": "dist/cli.js",
    "baba": "dist/cli.js",
    "bbyg": "dist/cli.js"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

### 2.3 Invariantes de Execução (Subtask 2)
- **Acesso Público:** A publicação no NPM é restrita ao escopo `@maiquelleonel` com `access: "public"`; o campo `"private": true` deve ser removido.
- **Tríade de Aliases no Bin:** `matryoshka`, `baba` e `bbyg` devem apontar de forma idêntica para o executável compilado `dist/cli.js`.
- **Compilação Completa de Build:** O script `bun run build` deve produzir atomicamente `dist/index.js` (biblioteca), `dist/cli.js` (CLI e bin dispatcher), e `dist/index.d.ts` (definições de tipos).
- **SemVer Parity:** O CLI deve responder à flag `--version` reportando a versão exata do manifesto (`0.4.0`).
- **Whitelisting de Pacote:** O pacote NPM final publicado deve conter apenas artefatos de distribuição (`dist`), metadados e documentação (`README.md`, `LICENSE`), prevenindo vazamento de testes ou arquivos efêmeros.

### 2.4 Modelos e Contratos de Cascas de Typosquatting (Subtask 3)

```typescript
export interface ProtectiveShellConfig {
  name: string;
  packageName: string;
  description: string;
  binName: string;
  aliases: string[];
  targetPackage: string;
  isTypoProtection?: boolean;
}

export interface ShellScaffoldResult {
  packageName: string;
  directory: string;
  filesWritten: string[];
  success: boolean;
  error?: string;
}

export interface ShellVerificationResult {
  packageName: string;
  directory: string;
  validManifest: boolean;
  validForwarder: boolean;
  validDependency: boolean;
  isPublic: boolean;
  success: boolean;
  errors: string[];
}
```

#### Definições Canônicas das Cascas (`PROTECTIVE_SHELLS`):
1. `@maiquelleonel/baba` -> Alias ergonômico de 4 letras (matriarca eslava).
2. `@maiquelleonel/bbyg` -> Atalho ultra-compacto (baba-yaga).
3. `@maiquelleonel/matrioska` -> Proteção contra erro comum de digitação (`i` em vez de `y`).
4. `@maiquelleonel/matryoska` -> Proteção contra erro comum de digitação (omissão do `h`).

Cada pacote declara `@maiquelleonel/matryoshka: "^0.4.0"` como dependência direta, expõe executáveis de encaminhamento em `bin/` com permissão de execução (`chmod +x`), reexporta a API da biblioteca via `index.js`, e inclui `README.md` explicativo e licença MIT.

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)

### Subtask 1: Compilation Script
```gherkin
Feature: Standalone Binaries Compilation Script (Subtask 1)

  Scenario: Compiling standalone binary for the current host architecture
    Given a configured repository with entrypoint "src/cli.ts"
    When buildAllBinaries is executed with target "current"
    Then it produces a compiled executable matching host platform
    And the binary exists and has non-zero size under 100MB
    And the SHA-256 hash is computed and recorded in checksums.txt

  Scenario: Multi-target configuration and target resolution
    Given the canonical list of SUPPORTED_TARGETS
    When resolving targets with a filter "linux-x64,darwin-arm64"
    Then only the requested targets are returned
    When resolving targets with an invalid target name
    Then an error is raised indicating invalid target

  Scenario: Checksums generation in standard format
    Given build results for compiled targets
    When generateChecksumsFile is called
    Then the resulting file matches format "<sha256>  <outputName>"
    And each entry corresponds to the exact SHA-256 of the artifact

  Scenario: Dry-run execution simulation
    When buildAllBinaries is invoked with dryRun: true
    Then no files are written to disk
    And the returned BuildSummary contains success: true and planned targets

  Scenario: CLI invocation of scripts/build-binaries.ts
    When "bun run scripts/build-binaries.ts --help" is executed
    Then it outputs usage instructions and available options
    When "bun run scripts/build-binaries.ts --dry-run --json" is executed
    Then it outputs a valid JSON BuildSummary with exit code 0
```

### Subtask 2: NPM Publishing Metadata & Bin Dispatchers
```gherkin
Feature: NPM Publishing Metadata and Bin Dispatchers (Subtask 2)

  Scenario: Package identity and public registry publishing configuration
    Given the root "package.json" file
    Then the package name must be "@maiquelleonel/matryoshka"
    And the package must have version "0.4.0"
    And the "publishConfig.access" must be strictly set to "public"
    And the "private" flag must be removed or false

  Scenario: Canonical library entrypoints and type definitions
    Given the root "package.json" file
    Then "main" must point to "dist/index.js"
    And "module" must point to "dist/index.js"
    And "types" must point to "dist/index.d.ts"
    And "exports" must configure root "." mapping types and import to dist artifacts

  Scenario: Binary aliases configuration and execution parity
    Given the "bin" mapping in "package.json"
    Then "matryoshka" must resolve to "dist/cli.js"
    And "baba" must resolve to "dist/cli.js"
    And "bbyg" must resolve to "dist/cli.js"

  Scenario: Build script compilation of distribution artifacts
    When executing "bun run build"
    Then "dist/index.js" exists and is non-empty
    And "dist/cli.js" exists, is executable, and starts with shebang
    And "dist/index.d.ts" exists and contains type declarations
    And executing "dist/cli.js --version" outputs "0.4.0"

  Scenario: Distribution whitelisting and metadata completeness
    Given the root "package.json"
    Then "files" must include "dist", "README.md", and "LICENSE"
    And repository, license, and author metadata must be properly populated

### Subtask 3: Protective Typosquatting Shells
```gherkin
Feature: Protective Typosquatting Forwarding Shells (Subtask 3)

  Scenario: Canonical definitions and metadata of protective shells
    Given the canonical PROTECTIVE_SHELLS configuration list
    Then it defines exactly 4 protective shells: "baba", "bbyg", "matrioska", "matryoska"
    And each shell targets "@maiquelleonel/matryoshka"
    And "matrioska" and "matryoska" are flagged as typo protection packages

  Scenario: Scaffolded shell package manifests and public distribution
    Given the scaffolded directory for each shell in "packages/<name>"
    Then "package.json" exists and has "name" matching "@maiquelleonel/<name>"
    And "publishConfig.access" is strictly set to "public"
    And "dependencies" explicitly declares "@maiquelleonel/matryoshka" with matching version
    And "bin" exposes the primary alias and canonical aliases pointing to forwarding scripts
    And "files" whitelists distribution assets ("bin", "index.js", "README.md", "LICENSE")

  Scenario: Forwarding script mechanics and canonical CLI invocation
    Given a forwarding script "packages/<name>/bin/<name>.js"
    Then it starts with a valid shebang ("#!/usr/bin/env node")
    And it has executable file mode permissions
    And it successfully resolves the canonical CLI of "@maiquelleonel/matryoshka"
    When invoked with arguments "--version"
    Then it forwards arguments to the canonical CLI and returns exit code 0 with matching version

  Scenario: Library re-export parity
    Given the "index.js" entrypoint in each shell package
    When required or imported
    Then it re-exports the canonical library surface of "@maiquelleonel/matryoshka"

  Scenario: Programmatic scaffolding and verification utilities
    When scaffoldAllShells is executed with dryRun: true
    Then it plans scaffolding for all 4 shells without modifying disk
    When verifyAllShells is executed
    Then all 4 shell packages pass verification with zero errors
```
```

---

## 🔒 4. Invariantes & Casos de Borda
- Validação estrita de opções e argumentos CLI.
- Isolamento de erros: falhas de compilação são capturadas e estruturadas em `BuildResult.error`.
- Zero dependência externa não empacotada: o script utiliza APIs nativas do Bun e Node.js built-ins (`crypto`, `fs`, `path`).
- Idempotência: rodar `bun run build` repetidas vezes produz a mesma saída consistente sem corromper symlinks ou permissões de execução.

---

## 📁 5. Arquivos Afetados
- `packages/baba/*` (Casca de encaminhamento para alias baba)
- `packages/bbyg/*` (Casca de encaminhamento para alias bbyg)
- `packages/matrioska/*` (Casca de proteção contra typosquatting matrioska)
- `packages/matryoska/*` (Casca de proteção contra typosquatting matryoska)
- `scripts/build-shells.ts` (Utilitário de geração, validação e sincronização de cascas)
- `package.json` (Script de build de cascas `build:shells`)
- `tests/protective_shells.test.ts` (Suíte de testes BDD de aceitação para Subtask 3)
- `docs/specs/SPEC-16.md` (Especificação formal SDD)
