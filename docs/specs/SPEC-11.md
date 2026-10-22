# 📐 SPEC-11: feat(ast): polyglot tree-sitter wasm engine and canonical baba wrap

**Módulo:** SDD Engine / Automated Architecture  
**Status:** in_progress (Subtask 3: Harness² Composite Scorer & Gap Aggregator)  
**Gatilho:** Issue #11  
**Target:** Bun + TypeScript + WebAssembly (WASM)  

### 2.7 Contratos do Harness² Composite Scorer & Gap Aggregator (Subtask 3)

```typescript
export interface AstDeductionPenalties {
  critical: number; // default: 15
  high: number;     // default: 8
  medium: number;   // default: 4
  low: number;      // default: 2
}

export interface Harness2Weights {
  oracleWeight: number; // default: 0.4
  astWeight: number;    // default: 0.6
}

export interface CompositeScorerOptions {
  weights?: Partial<Harness2Weights>;
  penalties?: Partial<AstDeductionPenalties>;
  threshold?: number;            // default: 80
  normalizeOracleScore?: boolean; // default: true
}

export interface AstHealthBreakdown {
  score: number; // 0..100
  totalDeductions: number;
  violationsCount: number;
  bySeverity: Record<AstViolationSeverity, number>;
  penaltiesApplied: Record<AstViolationSeverity, number>;
}

export interface OracleScoreBreakdown {
  rawScore: number;
  maxScore: number;
  normalizedScore: number; // 0..100
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
  compositeScore: number; // 0..100
  status: "PASS" | "NEEDS_REMEDIATION";
  threshold: number;
  passedThreshold: boolean;
  hasCriticalViolations: boolean;
  passedStrict: boolean;
  oracle: OracleScoreBreakdown;
  ast: AstHealthBreakdown;
  aggregatedGaps: AggregatedGapsResult;
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
```

### 2.8 Funções Canônicas (Subtask 3)
- `calculateAstHealthScore(violations: AstViolation[], penalties?: Partial<AstDeductionPenalties>): AstHealthBreakdown`
- `normalizeOracleBaseScore(oracle: HarnessScoreResult | number, maxScore?: number, normalize?: boolean): OracleScoreBreakdown`
- `calculateCompositeScore(oracle: HarnessScoreResult | number, astViolations: AstViolation[] | AstRuleSuiteResult, options?: CompositeScorerOptions): CompositeScoreResult`
- `aggregateHarnessGaps(oracleGaps: HarnessGap[] | null | undefined, astViolations: AstViolation[] | null | undefined): AggregatedGapsResult`
- `evaluateCompositeHarness(projectPath: string, options?: CompositeEvaluationOptions): Promise<Harness2EvaluationResult>`
- `class Harness2Scorer` (Orquestrador integrado de pontuação e agregação)

---

## 🎯 1. Objetivo & Escopo
Implement Phase 4 of the Matryoshka-Harness roadmap: zero-host-dependency Polyglot AST Engine powered by WebAssembly (WASM) and the canonical `baba wrap` (`matryoshka wrap`, `bbyg wrap`) command. Refer to PRD: `docs/prds/PRD_POLYGLOT_AST_AND_BABA_WRAP.md`

### 1.1 Escopo das Subtasks
- **Subtask 1 (Concluída):** Polyglot AST Walker & Tree-sitter WASM Engine
- **Subtask 2 (Concluída):** Contextual AST Antipattern Rule Suite (SQL, Tests, Secrets)
- **Subtask 3 (Concluída):** Harness² Composite Scorer & Gap Aggregator
- **Subtask 4:** `DIAGNOSTIC.md` & JSON Report Compilers
- **Subtask 5:** CLI Subcommand Integration, Guardrails & Strict Mode

---

## 📋 2. Contratos de I/O & Interfaces (Subtask 1)

### 2.1 Tipos Canônicos de Linguagem e Nós
```typescript
export type AstLanguage = "typescript" | "javascript" | "python" | "go" | "rust";

export interface AstPoint {
  row: number; // 0-based
  column: number; // 0-based
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
```

### 2.2 Interface de Arquivo AST Parsed
```typescript
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
```

### 2.3 Opções e Resultados do Walker
```typescript
export interface AstWalkerOptions {
  cwd?: string;
  maxFileSizeKb?: number; // default: 500
  timeoutMs?: number; // default: 2000
  languages?: AstLanguage[];
  ignorePatterns?: string[];
  wasmGrammarPaths?: Partial<Record<AstLanguage, string>>;
  concurrency?: number;
}

export interface AstSkippedFile {
  filePath: string;
  relativePath: string;
  reason: "exceeds_max_size" | "binary" | "ignored" | "unsupported_language" | "timeout" | "parse_error";
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
```

### 2.4 Funções Canônicas (Subtask 1)
- `detectFileLanguage(filePath: string): AstLanguage | null`
- `isBinaryContent(buffer: Buffer | Uint8Array): boolean`
- `isIgnoredFile(relativePath: string, customPatterns?: string[], gitignorePatterns?: string[]): boolean`
- `parseSource(source: string, language: AstLanguage, options?: AstWalkerOptions): ParsedFileAst`
- `parseFile(filePath: string, options?: AstWalkerOptions): Promise<ParsedFileAst>`
- `walkCodebase(projectPath: string, options?: AstWalkerOptions): Promise<AstWalkResult>`

### 2.5 Contratos de Violação e Regras AST (Subtask 2)
```typescript
export type AstViolationSeverity = "critical" | "high" | "medium" | "low";

export interface AstViolation {
  id: string;
  ruleId: string;
  severity: AstViolationSeverity;
  message: string;
  filePath: string;
  relativePath: string;
  line: number;      // 1-based line number
  column: number;    // 1-based column number
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
```

### 2.6 Regras Canônicas da Suite (Subtask 2)
1. **`SqlInterpolationRule` (`sql-interpolation`):**
   - Detecta interpolação de strings em queries de banco de dados (`db.query`, `cursor.execute`, `fmt.Sprintf`, template literals e f-strings com declarações SQL `SELECT`, `INSERT`, `UPDATE`, `DELETE`, etc.).
   - Severidade: `critical`.
   - Remediação: Parâmetros vinculados / queries parametrizadas.
2. **`AssertionlessTestRule` (`assertionless-test`):**
   - Detecta blocos de testes (`it`, `test`, `def test_*`, `func Test*`, `#[test] fn *`) sem asserções (`expect`, `assert`, `t.Fatal`, etc.) ou corpos de teste vazios.
   - Severidade: `high`.
   - Remediação: Adicionar ao menos uma asserção explícita.
3. **`HardcodedCredentialRule` (`hardcoded-credential`):**
   - Detecta variáveis e constantes contendo credenciais sensíveis (`api_key`, `secret`, `token`, `password`) atribuídas a literais de string em claro ou tokens de alta entropia / prefixos conhecidos (`sk_live_`, `ghp_`, `AKIA`, etc.).
   - Severidade: `critical`.
   - Remediação: Extrair credenciais para variáveis de ambiente (`process.env`, `os.environ`).
4. **`AstRuleSuite` & `runAstRules`:**
   - Orquestrador e agregador de violações com filtragem por severidade e medição de tempo de execução.

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)
```gherkin
Feature: Polyglot AST Walker & Tree-sitter WASM Engine (SPEC-11 Subtask 1)

  Scenario: Language detection and mapping
    Given a list of polyglot source files (.ts, .js, .py, .go, .rs)
    When detectFileLanguage is called for each path
    Then it accurately returns the matching AstLanguage enum or null for unsupported files

  Scenario: Filtering vendor directories, .gitignore and binary files
    Given a repository with vendor directories (node_modules, .venv, target), .gitignore rules, and binary files
    When walkCodebase is executed
    Then all vendor dirs, ignored paths, and binary files are skipped with explicit reasons
    And only valid polyglot source files are processed

  Scenario: Enforcing max file size limit (500KB default)
    Given a source file larger than 500KB
    When walkCodebase is executed
    Then the large file is skipped with reason "exceeds_max_size"
    And memory bloat is prevented

  Scenario: AST Node tree structure and traversal
    Given source code in TypeScript, Python, or Go
    When parseSource or parseFile is invoked
    Then a deterministic AstNode tree is returned with type, positions (row/col), text, and children
    And findChildByType, findChildrenByType, and walk methods traverse the tree correctly

  Scenario: Timeout and failure isolation (Graceful Degradation)
    Given a file parsing that exceeds the timeout limit (2000ms) or contains malformed syntax
    When walkCodebase is executed
    Then the error or timeout is safely trapped without aborting the overall walk
    And the skipped file records reason "timeout" or "parse_error"

  Scenario: Idempotent and deterministic file order
    Given an identical project structure scanned multiple times
    When walkCodebase is called repeatedly
    Then the scannedFiles order is byte-for-byte identical and deterministic

Feature: Contextual AST Antipattern Rule Suite (SPEC-11 Subtask 2)

  Scenario: Detecting SQL interpolation across polyglot files
    Given source files in TypeScript, Python, or Go containing unparameterized SQL dynamic queries
    When SqlInterpolationRule is executed on the parsed AST
    Then it flags violations with severity "critical"
    And provides 1-based line/col, nodeType, snippet, and parameterized remediation guidance

  Scenario: Detecting assertionless and empty test cases
    Given test files containing test blocks (test, it, def test_*, func Test*) without assertions or expectations
    When AssertionlessTestRule is executed on the parsed AST
    Then it flags violations with severity "high"
    And ignores tests containing valid assertions (expect, assert, t.Fatal)

  Scenario: Detecting hardcoded credentials and high-entropy secrets
    Given source files with variable declarations containing sensitive names (api_key, secret, password) or known token prefixes
    When HardcodedCredentialRule is executed on the parsed AST
    Then it flags violations with severity "critical"
    And ignores environment variable reads (process.env, os.getenv) and empty strings

  Scenario: Aggregating violations across multiple files and rules via AstRuleSuite
    Given a set of parsed polyglot files with various AST antipatterns
    When AstRuleSuite.run is executed
    Then it returns a deterministic AstRuleSuiteResult with total count, bySeverity, and byRule aggregates
    And supports disabledRuleIds and minSeverity filtering

Feature: Harness² Composite Scorer & Gap Aggregator (SPEC-11 Subtask 3)

  Scenario: AST health score deduction penalties
    Given AST violations with known severities (critical: -15, high: -8, medium: -4, low: -2)
    When calculateAstHealthScore is evaluated
    Then the AST health score starts at 100 and applies exact deductions
    And never drops below 0 even under extreme penalties (clamped to [0, 100])

  Scenario: Weighted composite score calculation
    Given an oracle base hygiene score of 88 and an AST health score of 81
    When calculateCompositeScore is evaluated with default weights (Oracle 0.4, AST 0.6)
    Then composite score evaluates to 84 (Math.round(88 * 0.4 + 81 * 0.6))
    And assigns status "PASS" when composite score >= 80

  Scenario: Strict CI threshold and critical violation gate
    Given a project with composite score below threshold or containing critical AST violations
    When calculateCompositeScore evaluates strict status
    Then passedStrict evaluates to false if hasCriticalViolations is true even if score >= threshold
    And passedThreshold evaluates to false if compositeScore < threshold

  Scenario: Gap aggregation and surgical action plan generation
    Given oracle governance gaps (e.g., CTX-01, CI-01) and AST violations (SQL injection, secrets)
    When aggregateHarnessGaps is invoked
    Then it aggregates total count, bySeverity, byRule, and byAxis
    And compiles a prioritized step-by-step surgical action plan with critical items first

  Scenario: End-to-end composite evaluation with graceful fallback
    Given a target repository path
    When evaluateCompositeHarness is executed
    Then it orchestrates stack detection, oracle scan (with fallback), AST walker, and rule suite
    And returns complete Harness2EvaluationResult with timing metrics and deterministic output
```

---

## 🔒 4. As 9 Dimensões de Produção (Invariantes & Casos de Borda)
1. **Input Validation:** Validar paths contra path traversal (`..`). Ignorar arquivos binários (detecção de byte nulo `\0` nos primeiros 8KB) e pastas vendor (`node_modules`, `.venv`, `target`, `vendor`, `.git`, `dist`, `build`).
2. **Failure Modes & Timeout:** Parsing de AST limitado a 2000ms por arquivo. Em falhas de grammar ou timeouts, registrar warning/skip e continuar a execução.
3. **Idempotency & Retry:** Ordenação alfabética determinística de caminhos. Múltiplas execuções no mesmo código produzem resultados idênticos.
4. **Authorization & Scopes:** Acesso estritamente read-only aos arquivos do projeto.
5. **Concurrency & Locks:** Processamento assíncrono paralelo bounded pela capacidade de hardware (`navigator.hardwareConcurrency`).
6. **Data Lifecycle & TTL:** Liberação imediata de memória após o walk.
7. **External Fallbacks:** Tentativa de inicialização do runtime WebAssembly quando grammars forem fornecidas; fallback graceful para parser sintático heurístico estruturado em caso de ausência de grammars WASM.
8. **State Transitions:** Fluxo estrito `INIT` -> `DISCOVERY` -> `FILTERING` -> `PARSING` -> `COMPLETE`.
9. **Observability & Metrics:** Relatório de métricas de arquivos descobertos, escaneados, pulados e contagem por linguagem.

---

## 📁 5. Arquivos Afetados
- `docs/specs/SPEC-11.md`
- `src/types.ts`
- `src/ast.ts`
- `src/rules.ts`
- `src/scorer.ts`
- `src/core/oracle.ts`
- `index.ts`
- `tests/ast_rules.test.ts`
- `tests/ast_engine.test.ts`
- `tests/composite_scorer.test.ts`
