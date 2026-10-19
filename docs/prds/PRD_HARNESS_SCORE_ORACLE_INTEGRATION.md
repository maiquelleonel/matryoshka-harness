# 📋 PRD: Comando 'baba scan' — Oráculo de Maturidade (harness-score) & Raio-X Semântico (codebase-memory-mcp)

**Status:** Aprovado para Desenvolvimento  
**Fase do Roadmap:** Fase 1 (Issue #2)  
**Autor:** Maiquel Leonel & Ouroboros Architecture Pod  
**Target:** Bun + TypeScript  

---

## 🎯 1. O Triângulo de Execução do Comando 'baba scan'

O comando `baba scan` (com aliases `bbyg scan` e `matryoshka scan`) não é apenas um wrapper raso de terminal. Ele é a ponte inteligente entre a régua de governança e a realidade do código-fonte:

1. **Régua de Maturidade (`harness-score`):**
   - Roda a verificação canônica dos 5 eixos (Contexto, Skills, Guardrails, Sensores, Higiene).
   - Aponta exatamente **o que está faltando** no repositório (gaps como `CTX-01`, `CI-01`, `SNS-05`).
2. **Raio-X Semântico (`codebase-memory-mcp`):**
   - Inspeciona o grafo de conhecimento da base em AST.
   - Mapeia os clusters reais de código, rotas de API, models de banco e dependências.
   - **Cruza o que o harness-score pediu com o que realmente existe no código**, identificando exatamente quais regras, fences e testes precisam ser gerados.
3. **Especificação de Remediação para o Agente:**
   - Emite o plano estruturado de issues atômicas prontas para o agente implementar no silício de acordo com a linguagem detectada.

---

## 🏗️ 2. Arquitetura do Pipeline 'baba scan'

```
                                ❯ baba scan [path]
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│       1. paladini/harness-score      │  │        2. codebase-memory-mcp        │
│          (O Diagnóstico L0..L4)      │  │          (O Raio-X Semântico)        │
│                                      │  │                                      │
│ • Gaps: CTX-01, CI-01, SNS-05        │  │ • Clusters: Controllers, Models, ORM │
│ • Score atual: 35/105 pts (L1)       │  │ • Rotas HTTP & Entidades de Banco    │
│ • O QUE FALTA                        │  │ • O QUE JÁ EXISTE NO CÓDIGO          │
└──────────────────┬───────────────────┘  └──────────────────┬───────────────────┘
                   │                                         │
                   └────────────────────┬────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                       3. CONCILIAÇÃO & PLANO DE REMEDIAÇÃO                     │
│                                                                                │
│  • Bate os gaps contra o grafo do repositório:                                 │
│      - Falta AGENTS.md? Extrai os padrões reais dos models/rotas para gerar.   │
│      - Falta teste? Mapeia as 3 rotas críticas desprovidas de cobertura.       │
│  • Emite o relatório executivo (Terminal / --json)                             │
│  • Prepara o backlog de issues para o agente implementar na linguagem certa.   │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ 3. Comandos & Ergonomia

```bash
# Scan completo: harness-score + codebase-memory-mcp
baba scan .

# Scan com emissão de JSON para o agente implementar
baba scan . --json

# Scan com geração de badge SVG
baba scan . --badge ./docs/harness-badge.svg
```

---

## ✅ 4. Critérios de Aceite (BDD)

### AC-1: Execução Coordenada de harness-score & codebase-memory-mcp
* **Given** um repositório git local,
* **When** o comando `baba scan .` for executado,
* **Then** o sistema deve executar o `harness-score` para capturar os gaps de governança e consultar o grafo do `codebase-memory-mcp` para identificar os clusters e entidades reais da base.

### AC-2: Conciliação Semântica de Gaps vs Código Existente
* **Given** gaps reportados pelo harness-score (ex: ausência de contexto de arquitetura),
* **When** o scan cruzar os dados com o grafo de conhecimento,
* **Then** a saída deve detalhar exatamente quais frameworks, models e rotas existentes devem compor o `AGENTS.md` e as `SKILLS.md`, sem inventar estruturas inexistentes.

### AC-3: Mapeamento de Issues de Remediação por Linguagem
* **Given** um projeto com stack identificada (Python, PHP, TS, Go, Rust, Ruby),
* **When** a flag `--json` for passada,
* **Then** o payload deve conter uma lista ordenada de `remediation_issues` tipadas para a linguagem, prontas para consumo por agentes agênticos.

### AC-4: Resiliência Offline & Fallback Defensivo
* **Given** um ambiente onde o servidor MCP ainda não foi inicializado,
* **When** o `baba scan .` rodar,
* **Then** o scanner deve realizar o bootstrap in-memory do grafo ou degradar graciosamente para a inspeção estrutural de arquivos locais, sem travar o comando.
