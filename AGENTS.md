# 🤖 AGENTS.md — Contrato de Governança e Harness Agêntico
## Protocolo de Supervisão, Engenharia e Guardrails Arquiteturais

Este repositório é gerenciado e civilizado sob o protocolo da **Matryoshka Agentic Factory**.
Qualquer agente autônomo operando nesta base deve seguir rigorosamente as regras abaixo:

---

## 🏛️ 1. Princípios Inegociáveis de Engenharia
1. **A Regra de Ouro (Red-to-Green Obrigatório):**
   - Nunca aplique correções no código de produção sem antes reproduzir em teste automatizado.
   - Todo ciclo inicia com teste falhando (RED) e conclui com teste passando (GREEN).
2. **Preservação Sagrada de Testes:**
   - É estritamente proibido afrouxar, suprimir ou deletar testes existentes.
3. **Zero Truques de Linter / Zero Supressores:**
   - Proibido usar `# noqa`, `eslint-disable`, `@ts-ignore` ou casts arbitrários.
4. **Knowledge Graph MCP First:**
   - Utilize consultas estruturadas via MCP antes de varreduras extensivas de texto.

---

## 🛠️ 2. Comandos Canônicos de Build e Teste
- **Testes:** `bun test` ou `pytest -q`
- **Linter & Formatação:** `bunx biome check .` ou `ruff check .`
- **Validação de Harness:** `bunx harness-score --json`

---

## 🛡️ 3. Governança & HITL (Human-in-the-Loop)
- Commits atômicos e descritivos no padrão Conventional Commits.
- Mudanças de alto impacto exigem validação prévia de contratos antes da implementação.
- Pausas preventivas em caso de desvio de escopo (Blast Radius Guard).
