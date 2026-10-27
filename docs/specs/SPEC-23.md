# 📐 SPEC-23: feat(agents): non-destructive legacy AGENTS.md migration engine (`baba agents migrate`)

**Módulo:** SDD Engine / Automated Architecture  
**Status:** ready4dev (Subtask 1: Detailed PRD & Technical Specification)  
**Gatilho:** Issue #23  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objetivo & Escopo
Implementar `baba agents migrate [path]` (e seus aliases canônicos `bbyg agents migrate`, `matryoshka agents migrate`) para realizar a migração não-destrutiva de arquivos monolíticos de instruções legadas (`AGENTS.md`, `.cursorrules`, `CLAUDE.md`, `.windsurfrules`).
O objetivo principal é encapsular 100% das convenções históricas, regras de domínio de negócio e peculiaridades arquiteturais em skills modulares ativas (`.agents/skills/legacy-knowledge.md`), carimbando-as com Frontmatter YAML padronizado (`origin: legacy_migration`, `name: legacy-knowledge`, `description: ...`), compilando um `AGENTS.md` raiz ultraleve (< 200 tokens) que referencia a nova skill em seu catálogo sob demanda, e preservando um snapshot exato de rollback em `AGENTS.md.bak`.

---

## 📋 2. Contratos de I/O & Interfaces TypeScript

### 2.1 Estrutura de Skill Extraída (`ExtractedSkill`)
```typescript
export interface ExtractedSkill {
  name: string;
  relativePath: string;
  description: string;
  origin: "legacy_migration";
  migratedAt: string;
  content: string;
  estimatedTokens: number;
}
```

### 2.2 Resumo de Economia de Tokens (`TokenSavingsSummary`)
```typescript
export interface TokenSavingsSummary {
  beforeTokens: number;
  afterTokens: number;
  savedTokens: number;
  reductionPercentage: number;
}
```

### 2.3 Opções de Migração (`LegacyMigrationOptions`)
```typescript
export interface LegacyMigrationOptions {
  projectPath?: string;
  from?: string;               // default: "AGENTS.md" (e.g., ".cursorrules", "CLAUDE.md")
  dryRun?: boolean;            // default: false
  json?: boolean;              // default: false
  force?: boolean;             // default: false (overwrite without failing if backup exists)
  maxRootTokens?: number;      // default: 200 (hard ceiling: 250)
}
```

### 2.4 Resultado da Migração (`LegacyMigrationResult`)
```typescript
export interface LegacyMigrationResult {
  success: boolean;
  status: "success" | "simulated" | "error" | "unchanged";
  sourceFile: string;
  backupPath?: string;
  backupCreated: boolean;
  rootAgentsPath: string;
  rootAgentsTokens: number;
  extractedSkills: ExtractedSkill[];
  tokenSavings: TokenSavingsSummary;
  dryRun: boolean;
  durationMs: number;
  error?: string;
}
```

### 2.5 Assinatura da Função Principal
```typescript
export function migrateLegacyInstructions(
  projectPath?: string,
  options?: LegacyMigrationOptions
): LegacyMigrationResult;
```

### 2.6 Contratos de Linha de Comando (CLI)
- `baba agents migrate [path] [--from=<file>] [--dry-run] [--force] [--json]`
- `bbyg agents migrate [path] [--from=<file>] [--dry-run] [--force] [--json]`
- `matryoshka agents migrate [path] [--from=<file>] [--dry-run] [--force] [--json]`

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
Feature: feat(agents): non-destructive legacy AGENTS.md migration engine (`baba agents migrate`)

  Scenario: AC-1 - Subtask 1: Detailed PRD: docs/prds/PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md
    Given O ambiente de execução está operacional e pronto para processar Subtask 1
    When A documentação do PRD e especificações técnicas de SPEC-23 são validadas
    Then O arquivo "docs/prds/PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md" existe e é substantivo (> 3.5KB)
    And Define os 9 Production Dimensions Audit e critérios BDD para migração não-destrutiva
    And O arquivo "docs/specs/SPEC-23.md" define os contratos TypeScript completos

  Scenario: AC-2 - Subtask 2: Zero-Loss Skill Conversion into .agents/skills/legacy-knowledge.md
    Given Um arquivo AGENTS.md monolítico legado de 1.200 tokens com regras de domínio
    When O comando "baba agents migrate" é executado
    Then O arquivo ".agents/skills/legacy-knowledge.md" é criado no disco
    And 100% das diretrizes e convenções originais são preservadas no corpo da skill

  Scenario: AC-3 - Subtask 3: YAML Frontmatter Stamping on Migrated Skills
    Given Uma skill legada migrada em ".agents/skills/legacy-knowledge.md"
    When O cabeçalho do arquivo é inspecionado
    Then Contém frontmatter YAML válido com delimitadores "---"
    And Os metadados contêm "origin: legacy_migration", "name: legacy-knowledge" e "description" descritiva

  Scenario: AC-4 - Subtask 4: Lean Root Compilation (< 200 tokens)
    Given Um arquivo monolítico de regras com mais de 1.000 tokens
    When O comando "baba agents migrate" é executado
    Then O novo arquivo raiz "AGENTS.md" gerado possui menos de 200 tokens
    And Registra e referencia formalmente ".agents/skills/legacy-knowledge.md" em seu catálogo

  Scenario: AC-5 - Subtask 5: Rollback Safety Snapshot in AGENTS.md.bak
    Given Um arquivo existente AGENTS.md antes da migração
    When O comando "baba agents migrate" é executado
    Then Um arquivo "AGENTS.md.bak" é gerado como snapshot exato do conteúdo pré-migração
    And O snapshot permite rollback seguro sem perda de dados históricos

  Scenario: AC-6 - Subtask 6: CLI Options: --dry-run and --from=<file>
    Given Um arquivo de regras customizado ".cursorrules"
    When O comando "baba agents migrate --from=.cursorrules --dry-run" é executado
    Then Nenhum arquivo em disco é criado ou modificado
    And A saída exibe o diff de extração planejado e a redução de tokens
    When O comando "baba agents migrate --from=.cursorrules" é executado
    Then A skill é extraída de ".cursorrules" e o backup ".cursorrules.bak" é criado

  Scenario: AC-7 - Subtask 7: Full BDD Test Suite Verification
    Given A suíte BDD em "tests/legacy_migration.test.ts"
    When "bun test tests/legacy_migration.test.ts" é executado
    Then Todos os testes de aceitação passam com 0 falhas

  Scenario: AC-8 - Subtask 8: Strict Alias Parity across baba, bbyg, and matryoshka
    Given Os três aliases canônicos da CLI ("baba", "bbyg", "matryoshka")
    When Invocados com "agents migrate --dry-run --json"
    Then Produzem comportamentos, códigos de saída e payloads JSON estritamente idênticos
```

---

## 🔒 4. Invariantes & Casos de Borda
- **Invariante de Zero-Loss:** 100% do conteúdo original das instruções é preservado no corpo de `.agents/skills/legacy-knowledge.md` e em `AGENTS.md.bak`. Nenhuma linha com valor instrucional é descartada.
- **Teto Rígido de Tokens no Root:** O arquivo `AGENTS.md` compilado deve estritamente respeitar o teto de 200 tokens (limite máximo de 250 tokens).
- **Idempotência Estrita:** Executar `baba agents migrate` em uma base já migrada detecta os metadados de frontmatter (`origin: legacy_migration`) e não cria duplicações recursivas de skills.
- **Isolamento de Erros e Atomics Writes:** As gravações em disco utilizam arquivos temporários (`.tmp`) com renomeação atômica para evitar arquivos corrompidos ou incompletos em caso de interrupção.
- **Paridade Estrita de Aliases:** `baba agents migrate`, `bbyg agents migrate` e `matryoshka agents migrate` executam o mesmo pipeline determinístico com os mesmos argumentos e flags.

---

## 📁 5. Arquivos Afetados
- `docs/prds/PRD_NON_DESTRUCTIVE_LEGACY_MIGRATION.md`
- `docs/specs/SPEC-23.md`
- `docs/EXPERIENCE.md`
- `tests/legacy_migration.test.ts`
- `src/agents.ts`
- `src/cli.ts`
- `src/types.ts`
