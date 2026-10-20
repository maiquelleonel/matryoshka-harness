# 📐 SPEC-8: feat(agents): context-aware adaptive AGENTS.md and modular skills engine
**Módulo:** SDD Engine / Automated Architecture  
**Status:** ready4dev  
**Gatilho:** Issue #8  

---

## 🎯 1. Objetivo & Escopo
Modern AI coding agents suffer from **context pollution** (dumping 1,500+ lines of monolithic instructions into every prompt turn) and **generic AI slop** (unidiomatic abstractions, textbook class hierarchies in declarative frameworks).

---

## 📋 2. Contratos de I/O
- `POST /v1/agents`

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)
```gherkin
Feature: feat(agents): context-aware adaptive AGENTS.md and modular skills engine

  Scenario: AC-1 - Subtask 1: **Ultra-lean root `AGENTS.md` (<200 tokens):** Defining archetype identity, canonical test/build/lint commands, and non-negotiable anti-slop rules.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 1: **Ultra-lean root `AGENTS.md` (<200 tokens):** Defining archetype identity, canonical test/build/lint commands, and non-negotiable anti-slop rules.'
    When A requisição correspondente a 'Subtask 1: **Ultra-lean root `AGENTS.md` (<200 tokens):** Defining archetype identity, canonical test/build/lint commands, and non-negotiable anti-slop rules.' é executada
    Then O resultado de 'Subtask 1: **Ultra-lean root `AGENTS.md` (<200 tokens):** Defining archetype identity, canonical test/build/lint commands, and non-negotiable anti-slop rules.' é processado e persistido em conformidade com o contrato
  Scenario: AC-2 - Subtask 2: **On-demand modular skills with strict YAML Frontmatter (`.agents/skills/`):** Specialized guidance (Backend, Frontend, Database, Security, Testing) loaded **only on demand** via metadata index to prevent premature context flooding.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 2: **On-demand modular skills with strict YAML Frontmatter (`.agents/skills/`):** Specialized guidance (Backend, Frontend, Database, Security, Testing) loaded **only on demand** via metadata index to prevent premature context flooding.'
    When A requisição correspondente a 'Subtask 2: **On-demand modular skills with strict YAML Frontmatter (`.agents/skills/`):** Specialized guidance (Backend, Frontend, Database, Security, Testing) loaded **only on demand** via metadata index to prevent premature context flooding.' é executada
    Then O resultado de 'Subtask 2: **On-demand modular skills with strict YAML Frontmatter (`.agents/skills/`):** Specialized guidance (Backend, Frontend, Database, Security, Testing) loaded **only on demand** via metadata index to prevent premature context flooding.' é processado e persistido em conformidade com o contrato
  Scenario: AC-3 - Subtask 3: **Subtask 1: Archetype Profiler & Seam Discovery**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 3: **Subtask 1: Archetype Profiler & Seam Discovery**'
    When A requisição correspondente a 'Subtask 3: **Subtask 1: Archetype Profiler & Seam Discovery**' é executada
    Then O resultado de 'Subtask 3: **Subtask 1: Archetype Profiler & Seam Discovery**' é processado e persistido em conformidade com o contrato
  Scenario: AC-4 - Subtask 4: **Subtask 2: Root `AGENTS.md` Template Engine & Token Guard**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 4: **Subtask 2: Root `AGENTS.md` Template Engine & Token Guard**'
    When A requisição correspondente a 'Subtask 4: **Subtask 2: Root `AGENTS.md` Template Engine & Token Guard**' é executada
    Then O resultado de 'Subtask 4: **Subtask 2: Root `AGENTS.md` Template Engine & Token Guard**' é processado e persistido em conformidade com o contrato
  Scenario: AC-5 - Subtask 5: **Subtask 3: Backend & Database Skill Compilers (with YAML Frontmatter)**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 5: **Subtask 3: Backend & Database Skill Compilers (with YAML Frontmatter)**'
    When A requisição correspondente a 'Subtask 5: **Subtask 3: Backend & Database Skill Compilers (with YAML Frontmatter)**' é executada
    Then O resultado de 'Subtask 5: **Subtask 3: Backend & Database Skill Compilers (with YAML Frontmatter)**' é processado e persistido em conformidade com o contrato
  Scenario: AC-6 - Subtask 6: **Subtask 4: Frontend & Security Skill Compilers (with YAML Frontmatter)**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 6: **Subtask 4: Frontend & Security Skill Compilers (with YAML Frontmatter)**'
    When A requisição correspondente a 'Subtask 6: **Subtask 4: Frontend & Security Skill Compilers (with YAML Frontmatter)**' é executada
    Then O resultado de 'Subtask 6: **Subtask 4: Frontend & Security Skill Compilers (with YAML Frontmatter)**' é processado e persistido em conformidade com o contrato
  Scenario: AC-7 - Subtask 7: **Subtask 5: Testing & Verification Skill Compiler (with YAML Frontmatter)**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 7: **Subtask 5: Testing & Verification Skill Compiler (with YAML Frontmatter)**'
    When A requisição correspondente a 'Subtask 7: **Subtask 5: Testing & Verification Skill Compiler (with YAML Frontmatter)**' é executada
    Then O resultado de 'Subtask 7: **Subtask 5: Testing & Verification Skill Compiler (with YAML Frontmatter)**' é processado e persistido em conformidade com o contrato
  Scenario: AC-8 - Subtask 8: **Subtask 6: CLI Subcommand & Overwrite Guardrails**
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 8: **Subtask 6: CLI Subcommand & Overwrite Guardrails**'
    When A requisição correspondente a 'Subtask 8: **Subtask 6: CLI Subcommand & Overwrite Guardrails**' é executada
    Then O resultado de 'Subtask 8: **Subtask 6: CLI Subcommand & Overwrite Guardrails**' é processado e persistido em conformidade com o contrato
```

---

## 🔒 4. Invariantes & Casos de Borda
- Invariante de idempotência e validação estrita de schema de entrada
- Tratamento de exceções com códigos HTTP semânticos (400, 404, 422)
- Zero efeitos colaterais em caso de falha de validação ou payload malformado

---

## 📁 5. Arquivos Afetados
- `AGENTS.md`
