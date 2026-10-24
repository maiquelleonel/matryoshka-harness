# 📐 SPEC-14: docs(branding): launch-grade README, actionable CLI help & Ouroboros heritage
**Módulo:** SDD Engine / Automated Architecture  
**Status:** implemented  
**Gatilho:** Issue #14  

---

## 🎯 1. Objetivo & Escopo
Prepare Matryoshka-Harness for open-source public release and GitHub 'Project of the Week' visibility with a comprehensive, highly accessible, and visually compelling `README.md`, declarative CLI help menus, and explicit heritage attribution to the LeonelLabs Ouroboros Engine.

---

## 📋 2. Contratos de I/O
- `POST /v1/branding`
- CLI standard help outputs (`--help`, `-h`, `help <subcommand>`)

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)
```gherkin
Feature: docs(branding): launch-grade README, actionable CLI help & Ouroboros heritage

  Scenario: AC-1 - Subtask 1: Craft launch-grade showcase `README.md` with architecture diagram and quickstart
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 1: Craft launch-grade showcase `README.md` with architecture diagram and quickstart'
    When A requisição correspondente a 'Subtask 1: Craft launch-grade showcase `README.md` with architecture diagram and quickstart' é executada
    Then O resultado de 'Subtask 1: Craft launch-grade showcase `README.md` with architecture diagram and quickstart' é processado e persistido em conformidade com o contrato

  Scenario: AC-2 - Subtask 2: Polish CLI help menus in `src/cli.ts` for declarative and actionable UX
    Given O terminal ou ambiente de execução invoca a CLI com flags de ajuda (`--help`, `-h`) ou comando `help`
    When A invocação é disparada no nível raiz (`baba --help`, `bbyg --help`, `matryoshka --help`)
    Then O menu de ajuda raiz apresenta agrupamento declarativo de comandos (Reconnaissance & Maturity Audit, Governance & Context-Fencing, Antipattern Remediation, MCP Autowiring)
    And Apresenta os aliases canônicos intercambiáveis (`baba`, `bbyg`, `matryoshka`)
    And Apresenta opções agrupadas categoricamente com descrições acionáveis
    And Fornece exemplos de uso acionáveis e diretos
    When A invocação de ajuda é disparada para subcomandos específicos (`detect`, `scan`, `agents`, `wrap`, `mcp`, `mcp wire`, `mcp serve`)
    Then Menus contextuais dedicados são exibidos contendo argumentos, flags pertinentes e exemplos específicos
    And Mantém paridade estrita de saída e comportamento através de todos os 3 aliases

  Scenario: AC-3 - Subtask 3: Verify and enforce MIT License and copyright headers
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 3: Verify and enforce MIT License and copyright headers'
    When A requisição correspondente a 'Subtask 3: Verify and enforce MIT License and copyright headers' é executada
    Then O resultado de 'Subtask 3: Verify and enforce MIT License and copyright headers' é processado e persistido em conformidade com o contrato

  Scenario: AC-4 - Subtask 4: Cross-link Matryoshka from Ouroboros Engine hotsite (`site/index.html`) and main README
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 4: Cross-link Matryoshka from Ouroboros Engine hotsite (`site/index.html`) and main README'
    When A requisição correspondente a 'Subtask 4: Cross-link Matryoshka from Ouroboros Engine hotsite (`site/index.html`) and main README' é executada
    Then O resultado de 'Subtask 4: Cross-link Matryoshka from Ouroboros Engine hotsite (`site/index.html`) and main README' é processado e persistido em conformidade com o contrato
```

---

## 🔒 4. Invariantes & Casos de Borda
- Invariante de paridade estrita entre aliases (`baba`, `bbyg`, `matryoshka`)
- Idempotência de saída e código de saída 0 para solicitações de ajuda (`--help`, `-h`, `help`)
- Preservação estrita das garantias de stream do MCP server (stdout exclusivo para JSON-RPC)
- Preservação da retrocompatibilidade com asserções de testes pré-existentes

---

## 📁 5. Arquivos Afetados
- `src/cli.ts`
- `tests/cli_help.test.ts`
- `README.md`
- `site/index.html`
- `tests/branding_and_heritage.test.ts`
- `docs/EXPERIENCE.md`
- `AGENTS.md`
