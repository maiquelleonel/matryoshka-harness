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

### 2.3 Semantic Reconciliation Contract & Remediation Issue Mapping
```typescript
export type RemediationPriority = "critical" | "high" | "medium" | "low";

export interface RemediationIssue {
  id: string; // e.g. "REM-CTX-01"
  gapId: string; // e.g. "CTX-01"
  axis: GovernanceAxis;
  title: string;
  description: string;
  targetFiles: string[];
  stack: PrimaryStack;
  priority: RemediationPriority;
  suggestedAction: string;
  snippet?: string;
}

export interface CodebaseEntities {
  models: string[];
  routes: string[];
  controllers: string[];
}

export interface SemanticReconciliation {
  primaryStack: PrimaryStack;
  archetype: ProjectArchetype;
  frameworks: string[];
  testRunner: string | null;
  oracleScore: number;
  oracleLevel: MaturityLevel;
  totalGaps: number;
  remediationIssues: RemediationIssue[];
  entities: CodebaseEntities;
  timestamp: string;
}
```

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

### AC-5: Semantic Reconciliation of Gaps with Polyglot Stack
* **Given** an oracle evaluation result containing governance gaps (`CTX-01`, `CI-01`, `SNS-05`, `DOC-02`),
* **When** `reconcileGapsWithStack(oracleResult, stack, projectPath)` is executed,
* **Then** it must correlate the gaps with the detected primary stack (`python`, `typescript`, `go`, `rust`, `ruby`, `php`), producing tailored remediation issues with targeted files, stack-specific guidance, and priority ranking without hallucinating fictional structures.

### AC-6: Codebase Entity Discovery & Anti-Slop Fencing
* **Given** a repository with existing routes, models, or controllers,
* **When** semantic reconciliation inspects the repository layout,
* **Then** discovered entities must be incorporated into the reconciliation payload (`entities.routes`, `entities.models`, `entities.controllers`) and referenced in the remediation actions for AGENTS.md, adhering to the anti-slop archetype rules (e.g. Zero forced SOLID in WordPress procedural CMS).

### AC-7: Human-Readable Terminal Output & Structured JSON Export for 'baba scan'
* **Given** a target codebase analyzed by `runMaturityScan`,
* **When** `baba scan [path]` is executed in the terminal without `--json`,
* **Then** it must render a styled, human-readable executive summary featuring:
  - Introspected root path, primary language stack, frameworks, and archetype
  - Oracle maturity level (L0-L4) and numerical score (e.g., `35/105 pts`)
  - Discovered codebase entities (routes, models, controllers)
  - Prioritized remediation action plan sorted by criticality (`critical`, `high`, `medium`, `low`) with target files and actionable instructions.
* **When** `baba scan [path] --json` is executed,
* **Then** it must emit strictly valid JSON with `status: "success"`, `command: "scan"`, `rootPath`, `oracleScore`, `oracleLevel`, `primaryStack`, `archetype`, `frameworks`, `testRunner`, `entities`, and `remediation_issues` ready for agent consumption.

---

## 📋 4. Subtasks & Delivery Checklist
- [x] Subtask 1: Execute `paladini/harness-score` (or local equivalent binary) against host repo via Bun subprocess
- [x] Subtask 2: Perform semantic reconciliation: map L0-L4 gaps with detected polyglot stack
- [x] Subtask 3: Expose human-readable terminal output and structured `--json`
- [ ] Subtask 4: Support SVG badge generation via `--badge`
- [ ] Subtask 5: Graceful in-memory fallback when oracle is not globally installed
