import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("SPEC-5: GitHub Actions CI Verification Gate", () => {
  const rootDir = process.cwd();
  const ciWorkflowPath = join(rootDir, ".github", "workflows", "ci.yml");
  const packageJsonPath = join(rootDir, "package.json");

  it("should have .github/workflows/ci.yml present", () => {
    expect(existsSync(ciWorkflowPath)).toBe(true);
  });

  it("should configure pull_request and push triggers on main and task branches", () => {
    const content = readFileSync(ciWorkflowPath, "utf-8");
    expect(content).toContain("pull_request:");
    expect(content).toContain("push:");
    expect(content).toMatch(/branches:.*main/s);
    expect(content).toContain("task/**");
  });

  it("should run on ubuntu-latest and set up Bun runtime", () => {
    const content = readFileSync(ciWorkflowPath, "utf-8");
    expect(content).toContain("runs-on: ubuntu-latest");
    expect(content).toContain("actions/checkout@v4");
    expect(content).toContain("oven-sh/setup-bun@v2");
  });

  it("should execute bun install --frozen-lockfile, bun test, and bun run build", () => {
    const content = readFileSync(ciWorkflowPath, "utf-8");
    expect(content).toContain("bun install --frozen-lockfile");
    expect(content).toContain("bun test");
    expect(content).toContain("bun run build");
  });

  it("should have a build script defined in package.json", () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.build).toContain("bun build");
  });

  it("should execute bun run build successfully", () => {
    const result = Bun.spawnSync(["bun", "run", "build"], {
      cwd: rootDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(0);
  });
});
