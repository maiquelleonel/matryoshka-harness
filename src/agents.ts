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
  ExtractedSkill,
  LegacyMigrationOptions,
  LegacyMigrationResult,
  LegacyRollbackResult,
  LegacySkillMetadata,
  MigratedRootAgentsOptions,
  PrimaryStack,
  ProjectStack,
  TokenSavingsSummary,
} from "./types";

export type AgentArchetype =
  | "api_backend"
  | "opinionated_monolith"
  | "reactive_frontend"
  | "systems_microservice"
  | "fullstack_hybrid";

export type SkillName =
  | "skill-backend"
  | "skill-frontend"
  | "skill-database"
  | "skill-security"
  | "skill-testing"
  | "custom-instructions";

export interface DiscoveredSeams {
  hasBackend: boolean;
  hasFrontend: boolean;
  hasDatabase: boolean;
  hasSecurity: boolean;
  hasTesting: boolean;
  routes: string[];
  models: string[];
  controllers: string[];
  services: string[];
  views: string[];
  tests: string[];
}

export interface ArchetypeProfile {
  archetype: AgentArchetype;
  runtime: string;
  packageManager: string;
  testCommand: string;
  buildCommand: string;
  lintCommand: string;
  activeSkills: SkillName[];
  seams: DiscoveredSeams;
}

export interface SkillDefinition {
  name: SkillName;
  fileName: string;
  description: string;
  content: string;
}

export interface SkillFrontmatter {
  name: SkillName | string;
  description: string;
  origin?: string;
  migrated_at?: string;
}

export interface SkillMetadataItem {
  name: SkillName;
  fileName: string;
  relativePath: string;
  domain: string;
  description: string;
  tokenCount: number;
}

export interface SkillsMetadataIndex {
  skillsDir: string;
  skills: SkillMetadataItem[];
  totalIndexTokens: number;
  monolithicTokens: number;
  tokenSavings: number;
  savingsPercentage: number;
}

export interface PlannedFile {
  path: string;
  tokens: number;
  type: "root_agents" | "skill";
}

export interface EstimatedTokenSavings {
  monolithicCost: number;
  leanRootCost: number;
  savedTokens: number;
  savingsPercentage: number;
}

export const MAX_ROOT_AGENTS_TOKENS = 250;
export const TARGET_ROOT_AGENTS_TOKENS = 200;
export const MAX_CODE_BLOCK_LINES = 25;

export interface TokenGuardReport {
  tokenCount: number;
  maxTokens: number;
  targetTokens: number;
  withinBudget: boolean;
  exceededBy: number;
  savingsPercentage: number;
}

export class TokenBudgetExceededError extends Error {
  public readonly tokenCount: number;
  public readonly maxTokens: number;
  public readonly exceededBy: number;

  constructor(message: string, tokenCount: number, maxTokens: number) {
    super(message);
    this.name = "TokenBudgetExceededError";
    this.tokenCount = tokenCount;
    this.maxTokens = maxTokens;
    this.exceededBy = Math.max(0, tokenCount - maxTokens);
  }
}

export interface RootAgentsProfileInput {
  archetype: AgentArchetype;
  runtime?: string;
  packageManager?: string;
  testCommand?: string;
  buildCommand?: string;
  lintCommand?: string;
  activeSkills?: SkillName[];
  customInvariants?: string[];
}

export interface RootAgentsTemplateOptions {
  maxTokens?: number;
  strictTokenGuard?: boolean;
  truncateCommands?: boolean;
}

export interface BackendSkillCompilerOptions {
  framework?: string;
  orm?: string;
  runtime?: string;
  asyncSafety?: boolean;
  customRules?: string[];
  projectPath?: string;
  profile?: ArchetypeProfile;
}

export interface DatabaseSkillCompilerOptions {
  databaseEngine?: string;
  orm?: string;
  hasMigrations?: boolean;
  customRules?: string[];
  projectPath?: string;
  profile?: ArchetypeProfile;
}

export interface FrontendSkillCompilerOptions {
  framework?: string;
  styling?: string;
  stateManagement?: string;
  customRules?: string[];
  projectPath?: string;
  profile?: ArchetypeProfile;
}

export interface SecuritySkillCompilerOptions {
  authFramework?: string;
  complianceStandards?: string[];
  customRules?: string[];
  projectPath?: string;
  profile?: ArchetypeProfile;
}

export interface TestingSkillCompilerOptions {
  testRunner?: string;
  testFramework?: string;
  e2eFramework?: string;
  customRules?: string[];
  projectPath?: string;
  profile?: ArchetypeProfile;
}

export interface GenerateAgentsOptions {
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
  maxTokens?: number;
  strictTokenGuard?: boolean;
  selectedSkills?: SkillName[];
  interactive?: boolean;
  yes?: boolean;
  exclude?: string | string[];
  excludePatterns?: string | string[];
}

export interface GenerateAgentsResult {
  status: "success" | "error";
  archetype: AgentArchetype;
  dryRun: boolean;
  rootAgentsPath: string;
  rootTokens: number;
  skillsDir: string;
  plannedFiles: PlannedFile[];
  planned_files: PlannedFile[];
  estimatedTokenSavings: EstimatedTokenSavings;
  estimated_token_savings: EstimatedTokenSavings;
  skillsIndex?: SkillsMetadataIndex;
  message?: string;
  seams?: DiscoveredSeams;
  profile?: ArchetypeProfile;
  tokenGuard: TokenGuardReport;
  token_guard: TokenGuardReport;
  backupCreated: boolean;
  backupPath?: string;
}

/**
 * Estimates token count deterministically without heavy tokenizers.
 * Uses a word/punctuation sub-token approximation.
 */
export function estimateTokens(text: string): number {
  const matches = text.match(/\w+|[^\w\s]+/g);
  return matches ? matches.length : Math.ceil(text.length / 4);
}

/**
 * Evaluates token budget compliance against strict maximum and target thresholds.
 */
export function inspectTokenBudget(
  content: string,
  maxTokens: number = MAX_ROOT_AGENTS_TOKENS
): TokenGuardReport {
  const tokenCount = estimateTokens(content);
  const withinBudget = tokenCount <= maxTokens;
  const exceededBy = withinBudget ? 0 : tokenCount - maxTokens;
  const targetTokens = TARGET_ROOT_AGENTS_TOKENS;
  const monolithicReference = 1500;
  const savings = Math.max(0, monolithicReference - tokenCount);
  const savingsPercentage = Math.round((savings / monolithicReference) * 100);

  return {
    tokenCount,
    maxTokens,
    targetTokens,
    withinBudget,
    exceededBy,
    savingsPercentage,
  };
}

/**
 * Asserts that content complies with the token budget.
 * Throws TokenBudgetExceededError if the token count exceeds maxTokens.
 */
export function assertTokenBudget(
  content: string,
  maxTokens: number = MAX_ROOT_AGENTS_TOKENS
): TokenGuardReport {
  const report = inspectTokenBudget(content, maxTokens);
  if (!report.withinBudget) {
    throw new TokenBudgetExceededError(
      `Token budget exceeded: ${report.tokenCount} tokens exceeds maximum threshold of ${report.maxTokens} tokens (exceeded by ${report.exceededBy} tokens)`,
      report.tokenCount,
      report.maxTokens
    );
  }
  return report;
}

/**
 * Discovers architectural seams across the repository by inspecting directory structures and file markers.
 */
export function discoverSeams(
  projectPath: string,
  options?: {
    exclude?: string | string[];
    excludePatterns?: string | string[];
    includeTests?: boolean;
  }
): DiscoveredSeams {
  const root = path.resolve(projectPath);
  const routes: string[] = [];
  const models: string[] = [];
  const controllers: string[] = [];
  const services: string[] = [];
  const views: string[] = [];
  const tests: string[] = [];

  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return {
      hasBackend: false,
      hasFrontend: false,
      hasDatabase: false,
      hasSecurity: false,
      hasTesting: false,
      routes,
      models,
      controllers,
      services,
      views,
      tests,
    };
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
    ".agents",
  ]);

  const excludePatterns = normalizeExcludePatterns([
    ...(options?.exclude ? (Array.isArray(options.exclude) ? options.exclude : [options.exclude]) : []),
    ...(options?.excludePatterns ? (Array.isArray(options.excludePatterns) ? options.excludePatterns : [options.excludePatterns]) : []),
  ]);
  const gitignorePatterns = loadGitignorePatterns(root);
  const babaIgnorePatterns = loadBabaIgnorePatterns(root);

  let totalFiles = 0;

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
            includeTests: options?.includeTests ?? true,
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
            includeTests: options?.includeTests ?? true,
            excludePatterns,
            gitignorePatterns,
            babaIgnorePatterns,
          })
        ) {
          continue;
        }
        totalFiles++;
        const lowerRel = relPath.toLowerCase();

        // Testing patterns
        if (
          lowerRel.includes("/tests/") ||
          lowerRel.startsWith("tests/") ||
          lowerRel.includes("/test/") ||
          lowerRel.startsWith("test/") ||
          lowerRel.includes("/__tests__/") ||
          lowerRel.startsWith("__tests__/") ||
          lowerRel.includes("/spec/") ||
          lowerRel.startsWith("spec/") ||
          lowerRel.endsWith(".test.ts") ||
          lowerRel.endsWith(".test.js") ||
          lowerRel.endsWith(".spec.ts") ||
          lowerRel.endsWith(".spec.js") ||
          lowerRel.endsWith("_test.go") ||
          lowerRel.endsWith("_test.py") ||
          lowerRel.endsWith("conftest.py") ||
          lowerRel.endsWith("pytest.ini")
        ) {
          tests.push(relPath);
        }

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

        // Model / Database patterns
        if (
          lowerRel.includes("/models/") ||
          lowerRel.startsWith("models/") ||
          lowerRel.includes("/entities/") ||
          lowerRel.startsWith("entities/") ||
          lowerRel.includes("/schemas/") ||
          lowerRel.startsWith("schemas/") ||
          lowerRel.includes("/migrations/") ||
          lowerRel.startsWith("migrations/") ||
          lowerRel.includes("model.") ||
          lowerRel.includes("entity.") ||
          lowerRel.includes("schema.") ||
          lowerRel.endsWith("schema.prisma")
        ) {
          models.push(relPath);
        }

        // Controller patterns
        if (
          lowerRel.includes("/controllers/") ||
          lowerRel.startsWith("controllers/") ||
          lowerRel.includes("/handlers/") ||
          lowerRel.startsWith("handlers/") ||
          lowerRel.includes("controller.") ||
          lowerRel.includes("handler.")
        ) {
          controllers.push(relPath);
        }

        // Service patterns
        if (
          lowerRel.includes("/services/") ||
          lowerRel.startsWith("services/") ||
          lowerRel.includes("/domain/") ||
          lowerRel.startsWith("domain/") ||
          lowerRel.includes("/usecases/") ||
          lowerRel.startsWith("usecases/") ||
          lowerRel.includes("service.")
        ) {
          services.push(relPath);
        }

        // Frontend / View patterns
        if (
          lowerRel.includes("/views/") ||
          lowerRel.startsWith("views/") ||
          lowerRel.includes("/templates/") ||
          lowerRel.startsWith("templates/") ||
          lowerRel.includes("/components/") ||
          lowerRel.startsWith("components/") ||
          lowerRel.includes("/pages/") ||
          lowerRel.startsWith("pages/") ||
          lowerRel.includes("/static/") ||
          lowerRel.startsWith("static/") ||
          lowerRel.includes("/app/views/") ||
          lowerRel.startsWith("app/views/") ||
          lowerRel.includes("/resources/views/") ||
          lowerRel.startsWith("resources/views/") ||
          lowerRel.endsWith(".html") ||
          lowerRel.endsWith(".jsx") ||
          lowerRel.endsWith(".tsx") ||
          lowerRel.endsWith(".vue") ||
          lowerRel.endsWith(".svelte") ||
          lowerRel.endsWith(".erb")
        ) {
          views.push(relPath);
        }
      }
    }
  }

  walk(root, 0);

  routes.sort();
  models.sort();
  controllers.sort();
  services.sort();
  views.sort();
  tests.sort();

  const hasBackend = routes.length > 0 || controllers.length > 0 || services.length > 0;
  const hasFrontend = views.length > 0;
  const hasDatabase = models.length > 0;
  const hasTesting = tests.length > 0;
  const hasSecurity = totalFiles > 0;

  return {
    hasBackend,
    hasFrontend,
    hasDatabase,
    hasSecurity,
    hasTesting,
    routes,
    models,
    controllers,
    services,
    views,
    tests,
  };
}

/**
 * Deterministically profiles a repository and classifies it into a canonical archetype.
 */
export function profileArchetype(
  projectPath: string,
  options?: {
    exclude?: string | string[];
    excludePatterns?: string | string[];
    includeTests?: boolean;
  }
): ArchetypeProfile {
  const root = path.resolve(projectPath);
  const stack = detectStack(root);
  const seams = discoverSeams(root, options);

  let archetype: AgentArchetype = "api_backend";
  let runtime = "unknown";
  let packageManager = "unknown";
  let testCommand = stack.testRunner || "none";
  let buildCommand = "none";
  let lintCommand = "none";

  // Check Python manifests
  const pyprojectPath = path.join(root, "pyproject.toml");
  const requirementsPath = path.join(root, "requirements.txt");
  const pipfilePath = path.join(root, "Pipfile");

  const hasPython =
    fs.existsSync(pyprojectPath) ||
    fs.existsSync(requirementsPath) ||
    fs.existsSync(pipfilePath);

  // Check JS/TS manifests
  const packageJsonPath = path.join(root, "package.json");
  const hasPackageJson = fs.existsSync(packageJsonPath);

  // Check Go manifests
  const goModPath = path.join(root, "go.mod");
  const hasGo = fs.existsSync(goModPath);

  // Check Rust manifests
  const cargoTomlPath = path.join(root, "Cargo.toml");
  const hasRust = fs.existsSync(cargoTomlPath);

  // Check Ruby manifests
  const gemfilePath = path.join(root, "Gemfile");
  const hasRuby = fs.existsSync(gemfilePath);

  // Check PHP manifests
  const composerJsonPath = path.join(root, "composer.json");
  const hasPhp = fs.existsSync(composerJsonPath);

  // Check monorepo subdirectories (e.g. apps/*, packages/*, frontend, backend, client, server)
  const candidateSubdirs = [
    "apps/web",
    "apps/frontend",
    "apps/ui",
    "apps/client",
    "frontend",
    "client",
    "web",
    "packages/ui",
    "packages/web",
    "apps/api",
    "apps/backend",
    "apps/server",
    "backend",
    "server",
    "api",
    "packages/api",
    "packages/server",
  ];

  let monorepoHasFrontend = false;
  let monorepoHasBackend = false;

  for (const rel of candidateSubdirs) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;

    const subPkg = path.join(full, "package.json");
    if (fs.existsSync(subPkg)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(subPkg, "utf-8"));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (
          "next" in deps ||
          "react" in deps ||
          "vue" in deps ||
          "svelte" in deps ||
          "@sveltejs/kit" in deps ||
          "nuxt" in deps ||
          "astro" in deps
        ) {
          monorepoHasFrontend = true;
        }
        if (
          "express" in deps ||
          "fastify" in deps ||
          "prisma" in deps ||
          "drizzle-orm" in deps ||
          "@nestjs/core" in deps
        ) {
          monorepoHasBackend = true;
        }
      } catch {}
    }

    if (
      fs.existsSync(path.join(full, "pyproject.toml")) ||
      fs.existsSync(path.join(full, "requirements.txt")) ||
      fs.existsSync(path.join(full, "go.mod")) ||
      fs.existsSync(path.join(full, "Cargo.toml"))
    ) {
      monorepoHasBackend = true;
    }
  }

  // Inspect JS/TS package.json
  let hasFrontendFramework = false;
  let hasDatabaseOrBackend = false;

  if (hasPackageJson) {
    let pkg: any = {};
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    } catch {
      pkg = {};
    }

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };
    const scripts = pkg.scripts || {};

    if (fs.existsSync(path.join(root, "bun.lock")) || fs.existsSync(path.join(root, "bun.lockb"))) {
      runtime = "bun";
      packageManager = "bun";
    } else if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
      runtime = "node";
      packageManager = "pnpm";
    } else if (fs.existsSync(path.join(root, "yarn.lock"))) {
      runtime = "node";
      packageManager = "yarn";
    } else {
      runtime = "node";
      packageManager = "npm";
    }

    testCommand = scripts.test ? `${packageManager === "npm" ? "npm test" : `${packageManager} test`}` : testCommand;
    buildCommand = scripts.build ? `${packageManager === "npm" ? "npm run build" : `${packageManager} run build`}` : "none";
    lintCommand = scripts.lint ? `${packageManager === "npm" ? "npm run lint" : `${packageManager} run lint`}` : "none";

    hasFrontendFramework =
      "next" in allDeps ||
      "react" in allDeps ||
      "vue" in allDeps ||
      "svelte" in allDeps ||
      "@sveltejs/kit" in allDeps ||
      "nuxt" in allDeps ||
      "astro" in allDeps ||
      "angular" in allDeps ||
      "@angular/core" in allDeps ||
      "solid-js" in allDeps ||
      "preact" in allDeps;

    hasDatabaseOrBackend =
      "prisma" in allDeps ||
      "@prisma/client" in allDeps ||
      "drizzle-orm" in allDeps ||
      "typeorm" in allDeps ||
      "mongoose" in allDeps ||
      "pg" in allDeps ||
      "mysql2" in allDeps ||
      "sqlite3" in allDeps ||
      "better-sqlite3" in allDeps ||
      "express" in allDeps ||
      "fastify" in allDeps;
  }

  // Inspect Python content
  let pythonContent = "";
  if (hasPython) {
    if (fs.existsSync(pyprojectPath)) {
      try {
        pythonContent += "\n" + fs.readFileSync(pyprojectPath, "utf-8");
      } catch {}
    }
    if (fs.existsSync(requirementsPath)) {
      try {
        pythonContent += "\n" + fs.readFileSync(requirementsPath, "utf-8");
      } catch {}
    }
  }

  const isDjangoNinja = /django[-_]ninja/i.test(pythonContent) || /ninja/i.test(pythonContent);
  const isDjango = !isDjangoNinja && /django/i.test(pythonContent);
  const hasPythonWebFramework =
    isDjango ||
    isDjangoNinja ||
    /fastapi|flask|pyramid|tornado|sanic|aiohttp|falcon|starlette|litestar/i.test(pythonContent);

  // Check if monorepo / fullstack hybrid
  const isHybridMonorepo =
    (monorepoHasFrontend && monorepoHasBackend) ||
    (hasFrontendFramework && (hasPython || hasGo || hasRust)) ||
    (hasFrontendFramework && hasDatabaseOrBackend);

  if (isHybridMonorepo) {
    archetype = "fullstack_hybrid";
    if (runtime === "unknown") {
      runtime = hasPackageJson ? (packageManager === "bun" ? "bun" : "node") : (hasPython ? "python" : "unknown");
    }
  } else if (hasPython) {
    runtime = "python";
    packageManager = "pip";
    if (fs.existsSync(path.join(root, "poetry.lock"))) {
      packageManager = "poetry";
    } else if (fs.existsSync(path.join(root, "Pipfile"))) {
      packageManager = "pipenv";
    } else if (fs.existsSync(path.join(root, "uv.lock"))) {
      packageManager = "uv";
    }

    if (isDjango) {
      archetype = "opinionated_monolith";
    } else if (hasPythonWebFramework) {
      archetype = "api_backend";
    } else {
      archetype = "systems_microservice";
    }

    testCommand = testCommand !== "none" ? testCommand : "pytest";
    lintCommand = /ruff/i.test(pythonContent)
      ? "ruff check ."
      : /flake8/i.test(pythonContent)
      ? "flake8"
      : "none";
  } else if (hasPackageJson) {
    let pkg: any = {};
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    } catch {
      pkg = {};
    }
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    if ("@nestjs/core" in allDeps || "nestjs" in allDeps) {
      archetype = "opinionated_monolith";
    } else if (hasFrontendFramework && hasDatabaseOrBackend) {
      archetype = "fullstack_hybrid";
    } else if (hasFrontendFramework) {
      archetype = "reactive_frontend";
    } else {
      archetype = "api_backend";
    }
  } else if (hasGo) {
    runtime = "go";
    packageManager = "go modules";
    testCommand = "go test ./...";
    buildCommand = "go build ./...";
    lintCommand = "golangci-lint run";

    let goContent = "";
    try {
      goContent = fs.readFileSync(goModPath, "utf-8");
    } catch {}

    if (/gin|echo|fiber|chi/i.test(goContent)) {
      archetype = "api_backend";
    } else {
      archetype = "systems_microservice";
    }
  } else if (hasRust) {
    runtime = "rust";
    packageManager = "cargo";
    testCommand = "cargo test";
    buildCommand = "cargo build";
    lintCommand = "cargo clippy";

    let cargoContent = "";
    try {
      cargoContent = fs.readFileSync(cargoTomlPath, "utf-8");
    } catch {}

    if (/actix|axum|rocket/i.test(cargoContent)) {
      archetype = "api_backend";
    } else {
      archetype = "systems_microservice";
    }
  } else if (hasRuby) {
    runtime = "ruby";
    packageManager = "bundler";
    testCommand = stack.testRunner || "bundle exec rake test";

    let gemContent = "";
    try {
      gemContent = fs.readFileSync(gemfilePath, "utf-8");
    } catch {}

    if (/rails/i.test(gemContent)) {
      archetype = "opinionated_monolith";
    } else {
      archetype = "api_backend";
    }
  } else if (hasPhp) {
    runtime = "php";
    packageManager = "composer";
    testCommand = stack.testRunner || "phpunit";

    archetype = "opinionated_monolith";
  }

  // Determine active skill modules based on archetype and discovered seams
  const activeSkills: SkillName[] = [];
  switch (archetype) {
    case "api_backend":
      activeSkills.push("skill-backend", "skill-database", "skill-security", "skill-testing");
      seams.hasBackend = true;
      seams.hasDatabase = true;
      seams.hasSecurity = true;
      seams.hasTesting = true;
      break;
    case "fullstack_hybrid":
      activeSkills.push("skill-frontend", "skill-backend", "skill-database", "skill-security", "skill-testing");
      seams.hasFrontend = true;
      seams.hasBackend = true;
      seams.hasDatabase = true;
      seams.hasSecurity = true;
      seams.hasTesting = true;
      break;
    case "opinionated_monolith":
      activeSkills.push("skill-backend", "skill-database", "skill-security", "skill-testing");
      seams.hasBackend = true;
      seams.hasDatabase = true;
      seams.hasSecurity = true;
      seams.hasTesting = true;

      // Include frontend if templates/views or client directories exist
      const hasMonolithFrontend =
        fs.existsSync(path.join(root, "templates")) ||
        fs.existsSync(path.join(root, "views")) ||
        fs.existsSync(path.join(root, "static")) ||
        fs.existsSync(path.join(root, "frontend")) ||
        fs.existsSync(path.join(root, "app", "views")) ||
        fs.existsSync(path.join(root, "app", "assets")) ||
        fs.existsSync(path.join(root, "resources", "views")) ||
        fs.existsSync(path.join(root, "resources", "js")) ||
        seams.views.length > 0;

      if (hasMonolithFrontend) {
        activeSkills.unshift("skill-frontend");
        seams.hasFrontend = true;
      }
      break;
    case "reactive_frontend":
      activeSkills.push("skill-frontend", "skill-security", "skill-testing");
      seams.hasFrontend = true;
      seams.hasSecurity = true;
      seams.hasTesting = true;
      break;
    case "systems_microservice":
      activeSkills.push("skill-backend", "skill-security", "skill-testing");
      seams.hasBackend = true;
      seams.hasSecurity = true;
      seams.hasTesting = true;
      break;
  }

  return {
    archetype,
    runtime,
    packageManager,
    testCommand,
    buildCommand,
    lintCommand,
    activeSkills,
    seams,
  };
}

/**
 * Detects the ORM or query builder used in the project by inspecting package manifests.
 */
export function detectBackendOrm(projectPath: string = process.cwd()): string | null {
  const root = path.resolve(projectPath);

  // 1. Check Node/TS package.json
  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if ("prisma" in deps || "@prisma/client" in deps) return "prisma";
      if ("drizzle-orm" in deps) return "drizzle";
      if ("typeorm" in deps) return "typeorm";
      if ("mongoose" in deps) return "mongoose";
      if ("kysely" in deps) return "kysely";
      if ("mikro-orm" in deps || "@mikro-orm/core" in deps) return "mikro-orm";
      if ("sequelize" in deps) return "sequelize";
    } catch {}
  }

  // 2. Check Python manifests
  const pyprojectPath = path.join(root, "pyproject.toml");
  const requirementsPath = path.join(root, "requirements.txt");
  let pythonContent = "";
  if (fs.existsSync(pyprojectPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(pyprojectPath, "utf-8");
    } catch {}
  }
  if (fs.existsSync(requirementsPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(requirementsPath, "utf-8");
    } catch {}
  }
  if (pythonContent) {
    if (/sqlalchemy/i.test(pythonContent)) return "sqlalchemy";
    if (/django/i.test(pythonContent)) return "django-orm";
    if (/tortoise-orm/i.test(pythonContent)) return "tortoise";
    if (/peewee/i.test(pythonContent)) return "peewee";
  }

  // 3. Check Go go.mod
  const goModPath = path.join(root, "go.mod");
  if (fs.existsSync(goModPath)) {
    try {
      const goContent = fs.readFileSync(goModPath, "utf-8");
      if (/gorm\.io\/gorm/i.test(goContent)) return "gorm";
      if (/entgo\.io\/ent/i.test(goContent)) return "ent";
      if (/sqlx/i.test(goContent)) return "sqlx";
    } catch {}
  }

  // 4. Check Rust Cargo.toml
  const cargoTomlPath = path.join(root, "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    try {
      const cargoContent = fs.readFileSync(cargoTomlPath, "utf-8");
      if (/diesel/i.test(cargoContent)) return "diesel";
      if (/sea-orm/i.test(cargoContent)) return "sea-orm";
      if (/sqlx/i.test(cargoContent)) return "sqlx";
    } catch {}
  }

  // 5. Check Ruby Gemfile
  const gemfilePath = path.join(root, "Gemfile");
  if (fs.existsSync(gemfilePath)) {
    try {
      const gemContent = fs.readFileSync(gemfilePath, "utf-8");
      if (/rails|activerecord/i.test(gemContent)) return "active_record";
      if (/sequel/i.test(gemContent)) return "sequel";
    } catch {}
  }

  // 6. Check PHP composer.json
  const composerJsonPath = path.join(root, "composer.json");
  if (fs.existsSync(composerJsonPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerJsonPath, "utf-8"));
      const reqs = { ...(composer.require || {}), ...(composer["require-dev"] || {}) };
      if ("laravel/framework" in reqs || "illuminate/database" in reqs) return "eloquent";
      if ("doctrine/orm" in reqs) return "doctrine";
    } catch {}
  }

  return null;
}

/**
 * Detects the frontend framework used in the project by inspecting package manifests.
 */
export function detectFrontendFramework(projectPath: string = process.cwd()): string | null {
  const root = path.resolve(projectPath);

  // 1. Check Node/TS package.json
  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if ("next" in deps) return "next";
      if ("nuxt" in deps) return "nuxt";
      if ("@sveltejs/kit" in deps || "svelte" in deps) return "svelte";
      if ("astro" in deps) return "astro";
      if ("@angular/core" in deps || "angular" in deps) return "angular";
      if ("solid-js" in deps) return "solid";
      if ("vue" in deps) return "vue";
      if ("react" in deps) return "react";
    } catch {}
  }

  // 2. Check monorepo subdirectories if not found at root
  const subdirs = ["apps/web", "apps/frontend", "apps/ui", "frontend", "client", "web"];
  for (const rel of subdirs) {
    const subPkg = path.join(root, rel, "package.json");
    if (fs.existsSync(subPkg)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(subPkg, "utf-8"));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if ("next" in deps) return "next";
        if ("nuxt" in deps) return "nuxt";
        if ("@sveltejs/kit" in deps || "svelte" in deps) return "svelte";
        if ("astro" in deps) return "astro";
        if ("@angular/core" in deps || "angular" in deps) return "angular";
        if ("solid-js" in deps) return "solid";
        if ("vue" in deps) return "vue";
        if ("react" in deps) return "react";
      } catch {}
    }
  }

  return null;
}

/**
 * Detects the styling framework or methodology used in the project.
 */
export function detectStylingSystem(projectPath: string = process.cwd()): string | null {
  const root = path.resolve(projectPath);

  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if ("tailwindcss" in deps || "@tailwindcss/postcss" in deps) return "tailwind";
      if ("@emotion/react" in deps || "styled-components" in deps) return "css-in-js";
      if ("sass" in deps || "less" in deps) return "sass";
    } catch {}
  }

  // Check config files
  if (
    fs.existsSync(path.join(root, "tailwind.config.js")) ||
    fs.existsSync(path.join(root, "tailwind.config.ts")) ||
    fs.existsSync(path.join(root, "tailwind.config.cjs")) ||
    fs.existsSync(path.join(root, "tailwind.config.mjs"))
  ) {
    return "tailwind";
  }

  return null;
}

/**
 * Detects the authentication or security framework used in the project.
 */
export function detectAuthFramework(projectPath: string = process.cwd()): string | null {
  const root = path.resolve(projectPath);

  // 1. Check Node/TS package.json
  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if ("next-auth" in deps || "@auth/core" in deps) return "next-auth";
      if ("@clerk/nextjs" in deps || "@clerk/backend" in deps || "@clerk/clerk-sdk-node" in deps) return "clerk";
      if ("@supabase/supabase-js" in deps || "@supabase/auth-helpers-nextjs" in deps) return "supabase-auth";
      if ("passport" in deps) return "passport";
      if ("lucia" in deps) return "lucia";
      if ("jsonwebtoken" in deps || "jose" in deps) return "jwt";
    } catch {}
  }

  // 2. Check Python manifests
  const pyprojectPath = path.join(root, "pyproject.toml");
  const requirementsPath = path.join(root, "requirements.txt");
  let pythonContent = "";
  if (fs.existsSync(pyprojectPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(pyprojectPath, "utf-8");
    } catch {}
  }
  if (fs.existsSync(requirementsPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(requirementsPath, "utf-8");
    } catch {}
  }
  if (pythonContent) {
    if (/django[-_]allauth/i.test(pythonContent)) return "django-allauth";
    if (/fastapi[-_]users/i.test(pythonContent)) return "fastapi-users";
    if (/pyjwt|python[-_]jose|authlib/i.test(pythonContent)) return "jwt";
  }

  // 3. Check Go manifests
  const goModPath = path.join(root, "go.mod");
  if (fs.existsSync(goModPath)) {
    try {
      const goContent = fs.readFileSync(goModPath, "utf-8");
      if (/golang-jwt\/jwt/i.test(goContent)) return "jwt";
    } catch {}
  }

  // 4. Check Rust manifests
  const cargoTomlPath = path.join(root, "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    try {
      const cargoContent = fs.readFileSync(cargoTomlPath, "utf-8");
      if (/jsonwebtoken/i.test(cargoContent)) return "jwt";
    } catch {}
  }

  return null;
}

/**
 * Detects the database engine used in the project by inspecting package manifests and driver dependencies.
 */
export function detectDatabaseEngine(projectPath: string = process.cwd()): string | null {
  const root = path.resolve(projectPath);

  // 1. Check Node/TS package.json
  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if ("pg" in deps || "postgres" in deps || "@neondatabase/serverless" in deps) return "postgresql";
      if ("mysql" in deps || "mysql2" in deps) return "mysql";
      if ("sqlite3" in deps || "better-sqlite3" in deps) return "sqlite";
      if ("mongodb" in deps || "mongoose" in deps) return "mongodb";
    } catch {}
  }

  // 2. Check Python manifests
  const pyprojectPath = path.join(root, "pyproject.toml");
  const requirementsPath = path.join(root, "requirements.txt");
  let pythonContent = "";
  if (fs.existsSync(pyprojectPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(pyprojectPath, "utf-8");
    } catch {}
  }
  if (fs.existsSync(requirementsPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(requirementsPath, "utf-8");
    } catch {}
  }
  if (pythonContent) {
    if (/asyncpg|psycopg2|psycopg/i.test(pythonContent)) return "postgresql";
    if (/mysqlclient|pymysql|asyncmy/i.test(pythonContent)) return "mysql";
    if (/aiosqlite|sqlite3/i.test(pythonContent)) return "sqlite";
    if (/motor|pymongo/i.test(pythonContent)) return "mongodb";
  }

  // 3. Check Go go.mod
  const goModPath = path.join(root, "go.mod");
  if (fs.existsSync(goModPath)) {
    try {
      const goContent = fs.readFileSync(goModPath, "utf-8");
      if (/pgx|lib\/pq/i.test(goContent)) return "postgresql";
      if (/go-sql-driver\/mysql/i.test(goContent)) return "mysql";
      if (/mattn\/go-sqlite3/i.test(goContent)) return "sqlite";
    } catch {}
  }

  // 4. Check Rust Cargo.toml
  const cargoTomlPath = path.join(root, "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    try {
      const cargoContent = fs.readFileSync(cargoTomlPath, "utf-8");
      if (/tokio-postgres|postgres/i.test(cargoContent)) return "postgresql";
      if (/mysql_async|mysql/i.test(cargoContent)) return "mysql";
      if (/rusqlite/i.test(cargoContent)) return "sqlite";
    } catch {}
  }

  // 5. Check Ruby Gemfile
  const gemfilePath = path.join(root, "Gemfile");
  if (fs.existsSync(gemfilePath)) {
    try {
      const gemContent = fs.readFileSync(gemfilePath, "utf-8");
      if (/\bpg\b/i.test(gemContent)) return "postgresql";
      if (/mysql2/i.test(gemContent)) return "mysql";
      if (/sqlite3/i.test(gemContent)) return "sqlite";
    } catch {}
  }

  // 6. Check PHP composer.json
  const composerJsonPath = path.join(root, "composer.json");
  if (fs.existsSync(composerJsonPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerJsonPath, "utf-8"));
      const reqs = { ...(composer.require || {}), ...(composer["require-dev"] || {}) };
      if ("ext-pdo_pgsql" in reqs || "ext-pgsql" in reqs) return "postgresql";
      if ("ext-pdo_mysql" in reqs || "ext-mysqli" in reqs) return "mysql";
      if ("ext-pdo_sqlite" in reqs || "ext-sqlite3" in reqs) return "sqlite";
    } catch {}
  }

  return null;
}

/**
 * Compiles context-aware backend engineering guidelines with YAML frontmatter.
 */
export function compileBackendSkill(options?: BackendSkillCompilerOptions): string {
  let orm = options?.orm;
  if (!orm && options?.projectPath) {
    orm = detectBackendOrm(options.projectPath) || undefined;
  }

  let ormGuidance = "";
  if (orm === "prisma") {
    ormGuidance = `\n* **Prisma ORM Guidance:** Use Prisma \`include\` or \`select\` to eagerly load relations in single queries. Never execute sequential \`findUnique\` or \`findFirst\` calls inside loops.`;
  } else if (orm === "sqlalchemy") {
    ormGuidance = `\n* **SQLAlchemy ORM Guidance:** Use \`selectinload\` or \`joinedload\` to eagerly load relationships and avoid N+1 queries. Never access unloaded lazy attributes inside response serialization loops.`;
  } else if (orm === "django-orm") {
    ormGuidance = `\n* **Django ORM Guidance:** Use \`select_related\` for single-valued relationships (ForeignKey, OneToOne) and \`prefetch_related\` for multi-valued relations (ManyToMany, reverse relations) to eliminate N+1 queries.`;
  } else if (orm === "diesel") {
    ormGuidance = `\n* **Diesel (Rust) Guidance:** Use Diesel associations and explicit eager loading joins. Never execute point lookups inside iteration blocks.`;
  } else if (orm === "gorm") {
    ormGuidance = `\n* **GORM (Go) Guidance:** Use GORM \`Preload\` or \`Joins\` to batch load relational associations. Avoid queries within iteration loops.`;
  } else if (orm === "active_record") {
    ormGuidance = `\n* **ActiveRecord (Ruby) Guidance:** Use \`includes\`, \`preload\`, or \`eager_load\` to batch association queries. Never traverse unloaded associations in view rendering or loops.`;
  } else if (orm === "eloquent") {
    ormGuidance = `\n* **Eloquent (PHP) Guidance:** Use Eloquent \`with\` or \`load\` for eager loading relationships. Prevent N+1 query patterns in API resource transformations.`;
  }

  let customRulesSection = "";
  if (options?.customRules && options.customRules.length > 0) {
    customRulesSection = `\n\n## 5. Repository Custom Invariants\n${options.customRules.map((rule) => rule.trim()).join("\n")}`;
  }

  return `---
name: skill-backend
description: Framework-idiomatic ORM patterns, transactional boundaries, anti-N+1 query prevention, and async persistence rules. Use when modifying models, controllers, repositories, or database queries.
---

# 🛠️ Backend Engineering Guidelines

## 1. Anti-N+1 Query Invariant
* Never issue queries inside loops. Use eager loading, join fetches, or batched loaders (DataLoader / select_related / prefetch_related / Prisma include).
* Explicitly define selection sets; avoid fetching unbounded columns or deep relation graphs.${ormGuidance}

## 2. Transactional Boundaries & Atomic Persistence
* Wrap multi-entity mutations inside explicit database transactions.
* Ensure idempotency on distributed endpoints with unique deduplication keys.
* Never leave open transactions across external HTTP calls or long-running async tasks.

## 3. Async Safety & Non-Blocking Persistence
* Never mix blocking synchronous database drivers with async event loops; use non-blocking drivers.
* Bounded Connection Pooling: Configure connection pool timeouts and max-overflow guards to prevent thread starvation under load.

## 4. Idiomatic Layer Seams
* Maintain separation between HTTP transport/controllers, business domain services, and persistence repositories.
* Fail fast with typed validation errors before touching domain logic or persistence.${customRulesSection}
`;
}

/**
 * Compiles context-aware database and migration guidelines with YAML frontmatter.
 */
export function compileDatabaseSkill(options?: DatabaseSkillCompilerOptions): string {
  let engine = options?.databaseEngine;
  if (!engine && options?.projectPath) {
    engine = detectDatabaseEngine(options.projectPath) || undefined;
  }

  let engineGuidance = "";
  if (engine === "postgresql") {
    engineGuidance = `\n* **PostgreSQL Invariant:** Always create indexes concurrently (\`CREATE INDEX CONCURRENTLY\`) outside transaction blocks to avoid locking table writes.\n* **Lock & Statement Timeouts:** Always configure strict \`lock_timeout\` and \`statement_timeout\` on migration transactions to prevent connection pool exhaustion.`;
  } else if (engine === "mysql") {
    engineGuidance = `\n* **MySQL Invariant:** Use non-blocking DDL (\`ALGORITHM=INPLACE, LOCK=NONE\`) for online schema modifications where supported to avoid table locks.`;
  } else if (engine === "sqlite") {
    engineGuidance = `\n* **SQLite Invariant:** Enable WAL mode (\`PRAGMA journal_mode=WAL\`) and keep write transactions short to minimize lock contention and busy errors.`;
  }

  let customRulesSection = "";
  if (options?.customRules && options.customRules.length > 0) {
    customRulesSection = `\n\n## 4. Repository Custom Invariants\n${options.customRules.map((rule) => rule.trim()).join("\n")}`;
  }

  return `---
name: skill-database
description: Zero-downtime migrations, lock safety, column additions, and indexing strategies. Use when modifying database schemas, migrations, or table structures.
---

# 🗄️ Database & Migration Guidelines

## 1. Zero-Downtime Migration Contract
* Never run destructive column drops or renames in a single release. Follow expand-and-contract phase transitions.
* New columns must be nullable or have safe defaults that do not trigger full-table rewrites.
* Backfill large datasets in batched asynchronous background workers rather than synchronous migration locks.

## 2. Lock Safety & Non-Blocking DDL
* Create indexes concurrently (e.g., \`CREATE INDEX CONCURRENTLY\` in PostgreSQL).
* Set strict lock timeouts on migration transactions to prevent cascading connection pool exhaustion.
* Avoid heavy table locks during high-traffic operational windows.${engineGuidance}

## 3. Query & Index Hygiene
* Ensure all foreign keys and frequently filtered columns have supporting indexes.
* Audit query execution plans (EXPLAIN ANALYZE) before committing complex multi-table joins.
* Prune unused and redundant indexes to avoid write throughput penalties.${customRulesSection}
`;
}

/**
 * Compiles context-aware frontend engineering guidelines with YAML frontmatter.
 */
export function compileFrontendSkill(options?: FrontendSkillCompilerOptions): string {
  let framework = options?.framework;
  if (!framework && options?.projectPath) {
    framework = detectFrontendFramework(options.projectPath) || undefined;
  }

  let styling = options?.styling;
  if (!styling && options?.projectPath) {
    styling = detectStylingSystem(options.projectPath) || undefined;
  }

  let frameworkGuidance = "";
  if (framework === "next") {
    frameworkGuidance = `\n* **Next.js Guidance:** Strictly delineate Server Components from Client Components with the \`'use client'\` boundary. Use \`next/image\` with explicit \`width\` and \`height\` or \`fill\` with \`sizes\` to eliminate CLS. Leverage \`next/font\` to avoid render-blocking typography shifts.`;
  } else if (framework === "react") {
    frameworkGuidance = `\n* **React Guidance:** Ensure hook dependency arrays are complete and immutable. Avoid creating inline object/function references inside frequently rendered props. Never mutate React state directly.`;
  } else if (framework === "vue" || framework === "nuxt") {
    frameworkGuidance = `\n* **Vue / Nuxt Guidance:** Preserve reactivity by avoiding direct destructuring of reactive objects (use \`toRefs\` or computed properties). Use \`defineAsyncComponent\` for code-splitting heavy dialogs and widgets.`;
  } else if (framework === "svelte") {
    frameworkGuidance = `\n* **Svelte Guidance:** Use reactive declarations and runes idioms. Avoid complex nested store subscriptions where localized reactive state suffices.`;
  } else if (framework === "astro") {
    frameworkGuidance = `\n* **Astro Guidance:** Default to zero-JavaScript static HTML. Hydrate components on demand using explicit client directives (\`client:load\`, \`client:idle\`, \`client:visible\`).`;
  } else if (framework === "angular") {
    frameworkGuidance = `\n* **Angular Guidance:** Enforce \`ChangeDetectionStrategy.OnPush\` across all components. Use Angular Signals for localized reactive state and standalone components for tree-shakeable packaging.`;
  }

  let stylingGuidance = "";
  if (styling === "tailwind") {
    stylingGuidance = `\n* **Tailwind CSS Guidance:** Colocate utility classes directly within components. Extract repetitive layout patterns into reusable primitives rather than sprawling custom CSS files.`;
  }

  let customRulesSection = "";
  if (options?.customRules && options.customRules.length > 0) {
    customRulesSection = `\n\n## 5. Repository Custom Invariants\n${options.customRules.map((rule) => rule.trim()).join("\n")}`;
  }

  return `---
name: skill-frontend
description: Reactivity best practices, layout shifts, pure rendering, accessibility standards (A11y), and state management. Use when modifying UI components, styling, or client-side logic.
---

# 🎨 Frontend Engineering Guidelines

## 1. Pure Rendering & Reactivity Invariants
* Keep render functions pure and free of side effects; isolate mutations in event handlers or lifecycle seams.
* Colocate state as close as possible to the consumers to avoid broad sub-tree re-renders.
* Minimize component surface area: prefer simple composable components over monolithic multi-purpose components.${frameworkGuidance}

## 2. Cumulative Layout Shifts (CLS) & Performance
* Always specify explicit dimensions or aspect ratios for images, embeds, and dynamic placeholders.
* Avoid layout-shifting skeleton states or flash of unstyled/unauthenticated content (FOUC).
* Code-split large interactive modules and lazy-load below-the-fold components to preserve Core Web Vitals and protect bundle size.

## 3. Accessibility (A11y) & Semantic Markup
* Use native HTML semantic elements (\`<button>\`, \`<main>\`, \`<nav>\`, \`<article>\`) before ARIA overrides.
* Ensure keyboard navigability, visible focus rings, and high-contrast color ratios across all interactives.
* Every interactive element must have an accessible name; all media elements (\`<img>\`, \`<video>\`) must specify descriptive \`alt\` or \`aria-label\` attributes.

## 4. Component Architecture & State Hygiene
* Follow unidirectional data flow: pass data down through props/inputs and emit changes up via events/callbacks.
* Avoid premature global state; prefer local component state or localized context/stores until shared consumption is strictly needed.${stylingGuidance}${customRulesSection}
`;
}

/**
 * Compiles context-aware security and DLP guidelines with YAML frontmatter.
 */
export function compileSecuritySkill(options?: SecuritySkillCompilerOptions): string {
  let authFramework = options?.authFramework;
  if (!authFramework && options?.projectPath) {
    authFramework = detectAuthFramework(options.projectPath) || undefined;
  }

  let authGuidance = "";
  if (authFramework === "next-auth") {
    authGuidance = `\n* **Next-Auth / Auth.js Guidance:** Validate sessions server-side using \`auth()\` or \`getServerSession()\`. Protect API routes and page transitions via Edge Middleware.`;
  } else if (authFramework === "jwt") {
    authGuidance = `\n* **JWT Guidance:** Verify signature, expiration (\`exp\`), issuer (\`iss\`), and audience (\`aud\`) on every incoming token. Never store sensitive PII or credentials in unencrypted JWT payload claims.`;
  } else if (authFramework === "clerk") {
    authGuidance = `\n* **Clerk Guidance:** Enforce \`auth().userId\` verification in server actions and route handlers. Use Clerk webhook signature verification for event listeners.`;
  } else if (authFramework === "supabase-auth") {
    authGuidance = `\n* **Supabase Auth Guidance:** Enforce Row-Level Security (RLS) policies on all tables. Never bypass RLS with the service_role key in client-accessible contexts.`;
  } else if (authFramework === "django-allauth") {
    authGuidance = `\n* **Django Auth Guidance:** Always enable CSRF protection for state-mutating requests. Use \`LoginRequiredMixin\` or \`@login_required\` on view endpoints.`;
  } else if (authFramework === "passport") {
    authGuidance = `\n* **Passport Guidance:** Validate session serialization and deserialize user instances strictly against database records.`;
  }

  let customRulesSection = "";
  if (options?.customRules && options.customRules.length > 0) {
    customRulesSection = `\n\n## 5. Repository Custom Invariants\n${options.customRules.map((rule) => rule.trim()).join("\n")}`;
  }

  return `---
name: skill-security
description: OWASP Top 10 mitigation, strict input sanitization, secret leakage prevention, and defense-in-depth security invariants. Use when handling user input, authentication, authorization, or sensitive data.
---

# 🔒 Security & DLP Guidelines

## 1. Zero Secret Leakage Invariant & DLP
* Never hardcode API keys, JWT secrets, database passwords, private certificates, or tokens in source code, configs, or test fixtures.
* Always retrieve sensitive credentials via runtime environment variables or secure key vaults. Ensure \`.env\` files are explicitly ignored in \`.gitignore\`.
* Redact sensitive fields (passwords, tokens, PII, credit cards) from application logs, error traces, and telemetry payloads.

## 2. Strict Input Sanitization & Parameterization
* Parameterize all database queries without exception to eliminate SQL and NoSQL injection vectors. Never concatenate untrusted user input into query strings.
* Sanitize and escape all user-provided HTML, URLs, and file uploads against Cross-Site Scripting (XSS).
* Validate and restrict outgoing URLs against private CIDR blocks (127.0.0.1, 10.0.0.0/8, 169.254.169.254, 192.168.0.0/16) to eliminate Server-Side Request Forgery (SSRF).
* Sanitize and canonicalize file system paths; resolve absolute paths against an allowed base directory to prevent Path Traversal attacks.

## 3. Authentication & Authorization Guardrails
* Apply least-privilege access control on all endpoints. Re-verify user ownership and object-level permissions on every resource access (Broken Object Level Authorization / IDOR prevention).
* Enforce secure cookie attributes: \`HttpOnly\`, \`SameSite=Lax\` (or \`Strict\`), and \`Secure\`.
* Enforce rate limiting and brute-force mitigation on authentication, password reset, and sensitive operational endpoints.${authGuidance}

## 4. Defense-in-Depth & Dependency Security
* Set robust HTTP security headers: Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Content-Type-Options (nosniff), and X-Frame-Options (DENY).
* Pin dependencies and audit third-party packages regularly against known CVEs; eliminate vulnerable transitives.
* Fail safely: return generic error responses to clients without exposing internal stack traces, database schema details, or server environments.${customRulesSection}
`;
}

/**
 * Detects the test runner used in the project by inspecting package manifests and test configs.
 */
export function detectTestRunner(projectPath: string = process.cwd()): string | null {
  const root = path.resolve(projectPath);

  // 1. Check Node/TS package.json
  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const scripts = pkg.scripts || {};
      const testScript = typeof scripts.test === "string" ? scripts.test : "";

      if (testScript.includes("bun test")) return "bun test";
      if (testScript.includes("vitest")) return "vitest";
      if (testScript.includes("jest")) return "jest";

      if ("vitest" in deps) return "vitest";
      if ("jest" in deps) return "jest";
      if (
        fs.existsSync(path.join(root, "bun.lock")) ||
        fs.existsSync(path.join(root, "bun.lockb")) ||
        "@types/bun" in deps ||
        "bun" in deps
      ) {
        return "bun test";
      }
    } catch {}
  }

  // Check config files for JS/TS
  if (
    fs.existsSync(path.join(root, "vitest.config.ts")) ||
    fs.existsSync(path.join(root, "vitest.config.js")) ||
    fs.existsSync(path.join(root, "vitest.config.mjs"))
  ) {
    return "vitest";
  }
  if (
    fs.existsSync(path.join(root, "jest.config.ts")) ||
    fs.existsSync(path.join(root, "jest.config.js")) ||
    fs.existsSync(path.join(root, "jest.config.json")) ||
    fs.existsSync(path.join(root, "jest.config.mjs"))
  ) {
    return "jest";
  }

  // 2. Check Python manifests
  const pyprojectPath = path.join(root, "pyproject.toml");
  const requirementsPath = path.join(root, "requirements.txt");
  let pythonContent = "";
  if (fs.existsSync(pyprojectPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(pyprojectPath, "utf-8");
    } catch {}
  }
  if (fs.existsSync(requirementsPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(requirementsPath, "utf-8");
    } catch {}
  }
  if (
    /pytest/i.test(pythonContent) ||
    fs.existsSync(path.join(root, "pytest.ini")) ||
    fs.existsSync(path.join(root, "conftest.py"))
  ) {
    return "pytest";
  }

  // 3. Check Go go.mod
  if (fs.existsSync(path.join(root, "go.mod"))) {
    return "go test";
  }

  // 4. Check Rust Cargo.toml
  if (fs.existsSync(path.join(root, "Cargo.toml"))) {
    return "cargo test";
  }

  // 5. Check Ruby Gemfile
  const gemfilePath = path.join(root, "Gemfile");
  if (fs.existsSync(gemfilePath)) {
    let gemContent = "";
    try {
      gemContent = fs.readFileSync(gemfilePath, "utf-8");
    } catch {}
    if (
      /rspec/i.test(gemContent) ||
      fs.existsSync(path.join(root, ".rspec")) ||
      fs.existsSync(path.join(root, "spec"))
    ) {
      return "rspec";
    }
  }

  // 6. Check PHP composer.json
  const composerJsonPath = path.join(root, "composer.json");
  if (fs.existsSync(composerJsonPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerJsonPath, "utf-8"));
      const reqs = { ...(composer.require || {}), ...(composer["require-dev"] || {}) };
      if ("pestphp/pest" in reqs) return "pest";
      if ("phpunit/phpunit" in reqs || fs.existsSync(path.join(root, "phpunit.xml"))) return "phpunit";
    } catch {}
  }

  // Fallback to detectStack testRunner
  try {
    const stack = detectStack(root);
    if (stack.testRunner) return stack.testRunner;
  } catch {}

  return null;
}

/**
 * Detects the E2E testing framework used in the project.
 */
export function detectE2eFramework(projectPath: string = process.cwd()): string | null {
  const root = path.resolve(projectPath);

  // 1. Check Node/TS package.json
  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if ("@playwright/test" in deps || "playwright" in deps) return "playwright";
      if ("cypress" in deps) return "cypress";
    } catch {}
  }

  // Check config files
  if (
    fs.existsSync(path.join(root, "playwright.config.ts")) ||
    fs.existsSync(path.join(root, "playwright.config.js")) ||
    fs.existsSync(path.join(root, "playwright.config.mjs"))
  ) {
    return "playwright";
  }

  if (
    fs.existsSync(path.join(root, "cypress.config.ts")) ||
    fs.existsSync(path.join(root, "cypress.config.js")) ||
    fs.existsSync(path.join(root, "cypress.json"))
  ) {
    return "cypress";
  }

  // 2. Check Python manifests
  const pyprojectPath = path.join(root, "pyproject.toml");
  const requirementsPath = path.join(root, "requirements.txt");
  let pythonContent = "";
  if (fs.existsSync(pyprojectPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(pyprojectPath, "utf-8");
    } catch {}
  }
  if (fs.existsSync(requirementsPath)) {
    try {
      pythonContent += "\n" + fs.readFileSync(requirementsPath, "utf-8");
    } catch {}
  }
  if (pythonContent && /playwright/i.test(pythonContent)) {
    return "playwright";
  }

  return null;
}

/**
 * Compiles context-aware testing and verification guidelines with YAML frontmatter.
 */
export function compileTestingSkill(options?: TestingSkillCompilerOptions): string {
  let testRunner = options?.testRunner;
  if (!testRunner && options?.projectPath) {
    testRunner = detectTestRunner(options.projectPath) || undefined;
  }
  if (!testRunner && options?.profile?.testCommand && options.profile.testCommand !== "none") {
    testRunner = options.profile.testCommand;
  }

  let e2eFramework = options?.e2eFramework;
  if (!e2eFramework && options?.projectPath) {
    e2eFramework = detectE2eFramework(options.projectPath) || undefined;
  }

  const normalizedRunner = testRunner ? testRunner.toLowerCase().trim() : "";
  let runnerGuidance = "";

  if (normalizedRunner.includes("vitest")) {
    runnerGuidance = `\n* **Vitest Guidance:** Utilize Vitest in-source testing and ESM native mocking (\`vi.mock\`, \`vi.fn\`). Configure happy-dom or jsdom for isolated component and DOM testing.`;
  } else if (normalizedRunner.includes("jest")) {
    runnerGuidance = `\n* **Jest Guidance:** Ensure \`jest.clearAllMocks()\` or \`jest.restoreAllMocks()\` is executed in teardown hooks. Avoid unhandled asynchronous promises and memory leaks in test runs.`;
  } else if (normalizedRunner.includes("pytest")) {
    runnerGuidance = `\n* **Pytest Guidance:** Use explicit fixtures with clean teardown (\`yield\` fixtures). Avoid monkeypatching production modules when pure dependency injection is viable.`;
  } else if (normalizedRunner.includes("bun")) {
    runnerGuidance = `\n* **Bun Test Guidance:** Leverage \`bun:test\` native matchers, snapshot testing, and lifecycle hooks (\`beforeEach\`, \`afterEach\`). Run in fast watch or silent modes (\`bun test --bail\`).`;
  } else if (normalizedRunner.includes("cargo")) {
    runnerGuidance = `\n* **Rust Cargo Test Guidance:** Structure integration tests in \`tests/\` and unit tests in \`mod tests\` with \`#[cfg(test)]\`. Ensure tests do not rely on parallel file lock races.`;
  } else if (normalizedRunner.includes("go test") || normalizedRunner === "go") {
    runnerGuidance = `\n* **Go Test Guidance:** Use table-driven tests (\`t.Run\`) with \`t.Parallel()\` where state is isolated. Check error contracts with \`errors.Is\` or \`errors.As\`.`;
  } else if (normalizedRunner.includes("rspec")) {
    runnerGuidance = `\n* **RSpec Guidance:** Use explicit \`let\` / \`let!\` bindings and clean factories over direct database records. Never disable transactional fixtures.`;
  } else if (normalizedRunner.includes("pest")) {
    runnerGuidance = `\n* **Pest Guidance:** Follow expressive fluent expectations. Isolate database mutations using RefreshDatabase traits.`;
  } else if (normalizedRunner.includes("phpunit")) {
    runnerGuidance = `\n* **PHPUnit Guidance:** Clean up mock objects and assertions in \`tearDown()\`. Utilize data providers for boundary edge testing.`;
  }

  let e2eGuidance = "";
  if (e2eFramework === "playwright") {
    e2eGuidance = `\n* **Playwright E2E Guidance:** Prioritize user-facing locators (\`getByRole\`, \`getByText\`). Avoid arbitrary timeouts (\`page.waitForTimeout\`); use locator-based assertions.`;
  } else if (e2eFramework === "cypress") {
    e2eGuidance = `\n* **Cypress E2E Guidance:** Chain commands off retryable queries. Avoid unconditional waits; rely on route interception (\`cy.intercept\`) and aliasing.`;
  }

  let customRulesSection = "";
  if (options?.customRules && options.customRules.length > 0) {
    customRulesSection = `\n\n## 5. Repository Custom Invariants\n${options.customRules.map((rule) => rule.trim()).join("\n")}`;
  }

  return `---
name: skill-testing
description: The Seam contract, Red-to-Green TDD discipline, deterministic test fixtures, and mock isolation boundaries. Use when writing tests, refactoring, or verifying bugfixes.
---

# 🧪 Testing & Verification Guidelines

## 1. The Seam Contract (Red-to-Green)
* Always produce a failing deterministic test (RED) proving the bug or missing capability before altering production code.
* Verify green state empirically through native test execution (\`bun test\`, \`pytest\`, \`cargo test\`, \`go test\`).
* Never mark an issue or task complete without reproducing and greening test suite evidence.${runnerGuidance}

## 2. Deterministic Fixtures & Isolation
* Tests must run in full isolation; tests must never depend on shared mutable state or execution ordering.
* Clean up all temporary files, test databases, and mocked timers in \`afterEach\` / teardown hooks.
* Avoid global state leakage across test cases; reset singletons and memoized caches between test runs.

## 3. Mock Boundaries & Test Doubles
* Only mock external system boundaries (network calls, external third-party APIs, clock shifts).
* Never mock the unit or domain logic under test. Prefer in-memory fakes over complex stubbing.
* Verify contract boundaries: mock at the seam edge, not deep within internal implementation details.

## 4. Test Suite Hygiene & Speed
* Keep unit test suites blazing fast (< 5s feedback loop).
* Decouple fast unit tests from slow integration or end-to-end (E2E) suites.
* Avoid brittle assertions: assert on behavior and observable state rather than private internal implementation details.${e2eGuidance}${customRulesSection}
`;
}

/**
 * Catalog of specialized skills with YAML frontmatter.
 */
export const SKILL_DEFINITIONS: Record<SkillName, SkillDefinition> = {
  "skill-backend": {
    name: "skill-backend",
    fileName: "skill-backend.md",
    description:
      "Framework-idiomatic ORM patterns, transactional boundaries, anti-N+1 query prevention, and async persistence rules. Use when modifying models, controllers, repositories, or database queries.",
    content: compileBackendSkill()
  },
  "skill-database": {
    name: "skill-database",
    fileName: "skill-database.md",
    description:
      "Zero-downtime migrations, lock safety, column additions, and indexing strategies. Use when modifying database schemas, migrations, or table structures.",
    content: compileDatabaseSkill()
  },
  "skill-frontend": {
    name: "skill-frontend",
    fileName: "skill-frontend.md",
    description:
      "Reactivity best practices, layout shifts, pure rendering, accessibility standards (A11y), and state management. Use when modifying UI components, styling, or client-side logic.",
    content: compileFrontendSkill()
  },
  "skill-security": {
    name: "skill-security",
    fileName: "skill-security.md",
    description:
      "OWASP Top 10 mitigation, strict input sanitization, secret leakage prevention, and defense-in-depth security invariants. Use when handling user input, authentication, authorization, or sensitive data.",
    content: compileSecuritySkill()
  },
  "skill-testing": {
    name: "skill-testing",
    fileName: "skill-testing.md",
    description:
      "The Seam contract, Red-to-Green TDD discipline, deterministic test fixtures, and mock isolation boundaries. Use when writing tests, refactoring, or verifying bugfixes.",
    content: compileTestingSkill()
  },
  "custom-instructions": {
    name: "custom-instructions",
    fileName: "custom-instructions.md",
    description:
      "Repository-specific overrides, domain rules, bespoke workflows, and developer guidelines.",
    content: `---
name: custom-instructions
description: Repository-specific overrides, domain rules, bespoke workflows, and developer guidelines.
---

# Custom Instructions & Repository Rules

- Document project-specific rules, invariants, or domain constraints here.
- Maintain deterministic code patterns and adherence to team conventions.
`
  }
};

const SKILL_TITLE_MAP: Record<SkillName, string> = {
  "skill-backend": "Backend & ORM",
  "skill-frontend": "Frontend & UI",
  "skill-database": "Database & Migrations",
  "skill-security": "Security & DLP",
  "skill-testing": "Testing & TDD",
  "custom-instructions": "Custom Instructions"
};

/**
 * Parses YAML frontmatter from a markdown skill definition.
 * Enforces strictly formatted 'name' and 'description' keys.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter | null {
  if (!content || typeof content !== "string") {
    return null;
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match || !match[1]) {
    return null;
  }
  const rawYaml = match[1];
  const nameMatch = rawYaml.match(/^name:\s*(.+)$/m);
  const descMatch = rawYaml.match(/^description:\s*(.+)$/m);

  if (!nameMatch || !descMatch || !nameMatch[1] || !descMatch[1]) {
    return null;
  }

  const name = nameMatch[1].trim() as SkillName;
  const description = descMatch[1].trim();

  if (!name || !description) {
    return null;
  }

  const originMatch = rawYaml.match(/^origin:\s*(.+)$/m);
  const migratedAtMatch = rawYaml.match(/^migrated_at:\s*["']?([^"'\r\n]+)["']?$/m);

  const result: SkillFrontmatter = {
    name,
    description,
  };

  if (originMatch && originMatch[1]) {
    result.origin = originMatch[1].trim();
  }
  if (migratedAtMatch && migratedAtMatch[1]) {
    result.migrated_at = migratedAtMatch[1].trim();
  }

  return result;
}

/**
 * Validates that the skill content begins with a valid YAML frontmatter block.
 */
export function validateSkillFrontmatter(content: string): boolean {
  const frontmatter = parseSkillFrontmatter(content);
  return frontmatter !== null && Boolean(frontmatter.name && frontmatter.description);
}

/**
 * Stamps standardized YAML Frontmatter onto a legacy skill body.
 * Metadata includes origin: legacy_migration, name, description, and migrated_at.
 * Strips existing frontmatter blocks if present to prevent nesting.
 */
export function stampLegacySkillFrontmatter(
  body: string,
  metadata: LegacySkillMetadata
): string {
  const origin = metadata.origin || "legacy_migration";
  const migratedAt = metadata.migratedAt || metadata.migrated_at || new Date().toISOString();
  const cleanBody = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();

  return `---
name: ${metadata.name}
description: ${metadata.description}
origin: ${origin}
migrated_at: "${migratedAt}"
---

${cleanBody}
`;
}

/**
 * Checks whether the given skill content represents a migrated legacy skill
 * by verifying the YAML frontmatter and checking origin === "legacy_migration".
 */
export function isLegacyMigrationSkill(content: string): boolean {
  const parsed = parseSkillFrontmatter(content);
  return parsed !== null && parsed.origin === "legacy_migration";
}

/**
 * Builds a lightweight skills metadata index.
 * Only domain names, paths, and short descriptions are indexed, preventing context flooding.
 */
export function buildSkillsMetadataIndex(
  projectPath: string = process.cwd(),
  activeSkills?: SkillName[]
): SkillsMetadataIndex {
  const root = path.resolve(projectPath);
  const skillsDir = path.join(root, ".agents", "skills");

  const skillsToInclude =
    activeSkills && activeSkills.length > 0
      ? activeSkills
      : ([
          "skill-backend",
          "skill-frontend",
          "skill-database",
          "skill-security",
          "skill-testing"
        ] as SkillName[]);

  const skills: SkillMetadataItem[] = [];
  let totalIndexTokens = 0;
  let monolithicTokens = 0;

  for (const skillName of skillsToInclude) {
    const def = SKILL_DEFINITIONS[skillName];
    if (!def) continue;

    const domain = SKILL_TITLE_MAP[skillName] || skillName;
    const tokenCount = estimateTokens(def.content);
    monolithicTokens += tokenCount;

    const metadataSnippet = `* ${domain}: .agents/skills/${def.fileName} - ${def.description}`;
    const metadataTokens = estimateTokens(metadataSnippet);
    totalIndexTokens += metadataTokens;

    skills.push({
      name: skillName,
      fileName: def.fileName,
      relativePath: path.join(".agents", "skills", def.fileName).replace(/\\/g, "/"),
      domain,
      description: def.description,
      tokenCount
    });
  }

  const tokenSavings = Math.max(0, monolithicTokens - totalIndexTokens);
  const savingsPercentage =
    monolithicTokens > 0
      ? Math.round((tokenSavings / monolithicTokens) * 100)
      : 0;

  return {
    skillsDir,
    skills,
    totalIndexTokens,
    monolithicTokens,
    tokenSavings,
    savingsPercentage
  };
}

/**
 * Loads a specialized skill on demand.
 * Reads from disk if available at .agents/skills/<fileName>, otherwise falls back to catalog.
 * Avoids dumping full instruction bodies prematurely into agent context.
 */
export function loadSkillOnDemand(
  skillName: SkillName,
  projectPath: string = process.cwd()
): SkillDefinition & { fullPath?: string; source: "disk" | "catalog" } {
  const catalogSkill = SKILL_DEFINITIONS[skillName];
  if (!catalogSkill) {
    throw new Error(`Unknown skill '${skillName}'`);
  }

  const root = path.resolve(projectPath);
  const diskPath = path.join(root, ".agents", "skills", catalogSkill.fileName);

  if (fs.existsSync(diskPath)) {
    try {
      const content = fs.readFileSync(diskPath, "utf-8");
      const parsed = parseSkillFrontmatter(content);
      return {
        name: (parsed?.name as SkillName) || catalogSkill.name,
        fileName: catalogSkill.fileName,
        description: parsed?.description || catalogSkill.description,
        content,
        fullPath: diskPath,
        source: "disk"
      };
    } catch {
      // Fallback to catalog if read fails
    }
  }

  return {
    ...catalogSkill,
    source: "catalog"
  };
}

/**
 * Compiles the ultra-lean root AGENTS.md index strictly under 200 tokens.
 * Enforces token guard and normalizes detected commands.
 */
export function compileRootAgents(
  profile: RootAgentsProfileInput,
  options?: RootAgentsTemplateOptions
): string {
  const sanitizeCmd = (cmd?: string): string => {
    if (!cmd) return "none";
    const cleaned = cmd.trim().replace(/\s+/g, " ");
    return cleaned.length > 0 ? cleaned : "none";
  };

  const runtime = profile.runtime?.trim() || "unknown";
  const packageManager = profile.packageManager?.trim() || "unknown";
  const testCommand = sanitizeCmd(profile.testCommand);
  const buildCommand = sanitizeCmd(profile.buildCommand);
  const lintCommand = sanitizeCmd(profile.lintCommand);

  const activeSkills = profile.activeSkills || [];
  const skillsList =
    activeSkills.length > 0
      ? activeSkills
          .map((skillName) => {
            const title = SKILL_TITLE_MAP[skillName] || skillName;
            const def = SKILL_DEFINITIONS[skillName];
            const fileName = def ? def.fileName : `${skillName}.md`;
            return `* ${title}: \`.agents/skills/${fileName}\``;
          })
          .join("\n")
      : "* No specialized skills required.";

  let customInvariantsSection = "";
  if (profile.customInvariants && profile.customInvariants.length > 0) {
    customInvariantsSection =
      "\n" + profile.customInvariants.map((inv) => inv.trim()).join("\n");
  }

  const content = `# 🤖 Project Operational Directives

## 🌐 Stack & Identity
* **Archetype:** ${profile.archetype}
* **Runtime:** ${runtime} (${packageManager})
* **Test Runner:** \`${testCommand}\`
* **Build / Lint:** \`${buildCommand}\` | \`${lintCommand}\`

## 🛡️ Anti-Slop Core Invariants
* **YAGNI & DRY First:** Prefer simple composable functions over speculative class hierarchies.
* **No Unprompted Refactoring:** Preserve working patterns; surgical edits only.
* **Verification First:** Never declare completion without executing test suite evidence.${customInvariantsSection}

## 🧭 On-Demand Specialized Skills
Load specialized guidelines only when touching respective domains:
${skillsList}
`;

  if (options?.strictTokenGuard) {
    assertTokenBudget(content, options.maxTokens ?? MAX_ROOT_AGENTS_TOKENS);
  }

  return content;
}

/**
 * Resolves the rendered markdown content for a modular skill given optional project context.
 */
export function resolveSkillContent(
  skillName: SkillName,
  options?: {
    projectPath?: string;
    profile?: ArchetypeProfile;
  }
): string {
  const root = options?.projectPath ? path.resolve(options.projectPath) : undefined;
  const profile = options?.profile;
  switch (skillName) {
    case "skill-backend":
      return compileBackendSkill({ projectPath: root, profile });
    case "skill-database":
      return compileDatabaseSkill({ projectPath: root, profile });
    case "skill-frontend":
      return compileFrontendSkill({ projectPath: root, profile });
    case "skill-security":
      return compileSecuritySkill({ projectPath: root, profile });
    case "skill-testing":
      return compileTestingSkill({ projectPath: root, profile });
    case "custom-instructions": {
      if (root) {
        const customPath = path.join(root, ".agents", "skills", "custom-instructions.md");
        if (fs.existsSync(customPath)) {
          try {
            return fs.readFileSync(customPath, "utf-8");
          } catch {
            // fallback
          }
        }
      }
      return SKILL_DEFINITIONS["custom-instructions"]?.content || "";
    }
    default:
      return (SKILL_DEFINITIONS[skillName as SkillName] as SkillDefinition | undefined)?.content || "";
  }
}

/**
 * Main engine to generate adaptive AGENTS.md and modular skills.
 */
export function generateAgents(
  projectPath: string = process.cwd(),
  options: GenerateAgentsOptions = {}
): GenerateAgentsResult {
  const root = path.resolve(projectPath);
  const profile = profileArchetype(root, options);
  const effectiveSkills = options.selectedSkills ?? profile.activeSkills;
  const effectiveProfile: ArchetypeProfile = {
    ...profile,
    activeSkills: effectiveSkills,
  };
  const maxTokens = options.maxTokens ?? MAX_ROOT_AGENTS_TOKENS;
  const rootAgentsContent = compileRootAgents(effectiveProfile, {
    maxTokens,
    strictTokenGuard: options.strictTokenGuard,
  });
  const rootTokens = estimateTokens(rootAgentsContent);
  const tokenGuard = inspectTokenBudget(rootAgentsContent, maxTokens);

  const agentsPath = path.join(root, "AGENTS.md");
  const backupPath = path.join(root, "AGENTS.md.bak");
  const skillsDir = path.join(root, ".agents", "skills");

  const plannedFiles: PlannedFile[] = [
    {
      path: "AGENTS.md",
      tokens: rootTokens,
      type: "root_agents"
    }
  ];

  for (const skillName of effectiveSkills) {
    const def = SKILL_DEFINITIONS[skillName];
    const skillContent = resolveSkillContent(skillName, { projectPath: root, profile: effectiveProfile });
    plannedFiles.push({
      path: path.join(".agents", "skills", def.fileName),
      tokens: estimateTokens(skillContent),
      type: "skill"
    });
  }

  const monolithicCost = 1500;
  const savedTokens = Math.max(0, monolithicCost - rootTokens);
  const savingsPercentage = Math.round((savedTokens / monolithicCost) * 100);

  const estimatedSavings: EstimatedTokenSavings = {
    monolithicCost,
    leanRootCost: rootTokens,
    savedTokens,
    savingsPercentage
  };

  const skillsIndex = buildSkillsMetadataIndex(root, effectiveSkills);

  // Dry-run mode: do not touch disk
  if (options.dryRun) {
    return {
      status: "success",
      archetype: effectiveProfile.archetype,
      dryRun: true,
      rootAgentsPath: agentsPath,
      rootTokens,
      skillsDir,
      plannedFiles,
      planned_files: plannedFiles,
      estimatedTokenSavings: estimatedSavings,
      estimated_token_savings: estimatedSavings,
      skillsIndex,
      seams: effectiveProfile.seams,
      profile: effectiveProfile,
      tokenGuard,
      token_guard: tokenGuard,
      backupCreated: false,
    };
  }

  // Non-destructive overwrite protection
  let backupCreated = false;
  if (fs.existsSync(agentsPath)) {
    if (!options.force) {
      throw new Error(`'AGENTS.md' already exists at ${agentsPath}. Use --force (-f) to overwrite.`);
    }
    // Backup existing AGENTS.md
    fs.copyFileSync(agentsPath, backupPath);
    backupCreated = true;
  }

  // Ensure directories exist
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  // Write root AGENTS.md
  fs.writeFileSync(agentsPath, rootAgentsContent, "utf-8");

  // Write active skills
  for (const skillName of effectiveSkills) {
    const def = SKILL_DEFINITIONS[skillName];
    const skillFilePath = path.join(skillsDir, def.fileName);
    const skillContent = resolveSkillContent(skillName, { projectPath: root, profile: effectiveProfile });
    fs.writeFileSync(skillFilePath, skillContent, "utf-8");
  }

  return {
    status: "success",
    archetype: effectiveProfile.archetype,
    dryRun: false,
    rootAgentsPath: agentsPath,
    rootTokens,
    skillsDir,
    plannedFiles,
    planned_files: plannedFiles,
    estimatedTokenSavings: estimatedSavings,
    estimated_token_savings: estimatedSavings,
    skillsIndex,
    seams: effectiveProfile.seams,
    profile: effectiveProfile,
    tokenGuard,
    token_guard: tokenGuard,
    backupCreated,
    ...(backupCreated ? { backupPath } : {}),
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Cognitive Context Linter & Turn-Zero Prompt Simulator (SPEC-22)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CognitiveRuleId =
  | "token-budget"
  | "dead-skills"
  | "negative-phrasing-trap"
  | "permissive-leak"
  | "greedy-preload";

export type CognitiveViolationSeverity = "fail" | "warn" | "pass";

export interface CognitiveViolation {
  id: string;
  ruleId: CognitiveRuleId;
  rule_id?: CognitiveRuleId;
  severity: CognitiveViolationSeverity;
  message: string;
  file: string;
  line?: number;
  snippet?: string;
  suggestion?: string;
  metadata?: Record<string, unknown>;
}

export interface CognitiveAuditSummary {
  totalRules: number;
  total_rules?: number;
  failedCount: number;
  failed_count?: number;
  warnCount: number;
  warn_count?: number;
  passedCount: number;
  passed_count?: number;
  estimatedTokens: number;
  estimated_tokens?: number;
  targetPath: string;
  target_path?: string;
  scannedFiles: string[];
  scanned_files?: string[];
}

export interface CognitiveAuditResult {
  score: number; // 0..100
  healthScore?: number;
  health_score?: number;
  passed: boolean;
  passedStrict: boolean;
  passed_strict?: boolean;
  violations: CognitiveViolation[];
  summary: CognitiveAuditSummary;
  durationMs: number;
  duration_ms?: number;
}

export interface CognitiveAuditOptions {
  strict?: boolean;
  json?: boolean;
  projectPath?: string;
  maxTokens?: number; // default: 250
  warnTokens?: number; // default: 200
  maxNegativePhrases?: number; // default: 3
  maxCodeBlockLines?: number; // default: 25
  permissivePhrases?: string[];
  includeTests?: boolean;
  exclude?: string | string[];
  excludePatterns?: string | string[];
}

/**
 * Audits root AI instruction files and cognitive context against anti-pattern rules.
 * Rule 1: token-budget (Ceiling: warn > 200 tokens, strict fail > 250 tokens).
 */
export function auditCognitiveContext(
  projectPath?: string,
  options?: CognitiveAuditOptions
): CognitiveAuditResult {
  const startTime = performance.now();
  const root = path.resolve(projectPath || options?.projectPath || process.cwd());
  const warnTokens = options?.warnTokens ?? TARGET_ROOT_AGENTS_TOKENS;
  const maxTokens = options?.maxTokens ?? MAX_ROOT_AGENTS_TOKENS;
  const maxNegativePhrases = options?.maxNegativePhrases ?? 3;

  let targetFile: string | null = null;
  const includeTests = options?.includeTests ?? false;
  const excludePatterns = normalizeExcludePatterns([
    ...(options?.exclude ? (Array.isArray(options.exclude) ? options.exclude : [options.exclude]) : []),
    ...(options?.excludePatterns ? (Array.isArray(options.excludePatterns) ? options.excludePatterns : [options.excludePatterns]) : []),
  ]);

  let rootDir = root;
  try {
    if (fs.existsSync(root) && !fs.statSync(root).isDirectory()) {
      rootDir = path.dirname(root);
    }
  } catch {}

  const gitignorePatterns = loadGitignorePatterns(rootDir);
  const babaIgnorePatterns = loadBabaIgnorePatterns(rootDir);

  const checkIsIgnored = (p: string): boolean => {
    const norm = p.replace(/\\/g, "/");
    const candidates = new Set<string>();
    candidates.add(norm);
    candidates.add(path.basename(p));

    const relToRoot = path.relative(rootDir, p).replace(/\\/g, "/");
    if (relToRoot) candidates.add(relToRoot);

    const fromCwd = path.relative(process.cwd(), p).replace(/\\/g, "/");
    if (fromCwd) candidates.add(fromCwd);

    let parentDir = path.dirname(rootDir);
    for (let depth = 0; depth < 4; depth++) {
      const relToParent = path.relative(parentDir, p).replace(/\\/g, "/");
      if (relToParent && !relToParent.startsWith("../")) {
        candidates.add(relToParent);
      }
      const nextParent = path.dirname(parentDir);
      if (nextParent === parentDir) break;
      parentDir = nextParent;
    }

    for (const cand of candidates) {
      if (
        isIgnoredFile(cand, {
          includeTests,
          excludePatterns,
          gitignorePatterns,
          babaIgnorePatterns,
        })
      ) {
        return true;
      }
    }
    return false;
  };

  if (checkIsIgnored(root)) {
    const durationMs = Number((performance.now() - startTime).toFixed(2));
    const summary: CognitiveAuditSummary = {
      totalRules: 5,
      total_rules: 5,
      failedCount: 0,
      failed_count: 0,
      warnCount: 0,
      warn_count: 0,
      passedCount: 5,
      passed_count: 5,
      estimatedTokens: 0,
      estimated_tokens: 0,
      targetPath: root,
      target_path: root,
      scannedFiles: [],
      scanned_files: [],
    };
    return {
      score: 100,
      healthScore: 100,
      health_score: 100,
      passed: true,
      passedStrict: true,
      passed_strict: true,
      violations: [],
      summary,
      durationMs,
      duration_ms: durationMs,
    };
  }

  if (fs.existsSync(root)) {
    try {
      const stat = fs.statSync(root);
      if (stat.isFile()) {
        targetFile = root;
      } else if (stat.isDirectory()) {
        const candidateNames = ["AGENTS.md", ".cursorrules", "CLAUDE.md"];
        for (const candidate of candidateNames) {
          const candidatePath = path.join(root, candidate);
          if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
            targetFile = candidatePath;
            break;
          }
        }
      }
    } catch {}
  }

  if (targetFile && checkIsIgnored(targetFile)) {
    const durationMs = Number((performance.now() - startTime).toFixed(2));
    const summary: CognitiveAuditSummary = {
      totalRules: 5,
      total_rules: 5,
      failedCount: 0,
      failed_count: 0,
      warnCount: 0,
      warn_count: 0,
      passedCount: 5,
      passed_count: 5,
      estimatedTokens: 0,
      estimated_tokens: 0,
      targetPath: root,
      target_path: root,
      scannedFiles: [],
      scanned_files: [],
    };
    return {
      score: 100,
      healthScore: 100,
      health_score: 100,
      passed: true,
      passedStrict: true,
      passed_strict: true,
      violations: [],
      summary,
      durationMs,
      duration_ms: durationMs,
    };
  }

  // Graceful failure when root instruction file does not exist
  if (!targetFile || !fs.existsSync(targetFile)) {
    const fileChecked = path.join(root, "AGENTS.md");
    const durationMs = Number((performance.now() - startTime).toFixed(2));
    const violation: CognitiveViolation = {
      id: "token-budget-missing",
      ruleId: "token-budget",
      rule_id: "token-budget",
      severity: "fail",
      message: `Root instruction file (AGENTS.md) not found at ${root}`,
      file: fileChecked,
      suggestion: "Run 'baba agents generate' to scaffold an ultra-lean AGENTS.md and modular skills."
    };
    const summary: CognitiveAuditSummary = {
      totalRules: 5,
      total_rules: 5,
      failedCount: 1,
      failed_count: 1,
      warnCount: 0,
      warn_count: 0,
      passedCount: 4,
      passed_count: 4,
      estimatedTokens: 0,
      estimated_tokens: 0,
      targetPath: root,
      target_path: root,
      scannedFiles: [],
      scanned_files: []
    };
    const score = Math.max(0, 100 - 15);
    return {
      score,
      healthScore: score,
      health_score: score,
      passed: false,
      passedStrict: false,
      passed_strict: false,
      violations: [violation],
      summary,
      durationMs,
      duration_ms: durationMs
    };
  }

  const content = fs.readFileSync(targetFile, "utf-8");
  const estimatedTokens = estimateTokens(content);
  const scannedFiles = [targetFile];
  const violations: CognitiveViolation[] = [];

  // Rule 1: token-budget
  if (estimatedTokens > maxTokens) {
    violations.push({
      id: "token-budget-fail",
      ruleId: "token-budget",
      rule_id: "token-budget",
      severity: "fail",
      message: `Root instruction file exceeds strict token budget: ${estimatedTokens} tokens (maximum allowed: ${maxTokens} tokens, exceeded by ${estimatedTokens - maxTokens} tokens).`,
      file: targetFile,
      suggestion: "Offload detailed instructions into modular skills in .agents/skills/ using 'baba agents generate'."
    });
  } else if (estimatedTokens > warnTokens) {
    violations.push({
      id: "token-budget-warn",
      ruleId: "token-budget",
      rule_id: "token-budget",
      severity: "warn",
      message: `Root instruction file approaches token budget ceiling: ${estimatedTokens} tokens (warning threshold: ${warnTokens} tokens, maximum allowed: ${maxTokens} tokens).`,
      file: targetFile,
      suggestion: "Consider offloading secondary instructions into .agents/skills/ to keep turn-zero overhead minimal."
    });
  }

  // Rule 2: dead-skills (Broken Reference Detector for .agents/skills/*.md)
  const baseDir = fs.existsSync(root) && fs.statSync(root).isDirectory()
    ? root
    : path.dirname(targetFile);
  const skillRegex = /(?:(?:\.\/|\.\.\/)?(?:\.agents\/skills\/|skills\/))([a-zA-Z0-9_\-\.]+)\.md/g;
  const lines = content.split("\n");
  const seenDeadSkills = new Set<string>();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineContent = lines[lineIndex];
    if (typeof lineContent !== "string") {
      continue;
    }
    const matches = lineContent.matchAll(skillRegex);
    for (const match of matches) {
      const rawRef = match[0];
      const skillBaseName = match[1];
      if (!skillBaseName) {
        continue;
      }
      const skillFileName = `${skillBaseName}.md`;

      const candidatePaths = [
        path.resolve(baseDir, rawRef),
        path.resolve(baseDir, ".agents", "skills", skillFileName),
        path.resolve(baseDir, "skills", skillFileName)
      ];

      const existsOnDisk = candidatePaths.some((cand) => {
        try {
          return fs.existsSync(cand) && fs.statSync(cand).isFile();
        } catch {
          return false;
        }
      });

      if (!existsOnDisk && !seenDeadSkills.has(skillFileName)) {
        seenDeadSkills.add(skillFileName);
        const skillSlug = skillBaseName;
        violations.push({
          id: `dead-skills-${skillSlug}`,
          ruleId: "dead-skills",
          rule_id: "dead-skills",
          severity: "fail",
          message: `Referenced skill file does not exist on disk: ${skillFileName} (referenced as '${rawRef}').`,
          file: targetFile,
          line: lineIndex + 1,
          snippet: lineContent.trim(),
          suggestion: `Create missing skill at '.agents/skills/${skillFileName}' or run 'baba agents generate' to scaffold missing skills.`,
          metadata: {
            skill: skillFileName,
            skillName: skillFileName,
            reference: rawRef,
            expectedPath: path.join(".agents", "skills", skillFileName)
          }
        });
      }
    }
  }

  // Rule 3: negative-phrasing-trap (Pink Elephant Paradox guard)
  const prohibitiveRegex =
    /\b(do\s+not|never|don['’]?t|prohibited|prohibit|must\s+not|cannot|can\s+not|can['’]?t)\b/gi;

  interface SectionInfo {
    name: string;
    startLine: number;
    lines: { lineNumber: number; content: string }[];
  }

  const sections: SectionInfo[] = [];
  let currentSection: SectionInfo = {
    name: "Root Instructions",
    startLine: 1,
    lines: []
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (typeof rawLine !== "string") {
      continue;
    }
    const headingMatch = rawLine.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch && headingMatch[1]) {
      if (currentSection.lines.length > 0 || currentSection.name !== "Root Instructions") {
        sections.push(currentSection);
      }
      currentSection = {
        name: headingMatch[1].trim(),
        startLine: i + 1,
        lines: [{ lineNumber: i + 1, content: rawLine }]
      };
    } else {
      currentSection.lines.push({ lineNumber: i + 1, content: rawLine });
    }
  }
  if (currentSection.lines.length > 0 || sections.length === 0) {
    sections.push(currentSection);
  }

  const seenTrapIds = new Set<string>();

  for (let sIndex = 0; sIndex < sections.length; sIndex++) {
    const sec = sections[sIndex];
    if (!sec) {
      continue;
    }
    let matchCount = 0;
    const matchedKeywords: string[] = [];
    let firstLine: number | undefined;
    let firstSnippet: string | undefined;

    for (const l of sec.lines) {
      const lineMatches = Array.from(l.content.matchAll(prohibitiveRegex));
      if (lineMatches.length > 0) {
        if (firstLine === undefined) {
          firstLine = l.lineNumber;
          firstSnippet = l.content.trim();
        }
        for (const m of lineMatches) {
          const matchedText = m[0];
          if (matchedText) {
            matchCount++;
            matchedKeywords.push(matchedText);
          }
        }
      }
    }

    if (matchCount > maxNegativePhrases) {
      const sectionSlug =
        sec.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "root";

      let trapId = `negative-phrasing-trap-${sectionSlug}`;
      if (seenTrapIds.has(trapId)) {
        trapId = `${trapId}-${sIndex + 1}`;
      }
      seenTrapIds.add(trapId);

      violations.push({
        id: trapId,
        ruleId: "negative-phrasing-trap",
        rule_id: "negative-phrasing-trap",
        severity: "warn",
        message: `Section "${sec.name}" contains ${matchCount} prohibitive phrases (threshold: ${maxNegativePhrases}), triggering the Pink Elephant Paradox.`,
        file: targetFile,
        line: firstLine,
        snippet: firstSnippet,
        suggestion:
          "Reformulate negative prohibitions into positive behavioral constraints using anchors such as 'PREFER', 'USE', 'ENFORCE', or 'ALWAYS' to avoid the Pink Elephant Paradox.",
        metadata: {
          section: sec.name,
          count: matchCount,
          threshold: maxNegativePhrases,
          keywords: matchedKeywords,
          prohibitiveKeywords: matchedKeywords,
          positiveAnchors: ["PREFER", "USE", "ENFORCE", "ALWAYS"],
          positive_anchors: ["PREFER", "USE", "ENFORCE", "ALWAYS"]
        }
      });
    }
  }

  // Rule 4: permissive-leak (Detects wishy-washy language in imperative directive contexts)
  const permissiveRegex =
    options?.permissivePhrases && options.permissivePhrases.length > 0
      ? new RegExp(
          `\\b(${options.permissivePhrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
          "gi"
        )
      : /\b(try(?:\s+not)?\s+to|if\s+possible|consider|maybe|ideally|(?:we\s+)?usually\s+prefer|if\s+feasible|if\s+you\s+can|might\s+want\s+to|could\s+possibly)\b/gi;

  const seenLeakIds = new Set<string>();
  let inCodeBlock = false;

  for (let sIndex = 0; sIndex < sections.length; sIndex++) {
    const sec = sections[sIndex];
    if (!sec) {
      continue;
    }

    for (const l of sec.lines) {
      const trimmed = l.content.trim();
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) {
        continue;
      }

      const matches = Array.from(l.content.matchAll(permissiveRegex));
      for (let mIndex = 0; mIndex < matches.length; mIndex++) {
        const match = matches[mIndex];
        if (!match) {
          continue;
        }
        const matchedText = match[0];
        if (!matchedText) {
          continue;
        }

        const normalizedPhrase = matchedText.toLowerCase();
        const leakSlug = normalizedPhrase.replace(/[^a-z0-9]+/g, "-");
        let leakId = `permissive-leak-${leakSlug}-${l.lineNumber}`;
        if (seenLeakIds.has(leakId)) {
          leakId = `${leakId}-${mIndex + 1}`;
        }
        seenLeakIds.add(leakId);

        const sectionMsg =
          sec.name && sec.name !== "Root Instructions"
            ? ` in section "${sec.name}"`
            : "";

        violations.push({
          id: leakId,
          ruleId: "permissive-leak",
          rule_id: "permissive-leak",
          severity: "warn",
          message: `Permissive language detected${sectionMsg}: "${matchedText}" (${normalizedPhrase}). Directives must use definitive imperatives rather than ambiguous, non-binding suggestions.`,
          file: targetFile,
          line: l.lineNumber,
          snippet: l.content.trim(),
          suggestion: `Replace permissive phrasing '${matchedText}' (${normalizedPhrase}) with definitive imperatives (e.g., 'ALWAYS', 'MUST', 'ENFORCE', 'REQUIRE') or explicit conditional contracts.`,
          metadata: {
            phrase: matchedText,
            match: matchedText,
            matchedText: matchedText,
            matchedPhrase: matchedText,
            matched_phrase: matchedText,
            normalizedPhrase,
            section: sec.name,
            suggestedImperatives: ["ALWAYS", "MUST", "ENFORCE", "REQUIRE"],
            suggested_imperatives: ["ALWAYS", "MUST", "ENFORCE", "REQUIRE"]
          }
        });
      }
    }
  }

  // Rule 5: greedy-preload (Identifies large raw code/schema dumps > 25 lines)
  const maxCodeBlockLines = options?.maxCodeBlockLines ?? MAX_CODE_BLOCK_LINES;
  const isStrict = options?.strict === true;
  const seenGreedyIds = new Set<string>();

  let inFencedBlock = false;
  let fenceChars = "";
  let fenceMinLength = 3;
  let codeBlockStartLine = 0;
  let codeBlockLanguage: string | undefined = undefined;
  let codeBlockLinesCount = 0;
  let codeBlockSnippet = "";

  let inTableBlock = false;
  let tableStartLine = 0;
  let tableLinesCount = 0;
  let tableSnippet = "";

  const recordGreedyViolation = (
    type: "code-block" | "table",
    startLine: number,
    linesCount: number,
    snippet: string,
    language?: string
  ) => {
    if (linesCount <= maxCodeBlockLines) {
      return;
    }
    const severity: CognitiveViolationSeverity = isStrict && linesCount > 50 ? "fail" : "warn";
    const sec = sections.slice().reverse().find((s) => s.startLine <= startLine);
    const sectionName = sec ? sec.name : "Root Instructions";
    const sectionMsg = sec && sec.name !== "Root Instructions" ? ` in section "${sec.name}"` : "";

    const typeSlug = type === "table" ? "table" : "code";
    let greedyId = `greedy-preload-${typeSlug}-line-${startLine}`;
    if (seenGreedyIds.has(greedyId)) {
      greedyId = `${greedyId}-${violations.length + 1}`;
    }
    seenGreedyIds.add(greedyId);

    const desc =
      type === "table"
        ? `Raw markdown table/schema dump starting at line ${startLine}`
        : `Raw code block (${language ? `${language} ` : ""}starting at line ${startLine})`;

    violations.push({
      id: greedyId,
      ruleId: "greedy-preload",
      rule_id: "greedy-preload",
      severity,
      message: `${desc}${sectionMsg} contains ${linesCount} lines, exceeding the ${maxCodeBlockLines}-line threshold (${linesCount} > ${maxCodeBlockLines}). Large raw code or schema preloads trigger cognitive attention dilution.`,
      file: targetFile,
      line: startLine,
      snippet,
      suggestion:
        "Move large code blocks, schemas, and extensive table dumps into dedicated modular skill files in '.agents/skills/' and reference them on-demand via markdown links to preserve Turn-Zero token efficiency.",
      metadata: {
        linesCount,
        lines_count: linesCount,
        lineCount: linesCount,
        line_count: linesCount,
        threshold: maxCodeBlockLines,
        type,
        language,
        section: sectionName,
        startLine,
        start_line: startLine
      }
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (typeof rawLine !== "string") {
      continue;
    }
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();

    // Check fenced code block
    if (inFencedBlock) {
      const closeRegex = new RegExp(`^\\s*${fenceChars[0]}{${fenceMinLength},}\\s*$`);
      if (closeRegex.test(rawLine)) {
        recordGreedyViolation(
          "code-block",
          codeBlockStartLine,
          codeBlockLinesCount,
          codeBlockSnippet,
          codeBlockLanguage
        );
        inFencedBlock = false;
        codeBlockLinesCount = 0;
      } else {
        codeBlockLinesCount++;
      }
      continue;
    }

    const fenceMatch = rawLine.match(/^\s*(```+|~~~+)(.*)$/);
    if (fenceMatch && fenceMatch[1]) {
      if (inTableBlock) {
        recordGreedyViolation("table", tableStartLine, tableLinesCount, tableSnippet);
        inTableBlock = false;
        tableLinesCount = 0;
      }

      inFencedBlock = true;
      fenceChars = fenceMatch[1];
      fenceMinLength = fenceMatch[1].length;
      codeBlockStartLine = lineNumber;
      codeBlockSnippet = trimmed;
      const rawLang = fenceMatch[2]?.trim();
      codeBlockLanguage = rawLang ? rawLang.split(/\s+/)[0] : undefined;
      codeBlockLinesCount = 0;
      continue;
    }

    // Markdown table detection outside fenced blocks
    const isTableRow = /^\s*\|.*\|\s*$/.test(rawLine);
    if (isTableRow) {
      if (!inTableBlock) {
        inTableBlock = true;
        tableStartLine = lineNumber;
        tableSnippet = trimmed;
        tableLinesCount = 1;
      } else {
        tableLinesCount++;
      }
    } else {
      if (inTableBlock) {
        recordGreedyViolation("table", tableStartLine, tableLinesCount, tableSnippet);
        inTableBlock = false;
        tableLinesCount = 0;
      }
    }
  }

  // Handle unclosed blocks at EOF
  if (inFencedBlock) {
    recordGreedyViolation(
      "code-block",
      codeBlockStartLine,
      codeBlockLinesCount,
      codeBlockSnippet,
      codeBlockLanguage
    );
  }
  if (inTableBlock) {
    recordGreedyViolation("table", tableStartLine, tableLinesCount, tableSnippet);
  }

  const failedViolations = violations.filter((v) => v.severity === "fail");
  const warnViolations = violations.filter((v) => v.severity === "warn");

  const failedCount = failedViolations.length;
  const warnCount = warnViolations.length;
  const totalRules = 5;
  const passedCount = Math.max(0, totalRules - failedCount - warnCount);

  // Health score calculation: Base 100, -15 per FAIL, -5 per WARN
  const totalPenalties = failedCount * 15 + warnCount * 5;
  const score = Math.max(0, 100 - totalPenalties);

  const passed = failedCount === 0 && score >= 75;
  const passedStrict = failedCount === 0 && score >= 80;

  const summary: CognitiveAuditSummary = {
    totalRules,
    total_rules: totalRules,
    failedCount,
    failed_count: failedCount,
    warnCount,
    warn_count: warnCount,
    passedCount,
    passed_count: passedCount,
    estimatedTokens,
    estimated_tokens: estimatedTokens,
    targetPath: root,
    target_path: root,
    scannedFiles,
    scanned_files: scannedFiles
  };

  const durationMs = Number((performance.now() - startTime).toFixed(2));

  return {
    score,
    healthScore: score,
    health_score: score,
    passed,
    passedStrict,
    passed_strict: passedStrict,
    violations,
    summary,
    durationMs,
    duration_ms: durationMs
  };
}

/**
 * Formats cognitive audit result into human-readable terminal output with severity badges and gauges.
 */
export function formatCognitiveAuditHumanOutput(
  result: CognitiveAuditResult,
  targetDisplayPath?: string
): string {
  const lines: string[] = [];

  lines.push(pc.bold(pc.cyan("\n🪆 Matryoshka Cognitive Context Linter (baba agents audit)")));
  lines.push(`  ${pc.dim("•")} ${pc.bold("Target Path:")}      ${targetDisplayPath || result.summary.targetPath}`);

  let scoreColor = pc.red;
  let statusBadge = pc.red("FAIL (diluted attention risk)");
  if (result.score >= 90) {
    scoreColor = pc.green;
    statusBadge = pc.green("PASS (optimal)");
  } else if (result.score >= 75) {
    scoreColor = pc.yellow;
    statusBadge = pc.yellow("WARN (acceptable with warnings)");
  }

  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Health Score:")}     ${scoreColor(
      `${result.score} / 100`
    )} [${statusBadge}]`
  );

  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Estimated Tokens:")} ${result.summary.estimatedTokens} (budget: 200 warn, 250 fail)`
  );
  lines.push(
    `  ${pc.dim("•")} ${pc.bold("Rules Audited:")}    ${result.summary.totalRules} (fail: ${result.summary.failedCount}, warn: ${result.summary.warnCount}, pass: ${result.summary.passedCount})`
  );

  if (result.violations.length > 0) {
    lines.push(pc.bold(pc.cyan("\n⚠️  Cognitive Antipattern Violations:")));
    for (const v of result.violations) {
      const badge =
        v.severity === "fail"
          ? pc.bgRed(pc.white(" FAIL "))
          : pc.bgYellow(pc.black(" WARN "));
      const loc = v.line ? `:${v.line}` : "";
      lines.push(`  ${badge} ${pc.bold(v.ruleId)} ${pc.dim(`(${v.file}${loc})`)}`);
      lines.push(`     ${v.message}`);
      if (v.snippet) {
        lines.push(`     ${pc.dim("Snippet:")} ${pc.italic(v.snippet)}`);
      }
      if (v.suggestion) {
        lines.push(`     ${pc.cyan("Suggestion:")} ${v.suggestion}`);
      }
    }
  } else {
    lines.push(pc.green("\n  ✨ No cognitive antipatterns detected. Prompt context is optimal."));
  }

  lines.push(`\n  ${pc.dim(`Completed in ${result.durationMs}ms`)}\n`);
  return lines.join("\n");
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Non-Destructive Legacy AGENTS.md Migration Engine (SPEC-23)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ExtractLegacySkillsOptions {
  migratedAt?: string;
  extractSubSkills?: boolean;
}

/**
 * Extracts legacy instruction content into active modular skills.
 * Enforces Zero-Loss Domain Preservation: 100% of historical rules and conventions
 * are preserved in the body of '.agents/skills/legacy-knowledge.md'.
 * When structured headers exist (e.g. Database, Frontend, Security, Testing, Conventions),
 * granular domain sub-skills are also extracted with YAML frontmatter stamped.
 */
export function extractLegacySkills(
  legacyContent: string,
  options?: ExtractLegacySkillsOptions
): ExtractedSkill[] {
  const migratedAt = options?.migratedAt || new Date().toISOString();
  let rawBody = legacyContent.trim();

  // Strip existing frontmatter if present to avoid recursive frontmatter nesting
  const frontmatterMatch = rawBody.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  if (frontmatterMatch && frontmatterMatch[1]) {
    rawBody = frontmatterMatch[1].trim();
  }

  // 1. Primary modular skill (.agents/skills/legacy-knowledge.md)
  // Zero-Loss Invariant: 100% of the original domain rules and conventions are preserved in the skill body.
  const primaryBody = `# 📜 Legacy Project Knowledge & Historical Conventions

The following directives were migrated from the previous monolithic instruction file.
Load and adhere to these guidelines when modifying legacy modules or domain-specific workflows:

${rawBody}`;

  const primaryDescription =
    "Preserved historical domain knowledge, architecture quirks, and legacy conventions migrated from existing project rules.";

  const primaryContent = stampLegacySkillFrontmatter(primaryBody, {
    name: "legacy-knowledge",
    description: primaryDescription,
    origin: "legacy_migration",
    migratedAt,
  });

  const primarySkill: ExtractedSkill = {
    name: "legacy-knowledge",
    relativePath: ".agents/skills/legacy-knowledge.md",
    description: primaryDescription,
    origin: "legacy_migration",
    migratedAt,
    content: primaryContent,
    estimatedTokens: estimateTokens(primaryContent),
  };

  const extractedSkills: ExtractedSkill[] = [primarySkill];

  if (options?.extractSubSkills === false) {
    return extractedSkills;
  }

  // 2. Structured Domain Sub-Skills Segmentation
  const lines = rawBody.split(/\r?\n/);
  interface RawSection {
    title: string;
    level: number;
    lines: string[];
  }

  const sections: RawSection[] = [];
  let currentSection: RawSection | null = null;
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      if (currentSection) currentSection.lines.push(line);
      continue;
    }

    if (!inCodeBlock) {
      const headerMatch = line.match(/^(#{1,2})\s+(.+)$/);
      if (headerMatch && headerMatch[1] && headerMatch[2]) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: headerMatch[2].trim(),
          level: headerMatch[1].length,
          lines: [],
        };
        continue;
      }
    }

    if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  interface DomainMatcher {
    key: string;
    domain: string;
    title: string;
    description: string;
    pattern: RegExp;
  }

  const domainMatchers: DomainMatcher[] = [
    {
      key: "legacy-database",
      domain: "database",
      title: "Legacy Database & Schemas",
      description:
        "Preserved historical database guidelines, schema rules, and migration conventions migrated from existing project rules.",
      pattern: /\b(database|db|sql|migration|migrations|schema|schemas|orm|prisma|drizzle|postgres|mysql|sqlite)\b/i,
    },
    {
      key: "legacy-frontend",
      domain: "frontend",
      title: "Legacy Frontend & UI",
      description:
        "Preserved historical frontend conventions, UI components, and styling rules migrated from existing project rules.",
      pattern: /\b(frontend|ui|styling|css|tailwind|components|react|vue|svelte|html)\b/i,
    },
    {
      key: "legacy-backend",
      domain: "backend",
      title: "Legacy Backend & APIs",
      description:
        "Preserved historical backend architecture, API patterns, and routing conventions migrated from existing project rules.",
      pattern: /\b(backend|api|server|endpoints|controllers|services|routing)\b/i,
    },
    {
      key: "legacy-security",
      domain: "security",
      title: "Legacy Security & Authentication",
      description:
        "Preserved historical security guidelines, auth patterns, and data protection rules migrated from existing project rules.",
      pattern: /\b(security|auth|authentication|authorization|dlp|owasp|secrets|permissions)\b/i,
    },
    {
      key: "legacy-testing",
      domain: "testing",
      title: "Legacy Testing & Verification",
      description:
        "Preserved historical testing guidelines, verification protocols, and fixture conventions migrated from existing project rules.",
      pattern: /\b(testing|test|tests|tdd|bdd|e2e|fixtures|mocks)\b/i,
    },
    {
      key: "legacy-conventions",
      domain: "conventions",
      title: "Legacy Coding Conventions",
      description:
        "Preserved historical coding conventions, style rules, and workflow standards migrated from existing project rules.",
      pattern: /\b(convention|conventions|code style|coding standards|code style guidelines|guidelines|git workflow|commit rules|best practices)\b/i,
    },
  ];

  const domainBuckets = new Map<string, { matcher: DomainMatcher; contentLines: string[] }>();

  for (const section of sections) {
    const titleLower = section.title.toLowerCase();
    const meaningfulLines = section.lines.filter((l) => l.trim().length > 0);
    if (meaningfulLines.length === 0) continue;

    for (const matcher of domainMatchers) {
      if (matcher.pattern.test(titleLower)) {
        if (!domainBuckets.has(matcher.key)) {
          domainBuckets.set(matcher.key, {
            matcher,
            contentLines: [],
          });
        }
        const bucket = domainBuckets.get(matcher.key)!;
        bucket.contentLines.push(`## ${section.title}`, ...section.lines, "");
        break; // Match first specific domain
      }
    }
  }

  for (const [key, bucket] of domainBuckets.entries()) {
    const bodyContent = bucket.contentLines.join("\n").trim();
    if (!bodyContent) continue;

    const subBody = `# 📜 ${bucket.matcher.title}

The following directives were extracted from historical project instructions for domain '${bucket.matcher.domain}':

${bodyContent}`;

    const subContent = stampLegacySkillFrontmatter(subBody, {
      name: key,
      description: bucket.matcher.description,
      origin: "legacy_migration",
      migratedAt,
    });

    extractedSkills.push({
      name: key,
      relativePath: `.agents/skills/${key}.md`,
      description: bucket.matcher.description,
      origin: "legacy_migration",
      migratedAt,
      content: subContent,
      estimatedTokens: estimateTokens(subContent),
    });
  }

  return extractedSkills;
}

export const LEGACY_SKILL_TITLES: Record<string, string> = {
  "legacy-knowledge": "Preserved Legacy Knowledge",
  "legacy-database": "Legacy Database",
  "legacy-frontend": "Legacy Frontend",
  "legacy-backend": "Legacy Backend",
  "legacy-security": "Legacy Security",
  "legacy-testing": "Legacy Testing",
  "legacy-conventions": "Legacy Conventions",
};

/**
 * Compiles a pristine, canonical lean root AGENTS.md strictly under 200 tokens
 * that registers and links to extracted legacy skills in its modular catalog.
 */
export function compileMigratedRootAgents(
  profile: ArchetypeProfile | RootAgentsProfileInput,
  extractedSkills: ExtractedSkill[] = [],
  options?: MigratedRootAgentsOptions
): string {
  const sanitizeCmd = (cmd?: string): string => {
    if (!cmd) return "none";
    const cleaned = cmd.trim().replace(/\s+/g, " ");
    return cleaned.length > 0 ? cleaned : "none";
  };

  const runtime = profile.runtime?.trim() || "unknown";
  const packageManager = profile.packageManager?.trim() || "unknown";
  const testCommand = sanitizeCmd(profile.testCommand);
  const buildCommand = sanitizeCmd(profile.buildCommand);
  const lintCommand = sanitizeCmd(profile.lintCommand);

  const skillsToFormat =
    extractedSkills.length > 0
      ? extractedSkills
      : [
          {
            name: "legacy-knowledge",
            relativePath: ".agents/skills/legacy-knowledge.md",
          },
        ];

  const legacySkillsList = skillsToFormat
    .map((s) => {
      const title = LEGACY_SKILL_TITLES[s.name] || s.name;
      return `* ${title}: \`${s.relativePath}\``;
    })
    .join("\n");

  const content = `# 🤖 Project Operational Directives

## 🌐 Stack & Identity
* **Archetype:** ${profile.archetype}
* **Runtime:** ${runtime} (${packageManager})
* **Test Runner:** \`${testCommand}\`
* **Build / Lint:** \`${buildCommand}\` | \`${lintCommand}\`

## 🛡️ Anti-Slop Core Invariants
* **YAGNI & DRY First:** Prefer simple composable functions over speculative class hierarchies.
* **No Unprompted Refactoring:** Preserve working patterns; surgical edits only.
* **Verification First:** Never declare completion without executing test suite evidence.

## 🧭 On-Demand Specialized Skills
Load specialized guidelines only when touching respective domains:
${legacySkillsList}
`;

  const maxTokens = options?.maxTokens ?? 200;
  if (options?.strictTokenGuard) {
    assertTokenBudget(content, maxTokens);
  }

  return content;
}

/**
 * Main migration engine to safely parse monolithic legacy instruction files,
 * encapsulate historical domain context into modular skills (.agents/skills/legacy-knowledge.md),
 * and assemble a lean root AGENTS.md (< 200 tokens).
 */
export function migrateLegacyInstructions(
  projectPath: string = process.cwd(),
  options: LegacyMigrationOptions = {}
): LegacyMigrationResult {
  const startTime = performance.now();
  let root = path.resolve(projectPath);
  let sourceFileName = options.from;

  if (fs.existsSync(root) && fs.statSync(root).isFile()) {
    if (!sourceFileName) {
      sourceFileName = path.basename(root);
    }
    root = path.dirname(root);
  }

  sourceFileName = sourceFileName || "AGENTS.md";
  let sourceFilePath: string;
  if (path.isAbsolute(sourceFileName)) {
    sourceFilePath = sourceFileName;
    if (projectPath === process.cwd()) {
      root = path.dirname(sourceFilePath);
    }
  } else {
    sourceFilePath = path.join(root, sourceFileName);
  }

  const rootAgentsPath = path.join(root, "AGENTS.md");
  const backupPath = `${sourceFilePath}.bak`;

  if (!fs.existsSync(sourceFilePath)) {
    const durationMs = Number((performance.now() - startTime).toFixed(2));
    return {
      success: false,
      status: "error",
      sourceFile: sourceFilePath,
      backupPath,
      backupCreated: false,
      rootAgentsPath,
      rootAgentsTokens: 0,
      extractedSkills: [],
      tokenSavings: {
        beforeTokens: 0,
        afterTokens: 0,
        savedTokens: 0,
        reductionPercentage: 0,
      },
      dryRun: Boolean(options.dryRun),
      durationMs,
      error: `Source instruction file not found at ${sourceFilePath}`,
    };
  }

  const rawContent = fs.readFileSync(sourceFilePath, "utf-8");
  const beforeTokens = estimateTokens(rawContent);

  // Idempotency check: if origin: legacy_migration is already present and not force
  if (!options.force && rawContent.includes("origin: legacy_migration")) {
    const durationMs = Number((performance.now() - startTime).toFixed(2));
    return {
      success: true,
      status: "unchanged",
      sourceFile: sourceFilePath,
      backupPath,
      backupCreated: false,
      rootAgentsPath,
      rootAgentsTokens: beforeTokens,
      extractedSkills: [],
      tokenSavings: {
        beforeTokens,
        afterTokens: beforeTokens,
        savedTokens: 0,
        reductionPercentage: 0,
      },
      dryRun: Boolean(options.dryRun),
      durationMs,
    };
  }

  // Check if backup snapshot already exists and force is not enabled
  if (!options.dryRun && fs.existsSync(backupPath) && !options.force) {
    const durationMs = Number((performance.now() - startTime).toFixed(2));
    return {
      success: false,
      status: "error",
      sourceFile: sourceFilePath,
      backupPath,
      backupCreated: false,
      rootAgentsPath,
      rootAgentsTokens: 0,
      extractedSkills: [],
      tokenSavings: {
        beforeTokens,
        afterTokens: beforeTokens,
        savedTokens: 0,
        reductionPercentage: 0,
      },
      dryRun: false,
      durationMs,
      error: `Backup snapshot already exists at ${backupPath}. Use --force (-f) to overwrite.`,
    };
  }

  const extractedSkills = extractLegacySkills(rawContent);

  // Profile project to compile lean root AGENTS.md
  let profile: ArchetypeProfile;
  try {
    profile = profileArchetype(root);
  } catch {
    profile = {
      archetype: "api_backend",
      runtime: "bun",
      packageManager: "bun",
      testCommand: "bun test",
      buildCommand: "bun run build",
      lintCommand: "none",
      activeSkills: ["skill-backend", "skill-database", "skill-security", "skill-testing"],
      seams: {
        hasBackend: true,
        hasFrontend: false,
        hasDatabase: true,
        hasSecurity: true,
        hasTesting: true,
        routes: [],
        models: [],
        controllers: [],
        services: [],
        views: [],
        tests: [],
      },
    };
  }

  // Compile lean root AGENTS.md referencing legacy skills (< 200 tokens)
  const maxRootTokens = options.maxRootTokens ?? 200;
  const rootAgentsContent = compileMigratedRootAgents(profile, extractedSkills, {
    maxTokens: maxRootTokens,
    strictTokenGuard: options.strictTokenGuard,
  });

  const rootAgentsTokens = estimateTokens(rootAgentsContent);
  const savedTokens = Math.max(0, beforeTokens - rootAgentsTokens);
  const reductionPercentage =
    beforeTokens > 0 ? Math.round((savedTokens / beforeTokens) * 100) : 0;

  const tokenSavings: TokenSavingsSummary = {
    beforeTokens,
    afterTokens: rootAgentsTokens,
    savedTokens,
    reductionPercentage,
  };

  const durationMs = Number((performance.now() - startTime).toFixed(2));

  // If dry-run, do not write to disk
  if (options.dryRun) {
    return {
      success: true,
      status: "simulated",
      sourceFile: sourceFilePath,
      backupPath,
      backupCreated: false,
      rootAgentsPath,
      rootAgentsTokens,
      extractedSkills,
      tokenSavings,
      dryRun: true,
      durationMs,
    };
  }

  // Atomic file write & backup
  // 1. Create byte-for-byte backup of source file
  fs.copyFileSync(sourceFilePath, backupPath);
  const backupCreated = true;

  // 2. Ensure .agents/skills exists
  const skillsDir = path.join(root, ".agents", "skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  // 3. Write each extracted skill to disk atomically
  for (const skill of extractedSkills) {
    const skillPath = path.join(root, skill.relativePath);
    const skillDir = path.dirname(skillPath);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    const tmpSkillPath = `${skillPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(tmpSkillPath, skill.content, "utf-8");
    fs.renameSync(tmpSkillPath, skillPath);
  }

  // 4. Write lean root AGENTS.md atomically
  const tmpRootPath = `${rootAgentsPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmpRootPath, rootAgentsContent, "utf-8");
  fs.renameSync(tmpRootPath, rootAgentsPath);

  return {
    success: true,
    status: "success",
    sourceFile: sourceFilePath,
    backupPath,
    backupCreated,
    rootAgentsPath,
    rootAgentsTokens,
    extractedSkills,
    tokenSavings,
    dryRun: false,
    durationMs,
  };
}

export function rollbackLegacyMigration(
  projectPath: string = process.cwd(),
  options: { from?: string } = {}
): LegacyRollbackResult {
  const startTime = performance.now();
  let root = path.resolve(projectPath);
  let sourceFileName = options.from;

  if (fs.existsSync(root) && fs.statSync(root).isFile()) {
    if (!sourceFileName) {
      sourceFileName = path.basename(root);
    }
    root = path.dirname(root);
  }

  sourceFileName = sourceFileName || "AGENTS.md";
  let sourceFilePath: string;
  if (path.isAbsolute(sourceFileName)) {
    sourceFilePath = sourceFileName;
    if (projectPath === process.cwd()) {
      root = path.dirname(sourceFilePath);
    }
  } else {
    sourceFilePath = path.join(root, sourceFileName);
  }
  const backupPath = `${sourceFilePath}.bak`;

  if (!fs.existsSync(backupPath)) {
    const durationMs = Number((performance.now() - startTime).toFixed(2));
    return {
      success: false,
      status: "error",
      restoredFile: sourceFilePath,
      backupFile: backupPath,
      durationMs,
      error: `Backup snapshot not found at ${backupPath}`,
    };
  }

  fs.copyFileSync(backupPath, sourceFilePath);
  const durationMs = Number((performance.now() - startTime).toFixed(2));

  return {
    success: true,
    status: "success",
    restoredFile: sourceFilePath,
    backupFile: backupPath,
    durationMs,
  };
}


