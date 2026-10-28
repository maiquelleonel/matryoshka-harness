/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
import * as path from "node:path";
import { executeHarnessScore, normalizeMaturityLevel, inferGovernanceAxis } from "./scanner";
import { walkCodebase, normalizeExcludePatterns } from "./ast";
import { runAstRules } from "./rules";
import type {
  AggregatedGapsResult,
  AstDeductionPenalties,
  AstHealthBreakdown,
  AstLanguage,
  AstRuleSuiteOptions,
  AstRuleSuiteResult,
  AstViolation,
  AstViolationSeverity,
  AstWalkerOptions,
  CompositeEvaluationOptions,
  CompositeScoreResult,
  CompositeScorerOptions,
  GovernanceAxis,
  Harness2EvaluationResult,
  Harness2Weights,
  HarnessGap,
  HarnessScoreOptions,
  HarnessScoreResult,
  MaturityLevel,
  OracleScoreBreakdown,
  SurgicalActionItem,
} from "./types";

/**
 * Canonical deduction penalties per violation severity.
 * Critical: -15, High: -8, Medium: -4, Low: -2
 */
export const DEFAULT_AST_DEDUCTION_PENALTIES: Record<AstViolationSeverity, number> = {
  critical: 15,
  high: 8,
  medium: 4,
  low: 2,
};

/**
 * Canonical Harness² composite weights: Score = (Oracle * 0.4) + (AST * 0.6)
 */
export const DEFAULT_HARNESS2_WEIGHTS: Harness2Weights = {
  oracleWeight: 0.4,
  astWeight: 0.6,
};

/**
 * Calculates the AST context-fencing health score based on rule violations and severity deductions.
 * Starts at 100 and clamps floor strictly to 0.
 */
export function calculateAstHealthScore(
  violations: AstViolation[],
  penalties?: Partial<AstDeductionPenalties>
): AstHealthBreakdown {
  const resolvedPenalties: AstDeductionPenalties = {
    critical: penalties?.critical ?? DEFAULT_AST_DEDUCTION_PENALTIES.critical,
    high: penalties?.high ?? DEFAULT_AST_DEDUCTION_PENALTIES.high,
    medium: penalties?.medium ?? DEFAULT_AST_DEDUCTION_PENALTIES.medium,
    low: penalties?.low ?? DEFAULT_AST_DEDUCTION_PENALTIES.low,
  };

  const bySeverity: Record<AstViolationSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const safeViolations = Array.isArray(violations) ? violations : [];

  for (const v of safeViolations) {
    if (v && v.severity && v.severity in bySeverity) {
      bySeverity[v.severity]++;
    }
  }

  const penaltiesApplied: Record<AstViolationSeverity, number> = {
    critical: bySeverity.critical * resolvedPenalties.critical,
    high: bySeverity.high * resolvedPenalties.high,
    medium: bySeverity.medium * resolvedPenalties.medium,
    low: bySeverity.low * resolvedPenalties.low,
  };

  const totalDeductions =
    penaltiesApplied.critical +
    penaltiesApplied.high +
    penaltiesApplied.medium +
    penaltiesApplied.low;

  const score = Math.max(0, Math.min(100, 100 - totalDeductions));

  return {
    score,
    totalDeductions,
    violationsCount: safeViolations.length,
    bySeverity,
    penaltiesApplied,
  };
}

/**
 * Normalizes an Oracle score (from HarnessScoreResult or number) into a standard 0..100 base score.
 */
export function normalizeOracleBaseScore(
  oracle: HarnessScoreResult | number,
  maxScore = 100,
  normalize = true
): OracleScoreBreakdown {
  if (typeof oracle === "number") {
    const clamped = Math.max(0, Math.min(100, Math.round(oracle)));
    let level: MaturityLevel = "L0";
    if (clamped >= 100) level = "L4";
    else if (clamped >= 75) level = "L3";
    else if (clamped >= 50) level = "L2";
    else if (clamped >= 25) level = "L1";

    return {
      rawScore: oracle,
      maxScore,
      normalizedScore: clamped,
      level,
      source: "fallback",
      totalGaps: 0,
    };
  }

  const rawScore = typeof oracle?.score === "number" ? oracle.score : 0;
  const oracleMax = typeof oracle?.maxScore === "number" && oracle.maxScore > 0 ? oracle.maxScore : 105;
  let normalizedScore: number;

  if (!normalize) {
    normalizedScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  } else {
    normalizedScore = Math.max(0, Math.min(100, Math.round((rawScore / oracleMax) * 100)));
  }

  return {
    rawScore,
    maxScore: oracleMax,
    normalizedScore,
    level: normalizeMaturityLevel(oracle?.level),
    source: oracle?.source || "fallback",
    totalGaps: Array.isArray(oracle?.gaps) ? oracle.gaps.length : 0,
  };
}

/**
 * Aggregates Oracle governance gaps and AST violations into a unified telemetry structure
 * and compiles a prioritized surgical action plan.
 */
export function aggregateHarnessGaps(
  oracleGaps?: HarnessGap[] | null,
  astViolations?: AstViolation[] | null
): AggregatedGapsResult {
  const safeOracleGaps = Array.isArray(oracleGaps) ? oracleGaps : [];
  const safeAstViolations = Array.isArray(astViolations) ? astViolations : [];

  const bySeverity: Record<AstViolationSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byRule: Record<string, number> = {};
  const byAxis: Record<GovernanceAxis, number> = {
    context: 0,
    skills: 0,
    guardrails: 0,
    sensors: 0,
    hygiene: 0,
  };

  for (const v of safeAstViolations) {
    if (v.severity && v.severity in bySeverity) {
      bySeverity[v.severity]++;
    }
    const ruleKey = v.ruleId || "unknown";
    byRule[ruleKey] = (byRule[ruleKey] || 0) + 1;
  }

  for (const gap of safeOracleGaps) {
    const axis = gap.axis || inferGovernanceAxis(gap.id);
    if (axis in byAxis) {
      byAxis[axis]++;
    } else {
      byAxis.hygiene++;
    }
  }

  const actionPlan: SurgicalActionItem[] = [];

  // 1. Critical AST Violations
  const criticalAst = safeAstViolations.filter((v) => v.severity === "critical");
  for (const v of criticalAst) {
    let action = `Resolve critical violation in ${v.relativePath}:${v.line}.`;
    if (v.ruleId === "sql-interpolation") {
      action = `Fix SQL injection in ${v.relativePath}:${v.line} using bind parameters.`;
    } else if (v.ruleId === "hardcoded-credential") {
      action = `Extract hardcoded secret in ${v.relativePath}:${v.line} to environment variable.`;
    } else if (v.remediation) {
      action = `${v.remediation} (${v.relativePath}:${v.line})`;
    }

    actionPlan.push({
      id: v.id,
      source: "ast",
      severity: "critical",
      title: v.message,
      description: v.codeSnippet,
      target: `${v.relativePath}:${v.line}`,
      action,
      remediation: v.remediation,
    });
  }

  // 2. High AST Violations
  const highAst = safeAstViolations.filter((v) => v.severity === "high");
  for (const v of highAst) {
    let action = `Resolve high-priority violation in ${v.relativePath}:${v.line}.`;
    if (v.ruleId === "assertionless-test") {
      action = `Add behavioral assertion to ${v.relativePath}:${v.line}.`;
    } else if (v.remediation) {
      action = `${v.remediation} (${v.relativePath}:${v.line})`;
    }

    actionPlan.push({
      id: v.id,
      source: "ast",
      severity: "high",
      title: v.message,
      description: v.codeSnippet,
      target: `${v.relativePath}:${v.line}`,
      action,
      remediation: v.remediation,
    });
  }

  // 3. Oracle Gaps (prioritized by weight desc, then id asc)
  const sortedOracle = [...safeOracleGaps].sort((a, b) => {
    const wA = a.weight ?? 10;
    const wB = b.weight ?? 10;
    if (wB !== wA) return wB - wA;
    return a.id.localeCompare(b.id);
  });

  for (const gap of sortedOracle) {
    const gapSeverity: AstViolationSeverity =
      (gap.weight ?? 10) >= 15 ? "high" : (gap.weight ?? 10) >= 10 ? "medium" : "low";

    actionPlan.push({
      id: gap.id,
      source: "oracle",
      severity: gapSeverity,
      title: gap.title,
      description: gap.description,
      target: gap.id,
      action: gap.remediation || `Resolve governance gap ${gap.id}: ${gap.title}`,
      remediation: gap.remediation,
    });
  }

  // 4. Medium AST Violations
  const mediumAst = safeAstViolations.filter((v) => v.severity === "medium");
  for (const v of mediumAst) {
    actionPlan.push({
      id: v.id,
      source: "ast",
      severity: "medium",
      title: v.message,
      description: v.codeSnippet,
      target: `${v.relativePath}:${v.line}`,
      action: v.remediation || `Resolve ${v.ruleId} in ${v.relativePath}:${v.line}: ${v.message}`,
      remediation: v.remediation,
    });
  }

  // 5. Low AST Violations
  const lowAst = safeAstViolations.filter((v) => v.severity === "low");
  for (const v of lowAst) {
    actionPlan.push({
      id: v.id,
      source: "ast",
      severity: "low",
      title: v.message,
      description: v.codeSnippet,
      target: `${v.relativePath}:${v.line}`,
      action: v.remediation || `Resolve ${v.ruleId} in ${v.relativePath}:${v.line}: ${v.message}`,
      remediation: v.remediation,
    });
  }

  return {
    totalCount: safeOracleGaps.length + safeAstViolations.length,
    astViolationsCount: safeAstViolations.length,
    oracleGapsCount: safeOracleGaps.length,
    hasCriticalViolations: bySeverity.critical > 0,
    bySeverity,
    byRule,
    byAxis,
    actionPlan,
  };
}

/**
 * Evaluates the weighted Harness² composite score:
 * Score = (Oracle * 0.4) + (AST * 0.6)
 */
export function calculateCompositeScore(
  oracle: HarnessScoreResult | number,
  astViolations: AstViolation[] | AstRuleSuiteResult,
  options?: CompositeScorerOptions
): CompositeScoreResult {
  const startTime = performance.now();

  const violations: AstViolation[] = Array.isArray(astViolations)
    ? astViolations
    : astViolations && Array.isArray(astViolations.violations)
      ? astViolations.violations
      : [];

  const oracleGaps: HarnessGap[] =
    typeof oracle === "object" && oracle !== null && Array.isArray(oracle.gaps)
      ? oracle.gaps
      : [];

  const threshold = options?.threshold ?? 80;
  const oracleWeight = options?.weights?.oracleWeight ?? DEFAULT_HARNESS2_WEIGHTS.oracleWeight;
  const astWeight = options?.weights?.astWeight ?? DEFAULT_HARNESS2_WEIGHTS.astWeight;
  const normalizeOracle =
    options?.normalizeOracleScore ?? (typeof oracle === "number" ? false : true);

  const oracleBreakdown = normalizeOracleBaseScore(
    oracle,
    typeof oracle === "object" ? oracle.maxScore : 100,
    normalizeOracle
  );
  const astBreakdown = calculateAstHealthScore(violations, options?.penalties);
  const aggregatedGaps = aggregateHarnessGaps(oracleGaps, violations);

  const baseScore = oracleBreakdown.normalizedScore;
  const astScore = astBreakdown.score;
  const weighted = baseScore * oracleWeight + astScore * astWeight;
  const compositeScore = Math.max(0, Math.min(100, Math.round(weighted)));

  const passedThreshold = compositeScore >= threshold;
  const hasCriticalViolations = astBreakdown.bySeverity.critical > 0;
  const passedStrict = passedThreshold && !hasCriticalViolations;
  const status: "PASS" | "NEEDS_REMEDIATION" = passedThreshold ? "PASS" : "NEEDS_REMEDIATION";

  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    compositeScore,
    status,
    threshold,
    passedThreshold,
    hasCriticalViolations,
    passedStrict,
    oracle: oracleBreakdown,
    ast: astBreakdown,
    aggregatedGaps,
    violations,
    executionTimeMs,
  };
}

/**
 * End-to-end evaluation runner orchestration:
 * Discovers stack, executes oracle scan, runs AST rules, and computes composite metrics.
 */
export async function evaluateCompositeHarness(
  projectPath: string,
  options?: CompositeEvaluationOptions
): Promise<Harness2EvaluationResult> {
  const startTime = performance.now();
  const resolvedPath = path.resolve(projectPath || ".");

  // 1. Run Oracle evaluation (with fallback)
  let oracleResult: HarnessScoreResult;
  try {
    oracleResult = await executeHarnessScore(resolvedPath, {
      allowFallback: true,
      ...options?.oracleOptions,
    });
  } catch {
    oracleResult = {
      score: 0,
      maxScore: 105,
      level: "L0",
      gaps: [],
      passed: [],
      source: "fallback",
      executionTimeMs: 0,
    };
  }

  // 2. Run Polyglot AST Walker
  const includeTests = options?.includeTests ?? options?.astOptions?.includeTests;
  const excludePatterns = normalizeExcludePatterns([
    ...(options?.exclude ? (Array.isArray(options.exclude) ? options.exclude : [options.exclude]) : []),
    ...(options?.excludePatterns ? (Array.isArray(options.excludePatterns) ? options.excludePatterns : [options.excludePatterns]) : []),
    ...(options?.astOptions?.exclude ? (Array.isArray(options.astOptions.exclude) ? options.astOptions.exclude : [options.astOptions.exclude]) : []),
    ...(options?.astOptions?.excludePatterns ? (Array.isArray(options.astOptions.excludePatterns) ? options.astOptions.excludePatterns : [options.astOptions.excludePatterns]) : []),
  ]);

  const walkResult = await walkCodebase(resolvedPath, {
    cwd: resolvedPath,
    ...options?.astOptions,
    ...(includeTests !== undefined ? { includeTests } : {}),
    ...(excludePatterns.length > 0 ? { excludePatterns } : {}),
  });

  // 3. Run Contextual AST Antipattern Rule Suite
  const ruleResult: AstRuleSuiteResult = runAstRules(
    walkResult.scannedFiles,
    options?.ruleOptions
  );

  // 4. Calculate Composite Score and Aggregate Gaps
  const scoreResult = calculateCompositeScore(oracleResult, ruleResult, options);

  const totalTimeMs = Math.round(performance.now() - startTime);

  return {
    ...scoreResult,
    violations: ruleResult.violations,
    projectPath: resolvedPath,
    totalFilesAnalyzed: walkResult.scannedFiles.length,
    languagesCount: walkResult.languagesCount,
    skippedFilesCount: walkResult.skippedFiles.length,
    timestamp: new Date().toISOString(),
    executionTimeMs: totalTimeMs,
  };
}

/**
 * Object-oriented facade for Harness² composite scoring and evaluation.
 */
export class Harness2Scorer {
  private readonly defaultOptions: CompositeEvaluationOptions;

  constructor(options?: CompositeEvaluationOptions) {
    this.defaultOptions = options || {};
  }

  public score(
    oracle: HarnessScoreResult | number,
    astViolations: AstViolation[] | AstRuleSuiteResult,
    options?: CompositeScorerOptions
  ): CompositeScoreResult {
    return calculateCompositeScore(oracle, astViolations, {
      ...this.defaultOptions,
      ...options,
    });
  }

  public async evaluate(
    projectPath: string,
    options?: CompositeEvaluationOptions
  ): Promise<Harness2EvaluationResult> {
    return evaluateCompositeHarness(projectPath, {
      ...this.defaultOptions,
      ...options,
    });
  }

  public aggregateGaps(
    oracleGaps?: HarnessGap[] | null,
    astViolations?: AstViolation[] | null
  ): AggregatedGapsResult {
    return aggregateHarnessGaps(oracleGaps, astViolations);
  }
}
