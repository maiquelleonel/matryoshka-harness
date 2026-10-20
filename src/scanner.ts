import * as fs from "node:fs";
import * as path from "node:path";
import type {
  GovernanceAxis,
  HarnessGap,
  HarnessScoreOptions,
  HarnessScoreResult,
  MaturityLevel,
} from "./types";

/**
 * Normalizes maturity level input into canonical L0..L4 representation.
 */
export function normalizeMaturityLevel(input: unknown): MaturityLevel {
  if (typeof input === "number") {
    if (input <= 0) return "L0";
    if (input === 1) return "L1";
    if (input === 2) return "L2";
    if (input === 3) return "L3";
    return "L4";
  }

  if (typeof input === "string") {
    const trimmed = input.trim().toUpperCase();
    if (trimmed === "L0" || trimmed === "L1" || trimmed === "L2" || trimmed === "L3" || trimmed === "L4") {
      return trimmed as MaturityLevel;
    }
    const match = trimmed.match(/(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num <= 0) return "L0";
      if (num === 1) return "L1";
      if (num === 2) return "L2";
      if (num === 3) return "L3";
      return "L4";
    }
  }

  return "L0";
}

/**
 * Infers the canonical governance axis from a gap identifier prefix.
 */
export function inferGovernanceAxis(gapId: string): GovernanceAxis {
  const upper = gapId.toUpperCase();
  if (upper.startsWith("CTX")) return "context";
  if (upper.startsWith("SKL")) return "skills";
  if (upper.startsWith("GRD") || upper.startsWith("CI")) return "guardrails";
  if (upper.startsWith("SNS")) return "sensors";
  if (upper.startsWith("HYG") || upper.startsWith("DOC")) return "hygiene";
  return "hygiene";
}

/**
 * Resolves the executable path of harness-score or equivalent oracle binary.
 */
export function resolveHarnessScoreBinary(
  targetDir: string,
  options?: HarnessScoreOptions
): string | null {
  const env = options?.env ?? process.env;

  // 1. Explicit option binaryPath
  if (options?.binaryPath && fs.existsSync(options.binaryPath)) {
    return options.binaryPath;
  }

  // 2. HARNESS_SCORE_BIN environment variable
  if (env.HARNESS_SCORE_BIN && env.HARNESS_SCORE_BIN.trim() !== "") {
    return env.HARNESS_SCORE_BIN.trim();
  }

  // 3. Target directory local node_modules/.bin/harness-score
  const localTargetBin = path.join(targetDir, "node_modules", ".bin", "harness-score");
  if (fs.existsSync(localTargetBin)) {
    return localTargetBin;
  }

  // 4. Current workspace node_modules/.bin/harness-score
  const workspaceBin = path.join(process.cwd(), "node_modules", ".bin", "harness-score");
  if (fs.existsSync(workspaceBin)) {
    return workspaceBin;
  }

  // 5. System PATH via Bun.which
  try {
    const whichPath = Bun.which("harness-score", { PATH: env.PATH });
    if (whichPath) return whichPath;
  } catch {
    // ignore lookup error
  }

  return null;
}

/**
 * Executes harness-score against a host repository via Bun subprocess.
 */
export async function runHarnessScoreSubprocess(
  targetDir: string,
  options?: HarnessScoreOptions
): Promise<HarnessScoreResult> {
  const startTime = performance.now();
  const binary = options?.binaryPath || resolveHarnessScoreBinary(targetDir, options);

  if (!binary) {
    throw new Error(
      "harness-score binary not found in PATH, node_modules/.bin, or HARNESS_SCORE_BIN environment variable."
    );
  }

  const customArgs = options?.args || [];
  const cmdArgs: string[] = [];

  // Ensure custom arguments are passed
  for (const arg of customArgs) {
    if (!cmdArgs.includes(arg)) {
      cmdArgs.push(arg);
    }
  }

  // Ensure --json is present
  if (!cmdArgs.includes("--json")) {
    cmdArgs.push("--json");
  }

  // Ensure target path is present
  if (!cmdArgs.includes(targetDir)) {
    cmdArgs.push(targetDir);
  }

  const executionCwd = options?.cwd || targetDir;
  const timeoutMs = options?.timeoutMs ?? 15000;

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([binary, ...cmdArgs], {
      cwd: executionCwd,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ...(options?.env || {}),
      },
    });
  } catch (spawnError: any) {
    throw new Error(`Failed to spawn harness-score subprocess: ${spawnError.message}`);
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        // process may have already exited
      }
      reject(new Error(`harness-score subprocess timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const exitCode = await Promise.race([proc.exited, timeoutPromise]);
    if (timer) clearTimeout(timer);

    let stdoutText = "";
    if (proc.stdout instanceof ReadableStream) {
      stdoutText = await new Response(proc.stdout).text();
    }
    let stderrText = "";
    if (proc.stderr instanceof ReadableStream) {
      stderrText = await new Response(proc.stderr).text();
    }

    if (exitCode !== 0) {
      const errDetails = stderrText.trim() || stdoutText.trim() || `Exit code ${exitCode}`;
      throw new Error(`harness-score subprocess failed (exit code ${exitCode}): ${errDetails}`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stdoutText.trim());
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse JSON output from harness-score: ${parseError.message}. Output was: ${stdoutText}`
      );
    }

    const gaps: HarnessGap[] = Array.isArray(parsed.gaps)
      ? parsed.gaps.map((gap: any) => ({
          id: String(gap.id || ""),
          axis: gap.axis
            ? (String(gap.axis).toLowerCase() as GovernanceAxis)
            : inferGovernanceAxis(String(gap.id || "")),
          title: String(gap.title || gap.name || gap.id || "Governance gap"),
          description: gap.description ? String(gap.description) : undefined,
          remediation: gap.remediation ? String(gap.remediation) : undefined,
          weight: typeof gap.weight === "number" ? gap.weight : undefined,
        }))
      : [];

    const passed: string[] = Array.isArray(parsed.passed)
      ? parsed.passed.map((p: any) => String(p))
      : [];

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      score: typeof parsed.score === "number" ? parsed.score : 0,
      maxScore: typeof parsed.maxScore === "number" ? parsed.maxScore : 105,
      level: normalizeMaturityLevel(parsed.level),
      gaps,
      passed,
      rawOutput: stdoutText,
      source: "subprocess",
      executionTimeMs,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Performs in-memory structural evaluation of the repository as a defensive fallback.
 */
export function evaluateInMemoryFallback(targetDir: string): HarnessScoreResult {
  const startTime = performance.now();
  let score = 0;
  const maxScore = 105;
  const gaps: HarnessGap[] = [];
  const passed: string[] = [];

  // Helper check
  const exists = (relativePath: string) => fs.existsSync(path.join(targetDir, relativePath));

  // 1. Context Axis (30 pts max)
  if (exists("AGENTS.md")) {
    score += 15;
    passed.push("CTX-01");
  } else {
    gaps.push({
      id: "CTX-01",
      axis: "context",
      title: "Missing root AGENTS.md context fence",
      description: "Codebase lacks root operational guidelines for coding agents.",
      remediation: "Run 'baba wrap .' to generate tailored AGENTS.md.",
      weight: 15,
    });
  }

  if (exists("ARCHITECTURE.md") || exists("docs/architecture.md")) {
    score += 10;
    passed.push("CTX-02");
  } else {
    gaps.push({
      id: "CTX-02",
      axis: "context",
      title: "Missing Architecture Blueprint",
      description: "No ARCHITECTURE.md found defining system boundaries.",
      weight: 10,
    });
  }

  if (exists("README.md")) {
    score += 5;
    passed.push("CTX-03");
  } else {
    gaps.push({
      id: "CTX-03",
      axis: "context",
      title: "Missing README documentation",
      description: "No README.md documentation file found.",
      weight: 5,
    });
  }

  // 2. Skills Axis (15 pts max)
  if (exists("skills") || exists(".claude-plugin") || exists("gemini-extension.json")) {
    score += 15;
    passed.push("SKL-01");
  } else {
    gaps.push({
      id: "SKL-01",
      axis: "skills",
      title: "Missing Agent Skills Manifests",
      description: "No modular skills or slash command configurations detected.",
      weight: 15,
    });
  }

  // 3. Guardrails Axis (20 pts max)
  if (exists(".github/workflows") || exists(".gitlab-ci.yml") || exists(".circleci")) {
    score += 15;
    passed.push("CI-01");
  } else {
    gaps.push({
      id: "CI-01",
      axis: "guardrails",
      title: "Missing Continuous Integration Pipeline",
      description: "No CI workflow configurations found in repository.",
      weight: 15,
    });
  }

  if (exists(".gitignore")) {
    score += 5;
    passed.push("GRD-01");
  } else {
    gaps.push({
      id: "GRD-01",
      axis: "guardrails",
      title: "Missing .gitignore guardrail",
      description: "No .gitignore found to prevent artifact pollution.",
      weight: 5,
    });
  }

  // 4. Sensors Axis (30 pts max)
  const hasTests =
    exists("test") ||
    exists("tests") ||
    exists("spec") ||
    exists("__tests__");

  if (hasTests) {
    score += 20;
    passed.push("SNS-01");
  } else {
    gaps.push({
      id: "SNS-01",
      axis: "sensors",
      title: "Missing Test Suite Directory",
      description: "No canonical test directory detected.",
      weight: 20,
    });
  }

  // Sensor configuration / test runner
  const hasManifest =
    exists("package.json") ||
    exists("pyproject.toml") ||
    exists("Cargo.toml") ||
    exists("go.mod") ||
    exists("composer.json") ||
    exists("Gemfile");

  if (hasManifest) {
    score += 10;
    passed.push("SNS-02");
  } else {
    gaps.push({
      id: "SNS-02",
      axis: "sensors",
      title: "Missing Project Manifest Sensor",
      description: "No recognized build/test manifest detected.",
      weight: 10,
    });
  }

  // 5. Hygiene Axis (10 pts max)
  if (exists("LICENSE") || exists("LICENSE.md") || exists("LICENSE.txt")) {
    score += 10;
    passed.push("HYG-01");
  } else {
    gaps.push({
      id: "HYG-01",
      axis: "hygiene",
      title: "Missing Open-Source License",
      description: "No LICENSE file present in repository root.",
      weight: 10,
    });
  }

  let level: MaturityLevel = "L0";
  if (score >= 100) level = "L4";
  else if (score >= 75) level = "L3";
  else if (score >= 50) level = "L2";
  else if (score >= 25) level = "L1";

  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    score,
    maxScore,
    level,
    gaps,
    passed,
    source: "fallback",
    executionTimeMs,
  };
}

/**
 * Top-level maturity orchestrator with automatic fallback resilience.
 */
export async function executeHarnessScore(
  targetDir: string,
  options?: HarnessScoreOptions
): Promise<HarnessScoreResult> {
  const binary = resolveHarnessScoreBinary(targetDir, options);

  if (binary) {
    try {
      return await runHarnessScoreSubprocess(targetDir, {
        ...options,
        binaryPath: binary,
      });
    } catch (error) {
      if (options?.allowFallback) {
        return evaluateInMemoryFallback(targetDir);
      }
      throw error;
    }
  }

  if (options?.allowFallback) {
    return evaluateInMemoryFallback(targetDir);
  }

  throw new Error(
    "harness-score binary not found in PATH or environment, and allowFallback is false."
  );
}
