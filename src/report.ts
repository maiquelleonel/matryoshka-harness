import * as fs from "node:fs";
import * as path from "node:path";
import { estimateTokens } from "./agents";
import type {
  AstLanguage,
  AstViolation,
  AstViolationSeverity,
  DiagnosticCompilerOptions,
  DiagnosticWriteOptions,
  DiagnosticWriteResult,
  FormattedAstViolation,
  Harness2EvaluationResult,
  WrapJsonReport,
  WrapJsonSummary,
} from "./types";

/**
 * Maximum token ceiling for DIAGNOSTIC.md reports to protect downstream LLM context windows.
 * FinOps invariant: < 1500 tokens.
 */
export const MAX_DIAGNOSTIC_TOKENS = 1500;

/**
 * Canonical human/agent-readable descriptions for known AST antipattern rules.
 */
export const CANONICAL_RULE_TITLES: Record<string, string> = {
  "sql-interpolation": "Unparameterized SQL Query (SQL Injection Hazard)",
  "assertionless-test": "Assertionless Test Case (False Green Hazard)",
  "hardcoded-credential": "Hardcoded Credential / Secret Leaked",
};

/**
 * Human-readable display names for AST languages.
 */
export const LANGUAGE_DISPLAY_NAMES: Record<AstLanguage, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  go: "Go",
  rust: "Rust",
};

/**
 * Evaluates token budget compliance for a diagnostic markdown report against maximum threshold.
 */
export function inspectDiagnosticTokenBudget(
  content: string,
  maxTokens: number = MAX_DIAGNOSTIC_TOKENS
): {
  tokenCount: number;
  maxTokens: number;
  withinBudget: boolean;
  exceededBy: number;
} {
  const tokenCount = estimateTokens(content);
  const withinBudget = tokenCount <= maxTokens;
  const exceededBy = withinBudget ? 0 : tokenCount - maxTokens;

  return {
    tokenCount,
    maxTokens,
    withinBudget,
    exceededBy,
  };
}

/**
 * Compiles a deterministic, human-and-agent-readable DIAGNOSTIC.md markdown report.
 * Strictly bounded by token budget (< 1500 tokens) with atomic reproducibility.
 */
export function compileDiagnosticMarkdown(
  result: Harness2EvaluationResult,
  options?: DiagnosticCompilerOptions
): string {
  const maxTokens = options?.maxTokens ?? MAX_DIAGNOSTIC_TOKENS;
  const truncateOnBudget = options?.truncateOnBudget ?? true;
  const remediationCmd = options?.remediationCommand ?? "baba wrap --strict";

  const lines: string[] = [];

  // 1. Header
  lines.push("# 🛡️ Matryoshka Diagnostic & Harness² Remediation Report\n");
  lines.push(`**Generated:** ${result.timestamp}  `);
  lines.push(`**Target Repository:** \`${result.projectPath}\`  `);
  const statusDisplay = result.status === "PASS" ? "PASS" : "NEEDS REMEDIATION";
  lines.push(`**Harness² Composite Score:** **${result.compositeScore} / 100** [Status: ${statusDisplay}]\n`);
  lines.push("---\n");

  // 2. Score Breakdown
  lines.push("## 📊 Score Breakdown");
  lines.push(`- **Base Repository Hygiene (Oracle):** ${result.oracle.normalizedScore} / 100`);
  lines.push(`- **AST Context-Fencing Health:** ${result.ast.score} / 100`);

  // Languages Breakdown (deterministic alphabetical order)
  const langEntries = (Object.keys(result.languagesCount || {}) as AstLanguage[])
    .sort()
    .filter((lang) => (result.languagesCount[lang] || 0) > 0)
    .map((lang) => `${result.languagesCount[lang]} ${LANGUAGE_DISPLAY_NAMES[lang] || lang}`);

  const langSuffix = langEntries.length > 0 ? ` (${langEntries.join(", ")})` : "";
  lines.push(`- **Total Files Analyzed:** ${result.totalFilesAnalyzed} files${langSuffix}`);

  // Violations Breakdown
  const bySeverity = result.ast.bySeverity || { critical: 0, high: 0, medium: 0, low: 0 };
  const violationEntries: string[] = [];
  if (bySeverity.critical > 0) violationEntries.push(`${bySeverity.critical} Critical`);
  if (bySeverity.high > 0) violationEntries.push(`${bySeverity.high} High`);
  if (bySeverity.medium > 0) violationEntries.push(`${bySeverity.medium} Medium`);
  if (bySeverity.low > 0) violationEntries.push(`${bySeverity.low} Low`);

  const violationsDisplay = violationEntries.length > 0 ? violationEntries.join(", ") : "None (Clean)";
  lines.push(`- **Violations Detected:** ${violationsDisplay}\n`);
  lines.push("---\n");

  // 3. Detected AST Violations
  lines.push("## 🚨 Detected AST Violations\n");

  const rawViolations = Array.isArray(result.violations) ? result.violations : [];

  if (rawViolations.length === 0) {
    lines.push("No AST context-fencing violations detected. Repository is clean!\n");
  } else {
    // Deterministic sort: severity priority -> relativePath -> line -> column
    const severityRank: Record<AstViolationSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const sortedViolations = [...rawViolations].sort((a, b) => {
      const rA = severityRank[a.severity] ?? 99;
      const rB = severityRank[b.severity] ?? 99;
      if (rA !== rB) return rA - rB;

      const pDiff = a.relativePath.localeCompare(b.relativePath);
      if (pDiff !== 0) return pDiff;

      if (a.line !== b.line) return a.line - b.line;
      return a.column - b.column;
    });

    // Action plan preview to estimate reserved budget
    const actionPlanItems = result.aggregatedGaps?.actionPlan || [];
    const maxActionPlanBudget = Math.min(250, Math.floor(maxTokens * 0.3));
    const estimatedActionPlanTokens = Math.min(
      maxActionPlanBudget,
      actionPlanItems.length * 15 + 40
    );

    let truncated = false;
    let includedCount = 0;

    for (let i = 0; i < sortedViolations.length; i++) {
      const v = sortedViolations[i];
      if (!v) continue;
      const title = CANONICAL_RULE_TITLES[v.ruleId] || v.message || v.ruleId;
      const vLines: string[] = [
        `### ${i + 1}. [${v.severity.toUpperCase()}] ${title}`,
        `- **File:** \`${v.relativePath}:${v.line}\``,
        `- **Node Type:** \`${v.nodeType}\``,
        `- **Remediation:** ${v.remediation}`,
      ];

      const vBlock = `${vLines.join("\n")}\n\n`;

      if (truncateOnBudget) {
        const potentialContent = `${lines.join("\n")}\n${vBlock}\n> ⚠️ *Remaining ${sortedViolations.length} violations omitted for context window optimization. Run \`baba wrap --json\` to inspect complete violation telemetry.*\n`;
        const currentTokens = estimateTokens(potentialContent);
        if (currentTokens + estimatedActionPlanTokens > maxTokens && includedCount > 0) {
          truncated = true;
          const remainingCount = sortedViolations.length - includedCount;
          lines.push(
            `> ⚠️ *Remaining ${remainingCount} violations omitted for context window optimization. Run \`baba wrap --json\` to inspect complete violation telemetry.*\n`
          );
          break;
        }
      }

      lines.push(vBlock.trimEnd());
      lines.push("");
      includedCount++;
    }
  }

  lines.push("---\n");

  // 4. Step-by-Step Surgical Action Plan
  lines.push("## 🎯 Step-by-Step Surgical Action Plan");

  const actionPlan = result.aggregatedGaps?.actionPlan || [];

  if (actionPlan.length === 0) {
    lines.push("1. [x] All governance gates and AST context-fencing rules satisfied.");
    lines.push(`2. [ ] Re-run \`${remediationCmd}\` in CI to ensure continuous compliance.`);
  } else {
    let actionTruncated = false;
    let actionsRendered = 0;

    for (let i = 0; i < actionPlan.length; i++) {
      const item = actionPlan[i];
      if (!item) continue;
      let actionText = item.action;

      // Wrap target in backticks if not already wrapped
      if (item.target && actionText.includes(item.target) && !actionText.includes(`\`${item.target}\``)) {
        actionText = actionText.replace(item.target, `\`${item.target}\``);
      }

      const nextActionLine = `${i + 1}. [ ] ${actionText}`;

      if (truncateOnBudget) {
        const testContent = `${lines.join("\n")}\n${nextActionLine}\n- *... and ${actionPlan.length} more surgical action items omitted for token budget. Run \`baba wrap --json\` to inspect full plan.*\n${i + 2}. [ ] Re-run \`${remediationCmd}\` to verify remediation.`;
        if (estimateTokens(testContent) > maxTokens && actionsRendered > 0) {
          const remaining = actionPlan.length - actionsRendered;
          lines.push(`- *... and ${remaining} more surgical action items omitted for token budget. Run \`baba wrap --json\` to inspect full plan.*`);
          actionTruncated = true;
          break;
        }
      }

      lines.push(nextActionLine);
      actionsRendered++;
    }

    const nextIndex = actionsRendered + 1;
    lines.push(`${nextIndex}. [ ] Re-run \`${remediationCmd}\` to verify remediation.`);
  }

  return `${lines.join("\n").trim()}\n`;
}

/**
 * Formats a Harness² evaluation result into structured JSON for CI automation and agent tools.
 */
export function formatWrapJsonOutput(
  result: Harness2EvaluationResult,
  options?: { reportPath?: string; written?: boolean }
): WrapJsonReport {
  const formattedViolations: FormattedAstViolation[] = (result.violations || []).map((v) => ({
    id: v.id,
    ruleId: v.ruleId,
    rule_id: v.ruleId,
    severity: v.severity,
    message: v.message,
    filePath: v.filePath,
    file_path: v.filePath,
    relativePath: v.relativePath,
    relative_path: v.relativePath,
    line: v.line,
    column: v.column,
    nodeType: v.nodeType,
    node_type: v.nodeType,
    codeSnippet: v.codeSnippet,
    code_snippet: v.codeSnippet,
    remediation: v.remediation,
  }));

  const bySeverity = result.ast.bySeverity || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const summary: WrapJsonSummary = {
    compositeScore: result.compositeScore,
    composite_score: result.compositeScore,
    status: result.status,
    threshold: result.threshold,
    passedThreshold: result.passedThreshold,
    passed_threshold: result.passedThreshold,
    hasCriticalViolations: result.hasCriticalViolations,
    has_critical_violations: result.hasCriticalViolations,
    passedStrict: result.passedStrict,
    passed_strict: result.passedStrict,
    oracleScore: result.oracle.normalizedScore,
    oracle_score: result.oracle.normalizedScore,
    astScore: result.ast.score,
    ast_score: result.ast.score,
    totalFilesAnalyzed: result.totalFilesAnalyzed,
    total_files_analyzed: result.totalFilesAnalyzed,
    languagesCount: result.languagesCount,
    languages_count: result.languagesCount,
    totalViolations: result.ast.violationsCount,
    total_violations: result.ast.violationsCount,
    bySeverity,
    by_severity: bySeverity,
    executionTimeMs: result.executionTimeMs,
    execution_time_ms: result.executionTimeMs,
  };

  const output: WrapJsonReport = {
    status: result.status === "PASS" ? "success" : "remediation_needed",
    command: "wrap",
    harnessScore: result.compositeScore,
    harness_score: result.compositeScore,
    compositeScore: result.compositeScore,
    composite_score: result.compositeScore,
    projectPath: result.projectPath,
    project_path: result.projectPath,
    timestamp: result.timestamp,
    summary,
    violations: formattedViolations,
    actionPlan: result.aggregatedGaps?.actionPlan || [],
    action_plan: result.aggregatedGaps?.actionPlan || [],
    oracle: result.oracle,
    ast: result.ast,
  };

  if (options?.reportPath) {
    output.reportPath = options.reportPath;
    output.report_path = options.reportPath;
  }

  if (options?.written !== undefined) {
    output.written = options.written;
  }

  return output;
}

/**
 * Writes DIAGNOSTIC.md atomically to disk (.tmp -> rename), honoring dry-run and token guardrails.
 */
export async function writeDiagnosticReport(
  projectPath: string,
  result: Harness2EvaluationResult,
  options?: DiagnosticWriteOptions
): Promise<DiagnosticWriteResult> {
  const targetDir = path.resolve(projectPath || ".");
  const dryRun = options?.dryRun ?? false;

  let resolvedReportPath: string;
  if (options?.outputPath) {
    const rawPath = options.outputPath.trim();
    const candidatePath = path.resolve(targetDir, rawPath);
    const relative = path.relative(targetDir, candidatePath);

    // Path traversal guard: candidate must not escape targetDir
    if (relative.startsWith("..") || path.isAbsolute(rawPath) && !candidatePath.startsWith(targetDir)) {
      resolvedReportPath = path.join(targetDir, path.basename(rawPath));
    } else {
      resolvedReportPath = candidatePath;
    }
  } else {
    resolvedReportPath = path.join(targetDir, "DIAGNOSTIC.md");
  }

  const content = compileDiagnosticMarkdown(result, options?.compilerOptions);
  const budget = inspectDiagnosticTokenBudget(content, options?.compilerOptions?.maxTokens);

  if (dryRun) {
    return {
      reportPath: resolvedReportPath,
      written: false,
      content,
      tokenCount: budget.tokenCount,
      isWithinBudget: budget.withinBudget,
      dryRun: true,
    };
  }

  // Ensure parent directory exists
  await fs.promises.mkdir(path.dirname(resolvedReportPath), { recursive: true });

  // Atomic file write: .tmp -> rename
  const tmpPath = `${resolvedReportPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  await fs.promises.writeFile(tmpPath, content, "utf-8");
  await fs.promises.rename(tmpPath, resolvedReportPath);

  return {
    reportPath: resolvedReportPath,
    written: true,
    content,
    tokenCount: budget.tokenCount,
    isWithinBudget: budget.withinBudget,
    dryRun: false,
  };
}
