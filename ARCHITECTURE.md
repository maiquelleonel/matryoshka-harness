# 🏛️ Matryoshka-Harness — System Architecture & Intent Blueprint

**Projeto:** Matryoshka-Harness (Aliases: `baba` / `bbyg` / `matryoshka`)  
**Propósito:** Context-fencing adaptativo, gerador de AGENTS.md anti-slop e remediação determinística de maturidade (L0 ➔ L4) para agentes de IA de código.  
**Runtime Primário:** [Bun](https://bun.com) (TypeScript estrito, execução nativa < 15ms, empacotamento standalone).  
**Licença:** Open-Source MIT.  

---

## 🎯 1. Visão Arquitetural & Princípios Fundamentais

1. **Context-Fencing Pragmático (Zero-Slop):**
   - Agentes de IA modernos (Claude, Gemini, Codex) falham por excesso de liberdade ou regras abstratas fora do contexto real do projeto.
   - O Matryoshka cerca o repositório antes do agente encostar no código: define convenções reais, proíbe abstrações inúteis (Zero SOLID em WordPress/Drupal!) e limita o raio de explosão.
2. **Oráculo Externo de Maturidade (Sem Reinvenção de Roda):**
   - Consome `paladini/harness-score` como dependência direta e oráculo oficial de governança (L0 a L4).
3. **Raio-X Semântico com MCP:**
   - Integra-se com o `codebase-memory-mcp` para ler o grafo em AST e reconciliar **o que falta** (diagnóstico) com **o que existe no código** (models, rotas, entidades).
4. **Ergonomia Máxima de Terminal:**
   - Binário tríplice: `baba` (4 letras, ultra-ergonômico), `bbyg` (Baba-Yaga) e `matryoshka` (formal).

---

## 📂 2. Estrutura Canônica de Pastas & Arquivos

```text
matryoshka-harness/
├── ARCHITECTURE.md              # 🏛️ [ESTE DOCUMENTO] Blueprint da arquitetura
├── ROADMAP.md                   # 🗺️ 5 Fases de desenvolvimento autônomo
├── README.md                    # 📖 Vitrine open-source e quickstart
├── package.json                 # 📦 Scripts Bun, binários (baba/bbyg/matryoshka) e deps
├── tsconfig.json                # ⚙️ Configuração TypeScript estrita
├── gemini-extension.json        # ♊ Manifesto nativo para Gemini CLI
├── .claude-plugin/              # 🦊 Manifesto nativo para Claude Code
│   └── plugin.json
│
├── src/                         # 💻 Core Engine (TypeScript puro / Bun)
│   ├── cli.ts                   # Entrypoint do CLI com parsing de flags e rotas
│   ├── detector.ts              # Detector poliglota de stack e test runner
│   ├── scanner.ts               # Orquestrador do harness-score + codebase-memory-mcp
│   ├── wrapper.ts               # Gerador adaptativo do AGENTS.md e cercamento
│   ├── ast.ts                   # Parser sintático de AST (Tree-sitter WASM / SQL AST)
│   ├── mcp.ts                   # Servidor MCP nativo via stdio para Claude e Gemini
│   └── types.ts                 # Contratos e schemas de tipos centrais
│
├── skills/                      # 🪆 Agent Skills nativas (Universal Skills)
│   └── matryoshka/
│       └── SKILL.md             # Definição e progressive disclosure da skill
│
├── commands/                    # ⚡ Slash commands universais
│   ├── wrap.md                  # Claude Code slash command
│   └── wrap.toml                # Gemini CLI slash command
│
├── docs/                        # 📚 Documentação viva
│   ├── EXPERIENCE.md            # Harness² Meta-Learning Library
│   └── prds/                    # Especificações atômicas de produto (PRDs)
│       ├── PRD_STACK_DETECTOR_AND_CLI_BASE.md
│       └── PRD_HARNESS_SCORE_ORACLE_INTEGRATION.md
│
└── tests/                       # 🧪 Suíte de Testes (RED-to-GREEN)
    ├── detector.test.ts         # Testes de detecção de stacks poliglotas
    ├── scanner.test.ts          # Testes de orquestração do harness-score
    └── cli.test.ts              # Testes de paridade de aliases (baba/bbyg)
```

---

## 🧩 3. Responsabilidade dos Módulos Centrais

### `src/detector.ts` (Stack & Runner)
* Lê a árvore de arquivos e inspeciona manifestos (`pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`).
* Retorna o tipo `ProjectStack`:
  ```typescript
  export interface ProjectStack {
    primary: 'python' | 'typescript' | 'go' | 'rust' | 'ruby' | 'php' | 'unknown';
    frameworks: string[];
    testRunner: string | null;
    archetype: 'procedural-cms' | 'reactive-frontend' | 'opinionated-framework' | 'distributed-systems' | 'generic';
  }
  ```

### `src/scanner.ts` (Diagnóstico & Conciliação)
* Invoca programmaticamente o `harness-score` para extrair o score L0..L4 e lista de gaps.
* Consulta o grafo do `codebase-memory-mcp` para identificar modelos e rotas reais existentes.
* Emite o relatório de conciliação: **O que falta vs O que existe**.

### `src/wrapper.ts` (Remediação Adaptativa)
* Injeta o `AGENTS.md` sob medida para o arquétipo do projeto.
* Cria o diretório de skills modulares (`skill-backend.md`, `skill-api.md`, `skill-security.md`).
* Configura os manifestos de MCP locais (`.cursor/mcp.json`, `.gemini/settings.json`).

---

## 🧪 4. Padrões de Qualidade & Testabilidade
* **Zero Overhead:** O CLI deve responder a `baba detect` em menos de 15ms.
* **TDD Estrito:** Todas as features são introduzidas via testes em `tests/*.test.ts` com o test runner nativo do Bun (`bun test`).
* **Zero Runtime Dependencies:** Para o usuário final, a distribuição via `npx` ou binário compilado pelo Bun dispensa a necessidade de compiladores ou runtimes adicionais no host.
