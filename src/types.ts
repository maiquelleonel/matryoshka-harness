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

export interface AstDeductionPenalties {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface Harness2Weights {
  oracleWeight: number;
  astWeight: number;
}

export interface CompositeScorerOptions {
  weights?: Partial<Harness2Weights>;
  penalties?: Partial<AstDeductionPenalties>;
  threshold?: number;
  normalizeOracleScore?: boolean;
}

export interface AstHealthBreakdown {
  score: number;
  totalDeductions: number;
  violationsCount: number;
  bySeverity: Record<AstViolationSeverity, number>;
  penaltiesApplied: Record<AstViolationSeverity, number>;
}

export interface OracleScoreBreakdown {
  rawScore: number;
  maxScore: number;
  normalizedScore: number;
  level: MaturityLevel;
  source: "subprocess" | "fallback";
  totalGaps: number;
}

export interface SurgicalActionItem {
  id: string;
  source: "ast" | "oracle";
  severity: AstViolationSeverity;
  title: string;
  description?: string;
  target?: string;
  action: string;
  remediation?: string;
}

export interface AggregatedGapsResult {
  totalCount: number;
  astViolationsCount: number;
  oracleGapsCount: number;
  hasCriticalViolations: boolean;
  bySeverity: Record<AstViolationSeverity, number>;
  byRule: Record<string, number>;
  byAxis: Record<GovernanceAxis, number>;
  actionPlan: SurgicalActionItem[];
}

export interface CompositeScoreResult {
  compositeScore: number;
  status: "PASS" | "NEEDS_REMEDIATION";
  threshold: number;
  passedThreshold: boolean;
  hasCriticalViolations: boolean;
  passedStrict: boolean;
  oracle: OracleScoreBreakdown;
  ast: AstHealthBreakdown;
  aggregatedGaps: AggregatedGapsResult;
  violations?: AstViolation[];
  executionTimeMs: number;
}

export interface CompositeEvaluationOptions extends CompositeScorerOptions {
  cwd?: string;
  oracleOptions?: HarnessScoreOptions;
  astOptions?: AstWalkerOptions;
  ruleOptions?: AstRuleSuiteOptions;
}

export interface Harness2EvaluationResult extends CompositeScoreResult {
  projectPath: string;
  totalFilesAnalyzed: number;
  languagesCount: Record<AstLanguage, number>;
  skippedFilesCount: number;
  timestamp: string;
}

// ==========================================
// SPEC-11 Subtask 4: Report Compilers
// ==========================================

export interface DiagnosticCompilerOptions {
  maxTokens?: number;
  includeSnippets?: boolean;
  truncateOnBudget?: boolean;
  remediationCommand?: string;
}

export interface WrapJsonSummary {
  compositeScore: number;
  composite_score: number;
  status: "PASS" | "NEEDS_REMEDIATION";
  threshold: number;
  passedThreshold: boolean;
  passed_threshold: boolean;
  hasCriticalViolations: boolean;
  has_critical_violations: boolean;
  passedStrict: boolean;
  passed_strict: boolean;
  oracleScore: number;
  oracle_score: number;
  astScore: number;
  ast_score: number;
  totalFilesAnalyzed: number;
  total_files_analyzed: number;
  languagesCount: Record<AstLanguage, number>;
  languages_count: Record<AstLanguage, number>;
  totalViolations: number;
  total_violations: number;
  bySeverity: Record<AstViolationSeverity, number>;
  by_severity: Record<AstViolationSeverity, number>;
  executionTimeMs: number;
  execution_time_ms: number;
}

export interface FormattedAstViolation {
  id: string;
  ruleId: string;
  rule_id: string;
  severity: AstViolationSeverity;
  message: string;
  filePath: string;
  file_path: string;
  relativePath: string;
  relative_path: string;
  line: number;
  column: number;
  nodeType: string;
  node_type: string;
  codeSnippet: string;
  code_snippet: string;
  remediation: string;
}

export interface WrapJsonReport {
  status: "success" | "remediation_needed";
  command: "wrap";
  harnessScore: number;
  harness_score: number;
  compositeScore: number;
  composite_score: number;
  projectPath: string;
  project_path: string;
  timestamp: string;
  summary: WrapJsonSummary;
  violations: FormattedAstViolation[];
  actionPlan: SurgicalActionItem[];
  action_plan: SurgicalActionItem[];
  oracle: OracleScoreBreakdown;
  ast: AstHealthBreakdown;
  reportPath?: string;
  report_path?: string;
  written?: boolean;
}

export interface DiagnosticWriteOptions {
  outputPath?: string;
  dryRun?: boolean;
  atomic?: boolean;
  compilerOptions?: DiagnosticCompilerOptions;
}

export interface DiagnosticWriteResult {
  reportPath: string;
  written: boolean;
  content: string;
  tokenCount: number;
  isWithinBudget: boolean;
  dryRun: boolean;
}

// ==========================================
// SPEC-11 Subtask 5: Wrap CLI Options
// ==========================================

export interface WrapCliOptions {
  outputPath?: string;
  strict?: boolean;
  threshold?: number;
  dryRun?: boolean;
  json?: boolean;
  maxFileSizeKb?: number;
}




