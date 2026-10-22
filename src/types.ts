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

export type RemediationPriority = "critical" | "high" | "medium" | "low";

export interface RemediationIssue {
  id: string;
  gapId: string;
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
  oracleSource?: "subprocess" | "fallback";
  totalGaps: number;
  remediationIssues: RemediationIssue[];
  entities: CodebaseEntities;
  timestamp: string;
}

export interface BadgeOptions {
  label?: string;
  format?: "level" | "score" | "full";
}

export type McpTargetName = "cursor" | "gemini" | "claude";

export interface McpTargetConfig {
  name: string;
  target: McpTargetName;
  path: string;
  relativePath: string;
  action: "create" | "update" | "unchanged";
  status: "planned" | "created" | "updated" | "unchanged" | "error";
  error?: string;
}

export interface McpWireOptions {
  dryRun?: boolean;
  targets?: McpTargetName[];
}

export interface McpWireResult {
  status: "planned" | "success" | "error";
  command: "mcp wire";
  rootPath: string;
  dryRun: boolean;
  serverName: "codebase-memory-mcp";
  serverConfig: {
    command: string;
    args: string[];
  };
  targets: McpTargetConfig[];
  files: McpTargetConfig[];
  message?: string;
}

// ==========================================
// SPEC-11: Polyglot AST Engine & Baba Wrap
// ==========================================

export type AstLanguage = "typescript" | "javascript" | "python" | "go" | "rust";

export interface AstPoint {
  row: number;
  column: number;
}

export interface AstNode {
  type: string;
  text: string;
  startPosition: AstPoint;
  endPosition: AstPoint;
  children: AstNode[];
  parent?: AstNode | null;
  childCount: number;
  findChildByType(type: string): AstNode | null;
  findChildrenByType(type: string): AstNode[];
  walk(visitor: (node: AstNode) => void | boolean): void;
}

export interface ParsedFileAst {
  filePath: string;
  relativePath: string;
  language: AstLanguage;
  sizeBytes: number;
  parseEngine: "tree-sitter-wasm" | "heuristic-fallback";
  parseTimeMs: number;
  rootNode: AstNode;
  content: string;
  lines: string[];
}

export interface AstWalkerOptions {
  cwd?: string;
  maxFileSizeKb?: number;
  timeoutMs?: number;
  languages?: AstLanguage[];
  ignorePatterns?: string[];
  wasmGrammarPaths?: Partial<Record<AstLanguage, string>>;
  concurrency?: number;
}

export interface AstSkippedFile {
  filePath: string;
  relativePath: string;
  reason:
    | "exceeds_max_size"
    | "binary"
    | "ignored"
    | "unsupported_language"
    | "timeout"
    | "parse_error";
  sizeBytes?: number;
  error?: string;
}

export interface AstWalkResult {
  totalFilesDiscovered: number;
  scannedFiles: ParsedFileAst[];
  skippedFiles: AstSkippedFile[];
  languagesCount: Record<AstLanguage, number>;
  executionTimeMs: number;
}

export type AstViolationSeverity = "critical" | "high" | "medium" | "low";

export interface AstViolation {
  id: string;
  ruleId: string;
  severity: AstViolationSeverity;
  message: string;
  filePath: string;
  relativePath: string;
  line: number;
  column: number;
  nodeType: string;
  codeSnippet: string;
  remediation: string;
}

export interface AstRuleContext {
  file: ParsedFileAst;
  allFiles?: ParsedFileAst[];
}

export interface AstRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultSeverity: AstViolationSeverity;
  check(context: AstRuleContext): AstViolation[];
}

export interface AstRuleSuiteOptions {
  rules?: AstRule[];
  disabledRuleIds?: string[];
  severityOverrides?: Partial<Record<string, AstViolationSeverity>>;
  minSeverity?: AstViolationSeverity;
}

export interface AstRuleSuiteResult {
  totalViolations: number;
  violations: AstViolation[];
  bySeverity: Record<AstViolationSeverity, number>;
  byRule: Record<string, number>;
  scannedFilesCount: number;
  cleanFilesCount: number;
  executionTimeMs: number;
}


