# 🗺️ Matryoshka-Harness Roadmap

This document outlines the strategic milestones, architectural evolutions, and canonical protocols of **Matryoshka-Harness** (`@maiquelleonel/matryoshka`, CLI aliases: `baba`, `bbyg`, `matryoshka`, `matrioska`).

---

## 🎯 Architectural Vision & Boundary ("The Seam")

Matryoshka-Harness is the **Adaptive Context-Fencing & L4 Maturity Gate** designed for the **Turn-Zero** of coding agents. It sanitizes and standardizes chaotic, poorly configured codebases before agents execute, preventing context window saturation and model hallucinations.

* **Matryoshka-Harness (`baba`):** Operates on the local developer environment and during the agent's pre-execution loop. It enforces strict token budgets (`AGENTS.md` < 200 tokens), compiles on-demand modular skills (`.agents/skills/`), performs polyglot AST traversal, and evaluates sub-25ms non-autoregressive guardrails.
* **Ouroboros Engine (`ouroboros`):** Operates on the enterprise CI/CD server. It manages parallel DAG worktrees, ephemeral container sandboxes, autonomous merge risk analysis, and sovereign auto-merges.

---

## 📅 Roadmap Overview

```
[v0.21.x (Current Launch)] ──► [v0.22.x: Pluggable System-1 Gate] ──► [v0.23.x: Native Djairon & OTel] ──► [v1.0.0: Stable Ecosystem]
 • Polyglot AST Engine        • Jev/Laya Wire Protocol (/predict)  • Native ONNX Daemon Bridge      • Certified IDE Plugins
 • Concentric Context-Fencing • .babarc.json + BABA_SYSTEM1_* ENV  • OpenTelemetry Context Spans    • Strict Backward Compatibility
 • Layered Ignores & Tests    • Heuristic AST Fallback (<1ms)      • Fast Autonomous Pre-Flight     • Plugin Discovery Engine
```

---

## 🚀 Milestones & Evolution Phases

### Phase 1: Context-Fencing & L4 Remediation Foundation (`v0.1.0` - `v0.21.x`) — **[COMPLETED]**
- [x] **Polyglot Stack Introspection:** Sub-10ms detector for TS/JS, Python, Go, Rust, Ruby, PHP (`baba detect`).
- [x] **Maturity Oracle Integration:** Reconciles L0–L4 gaps via `paladini/harness-score` (`baba scan`).
- [x] **Contextual AST Antipattern Suite:** Polyglot Tree-sitter WASM scanner detecting CWE-89 raw SQL injection, credential leaks, and assertionless tests (`baba wrap`).
- [x] **Adaptive AGENTS.md Compiler:** Ultra-lean root `AGENTS.md` (<200 tokens) with specialized on-demand modular skills in `.agents/skills/` (`baba agents generate`).
- [x] **Non-Destructive Migration Engine:** Seamlessly migrates monolithic legacy agent instructions into concentric layers (`baba agents migrate`).
- [x] **Cognitive Context Linter:** Turn-zero token simulator and slop detector (`baba agents audit`).
- [x] **Interactive TUI Skill Inspector:** Terminal-based preview modal and skill selector.
- [x] **Layered Ignore Engine:** `.babaignore` & `.bbygignore` support, `--exclude` CLI options, and default test suite exclusion (`--include-tests`).
- [x] **Triple Alias Parity & Distribution:** Strict parity across `baba`, `bbyg`, `matryoshka`, `matrioska` distributed on NPM and standalone Bun native binaries.

---

### Phase 2: System-1 Non-Autoregressive Fast-Gate Protocol (`v0.22.x`) — **[ACTIVE SPECIFICATION]**

#### 💡 The Problem
Regexes and static rules are brittle, while invoking heavy autoregressive LLMs (70B+ parameters) for simple security checks and command verification introduces high latency (>2s) and inflates token costs.

#### 🏛️ The Solution: Jev / Laya Wire Protocol Integration
Rather than bundling 200MB+ heavy model weights inside the lightweight CLI package (~167KB), Matryoshka adopts a **plug-and-play provider architecture** that natively speaks the canonical wire protocol of **Jev** and its drop-in port **Djairon** (based on `NandhaKishorM/laya` ModernBERT / mmBERT).

#### 🔌 Wire Protocol Specification (POST `/predict`)
Both Jev and Djairon expose an identical REST endpoint:

* **Endpoint:** `POST /predict`
* **Health Check:** `GET /health`
* **Headers:** `Content-Type: application/json`, `Authorization: Bearer <TOKEN>` (optional)

##### Request Payload Schema
```json
{
  "state": "<context_string_under_evaluation>",
  "questions": {
    "<question_id>": {
      "type": "noul" | "choice" | "score",
      "instructions": "<evaluation_prompt>",
      "criteria": { ... } | [ ... ]
    }
  }
}
```

##### Canonical Response Schema (`Prediction`)
```json
{
  "model": "laya-v1-fast",
  "answers": {
    "is_destructive": {
      "type": "noul",
      "noul": 0.982,
      "confidence": 0.982,
      "answer_confidence": 0.982,
      "x_jev_confidence": 0.982,
      "low_confidence": false
    },
    "intent_category": {
      "type": "choice",
      "choice": "remote_code_execution",
      "probabilities": {
        "build_compilation": 0.010,
        "remote_code_execution": 0.970,
        "testing_automation": 0.020
      },
      "confidence": 0.970,
      "answer_confidence": 0.970,
      "low_confidence": false
    },
    "structural_risk": {
      "type": "score",
      "score": 5.0,
      "probabilities": {
        "1": 0.005,
        "2": 0.010,
        "3": 0.015,
        "4": 0.070,
        "5": 0.900
      },
      "legend": { "1": "cosmetic", "5": "breaking" },
      "confidence": 0.900,
      "answer_confidence": 0.900,
      "low_confidence": false
    }
  },
  "usage": {
    "input_tokens": 38,
    "output_tokens": 3
  }
}
```

#### 🛡️ Question Primitives
1. **`noul` (Calibrated Binary Probability):** Single forward pass boolean classifier returning `noul` in `[0.0, 1.0]` (greater or equal to 0.5 evaluates to `true`). Used for instant command interception (`is_destructive_command`), prompt injection detection (`is_prompt_injection`), and honeypot filtering.
2. **`choice` (Categorical Distribution):** Selects from a predefined array or map of categories with exact softmax probability vectors. Used for command intent profiling and stack classification.
3. **`score` (Ordinal Scale):** Evaluates risk or compliance along an ordinal scale (e.g., 1 to 5) with full probability distribution. Used for migration risk scoring.

#### ⚙️ Configuration & Precedence
Configuration follows the 12-Factor CLI cascading pattern:
Built-in Heuristic (<1ms) -> .babarc.json / .bbygrc.json -> Environment Variables -> CLI Flags

* **Config File (`.babarc.json`):**
  ```json
  {
    "$schema": "https://matryoshka.dev/schema.json",
    "system1": {
      "engine": "laya",
      "endpoint": "http://127.0.0.1:11435",
      "timeoutMs": 50,
      "fallback": "heuristic",
      "confidenceThreshold": 0.8
    }
  }
  ```
* **Environment Variables:**
  - `BABA_SYSTEM1_ENGINE` / `BBYG_SYSTEM1_ENGINE`: `laya` | `jev` | `heuristic`
  - `BABA_SYSTEM1_ENDPOINT` / `BBYG_SYSTEM1_ENDPOINT`: e.g. `http://127.0.0.1:11435` or `unix:///var/run/djairon.sock`
  - `BABA_SYSTEM1_TIMEOUT_MS`: Default `50`
* **Zero-Breaking Graceful Degradation:** If the Jev/Laya daemon is unreachable or times out (>50ms), Matryoshka immediately falls back to built-in Tree-sitter WASM heuristic checks without blocking developer execution.

---

### Phase 3: Telemetry, Observability & Djairon Daemon (`v0.23.x`)
- [ ] **OpenTelemetry Native Spans:** Emit context-fencing telemetry metrics (tokens saved, turn-zero cache hits, seam violations prevented).
- [ ] **Auto-Wire Local Djairon Daemon:** Auto-discover running Djairon/Laya local instances via local port probe or domain socket (`/var/run/djairon.sock`).
- [ ] **Interactive Audit Visualizer:** Terminal sparklines and token budget allocation visualizations for complex monorepos.

---

### Phase 4: Production Hardening & Global Ecosystem (`v1.0.0`)
- [ ] **Frozen Core APIs:** Guarantee long-term backward compatibility for `baba detect`, `baba wrap`, and `baba agents`.
- [ ] **IDE Certified Extensions:** One-click marketplace extensions for Cursor, VS Code, Zed, and Claude Desktop wrapping native MCP servers.
- [ ] **Community Archetype Marketplace:** Declarative schema for community-contributed framework archetypes (e.g. Laravel, Phoenix, NestJS, Rails).
