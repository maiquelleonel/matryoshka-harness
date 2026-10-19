# 🤖 AGENTS.md — Governance & Operational Directives for Matryoshka-Harness

## 🌐 Language Policy (Strictly Enforced)
* All source code, identifiers, types, comments, tests, commit messages, PR titles, and technical documentation **MUST be written exclusively in English**.
* Do not introduce Portuguese in code files, test descriptions, or documentation.

## 🛠️ Stack & Runtime Standards
* **Runtime:** [Bun](https://bun.com) v1.3+ (Do NOT use Node.js, npm, or npx directly).
* **Package Management:** `bun install`, `bun add`.
* **Testing:** `bun test` (Strict Red-to-Green cycle: write failing tests in `tests/*.test.ts` before writing code).
* **Code Style:** Pure TypeScript, zero gratuitous dependencies, no unhandled promises, sub-15ms execution.

## 🏛️ Architectural Invariants
1. **Never reinvent paladini/harness-score:** Consume it directly as an evaluation oracle.
2. **Never force unidiomatic SOLID:** Adapt conventions to the detected framework (pragmatic-first).
3. **Dual Alias Parity:** `baba`, `bbyg`, and `matryoshka` must share identical execution paths.
