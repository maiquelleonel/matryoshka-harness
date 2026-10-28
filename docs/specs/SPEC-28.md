# 📐 SPEC-28: feat(core): layered ignore engine (.babaignore, --exclude) and default test suite exclusion (--include-tests)
**Módulo:** SDD Engine / Automated Architecture  
**Status:** ready4dev  
**Gatilho:** Issue #28  

---

## 🎯 1. Objetivo & Escopo
Currently, commands like `baba wrap`, `baba scan`, and `baba agents audit` traverse test directories (`tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*`). In test suites, unparameterized SQL snippets, dummy keys, or fixture templates are common and necessary for testing A...

---

## 📋 2. Contratos de I/O
- `POST /v1/core`

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)
```gherkin
Feature: feat(core): layered ignore engine (.babaignore, --exclude) and default test suite exclusion (--include-tests)

  Scenario: AC-1 - Subtask 1: By default, AST walks (`walkCodebase`) and harness evaluations must skip test directories and test files (`tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*`).
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 1: By default, AST walks (`walkCodebase`) and harness evaluations must skip test directories and test files (`tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*`).'
    When A requisição correspondente a 'Subtask 1: By default, AST walks (`walkCodebase`) and harness evaluations must skip test directories and test files (`tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*`).' é executada
    Then O resultado de 'Subtask 1: By default, AST walks (`walkCodebase`) and harness evaluations must skip test directories and test files (`tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*`).' é processado e persistido em conformidade com o contrato
  Scenario: AC-2 - Subtask 2: Add `--include-tests` flag across `baba wrap`, `baba scan`, and `baba agents audit` to allow users to opt-in to inspecting test suites when explicitly desired.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 2: Add `--include-tests` flag across `baba wrap`, `baba scan`, and `baba agents audit` to allow users to opt-in to inspecting test suites when explicitly desired.'
    When A requisição correspondente a 'Subtask 2: Add `--include-tests` flag across `baba wrap`, `baba scan`, and `baba agents audit` to allow users to opt-in to inspecting test suites when explicitly desired.' é executada
    Then O resultado de 'Subtask 2: Add `--include-tests` flag across `baba wrap`, `baba scan`, and `baba agents audit` to allow users to opt-in to inspecting test suites when explicitly desired.' é processado e persistido em conformidade com o contrato
  Scenario: AC-3 - Subtask 3: Support loading `.babaignore` (with `.bbygignore` fallback) from the project root.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 3: Support loading `.babaignore` (with `.bbygignore` fallback) from the project root.'
    When A requisição correspondente a 'Subtask 3: Support loading `.babaignore` (with `.bbygignore` fallback) from the project root.' é executada
    Then O resultado de 'Subtask 3: Support loading `.babaignore` (with `.bbygignore` fallback) from the project root.' é processado e persistido em conformidade com o contrato
  Scenario: AC-4 - Subtask 4: Patterns must follow standard gitignore-style glob semantics.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 4: Patterns must follow standard gitignore-style glob semantics.'
    When A requisição correspondente a 'Subtask 4: Patterns must follow standard gitignore-style glob semantics.' é executada
    Then O resultado de 'Subtask 4: Patterns must follow standard gitignore-style glob semantics.' é processado e persistido em conformidade com o contrato
  Scenario: AC-5 - Subtask 5: Relative paths matching patterns in this file must be bypassed during directory walks and AST parsing.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 5: Relative paths matching patterns in this file must be bypassed during directory walks and AST parsing.'
    When A requisição correspondente a 'Subtask 5: Relative paths matching patterns in this file must be bypassed during directory walks and AST parsing.' é executada
    Then O resultado de 'Subtask 5: Relative paths matching patterns in this file must be bypassed during directory walks and AST parsing.' é processado e persistido em conformidade com o contrato
  Scenario: AC-6 - Subtask 6: Add `--exclude` option to `baba wrap`, `baba scan`, `baba agents generate`, and `baba agents audit`.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 6: Add `--exclude` option to `baba wrap`, `baba scan`, `baba agents generate`, and `baba agents audit`.'
    When A requisição correspondente a 'Subtask 6: Add `--exclude` option to `baba wrap`, `baba scan`, `baba agents generate`, and `baba agents audit`.' é executada
    Then O resultado de 'Subtask 6: Add `--exclude` option to `baba wrap`, `baba scan`, `baba agents generate`, and `baba agents audit`.' é processado e persistido em conformidade com o contrato
  Scenario: AC-7 - Subtask 7: Accepts comma-separated values or repeated flags (e.g. `--exclude tests,docs` or `--exclude "tests/**" --exclude "docs/**"`).
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 7: Accepts comma-separated values or repeated flags (e.g. `--exclude tests,docs` or `--exclude "tests/**" --exclude "docs/**"`).'
    When A requisição correspondente a 'Subtask 7: Accepts comma-separated values or repeated flags (e.g. `--exclude tests,docs` or `--exclude "tests/**" --exclude "docs/**"`).' é executada
    Then O resultado de 'Subtask 7: Accepts comma-separated values or repeated flags (e.g. `--exclude tests,docs` or `--exclude "tests/**" --exclude "docs/**"`).' é processado e persistido em conformidade com o contrato
  Scenario: AC-8 - Subtask 8: **AC-1:** `baba wrap --dry-run` on a project containing `tests/ast_rules.test.ts` with literal SQL strings does **not** trigger SQL injection security remediation checklist by default.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 8: **AC-1:** `baba wrap --dry-run` on a project containing `tests/ast_rules.test.ts` with literal SQL strings does **not** trigger SQL injection security remediation checklist by default.'
    When A requisição correspondente a 'Subtask 8: **AC-1:** `baba wrap --dry-run` on a project containing `tests/ast_rules.test.ts` with literal SQL strings does **not** trigger SQL injection security remediation checklist by default.' é executada
    Then O resultado de 'Subtask 8: **AC-1:** `baba wrap --dry-run` on a project containing `tests/ast_rules.test.ts` with literal SQL strings does **not** trigger SQL injection security remediation checklist by default.' é processado e persistido em conformidade com o contrato
  Scenario: AC-9 - Subtask 9: **AC-2:** Passing `baba wrap --include-tests` evaluates `tests/` and reports any violations found inside test files.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 9: **AC-2:** Passing `baba wrap --include-tests` evaluates `tests/` and reports any violations found inside test files.'
    When A requisição correspondente a 'Subtask 9: **AC-2:** Passing `baba wrap --include-tests` evaluates `tests/` and reports any violations found inside test files.' é executada
    Then O resultado de 'Subtask 9: **AC-2:** Passing `baba wrap --include-tests` evaluates `tests/` and reports any violations found inside test files.' é processado e persistido em conformidade com o contrato
  Scenario: AC-10 - Subtask 10: **AC-3:** Adding `docs/**` to `.babaignore` successfully skips scanning the `docs` directory.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 10: **AC-3:** Adding `docs/**` to `.babaignore` successfully skips scanning the `docs` directory.'
    When A requisição correspondente a 'Subtask 10: **AC-3:** Adding `docs/**` to `.babaignore` successfully skips scanning the `docs` directory.' é executada
    Then O resultado de 'Subtask 10: **AC-3:** Adding `docs/**` to `.babaignore` successfully skips scanning the `docs` directory.' é processado e persistido em conformidade com o contrato
  Scenario: AC-11 - Subtask 11: **AC-4:** Passing `--exclude <pattern>` skips matched files even if absent from ignore files.
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 11: **AC-4:** Passing `--exclude <pattern>` skips matched files even if absent from ignore files.'
    When A requisição correspondente a 'Subtask 11: **AC-4:** Passing `--exclude <pattern>` skips matched files even if absent from ignore files.' é executada
    Then O resultado de 'Subtask 11: **AC-4:** Passing `--exclude <pattern>` skips matched files even if absent from ignore files.' é processado e persistido em conformidade com o contrato
  Scenario: AC-12 - Subtask 12: **AC-5:** Strict parity across all command aliases (`baba`, `bbyg`, `matryoshka`, `matrioska`).
    Given O ambiente de execução está operacional e pronto para processar 'Subtask 12: **AC-5:** Strict parity across all command aliases (`baba`, `bbyg`, `matryoshka`, `matrioska`).'
    When A requisição correspondente a 'Subtask 12: **AC-5:** Strict parity across all command aliases (`baba`, `bbyg`, `matryoshka`, `matrioska`).' é executada
    Then O resultado de 'Subtask 12: **AC-5:** Strict parity across all command aliases (`baba`, `bbyg`, `matryoshka`, `matrioska`).' é processado e persistido em conformidade com o contrato
```

---

## 🔒 4. Invariantes & Casos de Borda
- Invariante de idempotência e validação estrita de schema de entrada
- Tratamento de exceções com códigos HTTP semânticos (400, 404, 422)
- Zero efeitos colaterais em caso de falha de validação ou payload malformado

---

## 📁 5. Arquivos Afetados
- `tests/ast_rules.test.ts`
