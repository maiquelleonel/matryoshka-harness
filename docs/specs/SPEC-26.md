# 📐 SPEC-26: feat(agents): interactive skill inspector and terminal selector for baba agents generate
**Módulo:** SDD Engine / Automated Architecture  
**Status:** ready4dev  
**Gatilho:** Issue #26  

---

## 🎯 1. Objetivo & Escopo
Currently, `baba agents generate` executes in a purely headless/deterministic manner, detecting the project archetype and writing `AGENTS.md` and `.agents/skills/` directly to disk (with optional `--dry-run` or `--force`).

---

## 📋 2. Contratos de I/O
- `POST /v1/agents`

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)
```gherkin
Feature: feat(agents): interactive skill inspector and terminal selector for baba agents generate

  Scenario: AC-1 - Subtask 1: Review the detected archetype and stack profile.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 1: Review the detected archetype and stack profile.'
    When A requisição correspondente a 'Subtask 1: Review the detected archetype and stack profile.' é executada
    Then O resultado de 'Subtask 1: Review the detected archetype and stack profile.' é processado e persistido em conformidade com o contrato
  Scenario: AC-2 - Subtask 2: Selectively toggle specialized skills using arrow keys (`↑` / `↓`) and spacebar.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 2: Selectively toggle specialized skills using arrow keys (`↑` / `↓`) and spacebar.'
    When A requisição correspondente a 'Subtask 2: Selectively toggle specialized skills using arrow keys (`↑` / `↓`) and spacebar.' é executada
    Then O resultado de 'Subtask 2: Selectively toggle specialized skills using arrow keys (`↑` / `↓`) and spacebar.' é processado e persistido em conformidade com o contrato
  Scenario: AC-3 - Subtask 3: Live-preview the generated `Don't vs Do` guidelines and token footprint before persisting.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 3: Live-preview the generated `Don't vs Do` guidelines and token footprint before persisting.'
    When A requisição correspondente a 'Subtask 3: Live-preview the generated `Don't vs Do` guidelines and token footprint before persisting.' é executada
    Then O resultado de 'Subtask 3: Live-preview the generated `Don't vs Do` guidelines and token footprint before persisting.' é processado e persistido em conformidade com o contrato
  Scenario: AC-4 - Subtask 4: Smoothly fallback to non-interactive mode when running in headless/CI environments (when `!process.stdin.isTTY` or when `--yes` / `-y` is supplied).
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 4: Smoothly fallback to non-interactive mode when running in headless/CI environments (when `!process.stdin.isTTY` or when `--yes` / `-y` is supplied).'
    When A requisição correspondente a 'Subtask 4: Smoothly fallback to non-interactive mode when running in headless/CI environments (when `!process.stdin.isTTY` or when `--yes` / `-y` is supplied).' é executada
    Then O resultado de 'Subtask 4: Smoothly fallback to non-interactive mode when running in headless/CI environments (when `!process.stdin.isTTY` or when `--yes` / `-y` is supplied).' é processado e persistido em conformidade com o contrato
  Scenario: AC-5 - Subtask 5: **Interactive Prompt Interface:**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 5: **Interactive Prompt Interface:**'
    When A requisição correspondente a 'Subtask 5: **Interactive Prompt Interface:**' é executada
    Then O resultado de 'Subtask 5: **Interactive Prompt Interface:**' é processado e persistido em conformidade com o contrato
  Scenario: AC-6 - Subtask 6: **Skill Content Preview Modal/Screen:**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 6: **Skill Content Preview Modal/Screen:**'
    When A requisição correspondente a 'Subtask 6: **Skill Content Preview Modal/Screen:**' é executada
    Then O resultado de 'Subtask 6: **Skill Content Preview Modal/Screen:**' é processado e persistido em conformidade com o contrato
  Scenario: AC-7 - Subtask 7: **Headless & Flag Parity:**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 7: **Headless & Flag Parity:**'
    When A requisição correspondente a 'Subtask 7: **Headless & Flag Parity:**' é executada
    Then O resultado de 'Subtask 7: **Headless & Flag Parity:**' é processado e persistido em conformidade com o contrato
```

---

## 🔒 4. Invariantes & Casos de Borda
- Invariante de idempotência e validação estrita de schema de entrada
- Tratamento de exceções com códigos HTTP semânticos (400, 404, 422)
- Zero efeitos colaterais em caso de falha de validação ou payload malformado

---

## 📁 5. Arquivos Afetados
- `AGENTS.md`
