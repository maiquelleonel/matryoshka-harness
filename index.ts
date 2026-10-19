#!/usr/bin/env bun
export * from "./src/types";
export * from "./src/detector";
export * from "./src/cli";

import { runCli } from "./src/cli";

if (import.meta.main) {
  runCli();
}
