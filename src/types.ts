export type PrimaryStack =
  | "python"
  | "typescript"
  | "go"
  | "rust"
  | "ruby"
  | "php"
  | "unknown";

export type ProjectArchetype =
  | "procedural-cms"
  | "reactive-frontend"
  | "opinionated-framework"
  | "distributed-systems"
  | "generic";

export interface ProjectStack {
  primary: PrimaryStack;
  frameworks: string[];
  testRunner: string | null;
  archetype: ProjectArchetype;
}

export interface DetectResult {
  status: "success" | "error";
  stack: ProjectStack;
  rootPath: string;
  message?: string;
}

export type MaturityLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export type GovernanceAxis =
  | "context"
  | "skills"
  | "guardrails"
  | "sensors"
  | "hygiene";

export interface HarnessGap {
  id: string;
  axis: GovernanceAxis;
  title: string;
  description?: string;
  remediation?: string;
  weight?: number;
}

export interface HarnessScoreOptions {
  binaryPath?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  allowFallback?: boolean;
}

export interface HarnessScoreResult {
  score: number;
  maxScore: number;
  level: MaturityLevel;
  gaps: HarnessGap[];
  passed: string[];
  rawOutput?: string;
  source: "subprocess" | "fallback";
  executionTimeMs: number;
}
