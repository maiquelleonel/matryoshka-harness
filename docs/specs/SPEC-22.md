# 📐 SPEC-22: feat(agents): cognitive context linter & turn-zero prompt simulator (`baba agents audit`)

**Módulo:** SDD Engine / Automated Architecture  
**Status:** in_progress (Subtask 4: Rule 3 (negative-phrasing-trap))  
**Gatilho:** Issue #22  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objetivo & Escopo
Implementar `baba agents audit [path]` (e seus aliases canônicos `bbyg agents audit`, `matryoshka agents audit`) como um linter cognitivo estático de contexto para agentes de inteligência artificial. Arquivos raiz de diretrizes (`AGENTS.md`, `.cursorrules`, `CLAUDE.md`) sofrem de cinco antipatterns sistêmicos:
1. **Turn-Zero Token Bloat:** Inchaço de tokens (> 250 tokens) consumidos em cada turno de inferência.
2. **Dead Skill References:** Links quebrados para módulos inexistentes em `.agents/skills/`.
3. **Negative Phrasing Trap:** Uso excessivo de negativas proibitivas (`DO NOT`, `NEVER`, `DON'T`) acionando o Paradoxo do Elefante Cor-de-Rosa (Pink Elephant Paradox) nos modelos autorregressivos.
4. **Permissive Linguistic Leaks:** Linguagem vaga e permissiva (`try to`, `if possible`, `consider`) que dilui a observância de invariantes sob carga.
5. **Greedy Preload Smells:** Injeção de blocos maciços de código ou schemas (> 25 linhas) que deveriam estar modularizados em skills sob demanda.

O comando opera de forma 100% determinística, puramente estática, sem chamadas externas a LLMs, com execução sub-25ms e zero mutação no disco.

---

## 📋 2. Contratos de I/O & Interfaces

### 2.1 Identificadores de Regra e Severidade
```typescript
export type CognitiveRuleId =
  | "token-budget"
  | "dead-skills"
  | "negative-phrasing-trap"
  | "permissive-leak"
  | "greedy-preload";

export type CognitiveViolationSeverity = "fail" | "warn" | "pass";
```

### 2.2 Estrutura de Violações e Resultados
```typescript
export interface CognitiveViolation {
  id: string;
  ruleId: CognitiveRuleId;
  severity: CognitiveViolationSeverity;
  message: string;
  file: string;
  line?: number;
  snippet?: string;
  suggestion?: string;
  metadata?: Record<string, unknown>;
}

export interface CognitiveAuditSummary {
  totalRules: number;
  failedCount: number;
  warnCount: number;
  passedCount: number;
  estimatedTokens: number;
  targetPath: string;
  scannedFiles: string[];
}

export interface CognitiveAuditResult {
  score: number; // 0..100
  passed: boolean;
  passedStrict: boolean;
  violations: CognitiveViolation[];
  summary: CognitiveAuditSummary;
  durationMs: number;
}
```

### 2.3 Opções de Auditoria e Assinatura de Função
```typescript
export interface CognitiveAuditOptions {
  strict?: boolean;
  json?: boolean;
  projectPath?: string;
  maxTokens?: number;            // default: 250
  warnTokens?: number;           // default: 200
  maxNegativePhrases?: number;   // default: 3
  maxCodeBlockLines?: number;    // default: 25
}

export function auditCognitiveContext(
  projectPath?: string,
  options?: CognitiveAuditOptions
): CognitiveAuditResult;
```

### 2.4 Contratos de Linha de Comando (CLI)
- `baba agents audit [path] [--json] [--strict]`
- `bbyg agents audit [path] [--json] [--strict]`
- `matryoshka agents audit [path] [--json] [--strict]`

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
Feature: feat(agents): cognitive context linter & turn-zero prompt simulator (`baba agents audit`)

  Scenario: AC-1 - Subtask 1: Detailed PRD: `docs/prds/PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md`
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 1: Detailed PRD: `docs/prds/PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md`'
    When A documentação e especificações técnicas de 'Subtask 1: Detailed PRD: `docs/prds/PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md`' são validadas
    Then O resultado de 'Subtask 1: Detailed PRD: `docs/prds/PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md`' é processado e persistido em conformidade com o contrato

  Scenario: AC-2 - Subtask 2: Rule 1 (`token-budget`): Warnings > 200 tokens, strict fail > 250 tokens for root `AGENTS.md`
    Given O ambiente de execução está operacional e pronto para processar Rule 1
    When O linter cognitivo audita um arquivo AGENTS.md com contagem de tokens acima do teto
    Then Emite aviso para > 200 tokens e falha estrita para > 250 tokens

  Scenario: AC-3 - Subtask 3: Rule 2 (`dead-skills`): Dead link detector for missing files in `.agents/skills/`
    Given Um arquivo AGENTS.md com links relativos a `.agents/skills/*.md`
    When O linter valida a existência física dos arquivos referenciados
    Then Reporta violação de severidade 'fail' caso algum arquivo de skill não exista no disco

  Scenario: AC-4 - Subtask 4: Rule 3 (`negative-phrasing-trap`): Flags excessive prohibitive keywords
    Given Um arquivo AGENTS.md contendo densidade excessiva de negativas proibitivas ('DO NOT', 'NEVER', 'DON'T')
    When O linter avalia os parágrafos para o Pink Elephant Paradox
    Then Reporta alerta sugerindo âncoras comportamentais positivas ('PREFER', 'USE', 'ENFORCE')

  Scenario: AC-5 - Subtask 5: Rule 4 (`permissive-leak`): Detects wishy-washy language in imperative sections
    Given Um arquivo AGENTS.md contendo expressões permissivas ('try to', 'if possible', 'consider')
    When O linter analisa a firmeza diretiva das seções
    Then Reporta aviso identificando o vazamento permissivo e sugere termos imperativos estritos

  Scenario: AC-6 - Subtask 6: Rule 5 (`greedy-preload`): Identifies large raw code/schema dumps
    Given Um arquivo AGENTS.md com blocos de código contíguos excedendo 25 linhas
    When O linter avalia o pré-carregamento de contexto
    Then Identifica o smell de greedy preload e instrui a modularização em skills on-demand

  Scenario: AC-7 - Subtask 7: CLI flags: `--json` and `--strict`
    Given Invocação do subcomando `baba agents audit`
    When A flag `--json` é fornecida, retorna envelope JSON válido; quando `--strict` é combinada com violações, sai com código 1
    Then A saída e código de término aderem rigorosamente aos contratos

  Scenario: AC-8 - Subtask 8: Full BDD test suite with 100% deterministic local execution (< 25ms)
    Given Execução da suíte completa de testes de aceitação
    When Executada via `bun test`
    Then Todos os cenários passam com tempo de execução individual sub-25ms

  Scenario: AC-9 - Subtask 9: Alias parity across `baba`, `bbyg`, and `matryoshka`
    Given Os três aliases canônicos do ecossistema
    When Invocados com `agents audit [path] [--json] [--strict]`
    Then Produzem comportamentos e saídas estruturadas idênticas
```

---

## 🔒 4. Invariantes & Casos de Borda
- **100% Determinístico & Local:** Zero chamadas a APIs remotas, zero rede, tempo de execução < 25ms.
- **Segurança Não-Mutacional:** O comando `audit` é estritamente somente-leitura; nenhum arquivo é modificado em disco.
- **Idempotência Absoluta:** Múltiplas execuções sobre o mesmo código produzem bytes e métricas idênticas.
- **Resiliência a Falhas:** Ausência de `AGENTS.md` não dispara exceção não-tratada, reportando diagnóstico semântico com instrução para gerar com `baba agents generate`.
- **Proteção contra Path Traversal:** Caminhos informados são validados e confinados ao diretório de trabalho.

---

## 📁 5. Arquivos Afetados
- `docs/prds/PRD_COGNITIVE_CONTEXT_LINTER_AND_AUDIT.md`
- `docs/specs/SPEC-22.md`
- `docs/EXPERIENCE.md`
- `src/agents.ts`
- `src/cli.ts`
- `tests/cognitive_linter.test.ts`
