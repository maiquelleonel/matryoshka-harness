# 📋 PRD: Integração Nativa com paladini/harness-score como Oráculo de Avaliação

**Status:** Aprovado para Desenvolvimento  
**Fase do Roadmap:** Fase 1 (Issue #2)  
**Autor:** Maiquel Leonel & Ouroboros Architecture Pod  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objetivo & Visão Geral
Integrar a biblioteca **`harness-score`** (criada por Daniel Paladini) como dependência nativa direta do pacote `matryoshka-harness`. Em vez de reinventar a régua de maturidade agêntica, o Matryoshka consome o motor do `harness-score` como o **oráculo oficial de diagnóstico**, expondo o comando `baba scan` (com aliases `bbyg scan` e `matryoshka scan`) para diagnosticar com rigor determinístico o nível de governança de qualquer repositório (L0 a L4).

---

## 🏗️ 2. Arquitetura da Integração

```
┌─────────────────────────────────────────────────────────────┐
│                 CLI ENTRANCE (baba / bbyg)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               MATRYOSHKA SCANNER (src/scanner.ts)           │
│                                                             │
│   • Invoca programmaticamente o harness-score               │
│   • Captura os 5 eixos de maturidade (105 pts):             │
│       - Context & Guides (CTX)                              │
│       - Skills & Commands (SKL)                             │
│       - Hooks & Guardrails (GRD)                            │
│       - Sensors & Feedback (SNS)                            │
│       - Hygiene & Safety (HYG)                              │
│   • Normaliza os Gaps com recomendações de remediação       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       OUTPUT MODES                          │
│                                                             │
│   • Terminal UI: Resumo visual neon com barras de progresso  │
│   • --json: Payload completo para o motor de remediação     │
│   • --badge <file>: Gera o selo SVG oficial de maturidade   │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ 3. Comandos & Ergonomia

```bash
# Diagnóstico rápido visual no terminal
baba scan .

# Diagnóstico estruturado para orquestradores (Ouroboros / Claude / Gemini)
baba scan . --json

# Diagnóstico com geração direta de badge SVG
baba scan . --badge ./docs/harness-badge.svg
```

---

## ✅ 4. Critérios de Aceite (BDD)

### AC-1: Execução Programática Determinística do Harness-Score
* **Given** um repositório git local,
* **When** a função `scanHarness(targetPath)` for acionada,
* **Then** deve executar o scanner oficial do `harness-score` sem requisições de rede, retornando o objeto contendo `level` (L0..L4), `score`, `maxScore` e `percentual`.

### AC-2: Mapeamento Granular de Gaps de Remediação
* **Given** um repositório com falhas de maturidade (ex: sem `AGENTS.md` ou sem CI),
* **When** o scan for concluído,
* **Then** deve expor a lista de pendências não cumpridas com seus IDs canônicos (`CTX-01`, `CI-01`, etc.) e a descrição exata da remediação necessária para guiar o futuro comando `baba wrap`.

### AC-3: Suporte à Flag --badge para Exportação de SVG
* **Given** a flag `--badge <caminho>`,
* **When** o scan for executado,
* **Then** o arquivo SVG oficial de maturidade deve ser gravado no caminho especificado (ex: `harness | L4`) com status 0.

### AC-4: Saída Estruturada em JSON
* **Given** a flag `--json`,
* **When** invocado por um orquestrador agêntico,
* **Then** a saída em stdout deve conter estritamente o JSON parseável no formato:
  ```json
  {
    "status": "success",
    "maturity": {
      "level": "L4",
      "levelName": "Self-correcting",
      "score": 105,
      "maxScore": 105,
      "percent": 100
    },
    "gaps": [],
    "timestamp": "2026-10-18T22:30:00Z"
  }
  ```
