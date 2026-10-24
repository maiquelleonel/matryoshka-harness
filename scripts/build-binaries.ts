#!/usr/bin/env bun
/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface BuildTarget {
  name: string;
  platform: "linux" | "darwin" | "windows";
  arch: "x64" | "arm64";
  bunTarget: string;
  outputName: string;
}

export interface BuildOptions {
  targets?: string[];
  outDir?: string;
  entrypoint?: string;
  minify?: boolean;
  generateChecksums?: boolean;
  checksumsFileName?: string;
  dryRun?: boolean;
  cwd?: string;
  silent?: boolean;
}

export interface BuildResult {
  target: BuildTarget;
  outputFile: string;
  outputPath: string;
  sizeBytes: number;
  sha256: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface BuildSummary {
  success: boolean;
  outDir: string;
  results: BuildResult[];
  checksumsPath?: string;
  checksumsContent?: string;
  totalDurationMs: number;
}

export const DEFAULT_TARGETS: readonly BuildTarget[] = [
  {
    name: "linux-x64",
    platform: "linux",
    arch: "x64",
    bunTarget: "bun-linux-x64",
    outputName: "baba-linux-x64",
  },
  {
    name: "linux-arm64",
    platform: "linux",
    arch: "arm64",
    bunTarget: "bun-linux-arm64",
    outputName: "baba-linux-arm64",
  },
  {
    name: "darwin-arm64",
    platform: "darwin",
    arch: "arm64",
    bunTarget: "bun-darwin-arm64",
    outputName: "baba-darwin-arm64",
  },
  {
    name: "darwin-x64",
    platform: "darwin",
    arch: "x64",
    bunTarget: "bun-darwin-x64",
    outputName: "baba-darwin-x64",
  },
  {
    name: "windows-x64",
    platform: "windows",
    arch: "x64",
    bunTarget: "bun-windows-x64",
    outputName: "baba-windows-x64.exe",
  },
];

export const SUPPORTED_TARGETS = DEFAULT_TARGETS;

/**
 * Resolves a list of targets based on filter names or special aliases ('all', 'current', 'host').
 */
export function resolveTargets(filter?: string[]): BuildTarget[] {
  if (!filter || filter.length === 0) {
    return [...DEFAULT_TARGETS];
  }

  // Flatten any comma-separated entries
  const names = filter
    .flatMap((item) => item.split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (names.length === 0 || names.includes("all")) {
    return [...DEFAULT_TARGETS];
  }

  const resolved: BuildTarget[] = [];

  for (const name of names) {
    if (name === "current" || name === "host") {
      const currentPlatform = os.platform() === "win32" ? "windows" : (os.platform() as "linux" | "darwin" | "windows");
      const currentArch = os.arch() === "x64" ? "x64" : "arm64";

      const matched = DEFAULT_TARGETS.find(
        (t) => t.platform === currentPlatform && t.arch === currentArch,
      );

      if (matched) {
        if (!resolved.some((r) => r.name === matched.name)) {
          resolved.push(matched);
        }
      } else {
        // Construct fallback target matching host
        const fallbackTarget: BuildTarget = {
          name: `${currentPlatform}-${currentArch}`,
          platform: currentPlatform,
          arch: currentArch,
          bunTarget: `bun-${currentPlatform}-${currentArch}`,
          outputName: currentPlatform === "windows" ? `baba-${currentPlatform}-${currentArch}.exe` : `baba-${currentPlatform}-${currentArch}`,
        };
        if (!resolved.some((r) => r.name === fallbackTarget.name)) {
          resolved.push(fallbackTarget);
        }
      }
      continue;
    }

    const matched = DEFAULT_TARGETS.find(
      (t) =>
        t.name.toLowerCase() === name ||
        t.bunTarget.toLowerCase() === name ||
        t.outputName.toLowerCase() === name,
    );

    if (!matched) {
      throw new Error(`Unknown or unsupported target: "${name}"`);
    }

    if (!resolved.some((r) => r.name === matched.name)) {
      resolved.push(matched);
    }
  }

  return resolved;
}

/**
 * Computes deterministic SHA-256 hash of a file or buffer.
 */
export function computeSha256(input: string | Buffer): string {
  if (Buffer.isBuffer(input)) {
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  if (fs.existsSync(input)) {
    const fileBuffer = fs.readFileSync(input);
    return crypto.createHash("sha256").update(fileBuffer).digest("hex");
  }

  return crypto.createHash("sha256").update(Buffer.from(input)).digest("hex");
}

/**
 * Formats a canonical checksums.txt file content matching standard sha256sum format:
 * <hash>  <outputName>
 */
export function formatChecksumsFile(results: BuildResult[]): string {
  return results
    .filter((r) => r.success && r.sha256 && r.outputFile)
    .map((r) => `${r.sha256}  ${r.outputFile}\n`)
    .join("");
}

/**
 * Compiles a single standalone binary for the specified target.
 */
export async function buildBinary(
  target: BuildTarget,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const startTime = Date.now();
  const cwd = options.cwd ?? process.cwd();
  const outDir = options.outDir ?? "dist/bin";
  const entrypoint = options.entrypoint ?? "src/cli.ts";
  const minify = options.minify !== false;
  const dryRun = Boolean(options.dryRun);
  const silent = Boolean(options.silent);

  const resolvedOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(cwd, outDir);
  const outputPath = path.join(resolvedOutDir, target.outputName);
  const entrypointPath = path.isAbsolute(entrypoint) ? entrypoint : path.resolve(cwd, entrypoint);

  if (dryRun) {
    if (!silent) {
      console.log(`[DRY-RUN] Simulating build for ${target.name} (${target.bunTarget}) -> ${target.outputName}`);
    }
    return {
      target,
      outputFile: target.outputName,
      outputPath,
      sizeBytes: 0,
      sha256: "",
      success: true,
      durationMs: Date.now() - startTime,
    };
  }

  // Ensure output directory exists
  if (!fs.existsSync(resolvedOutDir)) {
    fs.mkdirSync(resolvedOutDir, { recursive: true });
  }

  if (!silent) {
    console.log(`🔨 Compiling ${target.name} (${target.bunTarget}) -> ${target.outputName}...`);
  }

  const buildArgs = [
    "bun",
    "build",
    "--compile",
    ...(minify ? ["--minify"] : []),
    "--target",
    target.bunTarget,
    entrypointPath,
    "--outfile",
    outputPath,
  ];

  try {
    const proc = Bun.spawnSync(buildArgs, {
      cwd,
      stdio: silent ? ["ignore", "pipe", "pipe"] : ["inherit", "inherit", "pipe"],
    });

    const durationMs = Date.now() - startTime;

    if (proc.exitCode !== 0) {
      const stderr = proc.stderr?.toString().trim() || `bun build exited with code ${proc.exitCode}`;
      if (!silent) {
        console.error(`❌ Build failed for ${target.name}:`, stderr);
      }
      return {
        target,
        outputFile: target.outputName,
        outputPath,
        sizeBytes: 0,
        sha256: "",
        success: false,
        durationMs,
        error: stderr,
      };
    }

    if (!fs.existsSync(outputPath)) {
      return {
        target,
        outputFile: target.outputName,
        outputPath,
        sizeBytes: 0,
        sha256: "",
        success: false,
        durationMs,
        error: `Output executable was not created at: ${outputPath}`,
      };
    }

    const stats = fs.statSync(outputPath);
    const sha256 = computeSha256(outputPath);

    if (!silent) {
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`✅ Successfully compiled ${target.outputName} (${sizeMB} MB) in ${durationMs}ms`);
    }

    return {
      target,
      outputFile: target.outputName,
      outputPath,
      sizeBytes: stats.size,
      sha256,
      success: true,
      durationMs,
    };
  } catch (err: any) {
    return {
      target,
      outputFile: target.outputName,
      outputPath,
      sizeBytes: 0,
      sha256: "",
      success: false,
      durationMs: Date.now() - startTime,
      error: err?.message ?? String(err),
    };
  }
}

/**
 * Compiles all resolved targets and generates checksums.txt.
 */
export async function buildAllBinaries(
  options: BuildOptions = {},
): Promise<BuildSummary> {
  const overallStart = Date.now();
  const cwd = options.cwd ?? process.cwd();
  const outDir = options.outDir ?? "dist/bin";
  const resolvedOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(cwd, outDir);
  const generateChecksums = options.generateChecksums !== false;
  const checksumsFileName = options.checksumsFileName ?? "checksums.txt";
  const dryRun = Boolean(options.dryRun);
  const silent = Boolean(options.silent);

  const targets = resolveTargets(options.targets);

  if (!silent) {
    console.log(`📦 Matryoshka Standalone Multi-Target Compiler`);
    console.log(`🎯 Targets resolved (${targets.length}): ${targets.map((t) => t.name).join(", ")}`);
    console.log(`📂 Output directory: ${resolvedOutDir}\n`);
  }

  const results: BuildResult[] = [];

  for (const target of targets) {
    const result = await buildBinary(target, {
      ...options,
      outDir: resolvedOutDir,
    });
    results.push(result);
  }

  const allSuccessful = results.every((r) => r.success);
  let checksumsPath: string | undefined;
  let checksumsContent: string | undefined;

  if (!dryRun && generateChecksums && results.some((r) => r.success)) {
    checksumsContent = formatChecksumsFile(results);
    checksumsPath = path.join(resolvedOutDir, checksumsFileName);
    fs.writeFileSync(checksumsPath, checksumsContent, "utf-8");

    if (!silent) {
      console.log(`\n📄 Generated SHA-256 checksums at: ${checksumsPath}`);
    }
  }

  const totalDurationMs = Date.now() - overallStart;

  if (!silent) {
    console.log(`\n🏁 Build completed in ${(totalDurationMs / 1000).toFixed(2)}s`);
  }

  return {
    success: allSuccessful,
    outDir: resolvedOutDir,
    results,
    checksumsPath,
    checksumsContent,
    totalDurationMs,
  };
}

/**
 * CLI parser and dispatcher for scripts/build-binaries.ts
 */
export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    console.log(`
Usage: build-binaries [options]

Compile standalone native binaries for Matryoshka-Harness across multi-platform targets.

Options:
  --targets <list>        Comma-separated list of target architectures (default: all)
                          Available: linux-x64, linux-arm64, darwin-arm64, darwin-x64, windows-x64, current
  --out-dir, -o <path>    Output directory for compiled executables (default: dist/bin)
  --entrypoint <file>     Entrypoint file to compile (default: src/cli.ts)
  --no-minify             Disable minification in bun build
  --no-checksums          Skip generating checksums.txt
  --dry-run               Simulate compilation without writing binaries to disk
  --json                  Output structured JSON summary
  -h, --help              Show this help message
`);
    process.exit(0);
  }

  const isJson = args.includes("--json");
  const dryRun = args.includes("--dry-run");
  const noMinify = args.includes("--no-minify");
  const noChecksums = args.includes("--no-checksums");

  let outDir = "dist/bin";
  let entrypoint = "src/cli.ts";
  const targets: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--out-dir" || arg === "-o") {
      const next = args[++i];
      if (next) outDir = next;
    } else if (arg.startsWith("--out-dir=")) {
      const val = arg.slice("--out-dir=".length);
      if (val) outDir = val;
    } else if (arg === "--entrypoint") {
      const next = args[++i];
      if (next) entrypoint = next;
    } else if (arg.startsWith("--entrypoint=")) {
      const val = arg.slice("--entrypoint=".length);
      if (val) entrypoint = val;
    } else if (arg === "--targets") {
      const next = args[++i];
      if (next) targets.push(next);
    } else if (arg.startsWith("--targets=")) {
      const val = arg.slice("--targets=".length);
      if (val) targets.push(val);
    }
  }

  try {
    const summary = await buildAllBinaries({
      targets: targets.length > 0 ? targets : undefined,
      outDir,
      entrypoint,
      minify: !noMinify,
      generateChecksums: !noChecksums,
      dryRun,
      silent: isJson,
    });

    if (isJson) {
      console.log(JSON.stringify(summary, null, 2));
    }

    if (!summary.success) {
      process.exit(1);
    }
  } catch (err: any) {
    if (isJson) {
      console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
    } else {
      console.error(`❌ Build error: ${err.message}`);
    }
    process.exit(1);
  }
}

// Execute directly if run as main script
if (import.meta.main) {
  runCli().catch((err) => {
    console.error("Fatal build failure:", err);
    process.exit(1);
  });
}
