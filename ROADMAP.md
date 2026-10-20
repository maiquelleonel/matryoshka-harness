# 🪆 Matryoshka-Harness — Engineering Roadmap
**Projeto:** Matryoshka Context-Fencing & Adaptive Remediation CLI  
**Objetivo:** Transformar LLMs de 'estagiários hiperativos' em Devs Seniores disciplinados através de cercamento contextual, remediação de maturidade (L0 a L4) e AST poliglota.  
**Licença:** Open-Source MIT  
**Stack Base:** Bun + TypeScript (Compilação standalone, zero runtime dependencies)  

---

## 🏛️ O Quadrado Mágico das Dependências Estruturais
1. **Oráculo de Avaliação:** paladini/harness-score (Régua canônica de maturidade L0 a L4).
2. **Raio-X Semântico:** codebase-memory-mcp (Grafo de tipos, chamadas, models e rotas sem queimar tokens).
3. **Cérebro de Auto-Ajuste:** Harness² Protocol (Gera DIAGNOSTIC.md com fragilidades, anti-patterns e lições aprendidas).
4. **Motor AST Poliglota (Rust/WASM):** web-tree-sitter (Do PHP/Ruby ao Rust/Mojo, com AST de SQL para detectar N+1 e queries sem índice).

---

## 🗺️ Fases do Desenvolvimento Autônomo

### 🐣 Fase 1: O Embrião & Oráculo de Avaliação
* [ ] **Issue #1: Detector Poliglota & CLI Base**
  * Auto-detecção de stack: Python (pyproject.toml), JS/TS (package.json), Go (go.mod), Rust (Cargo.toml), Ruby (Gemfile), PHP (composer.json).
  * Mapeamento do runner de testes (pytest, bun test, cargo test, go test, pest).
* [ ] **Issue #2: Integração com paladini/harness-score**
  * Adicionar harness-score como dependência direta do pacote.
  * Execução determinística do comando 'matryoshka scan [path] --json'.
  * Extração dos gaps de maturidade (CTX-01, CTX-03, CI-01, SNS-05, HYG-08).

---

### 🛡️ Fase 2: Remediação Pragmática & AGENTS.md Adaptativo
* [ ] **Issue #3: Gerador do AGENTS.md Context-Aware (Anti-Slop)**
  * Detecção de arquétipo: Web Procedural (WordPress/Drupal), Frontend Reativo (React/Vue), Framework Opinado (Laravel/Django/Rails), Sistemas Distribuídos (Go/Rust).
  * Injeção de diretrizes pragmáticas: DRY e YAGNI prioritários; SOLID adaptativo apenas quando o arquétipo comportar (zero classes abstratas em hooks funcionais).
* [ ] **Issue #4: Modularização em SKILLS.md por Especialidade**
  * Geração de skills focadas para economizar tokens:
    * skill-backend.md: ORM, isolamento transacional, anti-N+1.
    * skill-frontend.md: Acessibilidade, reatividade, layout shifts.
    * skill-api.md: Contratos OpenAPI, idempotência, schemas Pydantic/Zod.
    * skill-security.md: OWASP Top 10, sanitização de inputs, DLP.

---

### 🔍 Fase 3: Raio-X Semântico & AST Poliglota (Rust/WASM)
* [x] **Issue #7: Injeção do codebase-memory-mcp (Auto-Wiring & Telemetria)**
  * Configuração automática do servidor MCP em .cursor/mcp.json, .gemini/settings.json e .claude/mcp.json.
  * O agente já acorda com o grafo de conhecimento carregado no primeiro segundo.
  * Dashboard de observabilidade e métricas de AST conhecimento em dashboards/matryoshka-grafana.json.
* [ ] **Issue #6: Motor AST Multi-Linguagem com Tree-sitter WASM**
  * Parser sintático de alta velocidade cobrindo as 5+ linguagens canônicas.
  * Análise estática de AST de SQL (detecção de SELECT *, ausência de índices e injection antes de tocar no banco).

---

### 🧠 Fase 4: O Cérebro Harness² & Diagnóstico Executivo
* [ ] **Issue #7: Geração do DIAGNOSTIC.md Automatizado**
  * Relatório executivo apontando: 3 queries lentas, 2 gargalos de concorrência e débitos técnicos prioritários.
  * Criação do meta-learning log local (EXPERIENCE.md) para o repositório acumular sabedoria a cada sprint.
* [ ] **Issue #8: Comando Canônico matryoshka wrap [path]**
  * Fluxo completo end-to-end: Scan L0 ➔ Remediar ➔ Modularizar ➔ Auto-Wiring MCP ➔ Re-scan L4 (100% de maturidade).

---

### 🌐 Fase 5: Distribuição Universal & Lançamento Open-Source
* [ ] **Issue #9: Servidor MCP Nativo (matryoshka mcp)**
  * Expor os tools matryoshka_scan e matryoshka_wrap via stdio para Claude Code, Cursor, Gemini CLI e Zed.
* [ ] **Issue #10: Compilação de Binários Standalone via Bun**
  * bun build --compile gerando executáveis únicos para Linux x64/ARM64, macOS Apple Silicon e Windows.
  * Publicação no npm (npx matryoshka-harness wrap .).

---
*LeonelLabs Matryoshka Harness — Engineered for Sovereign Silicon Governance.*
