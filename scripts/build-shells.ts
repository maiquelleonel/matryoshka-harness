#!/usr/bin/env bun
/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export interface ProtectiveShellConfig {
  name: string;
  packageName: string;
  description: string;
  binName: string;
  aliases: string[];
  targetPackage: string;
  isTypoProtection?: boolean;
}

export interface ShellScaffoldResult {
  packageName: string;
  directory: string;
  filesWritten: string[];
  success: boolean;
  error?: string;
}

export interface ShellScaffoldSummary {
  success: boolean;
  results: ShellScaffoldResult[];
  totalFiles: number;
}

export interface ShellVerificationResult {
  packageName: string;
  directory: string;
  validManifest: boolean;
  validForwarder: boolean;
  validDependency: boolean;
  isPublic: boolean;
  success: boolean;
  errors: string[];
}

export interface ShellVerificationSummary {
  success: boolean;
  shells: ShellVerificationResult[];
}

export interface ScaffoldOptions {
  cwd?: string;
  dryRun?: boolean;
  version?: string;
}

export interface VerifyOptions {
  cwd?: string;
}

/**
 * The 4 canonical protective typosquatting shells under @maiquelleonel scope.
 */
export const PROTECTIVE_SHELLS: readonly ProtectiveShellConfig[] = [
  {
    name: "baba",
    packageName: "@maiquelleonel/baba",
    description:
      "Protective shell and forwarding wrapper for @maiquelleonel/matryoshka (baba ergonomic alias)",
    binName: "baba",
    aliases: ["baba", "matryoshka", "bbyg"],
    targetPackage: "@maiquelleonel/matryoshka",
  },
  {
    name: "bbyg",
    packageName: "@maiquelleonel/bbyg",
    description:
      "Protective shell and forwarding wrapper for @maiquelleonel/matryoshka (bbyg compact alias)",
    binName: "bbyg",
    aliases: ["bbyg", "matryoshka", "baba"],
    targetPackage: "@maiquelleonel/matryoshka",
  },
  {
    name: "matrioska",
    packageName: "@maiquelleonel/matrioska",
    description:
      "Protective typosquatting shell and forwarding wrapper for @maiquelleonel/matryoshka (matrioska typo protection)",
    binName: "matrioska",
    aliases: ["matrioska", "matryoshka", "baba", "bbyg"],
    targetPackage: "@maiquelleonel/matryoshka",
    isTypoProtection: true,
  },
  {
    name: "matryoska",
    packageName: "@maiquelleonel/matryoska",
    description:
      "Protective typosquatting shell and forwarding wrapper for @maiquelleonel/matryoshka (matryoska typo protection)",
    binName: "matryoska",
    aliases: ["matryoska", "matryoshka", "baba", "bbyg"],
    targetPackage: "@maiquelleonel/matryoshka",
    isTypoProtection: true,
  },
];

/**
 * Resolves the root package.json version of the monorepo.
 */
export function getRootPackageVersion(cwd: string = process.cwd()): string {
  try {
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return pkg.version || "0.4.0";
    }
  } catch {}
  return "0.4.0";
}

/**
 * Resolves the canonical CLI binary path of @maiquelleonel/matryoshka.
 */
export function resolveCanonicalCli(fromDir: string = process.cwd()): string {
  // 1. Try standard module resolution
  try {
    const req = typeof require !== "undefined" ? require : null;
    if (req) {
      const resolvedPkg = req.resolve("@maiquelleonel/matryoshka/package.json");
      const cliPath = path.join(path.dirname(resolvedPkg), "dist", "cli.js");
      if (fs.existsSync(cliPath)) {
        return cliPath;
      }
    }
  } catch {}

  // 2. Candidate paths in monorepo layout and local directories
  const candidates = [
    path.resolve(fromDir, "dist/cli.js"),
    path.resolve(fromDir, "../../dist/cli.js"),
    path.resolve(fromDir, "../../../dist/cli.js"),
    path.resolve(process.cwd(), "dist/cli.js"),
    path.resolve(
      process.cwd(),
      "node_modules/@maiquelleonel/matryoshka/dist/cli.js",
    ),
    path.resolve(
      fromDir,
      "node_modules/@maiquelleonel/matryoshka/dist/cli.js",
    ),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }

  throw new Error(
    "Unable to locate @maiquelleonel/matryoshka canonical CLI binary (dist/cli.js).",
  );
}

/**
 * Generates the package.json manifest for a protective shell package.
 */
export function generateShellPackageJson(
  shell: ProtectiveShellConfig,
  version: string,
): Record<string, any> {
  const binMap: Record<string, string> = {};
  for (const alias of shell.aliases) {
    binMap[alias] = `bin/${shell.binName}.js`;
  }

  return {
    name: shell.packageName,
    version,
    description: shell.description,
    main: `bin/${shell.binName}.js`,
    module: "index.js",
    bin: binMap,
    publishConfig: {
      access: "public",
    },
    files: ["bin", "index.js", "README.md", "LICENSE"],
    dependencies: {
      [shell.targetPackage]: `^${version}`,
    },
    repository: {
      type: "git",
      url: "git+https://github.com/maiquelleonel/matryoshka-harness.git",
      directory: `packages/${shell.name}`,
    },
    bugs: {
      url: "https://github.com/maiquelleonel/matryoshka-harness/issues",
    },
    homepage: "https://github.com/maiquelleonel/matryoshka-harness#readme",
    keywords: [
      "matryoshka",
      "harness",
      "baba",
      "bbyg",
      "typosquatting",
      "wrapper",
      "forwarding",
      "agentic",
      "ai",
      "mcp",
    ],
    author: "Maiquel Leonel <skywishmtfk@gmail.com>",
    license: "MIT",
  };
}

/**
 * Generates the executable forwarding wrapper script.
 */
export function generateForwarderScript(shell: ProtectiveShellConfig): string {
  return `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function resolveCanonicalCli() {
  try {
    const pkgJson = require.resolve("@maiquelleonel/matryoshka/package.json");
    const cliPath = path.join(path.dirname(pkgJson), "dist", "cli.js");
    if (fs.existsSync(cliPath)) return cliPath;
  } catch {}

  const candidates = [
    path.resolve(__dirname, "../../dist/cli.js"),
    path.resolve(__dirname, "../../../dist/cli.js"),
    path.resolve(process.cwd(), "dist/cli.js"),
    path.resolve(process.cwd(), "node_modules/@maiquelleonel/matryoshka/dist/cli.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    "Unable to locate @maiquelleonel/matryoshka canonical CLI. Please ensure @maiquelleonel/matryoshka is installed.",
  );
}

function forwardCli(args = process.argv.slice(2)) {
  const cliPath = resolveCanonicalCli();
  const isBun = typeof Bun !== "undefined" || Boolean(process.versions && process.versions.bun);
  const runtime = isBun ? process.execPath : "bun";

  let result;
  try {
    result = spawnSync(runtime, [cliPath, ...args], { stdio: "inherit" });
  } catch {
    try {
      result = spawnSync(process.execPath, [cliPath, ...args], { stdio: "inherit" });
    } catch {
      result = spawnSync(cliPath, args, { stdio: "inherit" });
    }
  }

  return result ? (result.status ?? 0) : 0;
}

if (require.main === module) {
  const code = forwardCli();
  process.exit(code);
}

module.exports = { resolveCanonicalCli, forwardCli };
`;
}

/**
 * Generates the library re-export index.js for the shell package.
 */
export function generateIndexJs(): string {
  return `// Forwarding library entrypoint delegating to canonical @maiquelleonel/matryoshka
module.exports = require("@maiquelleonel/matryoshka");
`;
}

/**
 * Generates the README.md documentation for the shell package.
 */
export function generateReadme(
  shell: ProtectiveShellConfig,
  version: string,
): string {
  const typoNote = shell.isTypoProtection
    ? `\n> **⚠️ Note:** \`${shell.name}\` is a common typographical variation of \`matryoshka\`. This package protects users and automation sandboxes against typosquatting and supply-chain confusion by delegating cleanly to the official package.\n`
    : "";

  return `# ${shell.packageName}

> 🛡️ Protective Typosquatting Shell & Forwarding Wrapper for [\`${shell.targetPackage}\`](https://www.npmjs.com/package/${shell.targetPackage})
${typoNote}
This package is an official, lightweight protective forwarding shell published under the \`@maiquelleonel\` scope. It ensures that invocations of \`${shell.name}\` seamlessly resolve and execute the canonical **Matryoshka-Harness** engine.

## 🚀 Instant Usage

Execute on-demand without manual pre-installation via your preferred runner:

\`\`\`bash
# Direct execution via bunx
bunx ${shell.packageName} --help
bunx ${shell.packageName} detect

# Direct execution via npx
npx ${shell.packageName} --version
npx ${shell.packageName} wrap
\`\`\`

## 📦 Canonical Installation

For direct production installations, install the canonical package directly:

\`\`\`bash
npm install -g ${shell.targetPackage}
# or
bun add -g ${shell.targetPackage}
\`\`\`

## 📄 License
MIT © Maiquel Leonel
`;
}

/**
 * Reads root LICENSE file if available, or returns standard MIT license.
 */
export function getLicenseContent(cwd: string = process.cwd()): string {
  try {
    const licensePath = path.join(cwd, "LICENSE");
    if (fs.existsSync(licensePath)) {
      return fs.readFileSync(licensePath, "utf-8");
    }
  } catch {}

  return `MIT License

Copyright (c) 2026 Maiquel Leonel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

/**
 * Scaffolds an individual protective shell package directory.
 */
export function scaffoldShell(
  shell: ProtectiveShellConfig,
  options: ScaffoldOptions = {},
): ShellScaffoldResult {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  const version = options.version ?? getRootPackageVersion(cwd);

  const shellDir = path.join(cwd, "packages", shell.name);
  const binDir = path.join(shellDir, "bin");
  const binFile = path.join(binDir, `${shell.binName}.js`);
  const pkgFile = path.join(shellDir, "package.json");
  const indexFile = path.join(shellDir, "index.js");
  const readmeFile = path.join(shellDir, "README.md");
  const licenseFile = path.join(shellDir, "LICENSE");

  const filesWritten: string[] = [pkgFile, binFile, indexFile, readmeFile, licenseFile];

  if (dryRun) {
    return {
      packageName: shell.packageName,
      directory: shellDir,
      filesWritten,
      success: true,
    };
  }

  try {
    fs.mkdirSync(binDir, { recursive: true });

    // 1. package.json
    const pkgContent = JSON.stringify(
      generateShellPackageJson(shell, version),
      null,
      2,
    ) + "\n";
    fs.writeFileSync(pkgFile, pkgContent, "utf-8");

    // 2. bin/<name>.js with chmod 0o755
    const forwarderContent = generateForwarderScript(shell);
    fs.writeFileSync(binFile, forwarderContent, { mode: 0o755, encoding: "utf-8" });
    try {
      fs.chmodSync(binFile, 0o755);
    } catch {}

    // 3. index.js
    fs.writeFileSync(indexFile, generateIndexJs(), "utf-8");

    // 4. README.md
    fs.writeFileSync(readmeFile, generateReadme(shell, version), "utf-8");

    // 5. LICENSE
    fs.writeFileSync(licenseFile, getLicenseContent(cwd), "utf-8");

    return {
      packageName: shell.packageName,
      directory: shellDir,
      filesWritten,
      success: true,
    };
  } catch (err: any) {
    return {
      packageName: shell.packageName,
      directory: shellDir,
      filesWritten: [],
      success: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Scaffolds all 4 canonical protective shell packages.
 */
export function scaffoldAllShells(
  options: ScaffoldOptions = {},
): ShellScaffoldSummary {
  const results: ShellScaffoldResult[] = [];
  let totalFiles = 0;

  for (const shell of PROTECTIVE_SHELLS) {
    const res = scaffoldShell(shell, options);
    results.push(res);
    totalFiles += res.filesWritten.length;
  }

  const success = results.every((r) => r.success);
  return { success, results, totalFiles };
}

/**
 * Verifies an individual shell package directory.
 */
export function verifyShell(
  shell: ProtectiveShellConfig,
  options: VerifyOptions = {},
): ShellVerificationResult {
  const cwd = options.cwd ?? process.cwd();
  const shellDir = path.join(cwd, "packages", shell.name);
  const errors: string[] = [];

  let validManifest = false;
  let validForwarder = false;
  let validDependency = false;
  let isPublic = false;

  if (!fs.existsSync(shellDir)) {
    errors.push(`Directory does not exist: ${shellDir}`);
    return {
      packageName: shell.packageName,
      directory: shellDir,
      validManifest: false,
      validForwarder: false,
      validDependency: false,
      isPublic: false,
      success: false,
      errors,
    };
  }

  // 1. Check package.json
  const pkgPath = path.join(shellDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    errors.push(`Missing package.json in ${shellDir}`);
  } else {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name !== shell.packageName) {
        errors.push(`Invalid name in manifest: ${pkg.name} != ${shell.packageName}`);
      }
      if (pkg.publishConfig?.access === "public") {
        isPublic = true;
      } else {
        errors.push("publishConfig.access is not 'public'");
      }
      if (pkg.dependencies && pkg.dependencies[shell.targetPackage]) {
        validDependency = true;
      } else {
        errors.push(`Missing dependency on ${shell.targetPackage}`);
      }
      if (pkg.bin && pkg.bin[shell.binName]) {
        validManifest = true;
      } else {
        errors.push(`Missing bin entry for ${shell.binName}`);
      }
    } catch (e: any) {
      errors.push(`Malformed package.json: ${e?.message}`);
    }
  }

  // 2. Check forwarder script
  const binPath = path.join(shellDir, "bin", `${shell.binName}.js`);
  if (!fs.existsSync(binPath)) {
    errors.push(`Missing forwarder script: ${binPath}`);
  } else {
    try {
      const content = fs.readFileSync(binPath, "utf-8");
      if (content.startsWith("#!/usr/bin/env node")) {
        validForwarder = true;
      } else {
        errors.push("Forwarder script missing #!/usr/bin/env node shebang");
      }
    } catch (e: any) {
      errors.push(`Error reading forwarder script: ${e?.message}`);
    }
  }

  const success =
    errors.length === 0 &&
    validManifest &&
    validForwarder &&
    validDependency &&
    isPublic;

  return {
    packageName: shell.packageName,
    directory: shellDir,
    validManifest,
    validForwarder,
    validDependency,
    isPublic,
    success,
    errors,
  };
}

/**
 * Verifies all protective shell packages.
 */
export function verifyAllShells(
  options: VerifyOptions = {},
): ShellVerificationSummary {
  const shells: ShellVerificationResult[] = [];
  for (const shell of PROTECTIVE_SHELLS) {
    shells.push(verifyShell(shell, options));
  }
  const success = shells.every((s) => s.success);
  return { success, shells };
}

// CLI runner
if (import.meta.main) {
  const args = process.argv.slice(2);
  const isJson = args.includes("--json");
  const isVerify = args.includes("--verify");
  const isDryRun = args.includes("--dry-run");

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Matryoshka Typosquatting Protective Shells Builder & Verifier

Usage:
  bun run scripts/build-shells.ts [options]

Options:
  --verify       Verify existing scaffolded shells without modifying files
  --dry-run      Simulate scaffolding and report planned files
  --json         Output structured JSON summary
  --help, -h     Show this help message
`);
    process.exit(0);
  }

  if (isVerify) {
    const summary = verifyAllShells();
    if (isJson) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(
        summary.success
          ? "✅ All protective typosquatting shells verified successfully."
          : "❌ Verification failed for one or more shells.",
      );
      for (const s of summary.shells) {
        console.log(` - ${s.packageName}: ${s.success ? "OK" : s.errors.join(", ")}`);
      }
    }
    process.exit(summary.success ? 0 : 1);
  }

  const summary = scaffoldAllShells({ dryRun: isDryRun });
  if (isJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      isDryRun
        ? "🧪 Dry-run: Protective shells planned for scaffolding:"
        : "✅ Successfully scaffolded protective typosquatting shells:",
    );
    for (const r of summary.results) {
      console.log(` - ${r.packageName} (${r.filesWritten.length} files) -> ${r.directory}`);
    }
  }
  process.exit(summary.success ? 0 : 1);
}
