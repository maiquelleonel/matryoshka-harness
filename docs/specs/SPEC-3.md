# SPEC-3: Maturity Oracle Integration (paladini/harness-score via Bun Subprocess)

**Status:** IN_PROGRESS  
**Roadmap Phase:** Phase 1 (Issue #2 / #3)  
**Author:** Maiquel Leonel & Ouroboros Architecture Pod  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objective & Overview
Integrate the canonical maturity evaluation oracle (`paladini/harness-score`) into **Matryoshka-Harness** (`baba` / `bbyg` / `matryoshka`), enabling deterministic execution against any host repository via high-performance Bun subprocesses (`Bun.spawn`).

The oracle extracts governance maturity levels (L0 to L4), numerical score (0 to 105 points), and architectural gaps across the canonical 5 axes: Context (`CTX`), Skills (`SKL`), Guardrails (`GRD`), Sensors (`SNS`), and Hygiene (`HYG`).

---

## 🔍 2. Execution Architecture & Contracts

### 2.1 Subprocess Runner Contract
The core runner in `src/scanner.ts` invokes the oracle binary using Bun's native subprocess primitives:

```typescript
export interface HarnessScoreOptions {
  binaryPath?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  allowFallback?: boolean;
}

export interface HarnessGap {
  id: string; // e.g. "CTX-01", "CI-01", "SNS-05"
  axis: "context" | "skills" | "guardrails" | "sensors" | "hygiene";
  title: string;
  description?: string;
  remediation?: string;
  weight?: number;
}

export interface HarnessScoreResult {
  score: number;
  maxScore: number;
  level: "L0" | "L1" | "L2" | "L3" | "L4";
  gaps: HarnessGap[];
  passed: string[];
  rawOutput?: string;
  source: "subprocess" | "fallback";
  executionTimeMs: number;
}
```

### 2.2 Binary Resolution Order
1. Explicit option `binaryPath`
2. Environment variable `HARNESS_SCORE_BIN`
3. Local project binary (`node_modules/.bin/harness-score`)
4. System PATH resolution via `Bun.which("harness-score")`
5. In-memory fallback evaluator if `allowFallback` is enabled

---

## ✅ 3. Acceptance Criteria (BDD)

### AC-1: Deterministic Subprocess Spawning via Bun.spawn
* **Given** a valid executable binary for `harness-score` (or mock binary),
* **When** `runHarnessScoreSubprocess(targetDir, options)` is executed,
* **Then** it must spawn the process via `Bun.spawn`, pass `--json` and the target path, stream stdout, and resolve the structured `HarnessScoreResult` with `source: "subprocess"`.

### AC-2: Structured JSON Output Parsing & Gap Mapping
* **Given** the subprocess emits standard JSON with score, level, and identified gaps (`CTX-01`, `CI-01`, etc.),
* **When** parsing the stdout stream,
* **Then** all gaps must be parsed into typed `HarnessGap` records with their corresponding governance axis, and the maturity level must be normalized to `L0`..`L4`.

### AC-3: Execution Timeout & Error Handling
* **Given** a subprocess that hangs or exits with a non-zero exit code,
* **When** the execution exceeds `timeoutMs` or encounters a process failure,
* **Then** the process must be terminated cleanly and reject with an informative error (or trigger fallback when configured).

### AC-4: Resilient Fallback When Binary is Missing
* **Given** a host environment where `harness-score` binary is not installed globally or locally,
* **When** `runHarnessScoreSubprocess` is invoked with `allowFallback: true` (or via `executeHarnessScore`),
* **Then** it must gracefully fall back to an in-memory structural evaluation without crashing.

---

## 📋 4. Subtasks & Delivery Checklist
- [x] Subtask 1: Execute `paladini/harness-score` (or local equivalent binary) against host repo via Bun subprocess
- [ ] Subtask 2: Perform semantic reconciliation: map L0-L4 gaps with detected polyglot stack
- [ ] Subtask 3: Expose human-readable terminal output and structured `--json`
- [ ] Subtask 4: Support SVG badge generation via `--badge`
- [ ] Subtask 5: Graceful in-memory fallback when oracle is not globally installed
