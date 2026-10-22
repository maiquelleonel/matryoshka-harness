#!/usr/bin/env bun
export * from "./src/types";
export * from "./src/detector";
export * from "./src/scanner";
export * from "./src/governance";
export * from "./src/release";
export * from "./src/mcp";
export * from "./src/mcp-server";
export * from "./src/agents";
export * from "./src/ast";
export * from "./src/rules";
export * from "./src/scorer";
export * from "./src/report";
export * from "./src/core/oracle";
export * from "./src/cli";

import { runCli } from "./src/cli";

if (import.meta.main) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
