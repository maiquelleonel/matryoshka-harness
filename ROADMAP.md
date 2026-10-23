# 🗺️ Matryoshka-Harness — Engineering Roadmap

## 🎯 1. Visão Executiva & Tese Fundamental
O **Matryoshka-Harness** (`baba` / `bbyg` / `matryoshka`) é uma engine de cercamento contextual adaptativo, anti-slop prompt compiler e remediação estática de maturidade (L0 a L4) para agentes autônomos de código. 

Desenvolvido em **Bun (TypeScript estrito)** para execução sub-15ms, o projeto opera como um **mashup concêntrico de harnesses de governança**:
1. **Oráculo de Avaliação (Layer 1):** Heurísticas estruturais de higiene (`paladini/harness-score`).
2. **Raio-X Semântico (Layer 2):** Grafo AST de chamadas e fluxo de dados (`codebase-memory-mcp`).
3. **Cercamento Adaptativo (Layer 3):** Compilador de `AGENTS.md` lean (< 200 tokens) e skills modulares on-demand com YAML frontmatter.
4. **Motor AST Poliglota (Layer 4):** Validação estática profunda via WebAssembly (`web-tree-sitter` WASM) e o comando canônico `baba wrap` (Harness²).
5. **Servidor MCP Nativo (Layer 5):** Exposição de ferramentas e recursos via stdio JSON-RPC 2.0 para Cursor, Zed, Claude Code e Gemini CLI.
6. **Distribuição Soberana:** Executáveis autocontidos e publicação NPM com proteção de typosquatting.

---

## 🚀 2. Status das Fases de Desenvolvimento

### 📍 Fase 1: O Embrião & O Oráculo `[CONCLUÍDA]`
*Foco: Detector de stacks poliglotas, integração com o oráculo e pipeline de governança.*
- [x] **Issue #1: Detector Poliglota de Stacks e Arquétipos** (`v0.1.0`)
- [x] **Issue #3: Integração do Oráculo de Avaliação (`harness-score`) & Geração de Badge SVG** (`v0.2.0`)
- [x] **Issue #5: GitHub Actions CI Verification Gate & Automated SemVer Release** (`v0.2.1`)

---

### 📍 Fase 2: Raio-X Semântico & MCP Auto-Wiring `[CONCLUÍDA]`
*Foco: Auto-configuração de ferramentas de grafo e telemetria para IDEs.*
- [x] **Issue #7: Auto-Wiring do `codebase-memory-mcp` para Cursor, Gemini CLI e Claude Code** (`v0.2.2`)
- [x] **Instrumentação de Telemetria AgentOps & Dashboard Grafana** (`dashboards/matryoshka-grafana.json`)

---

### 📍 Fase 3: Remediação Pragmática & `AGENTS.md` Adaptativo `[CONCLUÍDA]`
*Foco: Combate ao inchaço de contexto e eliminação de AI-slop.*
- [x] **Issue #8: Compilador de `AGENTS.md` Ultraleve (< 200 tokens) & Modular Skills Engine** (`v0.3.0`)
  * Modularização em `.agents/skills/` (`skill-backend`, `skill-database`, `skill-frontend`, `skill-security`, `skill-testing`).
  * Invariante de YAML Frontmatter em todas as skills modulares.
  * Proteção não-destrutiva com backup automático (`.bak`).

---

### 📍 Fase 4: Motor AST Poliglota & Comando `baba wrap` (Harness²) `[CONCLUÍDA]`
*Foco: Validação estática profunda via WebAssembly e diagnóstico de débitos.*
- [x] **Issue #11: WebAssembly Tree-sitter AST Engine & `baba wrap`** (`v0.3.1` / PR #13)
  * Parser sintático WASM sem dependências de host C/C++, Python ou Rust.
  * Regras de antipatterns contextuais: SQL injection via interpolação, testes sem asserção e credenciais hardcoded.
  * Cálculo do Harness² Composite Score (0 a 100) e geração determinística de `DIAGNOSTIC.md`.
  * Calibração empírica de arquétipos (`api-backend`, `browser-extension`, `static-site`).

---

### 📍 Fase 5: Servidor MCP Nativo & Distribuição Global `[EM ANDAMENTO]`
*Foco: Acesso nativo aos agentes de IDE e empacotamento universal.*
- [x] **Issue #12: Servidor MCP Nativo via Stdio (`baba mcp serve`)** (PR #15 — `MERGED`)
  * Protocolo JSON-RPC 2.0 estrito com separação de streams (`stdout` para RPC, `stderr` para logs).
  * Tools expostas: `detect_stack`, `scan_harness`, `wrap_context`, `generate_agents`.
  * Resources expostos: `matryoshka://agents`, `matryoshka://diagnostic`.
  * Prompts expostos: `audit_repository`.
- [ ] **Issue #13: Compilação Standalone via Bun & Publicação NPM**
  * Compilação `bun build --compile` gerando executáveis únicos (`baba-linux-x64`, `baba-darwin-arm64`).
  * Workflow de release no GitHub Actions utilizando o secret `NPM_TOKEN`.
  * Publicação multi-package com cascas de typosquatting: `@maiquelleonel/matryoshka` e aliases (`@maiquelleonel/[baba, bbyg, matrioska]`).
- [ ] **Issue #14: Vitrine de Lançamento (Showcase README, CLI Help & Ouroboros Heritage)**
  * README estelar estilo "GitHub Project of the Week" com o diagrama das 5 camadas concêntricas.
  * Demonstração visual interativa via terminal gravado (VHS).
  * Atribuição de honra ao Google Research (Harness²) e Fernando Paladini (`harness-score`).
  * Selo oficial: *"⚡ Built with mathematical rigor by Ouroboros Engine"*.

---

### 📍 Fase 6: Cognitive Linter, Dynamic Introspection & Polish `[PLANEJADA]`
*Foco: Elevação da experiência do desenvolvedor e refinamento semântico profundo.*

#### 1. Linter Cognitivo de Contexto (`baba agents audit`)
- [ ] **Auditoria da Árvore de Resolução de Contexto:** Simula o Turno Zero do agente e mede o payload inicial de tokens.
- [ ] **Detecção de Links Mortos:** Valida se todos os caminhos de arquivos citados no `AGENTS.md` existem no disco.
- [ ] **Heurística de Prompt Hygiene:**
  * *Negative Phrasing Trap:* Alerta contra densidade excessiva de proibições ("NÃO/NUNCA/JAMAIS") sem alternativa afirmativa.
  * *Permissive Leak:* Identifica linguagem frouxa ("se você quiser", "considere usar") e recomenda invariantes imperativos.
  * *Greedy Preload Guard:* Verifica se o prompt possui guarda contra pré-carregamento cego de todas as skills.

#### 2. Migração Não-Destrutiva com YAML Frontmatter
- [ ] Ao executar `baba agents generate` em um repositório com `AGENTS.md` pré-existente:
  * O conteúdo humano legado é preservado e fatiado para `.agents/skills/custom-instructions.md`.
  * A skill legada recebe YAML Frontmatter estruturado (`origin: legacy_agents_md`).
  * O novo root `AGENTS.md` lean (< 200 tokens) inclui ponteiro direto para a skill customizada, garantindo que zero regras de negócio sejam perdidas.

#### 3. Introspecção Semântica de Rotas e Models via Tree-sitter WASM
- [ ] Inspecionar o código de arquivos consolidados (`main.py`, `app.py`, `server.ts`) para extrair rotas e models:
  * Rotas: decorators `@app.get`, `@router.post`, `app.use('/api')`.
  * Models: classes herdando de `BaseModel`, `models.Model`, `SQLModel`.
- [ ] Fallback para comandos nativos de frameworks quando disponíveis (`manage.py show_urls`, `rails routes`, `artisan route:list`).

#### 4. Inspeção Dinâmica de Lockfiles
- [ ] Mapeamento aprofundado de dependências e frameworks instalados analisando lockfiles:
  * `package-lock.json`, `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`
  * `uv.lock`, `poetry.lock`, `Pipfile.lock`
  * `Gemfile.lock`, `Cargo.lock`, `mix.lock`

#### 5. Pipeline Canônico Unificado de 5 Gates (`baba gate`)
- [ ] Comando canônico executando o crivo de pré-PR local em 800ms:
  `Audit (pip/bun) ➔ Lint & Format (auto-fix) ➔ Harness² (AST) ➔ Tests ➔ Coverage SLA`.

#### 6. TUI Interativa para Inspeção de Skills
- [ ] No `baba agents generate`, adicionar modo interativo com navegação por setas (`↑` `↓`) para pré-visualizar e inspecionar o conteúdo de cada skill antes da gravação em disco.
