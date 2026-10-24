#!/usr/bin/env node
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
