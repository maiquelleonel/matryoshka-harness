# 📐 SPEC-17: docs(site): technical documentation site & agnostic information architecture
**Módulo:** SDD Engine / Automated Architecture  
**Status:** ready4dev  
**Gatilho:** Issue #17  

---

## 🎯 1. Objetivo & Escopo
Implement `docs/prds/PRD_DOCUMENTATION_SITE_AND_INFORMATION_ARCHITECTURE.md` to scaffold and author a world-class, agnostic technical documentation portal for Matryoshka-Harness (`baba` / `bbyg` / `matryoshka`).

---

## 📋 2. Contratos de I/O
- `POST /v1/site`

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)
```gherkin
Feature: docs(site): technical documentation site & agnostic information architecture

  Scenario: AC-1 - Subtask 1: Configure `mkdocs.yml` with `docs_dir: docs/guide`, `site_dir: site-docs`, dark theme, and navigation schema
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 1: Configure `mkdocs.yml` with `docs_dir: docs/guide`, `site_dir: site-docs`, dark theme, and navigation schema'
    When A requisição correspondente a 'Subtask 1: Configure `mkdocs.yml` with `docs_dir: docs/guide`, `site_dir: site-docs`, dark theme, and navigation schema' é executada
    Then O resultado de 'Subtask 1: Configure `mkdocs.yml` with `docs_dir: docs/guide`, `site_dir: site-docs`, dark theme, and navigation schema' é processado e persistido em conformidade com o contrato
  Scenario: AC-2 - Subtask 2: Author Getting Started guides in `docs/guide/getting-started/` (`installation.md`, `quickstart.md`)
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 2: Author Getting Started guides in `docs/guide/getting-started/` (`installation.md`, `quickstart.md`)'
    When A requisição correspondente a 'Subtask 2: Author Getting Started guides in `docs/guide/getting-started/` (`installation.md`, `quickstart.md`)' é executada
    Then O resultado de 'Subtask 2: Author Getting Started guides in `docs/guide/getting-started/` (`installation.md`, `quickstart.md`)' é processado e persistido em conformidade com o contrato
  Scenario: AC-3 - Subtask 3: Author Core Concepts in `docs/guide/concepts/` (`concentric-layers.md`, `ast-engine.md`, `adaptive-agents.md`)
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 3: Author Core Concepts in `docs/guide/concepts/` (`concentric-layers.md`, `ast-engine.md`, `adaptive-agents.md`)'
    When A requisição correspondente a 'Subtask 3: Author Core Concepts in `docs/guide/concepts/` (`concentric-layers.md`, `ast-engine.md`, `adaptive-agents.md`)' é executada
    Then O resultado de 'Subtask 3: Author Core Concepts in `docs/guide/concepts/` (`concentric-layers.md`, `ast-engine.md`, `adaptive-agents.md`)' é processado e persistido em conformidade com o contrato
  Scenario: AC-4 - Subtask 4: Author CLI Reference documentation in `docs/guide/cli/` (`detect.md`, `scan.md`, `wrap.md`, `agents.md`, `mcp.md`)
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 4: Author CLI Reference documentation in `docs/guide/cli/` (`detect.md`, `scan.md`, `wrap.md`, `agents.md`, `mcp.md`)'
    When A requisição correspondente a 'Subtask 4: Author CLI Reference documentation in `docs/guide/cli/` (`detect.md`, `scan.md`, `wrap.md`, `agents.md`, `mcp.md`)' é executada
    Then O resultado de 'Subtask 4: Author CLI Reference documentation in `docs/guide/cli/` (`detect.md`, `scan.md`, `wrap.md`, `agents.md`, `mcp.md`)' é processado e persistido em conformidade com o contrato
  Scenario: AC-5 - Subtask 5: Author Integrations guide in `docs/guide/integrations/` (`mcp-server.md`, `ci-cd-gates.md`)
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 5: Author Integrations guide in `docs/guide/integrations/` (`mcp-server.md`, `ci-cd-gates.md`)'
    When A requisição correspondente a 'Subtask 5: Author Integrations guide in `docs/guide/integrations/` (`mcp-server.md`, `ci-cd-gates.md`)' é executada
    Then O resultado de 'Subtask 5: Author Integrations guide in `docs/guide/integrations/` (`mcp-server.md`, `ci-cd-gates.md`)' é processado e persistido em conformidade com o contrato
  Scenario: AC-6 - Subtask 6: CI build verification test in `tests/docs_site.test.ts` validating mkdocs build and internal link integrity
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 6: CI build verification test in `tests/docs_site.test.ts` validating mkdocs build and internal link integrity'
    When A requisição correspondente a 'Subtask 6: CI build verification test in `tests/docs_site.test.ts` validating mkdocs build and internal link integrity' é executada
    Then O resultado de 'Subtask 6: CI build verification test in `tests/docs_site.test.ts` validating mkdocs build and internal link integrity' é processado e persistido em conformidade com o contrato
```

---

## 🔒 4. Invariantes & Casos de Borda
- Invariante de idempotência e validação estrita de schema de entrada
- Tratamento de exceções com códigos HTTP semânticos (400, 404, 422)
- Zero efeitos colaterais em caso de falha de validação ou payload malformado

---

## 📁 5. Arquivos Afetados
- `docs/EXPERIENCE.md`
- `tests/docs_site.test.ts`
