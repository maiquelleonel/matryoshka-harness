import * as fs from "node:fs";
import * as path from "node:path";
import { detectStack } from "./detector";
import type { PrimaryStack, ProjectStack } from "./types";

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
  | "skill-testing";

export interface SkillDefinition {
  name: SkillName;
  fileName: string;
  description: string;
  content: string;
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

export interface GenerateAgentsOptions {
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
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
  message?: string;
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
 * Deterministically profiles a repository and classifies it into a canonical archetype.
 */
export function profileArchetype(projectPath: string): {
  archetype: AgentArchetype;
  runtime: string;
  packageManager: string;
  testCommand: string;
  buildCommand: string;
  lintCommand: string;
  activeSkills: SkillName[];
} {
  const root = path.resolve(projectPath);
  const stack = detectStack(root);

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

  if (hasPython) {
    runtime = "python";
    packageManager = "pip";
    if (fs.existsSync(path.join(root, "poetry.lock"))) {
      packageManager = "poetry";
    } else if (fs.existsSync(path.join(root, "Pipfile"))) {
      packageManager = "pipenv";
    } else if (fs.existsSync(path.join(root, "uv.lock"))) {
      packageManager = "uv";
    }

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

    if (/django/i.test(pythonContent)) {
      archetype = "opinionated_monolith";
    } else {
      archetype = "api_backend";
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

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {})
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

    const hasFrontendFramework =
      "next" in allDeps ||
      "react" in allDeps ||
      "vue" in allDeps ||
      "svelte" in allDeps ||
      "@sveltejs/kit" in allDeps ||
      "nuxt" in allDeps ||
      "astro" in allDeps;

    const hasDatabaseOrBackend =
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

  // Determine active skill modules based on archetype
  const activeSkills: SkillName[] = [];
  switch (archetype) {
    case "api_backend":
      activeSkills.push("skill-backend", "skill-database", "skill-security", "skill-testing");
      break;
    case "fullstack_hybrid":
      activeSkills.push("skill-frontend", "skill-backend", "skill-database", "skill-security", "skill-testing");
      break;
    case "opinionated_monolith":
      activeSkills.push("skill-backend", "skill-database", "skill-security", "skill-testing");
      // Include frontend if templates/views or client directories exist
      if (
        fs.existsSync(path.join(root, "templates")) ||
        fs.existsSync(path.join(root, "views")) ||
        fs.existsSync(path.join(root, "static")) ||
        fs.existsSync(path.join(root, "frontend"))
      ) {
        activeSkills.unshift("skill-frontend");
      }
      break;
    case "reactive_frontend":
      activeSkills.push("skill-frontend", "skill-security", "skill-testing");
      break;
    case "systems_microservice":
      activeSkills.push("skill-backend", "skill-security", "skill-testing");
      break;
  }

  return {
    archetype,
    runtime,
    packageManager,
    testCommand,
    buildCommand,
    lintCommand,
    activeSkills
  };
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
    content: `---
name: skill-backend
description: Framework-idiomatic ORM patterns, transactional boundaries, anti-N+1 query prevention, and async persistence rules. Use when modifying models, controllers, repositories, or database queries.
---

# 🛠️ Backend Engineering Guidelines

## 1. Anti-N+1 Query Invariant
* Never issue queries inside loops. Use eager loading, join fetches, or batched loaders (DataLoader / select_related / prefetch_related / Prisma include).
* Explicitly define selection sets; avoid fetching unbounded columns or deep relation graphs.

## 2. Transactional Boundaries & Atomic Persistence
* Wrap multi-entity mutations inside explicit database transactions.
* Ensure idempotency on distributed endpoints with unique deduplication keys.
* Never leave open transactions across external HTTP calls or long-running async tasks.

## 3. Idiomatic Layer Seams
* Maintain separation between HTTP transport/controllers, business domain services, and persistence repositories.
* Fail fast with typed validation errors before touching domain logic or persistence.
`
  },
  "skill-database": {
    name: "skill-database",
    fileName: "skill-database.md",
    description:
      "Zero-downtime migrations, lock safety, column additions, and indexing strategies. Use when modifying database schemas, migrations, or table structures.",
    content: `---
name: skill-database
description: Zero-downtime migrations, lock safety, column additions, and indexing strategies. Use when modifying database schemas, migrations, or table structures.
---

# 🗄️ Database & Migration Guidelines

## 1. Zero-Downtime Migration Contract
* Never run destructive column drops or renames in a single release. Follow expand-and-contract phase transitions.
* New columns must be nullable or have safe defaults that do not trigger full-table rewrites.

## 2. Lock Safety & Non-Blocking DDL
* Create indexes concurrently (e.g., \`CREATE INDEX CONCURRENTLY\` in PostgreSQL).
* Set strict lock timeouts on migration transactions to prevent cascading connection pool exhaustion.
* Avoid heavy table locks during high-traffic operational windows.

## 3. Query & Index Hygiene
* Ensure all foreign keys and frequently filtered columns have supporting indexes.
* Audit query execution plans (EXPLAIN ANALYZE) before committing complex multi-table joins.
`
  },
  "skill-frontend": {
    name: "skill-frontend",
    fileName: "skill-frontend.md",
    description:
      "Reactivity best practices, layout shifts, pure rendering, accessibility standards (A11y), and state management. Use when modifying UI components, styling, or client-side logic.",
    content: `---
name: skill-frontend
description: Reactivity best practices, layout shifts, pure rendering, accessibility standards (A11y), and state management. Use when modifying UI components, styling, or client-side logic.
---

# 🎨 Frontend Engineering Guidelines

## 1. Pure Rendering & Reactivity Invariants
* Keep render functions pure and free of side effects; isolate mutations in event handlers or lifecycle seams.
* Colocate state as close as possible to the consumers to avoid broad sub-tree re-renders.

## 2. Cumulative Layout Shifts (CLS) & Performance
* Always specify explicit dimensions or aspect ratios for images, embeds, and dynamic placeholders.
* Avoid layout-shifting skeleton states or flash of unstyled/unauthenticated content.

## 3. Accessibility (A11y) & Semantic Markup
* Use native HTML semantic elements (\`<button>\`, \`<main>\`, \`<nav>\`, \`<article>\`) before ARIA overrides.
* Ensure keyboard navigability, focus rings, and high-contrast color ratios across all interactives.
`
  },
  "skill-security": {
    name: "skill-security",
    fileName: "skill-security.md",
    description:
      "OWASP Top 10 mitigation, strict input sanitization, secret leakage prevention, and defense-in-depth security invariants. Use when handling user input, authentication, authorization, or sensitive data.",
    content: `---
name: skill-security
description: OWASP Top 10 mitigation, strict input sanitization, secret leakage prevention, and defense-in-depth security invariants. Use when handling user input, authentication, authorization, or sensitive data.
---

# 🔒 Security & DLP Guidelines

## 1. Zero Secret Leakage Invariant
* Never hardcode API keys, JWT secrets, passwords, or private tokens in code, configs, or test fixtures.
* Always retrieve sensitive credentials via runtime environment variables or secure key vaults.

## 2. Strict Input Sanitization & Parameterization
* Parameterize all database queries without exception to eliminate SQL and NoSQL injection vectors.
* Sanitize user-provided HTML, URLs, and file uploads against XSS, SSRF, and directory traversal.

## 3. Authentication & Authorization Guardrails
* Apply least-privilege access control on all endpoints. Re-verify user ownership on resource access.
* Enforce CSRF protection and secure session cookies (\`HttpOnly\`, \`SameSite=Lax/Strict\`, \`Secure\`).
`
  },
  "skill-testing": {
    name: "skill-testing",
    fileName: "skill-testing.md",
    description:
      "The Seam contract, Red-to-Green TDD discipline, deterministic test fixtures, and mock isolation boundaries. Use when writing tests, refactoring, or verifying bugfixes.",
    content: `---
name: skill-testing
description: The Seam contract, Red-to-Green TDD discipline, deterministic test fixtures, and mock isolation boundaries. Use when writing tests, refactoring, or verifying bugfixes.
---

# 🧪 Testing & Verification Guidelines

## 1. The Seam Contract (Red-to-Green)
* Always produce a failing deterministic test (RED) proving the bug or missing capability before altering production code.
* Verify green state empirically through native test execution (\`bun test\`, \`pytest\`, \`cargo test\`, \`go test\`).

## 2. Deterministic Fixtures & Isolation
* Tests must run in full isolation; tests must never depend on shared mutable state or execution ordering.
* Clean up all temporary files, test databases, and mocked timers in \`afterEach\` / teardown hooks.

## 3. Mock Boundaries
* Only mock external system boundaries (network calls, external third-party APIs, clock shifts).
* Never mock the unit or domain logic under test. Prefer in-memory fakes over complex stubbing.
`
  }
};

const SKILL_TITLE_MAP: Record<SkillName, string> = {
  "skill-backend": "Backend & ORM",
  "skill-frontend": "Frontend & UI",
  "skill-database": "Database & Migrations",
  "skill-security": "Security & DLP",
  "skill-testing": "Testing & TDD"
};

/**
 * Compiles the ultra-lean root AGENTS.md index strictly under 250 tokens (< 200 target).
 */
export function compileRootAgents(profile: {
  archetype: AgentArchetype;
  runtime: string;
  packageManager: string;
  testCommand: string;
  buildCommand: string;
  lintCommand: string;
  activeSkills: SkillName[];
}): string {
  const skillsList = profile.activeSkills
    .map((skillName) => `* ${SKILL_TITLE_MAP[skillName]}: \`.agents/skills/${SKILL_DEFINITIONS[skillName].fileName}\``)
    .join("\n");

  return `# 🤖 Project Operational Directives

## 🌐 Stack & Identity
* **Archetype:** ${profile.archetype}
* **Runtime:** ${profile.runtime} (${profile.packageManager})
* **Test Runner:** \`${profile.testCommand}\`
* **Build / Lint:** \`${profile.buildCommand}\` | \`${profile.lintCommand}\`

## 🛡️ Anti-Slop Core Invariants
* **YAGNI & DRY First:** Prefer simple composable functions over speculative class hierarchies.
* **No Unprompted Refactoring:** Preserve existing working patterns; surgical edits only.
* **Verification First:** Never declare completion without executing test suite evidence.

## 🧭 On-Demand Specialized Skills
Load specialized guidelines only when touching respective domains:
${skillsList}
`;
}

/**
 * Main engine to generate adaptive AGENTS.md and modular skills.
 */
export function generateAgents(
  projectPath: string = process.cwd(),
  options: GenerateAgentsOptions = {}
): GenerateAgentsResult {
  const root = path.resolve(projectPath);
  const profile = profileArchetype(root);
  const rootAgentsContent = compileRootAgents(profile);
  const rootTokens = estimateTokens(rootAgentsContent);

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

  for (const skillName of profile.activeSkills) {
    const def = SKILL_DEFINITIONS[skillName];
    plannedFiles.push({
      path: path.join(".agents", "skills", def.fileName),
      tokens: estimateTokens(def.content),
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

  // Dry-run mode: do not touch disk
  if (options.dryRun) {
    return {
      status: "success",
      archetype: profile.archetype,
      dryRun: true,
      rootAgentsPath: agentsPath,
      rootTokens,
      skillsDir,
      plannedFiles,
      planned_files: plannedFiles,
      estimatedTokenSavings: estimatedSavings,
      estimated_token_savings: estimatedSavings
    };
  }

  // Non-destructive overwrite protection
  if (fs.existsSync(agentsPath)) {
    if (!options.force) {
      throw new Error(`'AGENTS.md' already exists at ${agentsPath}. Use --force (-f) to overwrite.`);
    }
    // Backup existing AGENTS.md
    fs.copyFileSync(agentsPath, backupPath);
  }

  // Ensure directories exist
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  // Write root AGENTS.md
  fs.writeFileSync(agentsPath, rootAgentsContent, "utf-8");

  // Write active skills
  for (const skillName of profile.activeSkills) {
    const def = SKILL_DEFINITIONS[skillName];
    const skillFilePath = path.join(skillsDir, def.fileName);
    fs.writeFileSync(skillFilePath, def.content, "utf-8");
  }

  return {
    status: "success",
    archetype: profile.archetype,
    dryRun: false,
    rootAgentsPath: agentsPath,
    rootTokens,
    skillsDir,
    plannedFiles,
    planned_files: plannedFiles,
    estimatedTokenSavings: estimatedSavings,
    estimated_token_savings: estimatedSavings
  };
}
