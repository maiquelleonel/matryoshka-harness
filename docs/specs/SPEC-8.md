# 📐 SPEC-8: feat(agents): context-aware adaptive AGENTS.md and modular skills engine

**Módulo:** SDD Engine / Automated Architecture  
**Status:** in_progress (Subtask 4: Root AGENTS.md Template Engine & Token Guard)  
**Gatilho:** Issue #8  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objetivo & Escopo
Modern AI coding agents suffer from **context pollution** (dumping 1,500+ lines of monolithic instructions into every prompt turn) and **generic AI slop** (unidiomatic abstractions, textbook class hierarchies in declarative frameworks).

The **Matryoshka Adaptive Engine** solves this by generating:
1. **Ultra-lean root `AGENTS.md` (<200 tokens):** Defining archetype identity, canonical test/build/lint commands, and non-negotiable anti-slop rules.
2. **On-demand modular skills with strict YAML Frontmatter (`.agents/skills/`):** Specialized guidance (Backend, Frontend, Database, Security, Testing) loaded **only on demand** via metadata index to prevent premature context flooding.
3. **Archetype Profiler & Seam Discovery:** Deterministic classification of repos into canonical archetypes (`api_backend`, `opinionated_monolith`, `reactive_frontend`, `systems_microservice`, `fullstack_hybrid`) and discovery of architectural layers/seams (routes, models, controllers, services, views/templates, testing).

---

## 📋 2. Contratos de I/O & Interfaces

### 2.1 Interface `DiscoveredSeams`
```typescript
export interface DiscoveredSeams {
  hasBackend: boolean;
  hasFrontend: boolean;
  hasDatabase: boolean;
  hasSecurity: boolean;
  hasTesting: boolean;
  routes: string[];
  models: string[];
  controllers: string[];
  services: string[];
  views: string[];
  tests: string[];
}
```

### 2.2 Interface `ArchetypeProfile`
```typescript
export interface ArchetypeProfile {
  archetype: AgentArchetype;
  runtime: string;
  packageManager: string;
  testCommand: string;
  buildCommand: string;
  lintCommand: string;
  activeSkills: SkillName[];
  seams: DiscoveredSeams;
}
```

### 2.3 Funções do Profiler, Template Engine & Token Guard
- `discoverSeams(projectPath: string): DiscoveredSeams`
- `profileArchetype(projectPath: string): ArchetypeProfile`
- `compileRootAgents(profile: RootAgentsProfileInput, options?: RootAgentsTemplateOptions): string`
- `inspectTokenBudget(content: string, maxTokens?: number): TokenGuardReport`
- `assertTokenBudget(content: string, maxTokens?: number): TokenGuardReport`
- `generateAgents(projectPath?: string, options?: GenerateAgentsOptions): GenerateAgentsResult`
- CLI subcommand: `baba agents profile [path] [--json]`
- CLI subcommand: `baba agents check [path] [--json] [--max-tokens <num>]`
- CLI subcommand: `baba agents generate [path] [--force] [--dry-run] [--json]`

### 2.4 Contratos de Token Guard
```typescript
export const MAX_ROOT_AGENTS_TOKENS = 250;
export const TARGET_ROOT_AGENTS_TOKENS = 200;

export interface TokenGuardReport {
  tokenCount: number;
  maxTokens: number;
  targetTokens: number;
  withinBudget: boolean;
  exceededBy: number;
  savingsPercentage: number;
}

export class TokenBudgetExceededError extends Error {
  public readonly tokenCount: number;
  public readonly maxTokens: number;
  public readonly exceededBy: number;
}
```

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
Feature: feat(agents): context-aware adaptive AGENTS.md and modular skills engine

  Scenario: AC-1 - Subtask 1: Ultra-lean root AGENTS.md (<200 tokens)
    Given um repositório configurado
    When a geração de AGENTS.md é executada
    Then o arquivo AGENTS.md deve ter menos de 200 tokens
    And conter comandos canônicos de test/build/lint e regras anti-slop

  Scenario: AC-2 - Subtask 2: On-demand modular skills with YAML Frontmatter
    Given diretório '.agents/skills/'
    When as skills modulares são compiladas
    Then cada skill deve conter frontmatter YAML com 'name' e 'description'
    And o índice de metadados deve carregar as instruções estritamente sob demanda

  Scenario: AC-3 - Subtask 3: Archetype Profiler & Seam Discovery
    Given um repositório poliglota, monorepo ou monólito
    When 'profileArchetype(projectPath)' ou 'baba agents profile [path]' é executado
    Then o repositório deve ser classificado no arquétipo canônico correspondente:
      | api_backend           | FastAPI, Django Ninja, Express, Actix, Gin    |
      | opinionated_monolith  | Django, Laravel, Ruby on Rails, NestJS        |
      | reactive_frontend     | React, Vue, Svelte, Next.js, Nuxt             |
      | systems_microservice  | Rust (Cargo), Go (go.mod) sem Web UI          |
      | fullstack_hybrid      | Monorepo (Next.js + Python/Go) ou Fullstack   |
    And as camadas arquiteturais ('seams': routes, models, controllers, services, views, tests) devem ser identificadas
    And skills ativas devem refletir as costuras arquiteturais existentes (ex: omitir skill-frontend se não houver frontend/views)

  Scenario: AC-4 - Subtask 4: Root AGENTS.md Template Engine & Token Guard
    Given perfil arquitetural inferido
    When o template é renderizado
    Then deve respeitar teto de 250 tokens com comandos resolvidos

  Scenario: AC-5 - Subtask 5: Backend & Database Skill Compilers
    Given regras de backend e banco de dados
    When 'skill-backend.md' e 'skill-database.md' são geradas
    Then devem conter regras anti-N+1, isolamento transacional e migrações zero-downtime

  Scenario: AC-6 - Subtask 6: Frontend & Security Skill Compilers
    Given regras de frontend e segurança
    When 'skill-frontend.md' e 'skill-security.md' são geradas
    Then devem conter regras de pure rendering, CLS, A11y, OWASP e zero-leak

  Scenario: AC-7 - Subtask 7: Testing & Verification Skill Compiler
    Given regras de teste e The Seam Contract
    When 'skill-testing.md' é gerada
    Then deve conter contrato Red-to-Green e fronteiras de isolamento/mock

  Scenario: AC-8 - Subtask 8: CLI Subcommand & Overwrite Guardrails
    Given execução CLI de 'baba agents generate'
    When executado com '--force', '--dry-run' ou '--json'
    Then deve realizar backup para 'AGENTS.md.bak' e respeitar flags estruturadas
```

---

## 🔒 4. Invariantes & Casos de Borda
- **Sub-15ms Execution:** A detecção de arquétipos e costuras não deve exceder 25ms.
- **Monorepo Seam Resolution:** Suporte a layouts `apps/`, `packages/`, `frontend/`, `backend/`, `services/`.
- **Zero-False-Positive Frontends:** Monólitos em modo API (Rails `--api` ou Django Ninja) sem pastas de views/templates devem omitir `skill-frontend.md`.
- **Idempotência & Isolamento:** Nenhuma escrita em disco em chamadas de `profile` ou `dryRun`.

---

## 📁 5. Arquivos Afetados
- `docs/specs/SPEC-8.md`
- `src/agents.ts`
- `src/cli.ts`
- `tests/agents_generator.test.ts`
- `docs/EXPERIENCE.md`
