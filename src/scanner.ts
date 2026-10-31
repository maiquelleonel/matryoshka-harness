/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import { detectStack } from "./detector";
import { isIgnoredFile, loadBabaIgnorePatterns, loadGitignorePatterns, normalizeExcludePatterns } from "./ast";
import type {
  BadgeOptions,
  CodebaseEntities,
  GovernanceAxis,
  HarnessGap,
  HarnessScoreOptions,
  HarnessScoreResult,
  MaturityLevel,
  ProjectStack,
  RemediationIssue,
  RemediationPriority,
  SemanticReconciliation,
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

  // 1. Explicit option binaryPath (if specified by caller, use it exclusively)
  if (options?.binaryPath !== undefined) {
    return fs.existsSync(options.binaryPath) ? options.binaryPath : null;
  }

  // 2. HARNESS_SCORE_BIN environment variable
  if (env.HARNESS_SCORE_BIN && env.HARNESS_SCORE_BIN.trim() !== "") {
    return env.HARNESS_SCORE_BIN.trim();
  }

  // 3. Isolated environment guard (if PATH was explicitly emptied and no env var provided, don't leak host workspace)
  if (options?.env && options.env.PATH === "" && !options.env.HARNESS_SCORE_BIN) {
    return null;
  }

  // 4. Target directory local node_modules/.bin/harness-score
  const localTargetBin = path.join(targetDir, "node_modules", ".bin", "harness-score");
  if (fs.existsSync(localTargetBin)) {
    return localTargetBin;
  }

  // 5. Current workspace node_modules/.bin/harness-score
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
 * Internal runner that executes harness-score against a host repository via Bun subprocess.
 */
async function executeHarnessScoreSubprocessInternal(
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

  // Pass --include-tests and --exclude if configured
  if (options?.includeTests && !cmdArgs.includes("--include-tests")) {
    cmdArgs.push("--include-tests");
  }

  if (options?.exclude && options.exclude.length > 0) {
    for (const pat of options.exclude) {
      cmdArgs.push("--exclude", pat);
    }
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

    // Suporta tanto inteiros simples quanto o schema moderno de objeto do harness-score 1.8+ ({ earned: 105, max: 105 })
    let computedScore = 0;
    let computedMax = 105;
    if (typeof parsed.score === "number") {
      computedScore = parsed.score;
    } else if (typeof parsed.score === "object" && parsed.score !== null) {
      computedScore = Number(parsed.score.earned ?? parsed.score.score ?? 0);
      if (typeof parsed.score.max === "number") {
        computedMax = parsed.score.max;
      }
    }

    // Suporta tanto string "L4" quanto o schema de objeto ({ index: 4, name: "Self-correcting" })
    let computedLevel = "L0";
    if (typeof parsed.level === "string") {
      computedLevel = normalizeMaturityLevel(parsed.level);
    } else if (typeof parsed.level === "object" && parsed.level !== null) {
      const idx = parsed.level.index ?? 0;
      computedLevel = normalizeMaturityLevel(`L${idx}`);
    }

    return {
      score: computedScore,
      maxScore: typeof parsed.maxScore === "number" ? parsed.maxScore : computedMax,
      level: normalizeMaturityLevel(computedLevel),
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
 * Executes harness-score against a host repository via Bun subprocess,
 * falling back gracefully to in-memory evaluation when allowFallback is enabled.
 */
export async function runHarnessScoreSubprocess(
  targetDir: string,
  options?: HarnessScoreOptions
): Promise<HarnessScoreResult> {
  if (options?.allowFallback) {
    try {
      return await executeHarnessScoreSubprocessInternal(targetDir, options);
    } catch {
      return evaluateInMemoryFallback(targetDir);
    }
  }

  return await executeHarnessScoreSubprocessInternal(targetDir, options);
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
      remediation: "Run 'baba agents generate --yes' to scaffold tailored AGENTS.md and modular skills.",
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

/**
 * Scans a target repository directory for actual routes, models, and controllers.
 * Operates safely with depth bounds and skips heavy or alien directories.
 */
/**
 * Validação semântica em nível de AST/código para confirmar se um arquivo
 * realmente define modelos de dados e entidades ORM (Django models.Model,
 * SQLAlchemy DeclarativeBase, Pydantic BaseModel, ActiveRecord, TypeORM @Entity, Prisma, etc).
 */
export function isSemanticModelSource(content: string, filePath: string): boolean {
  if (!content || typeof content !== "string") return false;

  // 1. Python: Django models.Model, SQLAlchemy, Pydantic, Peewee, Tortoise
  if (filePath.endsWith(".py")) {
    const pyClassInheritance = /class\s+[A-Za-z0-9_]+\s*\(([^)]+)\)\s*:/g;
    let match: RegExpExecArray | null;
    while ((match = pyClassInheritance.exec(content)) !== null) {
      const bases = match[1] || "";
      if (
        /\b(?:models\.)?Model\b/.test(bases) ||
        /\b(?:sa\.)?DeclarativeBase\b/.test(bases) ||
        /\bBaseModel\b/.test(bases) ||
        /\bAbstract(?:Base)?User\b/.test(bases) ||
        /\b(?:sa\.)?declarative_base\b/.test(bases) ||
        /\bpeewee\.Model\b/.test(bases) ||
        /\btortoise\.models\.Model\b/.test(bases)
      ) {
        return true;
      }
    }
  }

  // 2. TypeScript / JavaScript: TypeORM (@Entity), Prisma, Drizzle, Mongoose, Zod schemas, Sequelize, interfaces/types de entidade
  if (filePath.endsWith(".ts") || filePath.endsWith(".js") || filePath.endsWith(".tsx")) {
    if (
      /@Entity\s*\(/.test(content) ||
      /@Table\s*\(/.test(content) ||
      /new\s+(?:mongoose\.)?Schema\s*\(/.test(content) ||
      /z\.object\s*\(/.test(content) ||
      /defineTable\s*\(/.test(content) ||
      /pgTable\s*\(/.test(content) ||
      /sqliteTable\s*\(/.test(content) ||
      /class\s+[A-Za-z0-9_]+\s+extends\s+(?:Sequelize\.)?Model\b/.test(content) ||
      /export\s+(?:interface|type)\s+[A-Za-z0-9_]+/.test(content)
    ) {
      return true;
    }
  }

  // 1b. Python fallback para arquivos dentro de pastas models/ ou classes em models/
  if (filePath.endsWith(".py") && (filePath.includes("/models/") || filePath.startsWith("models/"))) {
    if (/class\s+[A-Za-z0-9_]+/.test(content) || content.trim().length <= 50) {
      return true;
    }
  }

  // 3. Ruby: ActiveRecord::Base, ApplicationRecord
  if (filePath.endsWith(".rb")) {
    if (/class\s+[A-Za-z0-9_]+\s*<\s*(?:ActiveRecord::Base|ApplicationRecord)\b/.test(content)) {
      return true;
    }
  }

  // 4. Go: Structs com tags db:, json:, gorm:
  if (filePath.endsWith(".go")) {
    if (/type\s+[A-Za-z0-9_]+\s+struct\s*\{[^}]*`(?:gorm|db|bson):/.test(content)) {
      return true;
    }
  }

  // 5. Rust: Diesel, SeaORM, SQLx derives
  if (filePath.endsWith(".rs")) {
    if (/#\[derive\([^)]*\b(?:Model|Entity|DeriveEntityModel|FromRow)\b[^)]*\)\]/.test(content)) {
      return true;
    }
  }

  return false;
}


export function discoverCodebaseEntities(
  targetDir: string,
  options?: { includeTests?: boolean; exclude?: string | string[]; excludePatterns?: string | string[] }
): CodebaseEntities {
  const routes: string[] = [];
  const models: string[] = [];
  const controllers: string[] = [];

  const root = path.resolve(targetDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { routes, models, controllers };
  }

  const ignoreDirs = new Set([
    "node_modules",
    ".git",
    ".bun-install",
    "vendor",
    "dist",
    "build",
    ".venv",
    "venv",
    "__pycache__",
    ".idea",
    ".vscode",
    "coverage",
    ".next",
    ".turbo",
  ]);

  const excludePatterns = normalizeExcludePatterns([
    ...(options?.exclude ? (Array.isArray(options.exclude) ? options.exclude : [options.exclude]) : []),
    ...(options?.excludePatterns ? (Array.isArray(options.excludePatterns) ? options.excludePatterns : [options.excludePatterns]) : []),
  ]);
  const gitignorePatterns = loadGitignorePatterns(root);
  const babaIgnorePatterns = loadBabaIgnorePatterns(root);

  function walk(currentDir: string, depth: number): void {
    if (depth > 5) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullDirPath = path.join(currentDir, entry.name);
        const relDir = path.relative(root, fullDirPath).replace(/\\/g, "/");
        const isIgnored =
          ignoreDirs.has(entry.name) ||
          entry.name.startsWith(".") ||
          isIgnoredFile(relDir, {
            includeTests: options?.includeTests,
            excludePatterns,
            gitignorePatterns,
            babaIgnorePatterns,
            isDirectory: true,
          });
        if (!isIgnored) {
          walk(fullDirPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(root, fullPath).replace(/\\/g, "/");
        if (
          isIgnoredFile(relPath, {
            includeTests: options?.includeTests,
            excludePatterns,
            gitignorePatterns,
            babaIgnorePatterns,
          })
        ) {
          continue;
        }
        const lowerRel = relPath.toLowerCase();

        // Route patterns
        if (
          lowerRel.includes("/routes/") ||
          lowerRel.startsWith("routes/") ||
          lowerRel.includes("/api/") ||
          lowerRel.startsWith("api/") ||
          lowerRel.includes("/endpoints/") ||
          lowerRel.startsWith("endpoints/") ||
          lowerRel.includes("router.") ||
          lowerRel.includes("route.") ||
          lowerRel.endsWith("urls.py")
        ) {
          routes.push(relPath);
        }

        // Model patterns: Primeiro filtra candidatos por convenção de arquivo
        const isCandidateModelFile =
          lowerRel.includes("/models/") ||
          lowerRel.startsWith("models/") ||
          lowerRel.includes("/entities/") ||
          lowerRel.startsWith("entities/") ||
          lowerRel.includes("/schemas/") ||
          lowerRel.startsWith("schemas/") ||
          lowerRel.endsWith("/models.py") ||
          lowerRel.endsWith("models.py") ||
          lowerRel.endsWith("/model.py") ||
          lowerRel.endsWith("model.py") ||
          lowerRel.includes("model.") ||
          lowerRel.includes("entity.") ||
          lowerRel.includes("schema.");

        if (isCandidateModelFile) {
          // Validação em nível de AST/código: confirma se realmente herda de models.Model, DeclarativeBase, etc.
          let isTrueModel = false;
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size <= 200 * 1024) {
              const fileContent = fs.readFileSync(fullPath, "utf-8");
              isTrueModel = isSemanticModelSource(fileContent, fullPath);
            } else {
              isTrueModel = true; // Arquivos gigantes mantém como candidato defensivo
            }
          } catch {
            isTrueModel = false;
          }

          if (isTrueModel) {
            models.push(relPath);
          }
        }

        // Controller patterns (inclui Django views.py, handlers e endpoints)
        if (
          lowerRel.includes("/controllers/") ||
          lowerRel.startsWith("controllers/") ||
          lowerRel.includes("/handlers/") ||
          lowerRel.startsWith("handlers/") ||
          lowerRel.includes("/views/") ||
          lowerRel.startsWith("views/") ||
          lowerRel.endsWith("/views.py") ||
          lowerRel.endsWith("views.py") ||
          lowerRel.includes("controller.") ||
          lowerRel.includes("handler.") ||
          lowerRel.includes("views.")
        ) {
          controllers.push(relPath);
        }
      }
    }
  }

  walk(root, 0);

  routes.sort();
  models.sort();
  controllers.sort();

  return { routes, models, controllers };
}

/**
 * Maps an oracle governance gap to a language-tailored remediation issue.
 */
export function generateRemediationIssue(
  gap: HarnessGap,
  stack: ProjectStack,
  entities?: CodebaseEntities
): RemediationIssue {
  const gapUpper = gap.id.toUpperCase();
  const axis = gap.axis || inferGovernanceAxis(gap.id);

  // Determine priority
  let priority: RemediationPriority = "medium";
  if (gapUpper === "CTX-01" || gapUpper === "SNS-01" || gapUpper === "SNS-02") {
    priority = "critical";
  } else if (gapUpper === "CI-01" || gapUpper === "GRD-01" || gapUpper === "SNS-05") {
    priority = "high";
  } else if (
    gapUpper === "CTX-03" ||
    gapUpper === "HYG-01" ||
    gapUpper === "HYG-02" ||
    gapUpper === "HYG-05"
  ) {
    priority = "low";
  }

  // 1. Context Fence: CTX-01
  if (gapUpper === "CTX-01") {
    let action = "";
    let desc = gap.description || "Codebase lacks root operational guidelines for coding agents.";

    if (entities && entities.routes.length > 0) {
      desc += ` Existing routes detected: ${entities.routes.join(", ")}.`;
    }
    if (entities && entities.models.length > 0) {
      desc += ` Existing models detected: ${entities.models.join(", ")}.`;
    }

    if (stack.primary === "typescript") {
      if (stack.archetype === "reactive-frontend") {
        action = `Generate root AGENTS.md with TypeScript and ${stack.frameworks.join("/") || "React"} conventions (reactive state patterns, component bounds, zero forced SOLID OOP abstractions, test runner: ${stack.testRunner || "bun test"}).`;
      } else if (stack.archetype === "opinionated-framework") {
        action = `Generate root AGENTS.md with NestJS/TypeScript architecture (controllers, services, repositories, strict DTO validation, test runner: ${stack.testRunner || "bun test"}).`;
      } else {
        action = `Generate root AGENTS.md with TypeScript strict typing conventions, modular boundaries, zero forced SOLID abstractions, test runner: ${stack.testRunner || "bun test"}.`;
      }
    } else if (stack.primary === "python") {
      if (stack.frameworks.includes("fastapi")) {
        action = `Generate root AGENTS.md with Python conventions (PEP 8, type annotations, FastAPI async route handlers, Pydantic v2 schemas, test runner: ${stack.testRunner || "pytest"}).`;
      } else if (stack.frameworks.includes("django")) {
        action = `Generate root AGENTS.md with Python/Django conventions (PEP 8, MTV architecture, ORM migrations, test runner: ${stack.testRunner || "pytest"}).`;
      } else {
        action = `Generate root AGENTS.md with Python conventions (PEP 8, type hints, modular package architecture, test runner: ${stack.testRunner || "pytest"}).`;
      }
    } else if (stack.primary === "php") {
      if (
        stack.archetype === "procedural-cms" ||
        stack.frameworks.includes("wordpress") ||
        stack.frameworks.includes("drupal")
      ) {
        action = `Generate root AGENTS.md with pragmatic procedural CMS guidelines (Zero forced SOLID, prioritize DRY and YAGNI, respect native hooks and filters, avoid excessive class hierarchies, test runner: ${stack.testRunner || "phpunit"}).`;
      } else if (stack.frameworks.includes("laravel")) {
        action = `Generate root AGENTS.md with Laravel conventions (service providers, typed repository/actions, Eloquent models, test runner: ${stack.testRunner || "pest"}).`;
      } else {
        action = `Generate root AGENTS.md with PHP standards (PSR-12, strict types, test runner: ${stack.testRunner || "phpunit"}).`;
      }
    } else if (stack.primary === "go") {
      action = `Generate root AGENTS.md with Go idioms (gofmt, small interfaces, explicit error handling 'if err != nil', no panics in services, test runner: ${stack.testRunner || "go test"}).`;
    } else if (stack.primary === "rust") {
      action = `Generate root AGENTS.md with Rust idioms (strict ownership, Result/Option error handling without unwrap(), cargo test, bounded concurrency).`;
    } else if (stack.primary === "ruby") {
      action = `Generate root AGENTS.md with Ruby and ${stack.frameworks.includes("rails") ? "Rails conventions (MVC, ActiveRecord best practices)" : "clean modular design"}, test runner: ${stack.testRunner || "rspec"}.`;
    } else {
      action = `Generate root AGENTS.md establishing pragmatic code conventions, architecture overview, and operational boundaries.`;
    }

    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Generate Context Fence (AGENTS.md)",
      description: desc,
      targetFiles: ["AGENTS.md"],
      stack: stack.primary,
      priority: "critical",
      suggestedAction: action,
    };
  }

  // 2. CI Pipeline: CI-01
  if (gapUpper === "CI-01") {
    let action = "";
    if (stack.primary === "typescript") {
      action = `Configure GitHub Actions CI workflow with Bun/Node setup and '${stack.testRunner || "bun test"}' execution.`;
    } else if (stack.primary === "python") {
      action = `Configure GitHub Actions CI workflow with Python setup, dependency installation, and '${stack.testRunner || "pytest"}' execution.`;
    } else if (stack.primary === "go") {
      action = `Configure GitHub Actions CI workflow with Go setup and '${stack.testRunner || "go test ./..."}' execution.`;
    } else if (stack.primary === "rust") {
      action = `Configure GitHub Actions CI workflow with Rust toolchain and '${stack.testRunner || "cargo test"}' execution.`;
    } else if (stack.primary === "ruby") {
      action = `Configure GitHub Actions CI workflow with Ruby setup, bundle install, and '${stack.testRunner || "bundle exec rake test"}' execution.`;
    } else if (stack.primary === "php") {
      action = `Configure GitHub Actions CI workflow with PHP setup, composer install, and '${stack.testRunner || "vendor/bin/phpunit"}' execution.`;
    } else {
      action = `Configure baseline GitHub Actions CI workflow with automated test and lint steps.`;
    }

    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Configure Continuous Integration Pipeline",
      description: gap.description || "No CI workflow configurations found in repository.",
      targetFiles: [".github/workflows/ci.yml"],
      stack: stack.primary,
      priority: "high",
      suggestedAction: action,
    };
  }

  // 3. Test Runner / Suite: SNS-01 or SNS-05
  if (gapUpper === "SNS-01" || gapUpper === "SNS-05") {
    let action = "";
    let targets: string[] = [];

    if (stack.primary === "typescript") {
      targets = ["tests/index.test.ts"];
      action = `Configure ${stack.testRunner || "bun test"} and initialize unit test suite in tests/.`;
    } else if (stack.primary === "python") {
      targets = ["tests/test_main.py"];
      action = `Configure ${stack.testRunner || "pytest"} and initialize test suite in tests/.`;
    } else if (stack.primary === "go") {
      targets = ["main_test.go"];
      action = `Configure ${stack.testRunner || "go test"} and add initial '*_test.go' files.`;
    } else if (stack.primary === "rust") {
      targets = ["tests/integration_test.rs"];
      action = `Configure ${stack.testRunner || "cargo test"} and scaffold integration test suite.`;
    } else if (stack.primary === "ruby") {
      targets = [stack.testRunner === "rspec" ? "spec/spec_helper.rb" : "test/test_helper.rb"];
      action = `Initialize test harness with ${stack.testRunner || "rspec"}.`;
    } else if (stack.primary === "php") {
      targets = ["tests/TestCase.php"];
      action = `Initialize test suite with ${stack.testRunner || "pest"}.`;
    } else {
      targets = ["tests/test_basic"];
      action = `Configure automated test runner and test directory.`;
    }

    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: gapUpper === "SNS-01" ? "Initialize Test Suite Directory" : "Configure Automated Test Runner",
      description: gap.description || "Missing test directory or test runner configuration.",
      targetFiles: targets,
      stack: stack.primary,
      priority,
      suggestedAction: action,
    };
  }

  // 4. Project Manifest Sensor: SNS-02
  if (gapUpper === "SNS-02") {
    let targets: string[] = [];
    let action = "";
    if (stack.primary === "typescript") {
      targets = ["package.json"];
      action = "Initialize package.json manifest defining project metadata, scripts, and dependencies.";
    } else if (stack.primary === "python") {
      targets = ["pyproject.toml"];
      action = "Initialize pyproject.toml manifest defining Python package build configuration and dependencies.";
    } else if (stack.primary === "go") {
      targets = ["go.mod"];
      action = "Initialize go.mod module definition file.";
    } else if (stack.primary === "rust") {
      targets = ["Cargo.toml"];
      action = "Initialize Cargo.toml manifest with package metadata and dependencies.";
    } else if (stack.primary === "ruby") {
      targets = ["Gemfile"];
      action = "Initialize Gemfile specifying Ruby dependencies.";
    } else if (stack.primary === "php") {
      targets = ["composer.json"];
      action = "Initialize composer.json defining PHP package metadata and autoloading.";
    } else {
      targets = ["package.json"];
      action = "Initialize project build/test manifest.";
    }

    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Initialize Project Manifest Sensor",
      description: gap.description || "No recognized build/test manifest detected.",
      targetFiles: targets,
      stack: stack.primary,
      priority: "critical",
      suggestedAction: action,
    };
  }

  // 4. Linter / Formatter: GRD-03
  if (gapUpper === "GRD-03") {
    let targets: string[] = [];
    if (stack.primary === "typescript") targets = ["biome.json"];
    else if (stack.primary === "python") targets = ["ruff.toml"];
    else if (stack.primary === "go") targets = [".golangci.yml"];
    else if (stack.primary === "rust") targets = ["rustfmt.toml"];
    else if (stack.primary === "ruby") targets = [".rubocop.yml"];
    else if (stack.primary === "php") targets = [".php-cs-fixer.php"];
    else targets = [".editorconfig"];

    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Configure Static Linter and Formatter",
      description: gap.description || "No automated linter or code formatting configuration detected.",
      targetFiles: targets,
      stack: stack.primary,
      priority: "medium",
      suggestedAction: `Configure native linter and formatter for ${stack.primary}.`,
    };
  }

  // 5. Living Documentation: DOC-02
  if (gapUpper === "DOC-02") {
    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Establish Living Documentation and Specs",
      description: gap.description || "Missing living documentation or technical specifications.",
      targetFiles: ["docs/specs/SPEC-1.md"],
      stack: stack.primary,
      priority: "medium",
      suggestedAction: `Create formal SDD specification in docs/specs/ documenting ${stack.primary} architecture, contracts, and BDD acceptance criteria.`,
    };
  }

  // 6. Agent Skills: SKL-01 (Desacoplamento de conhecimento em skills modulares sob demanda)
  if (gapUpper === "SKL-01") {
    const defaultSkillName = stack.testRunner && stack.testRunner !== "none" ? "run-tests" : "domain-expert";
    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Scaffold Modular Agent Skills",
      description: gap.description || "No modular skills or slash command configurations detected.",
      targetFiles: [
        `skills/${defaultSkillName}/SKILL.md`,
        ".cursor/skills/",
        "gemini-extension.json",
        ".claude-plugin/plugin.json",
      ],
      stack: stack.primary,
      priority: "medium",
      suggestedAction: `Scaffold modular skills directory (skills/${defaultSkillName}/SKILL.md) isolating verbose domain knowledge and ${stack.primary} toolchains outside the canonical AGENTS.md.`,
    };
  }

  // 7. Git Guardrail: GRD-01
  if (gapUpper === "GRD-01") {
    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Create .gitignore Guardrail",
      description: gap.description || "No .gitignore found to prevent artifact pollution.",
      targetFiles: [".gitignore"],
      stack: stack.primary,
      priority: "high",
      suggestedAction: `Create .gitignore configured for ${stack.primary} artifacts and environment files.`,
    };
  }

  // 8. License: HYG-01
  if (gapUpper === "HYG-01") {
    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Add Open-Source License",
      description: gap.description || "No LICENSE file present in repository root.",
      targetFiles: ["LICENSE"],
      stack: stack.primary,
      priority: "low",
      suggestedAction: "Add standard open-source LICENSE file (e.g. MIT).",
    };
  }

  // 9. Architecture Blueprint: CTX-02
  if (gapUpper === "CTX-02") {
    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Create Architecture Blueprint",
      description: gap.description || "No ARCHITECTURE.md found defining system boundaries.",
      targetFiles: ["ARCHITECTURE.md"],
      stack: stack.primary,
      priority: "medium",
      suggestedAction: `Create ARCHITECTURE.md outlining ${stack.primary} project components, data flows, and architectural boundaries.`,
    };
  }

  // 10. Readme: CTX-03
  if (gapUpper === "CTX-03") {
    return {
      id: `REM-${gap.id}`,
      gapId: gap.id,
      axis,
      title: "Create README Documentation",
      description: gap.description || "No README.md documentation file found.",
      targetFiles: ["README.md"],
      stack: stack.primary,
      priority: "low",
      suggestedAction: `Add README.md with project overview, installation, and usage instructions for ${stack.primary}.`,
    };
  }

  // Generic fallback
  return {
    id: `REM-${gap.id}`,
    gapId: gap.id,
    axis,
    title: gap.title || `Remediate ${gap.id}`,
    description: gap.description || `Governance gap ${gap.id} identified by oracle.`,
    targetFiles: ["docs/REMEDIATION.md"],
    stack: stack.primary,
    priority,
    suggestedAction: gap.remediation || `Remediate governance gap ${gap.id} (${gap.title}).`,
  };
}

/**
 * Semantically reconciles oracle governance gaps with the polyglot stack and discovered codebase entities.
 */
export function reconcileGapsWithStack(
  oracleResult: HarnessScoreResult,
  stack: ProjectStack,
  projectPath?: string,
  options?: HarnessScoreOptions
): SemanticReconciliation {
  const entities: CodebaseEntities = projectPath
    ? discoverCodebaseEntities(projectPath, options)
    : { models: [], routes: [], controllers: [] };

  const priorityOrder: Record<RemediationPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const remediationIssues: RemediationIssue[] = oracleResult.gaps
    .map((gap) => generateRemediationIssue(gap, stack, entities))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    primaryStack: stack.primary,
    archetype: stack.archetype,
    frameworks: stack.frameworks,
    testRunner: stack.testRunner,
    oracleScore: oracleResult.score,
    oracleLevel: oracleResult.level,
    oracleSource: oracleResult.source,
    totalGaps: oracleResult.gaps.length,
    remediationIssues,
    entities,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Top-level maturity scan pipeline coordinating stack detection, oracle execution, and semantic reconciliation.
 */
export async function runMaturityScan(
  targetDir: string = process.cwd(),
  options?: HarnessScoreOptions
): Promise<SemanticReconciliation> {
  const resolvedPath = path.resolve(targetDir);
  const stack = detectStack(resolvedPath);
  const oracleResult = await executeHarnessScore(resolvedPath, {
    allowFallback: true,
    ...options,
  });
  return reconcileGapsWithStack(oracleResult, stack, resolvedPath, options);
}

/**
 * Formats a semantic reconciliation result into a styled human-readable terminal report.
 */
export function formatScanHumanOutput(
  reconciliation: SemanticReconciliation,
  rootPath: string,
  options?: { badgePath?: string }
): string {
  const lines: string[] = [];

  // Header
  lines.push(pc.bold(pc.cyan("\n🪆 Matryoshka Maturity Scanner (paladini/harness-score & semantic AST)")));
  lines.push(`  ${pc.dim("•")} ${pc.bold("Root Path:")}   ${rootPath}`);
  lines.push(`  ${pc.dim("•")} ${pc.bold("Primary:")}     ${pc.green(reconciliation.primaryStack)}`);
  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Frameworks:")}  ${
      reconciliation.frameworks.length > 0
        ? reconciliation.frameworks.map((f) => pc.blue(f)).join(", ")
        : pc.dim("none")
    }`
  );
  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Test Runner:")} ${
      reconciliation.testRunner ? pc.yellow(reconciliation.testRunner) : pc.dim("none")
    }`
  );
  lines.push(`  ${pc.dim("•")} ${pc.bold("Archetype:")}   ${pc.magenta(reconciliation.archetype)}`);

  // Maturity Level & Score
  let levelColor = pc.red;
  if (reconciliation.oracleLevel === "L4") levelColor = pc.green;
  else if (reconciliation.oracleLevel === "L3") levelColor = pc.cyan;
  else if (reconciliation.oracleLevel === "L2") levelColor = pc.blue;
  else if (reconciliation.oracleLevel === "L1") levelColor = pc.yellow;

  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Maturity:")}    ${levelColor(
      reconciliation.oracleLevel
    )} (${reconciliation.oracleScore}/105 pts) — ${reconciliation.totalGaps} governance gap(s)`
  );
  if (options?.badgePath) {
    lines.push(`  ${pc.dim("•")} ${pc.bold("Badge:")}       ${pc.green(options.badgePath)}`);
  }

  // Codebase Entities
  lines.push(pc.bold(pc.cyan("\n📍 Discovered Codebase Entities")));
  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Routes:")}      ${
      reconciliation.entities.routes.length > 0
        ? reconciliation.entities.routes.join(", ")
        : pc.dim("none")
    }`
  );
  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Models:")}      ${
      reconciliation.entities.models.length > 0
        ? reconciliation.entities.models.join(", ")
        : pc.dim("none")
    }`
  );
  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Controllers:")} ${
      reconciliation.entities.controllers.length > 0
        ? reconciliation.entities.controllers.join(", ")
        : pc.dim("none")
    }`
  );

  // Prioritized Remediation Plan
  lines.push(pc.bold(pc.cyan("\n🛠️ Remediation Plan (Prioritized Issues)")));
  if (reconciliation.remediationIssues.length === 0) {
    lines.push(`  ${pc.green("✔ No governance gaps identified! Repository is fully harnessed.")}`);
  } else {
    for (const issue of reconciliation.remediationIssues) {
      let badge = pc.gray("[LOW]");
      if (issue.priority === "critical") badge = pc.bold(pc.red("[CRITICAL]"));
      else if (issue.priority === "high") badge = pc.bold(pc.yellow("[HIGH]"));
      else if (issue.priority === "medium") badge = pc.bold(pc.blue("[MEDIUM]"));

      lines.push(`  ${badge} ${pc.bold(issue.id)}: ${issue.title}`);
      lines.push(`    ${pc.dim("Target:")} ${pc.magenta(issue.targetFiles.join(", "))}`);
      lines.push(`    ${pc.dim("Action:")} ${issue.suggestedAction}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Formats a semantic reconciliation result into a structured JSON payload ready for agent tooling.
 */
export function formatScanJsonOutput(
  reconciliation: SemanticReconciliation,
  rootPath: string,
  options?: { badgePath?: string }
): Record<string, any> {
  const remediation_issues = reconciliation.remediationIssues.map((issue) => ({
    id: issue.id,
    gap_id: issue.gapId,
    gapId: issue.gapId,
    axis: issue.axis,
    title: issue.title,
    description: issue.description,
    target_files: issue.targetFiles,
    targetFiles: issue.targetFiles,
    stack: issue.stack,
    priority: issue.priority,
    suggested_action: issue.suggestedAction,
    suggestedAction: issue.suggestedAction,
    snippet: issue.snippet,
  }));

  const output: Record<string, any> = {
    status: "success",
    command: "scan",
    rootPath,
    primaryStack: reconciliation.primaryStack,
    archetype: reconciliation.archetype,
    frameworks: reconciliation.frameworks,
    testRunner: reconciliation.testRunner,
    oracleScore: reconciliation.oracleScore,
    oracleLevel: reconciliation.oracleLevel,
    oracleSource: reconciliation.oracleSource || "fallback",
    oracle_source: reconciliation.oracleSource || "fallback",
    totalGaps: reconciliation.totalGaps,
    remediationIssues: reconciliation.remediationIssues,
    remediation_issues,
    entities: reconciliation.entities,
    timestamp: reconciliation.timestamp,
  };

  if (options?.badgePath) {
    output.badgePath = options.badgePath;
    output.badge_path = options.badgePath;
    output.badge = options.badgePath;
  }

  return output;
}

/**
 * Generates an SVG maturity badge (Shields.io flat style)
 * representing the evaluated score and governance maturity level.
 */
export function generateHarnessBadgeSvg(
  reconciliation:
    | SemanticReconciliation
    | HarnessScoreResult
    | { score: number; level: MaturityLevel; maxScore?: number },
  options?: BadgeOptions
): string {
  const label = options?.label || "harness";

  let level: MaturityLevel = "L0";
  let score = 0;
  let maxScore = 105;

  if ("oracleLevel" in reconciliation) {
    level = normalizeMaturityLevel(reconciliation.oracleLevel);
    score = reconciliation.oracleScore;
  } else if ("level" in reconciliation) {
    level = normalizeMaturityLevel(reconciliation.level);
    score = reconciliation.score;
    if ("maxScore" in reconciliation && typeof reconciliation.maxScore === "number") {
      maxScore = reconciliation.maxScore;
    }
  }

  const format = options?.format || "full";
  let value: string;
  if (format === "level") {
    value = level;
  } else if (format === "score") {
    value = `${score}/${maxScore}`;
  } else {
    value = `${level} (${score}/${maxScore})`;
  }

  let color = "#cf222e"; // L0 (Red)
  if (level === "L4") color = "#2ea44f"; // Green
  else if (level === "L3") color = "#0969da"; // Blue
  else if (level === "L2") color = "#1f6feb"; // Indigo/Blue
  else if (level === "L1") color = "#d29922"; // Yellow/Orange

  const leftWidth = Math.max(30, label.length * 7 + 14);
  const rightWidth = Math.max(30, value.length * 7 + 14);
  const totalWidth = leftWidth + rightWidth;

  const leftX = Math.round((leftWidth / 2) * 10);
  const rightX = Math.round((leftWidth + rightWidth / 2) * 10);
  const leftTextLength = (leftWidth - 10) * 10;
  const rightTextLength = (rightWidth - 10) * 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${leftX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${leftTextLength}">${label}</text>
    <text x="${leftX}" y="140" transform="scale(.1)" fill="#fff" textLength="${leftTextLength}">${label}</text>
    <text aria-hidden="true" x="${rightX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${rightTextLength}">${value}</text>
    <text x="${rightX}" y="140" transform="scale(.1)" fill="#fff" textLength="${rightTextLength}">${value}</text>
  </g>
</svg>`;
}


