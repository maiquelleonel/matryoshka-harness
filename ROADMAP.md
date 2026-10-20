# 🪆 Matryoshka-Harness — Engineering Roadmap
**Projeto:** Matryoshka Context-Fencing & Adaptive Remediation CLI  
**Objetivo:** Transformar LLMs de "estagiários hiperativos" em Devs Seniores disciplinados através de cercamento contextual, auto-wiring de MCP e AST poliglota.  
**Runtime:** Bun (TypeScript estrito, execução <15ms).  
**Licença:** MIT.  

---

## 🏛️ Pilares Estruturais da Arquitetura
1. **Oráculo de Avaliação:** `paladini/harness-score` (régua externa de maturidade L0 a L4).
2. **Raio-X Semântico:** `codebase-memory-mcp` (grafo de conhecimento e AST contextual via MCP).
3. **Remediação Pragmática:** Geração dinâmica de `AGENTS.md` e `SKILLS.md` anti-slop guiada por arquétipos e topologia real de código.
4. **Motor AST Poliglota & Cérebro:** `web-tree-sitter` (WASM) para validação estática de SQL/código + protocolo `Harness²` (`DIAGNOSTIC.md` e `EXPERIENCE.md`).
5. **Distribuição Soberana:** CLI standalone compilada com Bun (`baba`, `bbyg`, `matryoshka`) e servidor MCP nativo.

---

## 🗺️ Fases do Desenvolvimento Autônomo

### 🐣 Fase 1: O Embrião & Oráculo de Avaliação `[CONCLUÍDA]`
* [x] **Issue #1: Detector Poliglota & CLI Base**
  * Auto-detecção instantânea de stacks (Python, JS/TS, Go, Rust, Ruby, PHP), frameworks e test runners em <15ms.
  * Aliases canônicos: `baba`, `bbyg` e `matryoshka`.
* [x] **Issue #3: Integração com paladini/harness-score & Badge SVG**
  * Wrapper determinístico do `harness-score --json`.
  * Extração de gaps de maturidade (L0 a L4) e exportação de badge SVG dinâmico (`--badge`).
* [x] **Issue #5 / PR #6: GitHub Actions CI Gate & Automated SemVer Release**
  * Pipeline com testes unitários no Bun, linter e release automático.

---

### 🔍 Fase 2: Raio-X Semântico & Auto-Wiring MCP `[EM EXECUÇÃO / PRÓXIMA DA FILA]`
*Foco: Equipar o agente com o Grafo de Conhecimento antes de gerar instruções, reduzindo tokens em 70% e habilitando telemetria no Grafana.*
* [ ] **Issue #7: Injeção do codebase-memory-mcp (Auto-Wiring) & Telemetria Grafana**
  * Configuração automática do servidor MCP em `.cursor/mcp.json`, `.gemini/settings.json` e `.claude/mcp.json`.
  * Merge idempotente e preservação de configurações prévias do desenvolvedor.
  * Instrumentação e hidratação da métrica `search_graph` no Grafana do projeto para visibilidade operacional de AgentOps.
  * O agente acorda com o grafo de conhecimento carregado no primeiro segundo de execução (`baba mcp wire [path]`).

---

### 🛡️ Fase 3: Remediação Pragmática & AGENTS.md Adaptativo (Graph-Powered)
*Foco: Usar o raio-X semântico do grafo para injetar diretrizes contextuais reais, não alucinações teóricas.*
* [ ] **Issue #8: Gerador de AGENTS.md Context-Aware & Anti-Slop**
  * Detecção de arquétipo: Web Procedural (WordPress/Drupal), Frontend Reativo (React/Vue), Framework Opinado (Laravel/Django/Rails), Sistemas Distribuídos (Go/Rust).
  * Enriquecimento com rotas, camadas e convenções reais identificadas pelo MCP.
  * Injeção de diretrizes pragmáticas: DRY e YAGNI prioritários; regras estritas de não-slop.
* [ ] **Issue #9: Modularização em SKILLS.md por Especialidade**
  * Geração de skills focadas para economizar tokens:
    * `skill-backend.md`: ORM, isolamento transacional, anti-N+1.
    * `skill-frontend.md`: Acessibilidade, reatividade, layout shifts.
    * `skill-api.md`: Contratos OpenAPI, idempotência, schemas Pydantic/Zod.
    * `skill-security.md`: OWASP Top 10, sanitização de inputs, DLP.

---

### 🧠 Fase 4: Motor AST Poliglota & O Cérebro Harness²
*Foco: Validação estática profunda em tempo de compilação e diagnóstico executivo de débitos.*
* [ ] **Issue #10: Motor AST Multi-Linguagem com Tree-sitter WASM**
  * Parser sintático de alta velocidade cobrindo 5+ linguagens canônicas via WebAssembly.
  * Análise estática de AST de SQL: detecção de `SELECT *`, ausência de índices e injection antes de tocar no banco.
* [ ] **Issue #11: Geração do DIAGNOSTIC.md Automatizado & Comando Canônico `matryoshka wrap`**
  * Relatório executivo apontando: 3 queries lentas, 2 gargalos de concorrência e débitos técnicos prioritários.
  * Meta-aprendizado local incremental em `EXPERIENCE.md`.
  * Comando canônico `baba wrap [path]` executando detecção, score, MCP wiring, cercamento e diagnóstico em um único passo.

---

### 🌐 Fase 5: Distribuição Universal & Lançamento Open-Source
*Foco: Empacotamento para consumo global por qualquer agente ou desenvolvedor.*
* [ ] **Issue #12: Servidor MCP Nativo (`matryoshka mcp`)**
  * Exposição dos recursos do Matryoshka como um servidor MCP via stdio para consumo direto por Cursor, Gemini CLI, Claude Code e Aider.
* [ ] **Issue #13: Compilação de Binários Standalone via Bun & Publicação NPM**
  * Compilação via `bun build --compile` gerando executáveis únicos sem dependências externas (`baba-linux-x64`, `baba-darwin-arm64`, etc.).
  * Publicação multi-package com cascas protetoras (`@maiquelleonel/matryoshka` e aliases).
