# 📋 PRD: Polyglot Stack Detector & Base CLI Scaffold (baba / bbyg / matryoshka)

**Status:** Aprovado para Desenvolvimento  
**Fase do Roadmap:** Fase 1 (Issue #1)  
**Autor:** Maiquel Leonel & Ouroboros Architecture Pod  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objetivo & Visão Geral
Construir o motor central de introspecção de código do **Matryoshka-Harness** capaz de inspecionar qualquer diretório de projeto em menos de 10ms, identificar a stack primária, ecossistema de frameworks, test runner canônico e expor esses dados via CLI ergonômico com os aliases canônicos `baba`, `bbyg` e `matryoshka`.

---

## 🔍 2. Matriz de Detecção Poliglota

| Ecossistema | Arquivos de Assinatura | Frameworks Detectados | Test Runners Suportados |
| :--- | :--- | :--- | :--- |
| **Python** | `pyproject.toml`, `requirements.txt`, `Pipfile` | FastAPI, Django, Flask | `pytest`, `unittest` |
| **JS / TS** | `package.json`, `bun.lock`, `package-lock.json` | Next.js, React, Vue, NestJS, Express | `bun test`, `vitest`, `jest` |
| **Go** | `go.mod` | Gin, Echo, Fiber, Chi | `go test` |
| **Rust** | `Cargo.toml` | Actix, Axum, Tokio, Rocket | `cargo test` |
| **Ruby** | `Gemfile` | Rails, Sinatra, Hanami | `rspec`, `bundle exec rake test` |
| **PHP** | `composer.json` | Laravel, Symfony, WordPress, Drupal | `pest`, `phpunit` |

---

## ⚡ 3. Ergonomia de Terminal (Aliases Canônicos)
O CLI deve responder com paridade funcional estrita aos três comandos:
1. `baba <command>` (A avó / matriarca das bonecas russas — 4 letras, zero typo)
2. `bbyg <command>` (Baba-Yaga — a bruxaria de silício)
3. `matryoshka <command>` (Nome acadêmico formal)

### Subcomando Base:
```bash
baba detect [path] [--json]
```

---

## ✅ 4. Critérios de Aceite (BDD)

### AC-1: Detecção Determinística de Stack Primária
* **Given** um diretório de projeto contendo um dos manifestos suportados (`pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`),
* **When** a função `detectStack(projectPath)` for executada,
* **Then** deve retornar o objeto de stack com `primary`, lista de `frameworks` e o `testRunner` detectado em < 15ms.

### AC-2: Fallback Gracioso para Repositórios Desconhecidos (L0 Unharnessed)
* **Given** um diretório vazio ou sem manifestos de dependência reconhecidos,
* **When** a detecção for executada,
* **Then** deve retornar `primary: "unknown"`, `testRunner: null` e `frameworks: []` sem lançar exceções não tratadas.

### AC-3: Paridade Estrita dos Aliases de CLI
* **Given** a execução via terminal,
* **When** invocado como `baba`, `bbyg` ou `matryoshka`,
* **Then** o binário deve despachar o mesmo fluxo de parsing de argumentos, exibindo versão e ajuda idênticas.

### AC-4: Saída Estruturada em JSON para Orquestradores
* **Given** a flag `--json`,
* **When** o comando for executado,
* **Then** a saída em stdout deve ser estritamente um JSON parseável contendo:
  ```json
  {
    "status": "success",
    "stack": {
      "primary": "typescript",
      "frameworks": ["nextjs"],
      "testRunner": "bun test"
    },
    "rootPath": "/path/to/project"
  }
  ```
