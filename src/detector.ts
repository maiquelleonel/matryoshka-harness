/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { ProjectStack, PrimaryStack, ProjectArchetype } from "./types";

interface ManifestContent {
  packageJson?: any;
  pyprojectToml?: string;
  requirementsTxt?: string;
  pipfile?: string;
  goMod?: string;
  cargoToml?: string;
  gemfile?: string;
  composerJson?: any;
}

/**
 * Inspects a project directory and detects its primary stack, frameworks, test runner, and archetype.
 * Operates in < 10ms through targeted manifest inspections.
 */
export function detectStack(projectPath: string = process.cwd()): ProjectStack {
  try {
    const root = path.resolve(projectPath);

    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return createFallbackStack();
    }

    // Check JS / TS manifest signatures
    const packageJsonPath = path.join(root, "package.json");
    const bunLockPath = path.join(root, "bun.lock");
    const bunLockbPath = path.join(root, "bun.lockb");
    const packageLockPath = path.join(root, "package-lock.json");

    if (
      fs.existsSync(packageJsonPath) ||
      fs.existsSync(bunLockPath) ||
      fs.existsSync(bunLockbPath) ||
      fs.existsSync(packageLockPath)
    ) {
      return detectJsTsStack(root, packageJsonPath);
    }

    // Check Python manifest signatures
    const pyprojectPath = path.join(root, "pyproject.toml");
    const requirementsPath = path.join(root, "requirements.txt");
    const pipfilePath = path.join(root, "Pipfile");

    if (
      fs.existsSync(pyprojectPath) ||
      fs.existsSync(requirementsPath) ||
      fs.existsSync(pipfilePath)
    ) {
      return detectPythonStack(root, pyprojectPath, requirementsPath, pipfilePath);
    }

    // Check Go manifest signature
    const goModPath = path.join(root, "go.mod");
    if (fs.existsSync(goModPath)) {
      return detectGoStack(goModPath);
    }

    // Check Rust manifest signature
    const cargoTomlPath = path.join(root, "Cargo.toml");
    if (fs.existsSync(cargoTomlPath)) {
      return detectRustStack(cargoTomlPath);
    }

    // Check Ruby manifest signature
    const gemfilePath = path.join(root, "Gemfile");
    if (fs.existsSync(gemfilePath)) {
      return detectRubyStack(root, gemfilePath);
    }

    // Check PHP manifest signature
    const composerJsonPath = path.join(root, "composer.json");
    if (fs.existsSync(composerJsonPath)) {
      return detectPhpStack(root, composerJsonPath);
    }

    return createFallbackStack();
  } catch {
    return createFallbackStack();
  }
}

function createFallbackStack(): ProjectStack {
  return {
    primary: "unknown",
    frameworks: [],
    testRunner: null,
    archetype: "generic"
  };
}

function detectJsTsStack(root: string, packageJsonPath: string): ProjectStack {
  let pkg: any = {};
  if (fs.existsSync(packageJsonPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    } catch {
      pkg = {};
    }
  }

  const allDeps: Record<string, string> = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {})
  };

  const scripts = pkg.scripts || {};
  const frameworks: string[] = [];

  // Next.js takes precedence over raw React
  if ("next" in allDeps || "nextjs" in allDeps) {
    frameworks.push("nextjs");
  } else if ("react" in allDeps) {
    frameworks.push("react");
  }

  if ("vue" in allDeps) {
    frameworks.push("vue");
  }

  if ("@nestjs/core" in allDeps || "nestjs" in allDeps) {
    frameworks.push("nestjs");
  }

  if ("express" in allDeps) {
    frameworks.push("express");
  }

  // Detect test runner
  let testRunner: string | null = null;
  const testScript = typeof scripts.test === "string" ? scripts.test : "";

  if (testScript.includes("bun test")) {
    testRunner = "bun test";
  } else if (testScript.includes("vitest")) {
    testRunner = "vitest";
  } else if (testScript.includes("jest")) {
    testRunner = "jest";
  } else if (
    fs.existsSync(path.join(root, "bun.lock")) ||
    fs.existsSync(path.join(root, "bun.lockb")) ||
    "@types/bun" in allDeps ||
    "bun" in allDeps
  ) {
    testRunner = "bun test";
  } else if (
    "vitest" in allDeps ||
    fs.existsSync(path.join(root, "vitest.config.ts")) ||
    fs.existsSync(path.join(root, "vitest.config.js"))
  ) {
    testRunner = "vitest";
  } else if (
    "jest" in allDeps ||
    fs.existsSync(path.join(root, "jest.config.ts")) ||
    fs.existsSync(path.join(root, "jest.config.js"))
  ) {
    testRunner = "jest";
  }

  let archetype: ProjectArchetype = "generic";
  const manifestCandidates = [
    path.join(root, "manifest.json"),
    path.join(root, "public", "manifest.json"),
    path.join(root, "src", "manifest.json"),
  ];
  const hasBrowserManifest = manifestCandidates.some((p) => {
    if (!fs.existsSync(p)) return false;
    try {
      const m = JSON.parse(fs.readFileSync(p, "utf-8"));
      return Boolean(m.manifest_version);
    } catch {
      return false;
    }
  });

  if (hasBrowserManifest) {
    archetype = "browser-extension";
  } else if (frameworks.includes("nestjs")) {
    archetype = "opinionated-framework";
  } else if (
    frameworks.includes("nextjs") ||
    frameworks.includes("react") ||
    frameworks.includes("vue")
  ) {
    archetype = "reactive-frontend";
  } else if (
    frameworks.includes("express") ||
    frameworks.includes("fastify") ||
    frameworks.includes("hono") ||
    frameworks.includes("koa")
  ) {
    archetype = "api-backend";
  }

  return {
    primary: "typescript",
    frameworks,
    testRunner,
    archetype
  };
}

function detectPythonStack(
  root: string,
  pyprojectPath: string,
  requirementsPath: string,
  pipfilePath: string
): ProjectStack {
  let combinedContent = "";

  if (fs.existsSync(pyprojectPath)) {
    try {
      combinedContent += "\n" + fs.readFileSync(pyprojectPath, "utf-8");
    } catch {}
  }
  if (fs.existsSync(requirementsPath)) {
    try {
      combinedContent += "\n" + fs.readFileSync(requirementsPath, "utf-8");
    } catch {}
  }
  if (fs.existsSync(pipfilePath)) {
    try {
      combinedContent += "\n" + fs.readFileSync(pipfilePath, "utf-8");
    } catch {}
  }

  const frameworks: string[] = [];
  if (/fastapi/i.test(combinedContent)) {
    frameworks.push("fastapi");
  }
  if (/django/i.test(combinedContent)) {
    frameworks.push("django");
  }
  if (/flask/i.test(combinedContent)) {
    frameworks.push("flask");
  }

  let testRunner: string = "unittest";
  if (
    /pytest/i.test(combinedContent) ||
    fs.existsSync(path.join(root, "pytest.ini")) ||
    fs.existsSync(path.join(root, "conftest.py"))
  ) {
    testRunner = "pytest";
  }

  let archetype: ProjectArchetype = "generic";
  if (frameworks.includes("django")) {
    archetype = "opinionated-framework";
  } else if (frameworks.includes("fastapi") || frameworks.includes("flask")) {
    archetype = "api-backend";
  }

  return {
    primary: "python",
    frameworks,
    testRunner,
    archetype
  };
}

function detectGoStack(goModPath: string): ProjectStack {
  let content = "";
  try {
    content = fs.readFileSync(goModPath, "utf-8");
  } catch {}

  const frameworks: string[] = [];
  if (/gin-gonic\/gin/i.test(content) || /\bgin\b/i.test(content)) {
    frameworks.push("gin");
  }
  if (/labstack\/echo/i.test(content) || /\becho\b/i.test(content)) {
    frameworks.push("echo");
  }
  if (/gofiber\/fiber/i.test(content) || /\bfiber\b/i.test(content)) {
    frameworks.push("fiber");
  }
  if (/go-chi\/chi/i.test(content) || /\bchi\b/i.test(content)) {
    frameworks.push("chi");
  }

  return {
    primary: "go",
    frameworks,
    testRunner: "go test",
    archetype: "distributed-systems"
  };
}

function detectRustStack(cargoTomlPath: string): ProjectStack {
  let content = "";
  try {
    content = fs.readFileSync(cargoTomlPath, "utf-8");
  } catch {}

  const frameworks: string[] = [];
  if (/actix-web/i.test(content) || /\bactix\b/i.test(content)) {
    frameworks.push("actix");
  }
  if (/\baxum\b/i.test(content)) {
    frameworks.push("axum");
  }
  if (/\btokio\b/i.test(content)) {
    frameworks.push("tokio");
  }
  if (/\brocket\b/i.test(content)) {
    frameworks.push("rocket");
  }

  return {
    primary: "rust",
    frameworks,
    testRunner: "cargo test",
    archetype: "distributed-systems"
  };
}

function detectRubyStack(root: string, gemfilePath: string): ProjectStack {
  let content = "";
  try {
    content = fs.readFileSync(gemfilePath, "utf-8");
  } catch {}

  const frameworks: string[] = [];
  if (/\brails\b/i.test(content)) {
    frameworks.push("rails");
  }
  if (/\bsinatra\b/i.test(content)) {
    frameworks.push("sinatra");
  }
  if (/\bhanami\b/i.test(content)) {
    frameworks.push("hanami");
  }
  if (/\bjekyll\b/i.test(content) || fs.existsSync(path.join(root, "_config.yml"))) {
    frameworks.push("jekyll");
  }

  let testRunner = "bundle exec rake test";
  if (
    /rspec/i.test(content) ||
    fs.existsSync(path.join(root, ".rspec")) ||
    fs.existsSync(path.join(root, "spec"))
  ) {
    testRunner = "rspec";
  }

  let archetype: ProjectArchetype = "generic";
  if (frameworks.includes("rails")) {
    archetype = "opinionated-framework";
  } else if (frameworks.includes("jekyll") || fs.existsSync(path.join(root, "_config.yml"))) {
    archetype = "static-site";
  }

  return {
    primary: "ruby",
    frameworks,
    testRunner,
    archetype
  };
}

function detectPhpStack(root: string, composerJsonPath: string): ProjectStack {
  let composer: any = {};
  let content = "";
  try {
    content = fs.readFileSync(composerJsonPath, "utf-8");
    composer = JSON.parse(content);
  } catch {
    composer = {};
  }

  const allReqs: Record<string, string> = {
    ...(composer.require || {}),
    ...(composer["require-dev"] || {})
  };

  const frameworks: string[] = [];
  if ("laravel/framework" in allReqs || /laravel/i.test(content)) {
    frameworks.push("laravel");
  }
  if (
    Object.keys(allReqs).some((k) => k.startsWith("symfony/")) ||
    /symfony/i.test(content)
  ) {
    frameworks.push("symfony");
  }
  if (
    "johnpbloch/wordpress" in allReqs ||
    "roots/bedrock" in allReqs ||
    /wordpress/i.test(content) ||
    fs.existsSync(path.join(root, "wp-config.php"))
  ) {
    frameworks.push("wordpress");
  }
  if (
    "drupal/core" in allReqs ||
    "drupal/recommended-project" in allReqs ||
    /drupal/i.test(content)
  ) {
    frameworks.push("drupal");
  }

  let testRunner = "phpunit";
  if ("pestphp/pest" in allReqs || /pest/i.test(content)) {
    testRunner = "pest";
  } else if (
    "phpunit/phpunit" in allReqs ||
    fs.existsSync(path.join(root, "phpunit.xml"))
  ) {
    testRunner = "phpunit";
  }

  let archetype: ProjectArchetype = "generic";
  if (frameworks.includes("wordpress") || frameworks.includes("drupal")) {
    archetype = "procedural-cms";
  } else if (frameworks.includes("laravel")) {
    archetype = "opinionated-framework";
  }

  return {
    primary: "php",
    frameworks,
    testRunner,
    archetype
  };
}
