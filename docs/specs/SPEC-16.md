# 📐 SPEC-16: feat(release): standalone bun binaries compilation & npm distribution (Phase 5.2)

**Módulo:** Release Engineering / Multi-Platform Distribution  
**Status:** ready4dev (Subtask 1: Implement compilation script `scripts/build-binaries.ts` for multi-platform standalone targets)  
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
     - `darwin-x64` (`bun-darwin-x64` -> `baba-darwin-x64`)
     - `windows-x64` (`bun-windows-x64` -> `baba-windows-x64.exe`)
   - CLI flags: `--targets`, `--out-dir`, `--no-minify`, `--no-checksums`, `--dry-run`, `--json`.
   - Automatic generation of `checksums.txt` containing SHA-256 hashes in canonical format (`<hash>  <filename>`).
   - Binary size guardrail (< 100MB).
2. **NPM Scoped Registry Publishing (Subtask 2):**
   - Configure `package.json` for `@maiquelleonel/matryoshka` with public access.
   - Expose binary aliases: `matryoshka`, `baba`, `bbyg`.
3. **Protective Typosquatting Forwarding Shells (Subtask 3):**
   - Scaffold forwarding packages (`@maiquelleonel/baba`, `@maiquelleonel/bbyg`, `@maiquelleonel/matrioska`, `@maiquelleonel/matryoska`).
4. **CI/CD Release Automation (Subtask 4):**
   - Update `.github/workflows/release.yml` with multi-target binary building, checksum verification, GitHub Releases attachment, and NPM publishing.
5. **Verification & Acceptance Test Suite (Subtask 5):**
   - Comprehensive tests validating standalone binary compilation, CLI parity, and checksum validation.

---

## 📋 2. Contratos de I/O & Tipagem (Subtask 1)

### 2.1 Modelos de Dados e Configuração

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

### 2.2 Invariantes de Execução
- **Idempotência:** A execução sucessiva sobre o mesmo diretório de saída deve sobrescrever os binários de forma atômica e atualizar `checksums.txt`.
- **Target Filtering:** Permite selecionar alvos específicos via `--targets` (ex: `--targets linux-x64,darwin-arm64`) ou compilar apenas para a máquina host (`--targets current`).
- **Dry Run:** Em modo `--dry-run`, nenhum arquivo ou diretório de build é criado no disco; simula o plano de compilação e valida parâmetros.
- **Fail-Safe:** Em caso de falha de compilação em um alvo, o erro é isolado no resultado daquele target e reportado no resumo final.

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)

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

---

## 🔒 4. Invariantes & Casos de Borda
- Validação estrita de opções e argumentos CLI.
- Isolamento de erros: falhas de compilação são capturadas e estruturadas em `BuildResult.error`.
- Zero dependência externa não empacotada: o script utiliza APIs nativas do Bun e Node.js built-ins (`crypto`, `fs`, `path`).

---

## 📁 5. Arquivos Afetados
- `scripts/build-binaries.ts` (Implementação do script de compilação)
- `tests/build_binaries.test.ts` (Suíte de testes de aceitação BDD)
- `docs/specs/SPEC-16.md` (Especificação formal SDD)
