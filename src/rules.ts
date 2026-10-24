/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
import type {
  AstLanguage,
  AstNode,
  AstRule,
  AstRuleContext,
  AstRuleSuiteOptions,
  AstRuleSuiteResult,
  AstViolation,
  AstViolationSeverity,
  ParsedFileAst,
} from "./types";

/**
 * Calculates the Shannon Entropy of a string.
 * Measures information density / randomness.
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) {
    return 0;
  }
  const frequencies = new Map<string, number>();
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 1000) / 1000;
}

/**
 * Regex patterns identifying standard SQL clauses and DDL/DML statements.
 */
const SQL_PATTERNS: RegExp[] = [
  /\bSELECT\b[\s\S]+?\bFROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b[\s\S]+?\bSET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bCREATE\s+TABLE\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bUNION\s+(?:ALL\s+)?SELECT\b/i,
];

/**
 * Checks if a string contains SQL queries or keywords.
 */
export function isPotentialSql(text: string): boolean {
  if (!text || typeof text !== "string") {
    return false;
  }
  return SQL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Severity ranking map for minSeverity filtering.
 */
const SEVERITY_RANK: Record<AstViolationSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ============================================================================
// Rule 1: SqlInterpolationRule
// ============================================================================

export class SqlInterpolationRule implements AstRule {
  public readonly id = "sql-interpolation";
  public readonly name = "SQL String Interpolation Hazard";
  public readonly description =
    "Detects unparameterized dynamic SQL queries formed by string interpolation or concatenation";
  public readonly defaultSeverity: AstViolationSeverity = "critical";

  public check(context: AstRuleContext): AstViolation[] {
    const { file } = context;
    const violations: AstViolation[] = [];
    const reportedLines = new Set<number>();

    // 1. Traverse AST nodes for TemplateLiteral and FormattedString
    file.rootNode.walk((node) => {
      const lineNum = node.startPosition.row + 1;
      const colNum = node.startPosition.column + 1;

      if (node.type === "TemplateLiteral") {
        const text = node.text;
        if (text.includes("${") && isPotentialSql(text)) {
          if (!reportedLines.has(lineNum)) {
            reportedLines.add(lineNum);
            violations.push({
              id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              message:
                "Unparameterized SQL query constructed via template literal interpolation.",
              filePath: file.filePath,
              relativePath: file.relativePath,
              line: lineNum,
              column: colNum,
              nodeType: node.type,
              codeSnippet: file.lines[node.startPosition.row]?.trim() || text,
              remediation:
                "Use parameterized queries or bound arguments (e.g., 'SELECT * FROM users WHERE id = $1', [userId]) instead of string interpolation.",
            });
          }
        }
      } else if (node.type === "FormattedString") {
        const text = node.text;
        if (text.includes("{") && text.includes("}") && isPotentialSql(text)) {
          if (!reportedLines.has(lineNum)) {
            reportedLines.add(lineNum);
            violations.push({
              id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              message:
                "Unparameterized SQL query constructed via f-string expression.",
              filePath: file.filePath,
              relativePath: file.relativePath,
              line: lineNum,
              column: colNum,
              nodeType: node.type,
              codeSnippet: file.lines[node.startPosition.row]?.trim() || text,
              remediation:
                "Use parameterized queries or bound arguments (e.g., cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))) instead of f-strings.",
            });
          }
        }
      }
    });

    // 2. Line-by-line inspection for dynamic SQL concatenation, fmt.Sprintf, or %-formatting
    for (let row = 0; row < file.lines.length; row++) {
      const lineNum = row + 1;
      if (reportedLines.has(lineNum)) {
        continue;
      }
      const rawLine = file.lines[row] || "";
      const trimmed = rawLine.trim();

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
        continue;
      }

      // Check string concatenation with SQL: "SELECT ... " + var or var + " WHERE ..."
      const hasSqlWithPlus =
        isPotentialSql(trimmed) &&
        (trimmed.includes("+") || trimmed.includes("||")) &&
        /["'].*?(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE).*?["']\s*\+/i.test(
          trimmed
        );

      // Check Go fmt.Sprintf with SQL: fmt.Sprintf("SELECT ... %s", id)
      const hasGoSprintfSql =
        /\bfmt\.Sprintf\s*\(\s*["'].*?(?:SELECT|INSERT|UPDATE|DELETE).*?%[svd]/i.test(
          trimmed
        );

      // Check Python %-formatting with SQL: "SELECT ... %s" % var
      const hasPyPercentSql =
        /["'].*?(?:SELECT|INSERT|UPDATE|DELETE).*?%[svd].*?["']\s*%/i.test(
          trimmed
        );

      if (hasSqlWithPlus || hasGoSprintfSql || hasPyPercentSql) {
        reportedLines.add(lineNum);
        const colNum = rawLine.indexOf(trimmed) + 1;
        violations.push({
          id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
          ruleId: this.id,
          severity: this.defaultSeverity,
          message:
            "Unparameterized SQL query constructed via string formatting or dynamic concatenation.",
          filePath: file.filePath,
          relativePath: file.relativePath,
          line: lineNum,
          column: colNum,
          nodeType: hasGoSprintfSql ? "CallExpression" : "BinaryExpression",
          codeSnippet: trimmed,
          remediation:
            "Use parameterized queries or bound arguments rather than dynamic string formatting or concatenation.",
        });
      }
    }

    return violations;
  }
}

// ============================================================================
// Rule 2: AssertionlessTestRule
// ============================================================================

export class AssertionlessTestRule implements AstRule {
  public readonly id = "assertionless-test";
  public readonly name = "Assertionless Test Case Hazard";
  public readonly description =
    "Detects test cases lacking behavioral assertions or expectations";
  public readonly defaultSeverity: AstViolationSeverity = "high";

  public check(context: AstRuleContext): AstViolation[] {
    const { file } = context;
    const violations: AstViolation[] = [];

    // Helper to test if text contains valid assertions
    function hasAssertion(text: string, language: AstLanguage): boolean {
      switch (language) {
        case "typescript":
        case "javascript":
          return (
            /\bexpect\s*\(/.test(text) ||
            /\bassert\s*\(/.test(text) ||
            /\bassert\.[a-zA-Z0-9_$]+\s*\(/.test(text) ||
            /\.should\b/.test(text) ||
            /\bt\.(?:is|true|false|assert|regex|throws|notThrows)\b/.test(text)
          );
        case "python":
          return (
            /\bassert\b/.test(text) ||
            /\bself\.assert[a-zA-Z0-9_]*\s*\(/.test(text) ||
            /\bpytest\.(?:raises|warns|approx)\b/.test(text)
          );
        case "go":
          return (
            /\bt\.(?:Error|Errorf|Fatal|Fatalf|Fail|FailNow)\b/.test(text) ||
            /\bassert\.[a-zA-Z0-9_]+\s*\(/.test(text) ||
            /\brequire\.[a-zA-Z0-9_]+\s*\(/.test(text)
          );
        case "rust":
          return (
            /\bassert!/.test(text) ||
            /\bassert_eq!/.test(text) ||
            /\bassert_ne!/.test(text) ||
            /\bassert_matches!/.test(text)
          );
        default:
          return (
            /\bassert\b/.test(text) ||
            /\bexpect\b/.test(text)
          );
      }
    }

    // 1. TypeScript & JavaScript: it(...) or test(...)
    if (file.language === "typescript" || file.language === "javascript") {
      const itOrTestRegex =
        /\b(?:it|test)(?:\.(?:only|skip|concurrent))?\s*\(\s*(['"`].*?['"`])/g;

      for (let row = 0; row < file.lines.length; row++) {
        const line = file.lines[row] || "";
        let match: RegExpExecArray | null;

        while ((match = itOrTestRegex.exec(line)) !== null) {
          const testTitle = match[1] || "";
          const startCol = match.index + 1;
          const lineNum = row + 1;

          // Find test body span: track opening and closing parens / braces
          let bodyText = "";
          let braceDepth = 0;
          let parenDepth = 0;
          let foundOpen = false;
          let endRow = row;

          for (let r = row; r < file.lines.length; r++) {
            const currentLine = file.lines[r] || "";
            const startCharIdx = r === row ? match.index : 0;

            for (let c = startCharIdx; c < currentLine.length; c++) {
              const ch = currentLine[c];
              if (ch === "(") {
                parenDepth++;
                foundOpen = true;
              } else if (ch === ")") {
                parenDepth--;
                if (foundOpen && parenDepth <= 0 && braceDepth <= 0) {
                  endRow = r;
                  break;
                }
              } else if (ch === "{") {
                braceDepth++;
              } else if (ch === "}") {
                braceDepth--;
                if (foundOpen && braceDepth <= 0 && parenDepth <= 0) {
                  endRow = r;
                  break;
                }
              }
            }

            bodyText += currentLine + "\n";
            if (foundOpen && parenDepth <= 0 && braceDepth <= 0) {
              endRow = r;
              break;
            }
          }

          if (!hasAssertion(bodyText, file.language)) {
            violations.push({
              id: `${this.id}-${file.relativePath}-${lineNum}-${startCol}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Test case ${testTitle} has no behavioral assertions or expectations.`,
              filePath: file.filePath,
              relativePath: file.relativePath,
              line: lineNum,
              column: startCol,
              nodeType: "CallExpression",
              codeSnippet: line.trim(),
              remediation:
                "Add at least one explicit assertion or expectation (e.g., expect(...).toBe(...), assert.strictEqual(...)) to verify behavior.",
            });
          }
        }
      }
    }

    // 2. Python: def test_*()
    if (file.language === "python") {
      const pyTestRegex = /^\s*def\s+(test_[a-zA-Z0-9_]*)\s*\(/;

      for (let row = 0; row < file.lines.length; row++) {
        const line = file.lines[row] || "";
        const match = pyTestRegex.exec(line);

        if (match && match[1]) {
          const funcName = match[1];
          const lineNum = row + 1;
          const baseIndent = line.search(/\S/);
          const colNum = baseIndent + 1;

          // Collect body lines (lines indented deeper than baseIndent)
          let bodyText = "";
          for (let r = row + 1; r < file.lines.length; r++) {
            const nextLine = file.lines[r] || "";
            const trimmedNext = nextLine.trim();
            if (!trimmedNext || trimmedNext.startsWith("#")) {
              continue;
            }
            const nextIndent = nextLine.search(/\S/);
            if (nextIndent <= baseIndent) {
              break;
            }
            bodyText += nextLine + "\n";
          }

          if (!hasAssertion(bodyText, "python")) {
            violations.push({
              id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Test function ${funcName} has no behavioral assertions or expectations.`,
              filePath: file.filePath,
              relativePath: file.relativePath,
              line: lineNum,
              column: colNum,
              nodeType: "FunctionDeclaration",
              codeSnippet: line.trim(),
              remediation:
                "Add at least one explicit assertion (e.g., assert condition or self.assertEqual(...)) to verify behavior.",
            });
          }
        }
      }
    }

    // 3. Go: func Test*(t *testing.T)
    if (file.language === "go") {
      const goTestRegex = /^func\s+(Test[a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z0-9_]+)\s*\*testing\.T\s*\)/;

      for (let row = 0; row < file.lines.length; row++) {
        const line = file.lines[row] || "";
        const match = goTestRegex.exec(line.trim());

        if (match && match[1]) {
          const testName = match[1];
          const lineNum = row + 1;
          const colNum = line.indexOf("func") + 1;

          // Collect body inside { ... }
          let bodyText = "";
          let braceDepth = 0;
          let foundOpen = false;

          for (let r = row; r < file.lines.length; r++) {
            const curLine = file.lines[r] || "";
            for (let c = 0; c < curLine.length; c++) {
              if (curLine[c] === "{") {
                braceDepth++;
                foundOpen = true;
              } else if (curLine[c] === "}") {
                braceDepth--;
              }
            }
            bodyText += curLine + "\n";
            if (foundOpen && braceDepth <= 0) {
              break;
            }
          }

          if (!hasAssertion(bodyText, "go")) {
            violations.push({
              id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Go test function ${testName} has no behavioral assertions or fatal calls.`,
              filePath: file.filePath,
              relativePath: file.relativePath,
              line: lineNum,
              column: colNum,
              nodeType: "FunctionDeclaration",
              codeSnippet: line.trim(),
              remediation:
                "Add at least one explicit verification (e.g., t.Fatalf(...) or assert.Equal(...)) to verify behavior.",
            });
          }
        }
      }
    }

    // 4. Rust: #[test] or fn test_*()
    if (file.language === "rust") {
      for (let row = 0; row < file.lines.length; row++) {
        const line = file.lines[row] || "";
        const prevLine = row > 0 ? (file.lines[row - 1] || "").trim() : "";
        const isTestAnnotation = prevLine.includes("#[test]");
        const isTestFn = /^(?:pub\s+)?fn\s+(test_[a-zA-Z0-9_]*)/.exec(line.trim());

        if (isTestAnnotation || isTestFn) {
          const testName = isTestFn ? isTestFn[1] : "test";
          const lineNum = row + 1;
          const colNum = line.search(/\S/) + 1;

          let bodyText = "";
          let braceDepth = 0;
          let foundOpen = false;

          for (let r = row; r < file.lines.length; r++) {
            const curLine = file.lines[r] || "";
            for (let c = 0; c < curLine.length; c++) {
              if (curLine[c] === "{") {
                braceDepth++;
                foundOpen = true;
              } else if (curLine[c] === "}") {
                braceDepth--;
              }
            }
            bodyText += curLine + "\n";
            if (foundOpen && braceDepth <= 0) {
              break;
            }
          }

          if (!hasAssertion(bodyText, "rust")) {
            violations.push({
              id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Rust test function ${testName} has no assertions or expectations.`,
              filePath: file.filePath,
              relativePath: file.relativePath,
              line: lineNum,
              column: colNum,
              nodeType: "FunctionDeclaration",
              codeSnippet: line.trim(),
              remediation:
                "Add at least one explicit assertion (e.g., assert!(...), assert_eq!(...)) to verify behavior.",
            });
          }
        }
      }
    }

    return violations;
  }
}

// ============================================================================
// Rule 3: HardcodedCredentialRule
// ============================================================================

const SENSITIVE_VAR_REGEX =
  /(?:api[_-]?key|secret|token|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret|password|passwd|db[_-]?password|jwt[_-]?secret|bearer[_-]?token)/i;

const KNOWN_TOKEN_PREFIXES: RegExp[] = [
  /sk_live_[0-9a-zA-Z]{16,}/,
  /sk_test_[0-9a-zA-Z]{16,}/,
  /ghp_[0-9a-zA-Z]{20,}/,
  /gho_[0-9a-zA-Z]{20,}/,
  /ghu_[0-9a-zA-Z]{20,}/,
  /ghs_[0-9a-zA-Z]{20,}/,
  /ghr_[0-9a-zA-Z]{20,}/,
  /xoxb-[0-9a-zA-Z\-]{16,}/,
  /xoxp-[0-9a-zA-Z\-]{16,}/,
  /xapp-[0-9a-zA-Z\-]{16,}/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z\-_]{35}/,
  /\[REDACTED\]-[0-9a-zA-Z\-]{16,}/,
];

const SAFE_ENV_READ_REGEX =
  /(?:process\.env|os\.environ|os\.getenv|os\.Getenv|System\.getenv|config\.|settings\.|env\.)/i;

const BENIGN_VALUES = new Set([
  "",
  "''",
  '""',
  "null",
  "undefined",
  "true",
  "false",
  "none",
  "test",
  "dummy",
  "example",
  "fake",
  "mock",
  "placeholder",
  "production",
  "development",
  "staging",
  "localhost",
]);

export class HardcodedCredentialRule implements AstRule {
  public readonly id = "hardcoded-credential";
  public readonly name = "Hardcoded Secret / Credential Hazard";
  public readonly description =
    "Detects hardcoded secrets, tokens, API keys, and high-entropy sensitive variables";
  public readonly defaultSeverity: AstViolationSeverity = "critical";

  public check(context: AstRuleContext): AstViolation[] {
    const { file } = context;
    const violations: AstViolation[] = [];
    const reportedLines = new Set<number>();

    for (let row = 0; row < file.lines.length; row++) {
      const lineNum = row + 1;
      const rawLine = file.lines[row] || "";
      const trimmed = rawLine.trim();

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
        continue;
      }

      // Skip lines reading from environment variables
      if (SAFE_ENV_READ_REGEX.test(trimmed)) {
        continue;
      }

      // Check 1: Known Secret Token Prefixes (anywhere on the line)
      let foundKnownPrefix = false;
      for (const prefixRegex of KNOWN_TOKEN_PREFIXES) {
        const match = prefixRegex.exec(trimmed);
        if (match) {
          foundKnownPrefix = true;
          reportedLines.add(lineNum);
          const colNum = rawLine.indexOf(match[0]) + 1;
          violations.push({
            id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: "Hardcoded credential token matching known secret prefix.",
            filePath: file.filePath,
            relativePath: file.relativePath,
            line: lineNum,
            column: colNum,
            nodeType: "StringLiteral",
            codeSnippet: trimmed,
            remediation:
              "Extract credentials to environment variables or secret manager rather than committing raw tokens.",
          });
          break;
        }
      }

      if (foundKnownPrefix) {
        continue;
      }

      // Check 2: Variable Declaration / Assignment matching Sensitive Var Regex
      const varAssignMatch =
        /(?:const|let|var|val)?\s*([a-zA-Z0-9_$]+)\s*(?::\s*[^=]+)?\s*[:=]\s*(['"`])([^'"`]+)\2/.exec(
          trimmed
        );

      if (varAssignMatch && varAssignMatch[1] && varAssignMatch[3]) {
        const varName = varAssignMatch[1];
        const stringVal = varAssignMatch[3].trim();

        if (SENSITIVE_VAR_REGEX.test(varName)) {
          // Check if value is benign or placeholder
          const lowerVal = stringVal.toLowerCase();
          if (BENIGN_VALUES.has(lowerVal) || lowerVal.length < 4) {
            continue;
          }

          // Check if value is URL or path
          if (lowerVal.startsWith("http://") || lowerVal.startsWith("https://") || lowerVal.startsWith("/")) {
            continue;
          }

          reportedLines.add(lineNum);
          const colNum = rawLine.indexOf(varName) + 1;
          violations.push({
            id: `${this.id}-${file.relativePath}-${lineNum}-${colNum}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Hardcoded credential detected in variable '${varName}'.`,
            filePath: file.filePath,
            relativePath: file.relativePath,
            line: lineNum,
            column: colNum,
            nodeType: "VariableDeclaration",
            codeSnippet: trimmed,
            remediation:
              "Extract credentials to environment variables (e.g., process.env.API_KEY, os.environ['API_KEY']) or secret manager rather than hardcoding in source.",
          });
        }
      }
    }

    return violations;
  }
}

// ============================================================================
// Default Rule Suite & Aggregator
// ============================================================================

export const DEFAULT_AST_RULES: AstRule[] = [
  new SqlInterpolationRule(),
  new AssertionlessTestRule(),
  new HardcodedCredentialRule(),
];

export class AstRuleSuite {
  private rules: AstRule[];

  constructor(options?: AstRuleSuiteOptions) {
    this.rules = options?.rules ? [...options.rules] : [...DEFAULT_AST_RULES];
  }

  public getRules(): AstRule[] {
    return [...this.rules];
  }

  public registerRule(rule: AstRule): void {
    const existingIdx = this.rules.findIndex((r) => r.id === rule.id);
    if (existingIdx >= 0) {
      this.rules[existingIdx] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  public checkFile(
    file: ParsedFileAst,
    options?: AstRuleSuiteOptions
  ): AstViolation[] {
    const disabledIds = new Set(options?.disabledRuleIds || []);
    const minSev = options?.minSeverity;
    const minSevRank = minSev ? SEVERITY_RANK[minSev] || 1 : 1;
    const overrides = options?.severityOverrides || {};

    const violations: AstViolation[] = [];

    for (const rule of this.rules) {
      if (disabledIds.has(rule.id)) {
        continue;
      }

      const ruleViolations = rule.check({ file });
      for (const v of ruleViolations) {
        if (overrides[rule.id]) {
          v.severity = overrides[rule.id]!;
        }

        const vRank = SEVERITY_RANK[v.severity] || 1;
        if (vRank >= minSevRank) {
          violations.push(v);
        }
      }
    }

    return violations;
  }

  public run(
    files: ParsedFileAst | ParsedFileAst[],
    options?: AstRuleSuiteOptions
  ): AstRuleSuiteResult {
    const startMs = performance.now();
    const fileList = Array.isArray(files) ? files : [files];

    const violations: AstViolation[] = [];
    const bySeverity: Record<AstViolationSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byRule: Record<string, number> = {};

    let cleanFilesCount = 0;

    for (const file of fileList) {
      const fileViolations = this.checkFile(file, options);
      if (fileViolations.length === 0) {
        cleanFilesCount++;
      } else {
        violations.push(...fileViolations);
        for (const v of fileViolations) {
          bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
          byRule[v.ruleId] = (byRule[v.ruleId] || 0) + 1;
        }
      }
    }

    // Deterministic sorting: relativePath -> line -> column
    violations.sort((a, b) => {
      const pathCmp = a.relativePath.localeCompare(b.relativePath);
      if (pathCmp !== 0) return pathCmp;
      if (a.line !== b.line) return a.line - b.line;
      return a.column - b.column;
    });

    const executionTimeMs =
      Math.round((performance.now() - startMs) * 100) / 100;

    return {
      totalViolations: violations.length,
      violations,
      bySeverity,
      byRule,
      scannedFilesCount: fileList.length,
      cleanFilesCount,
      executionTimeMs,
    };
  }
}

/**
 * Convenience helper to run AST rules across parsed files.
 */
export function runAstRules(
  files: ParsedFileAst | ParsedFileAst[],
  options?: AstRuleSuiteOptions
): AstRuleSuiteResult {
  const suite = new AstRuleSuite(options);
  return suite.run(files, options);
}
