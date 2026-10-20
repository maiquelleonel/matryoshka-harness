import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("SPEC-7: MCP Auto-Wiring & Observability (baba mcp wire)", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");
  const indexPath = path.resolve(__dirname, "../index.ts");
  const repoRoot = path.resolve(__dirname, "..");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-mcp-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Scenario 1: Auto-wiring in a clean workspace", () => {
    it("creates required directories and configuration files with codebase-memory-mcp", async () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", tempDir]);
      expect(proc.exitCode).toBe(0);

      const cursorConfigPath = path.join(tempDir, ".cursor", "mcp.json");
      const geminiConfigPath = path.join(tempDir, ".gemini", "settings.json");
      const claudeConfigPath = path.join(tempDir, ".claude", "mcp.json");

      expect(fs.existsSync(cursorConfigPath)).toBe(true);
      expect(fs.existsSync(geminiConfigPath)).toBe(true);
      expect(fs.existsSync(claudeConfigPath)).toBe(true);

      const cursorConfig = JSON.parse(fs.readFileSync(cursorConfigPath, "utf-8"));
      const geminiConfig = JSON.parse(fs.readFileSync(geminiConfigPath, "utf-8"));
      const claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, "utf-8"));

      const expectedServer = {
        command: "bunx",
        args: ["codebase-memory-mcp"]
      };

      expect(cursorConfig.mcpServers?.["codebase-memory-mcp"]).toEqual(expectedServer);
      expect(geminiConfig.mcpServers?.["codebase-memory-mcp"]).toEqual(expectedServer);
      expect(claudeConfig.mcpServers?.["codebase-memory-mcp"]).toEqual(expectedServer);
    });

    it("defaults to current working directory when path is omitted", async () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire"], {
        cwd: tempDir
      });
      expect(proc.exitCode).toBe(0);

      const cursorConfigPath = path.join(tempDir, ".cursor", "mcp.json");
      expect(fs.existsSync(cursorConfigPath)).toBe(true);
    });
  });

  describe("Subtask 2: Auto-Injection Targets Isolation & CLI Flags", () => {
    it("wires only cursor when --targets cursor is provided", async () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "mcp",
        "wire",
        tempDir,
        "--targets",
        "cursor",
        "--json"
      ]);
      expect(proc.exitCode).toBe(0);

      expect(fs.existsSync(path.join(tempDir, ".cursor", "mcp.json"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".gemini"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".claude"))).toBe(false);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.targets.length).toBe(1);
      expect(parsed.targets[0].target).toBe("cursor");
    });

    it("wires multiple filtered targets when --targets cursor,claude is provided", async () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "mcp",
        "wire",
        tempDir,
        "--targets",
        "cursor,claude",
        "--json"
      ]);
      expect(proc.exitCode).toBe(0);

      expect(fs.existsSync(path.join(tempDir, ".cursor", "mcp.json"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".claude", "mcp.json"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".gemini"))).toBe(false);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.targets.length).toBe(2);
      expect(parsed.targets.map((t: any) => t.target).sort()).toEqual(["claude", "cursor"]);
    });

    it("supports singular --target flag for single target isolation", async () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "mcp",
        "wire",
        tempDir,
        "--target",
        "gemini",
        "--json"
      ]);
      expect(proc.exitCode).toBe(0);

      expect(fs.existsSync(path.join(tempDir, ".gemini", "settings.json"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".cursor"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".claude"))).toBe(false);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.targets.length).toBe(1);
      expect(parsed.targets[0].target).toBe("gemini");
    });
  });

  describe("Scenario 2: Preserving existing configurations (Idempotent Merge)", () => {
    it("strictly preserves existing settings, custom MCP servers, and user keys", async () => {
      const geminiDir = path.join(tempDir, ".gemini");
      fs.mkdirSync(geminiDir, { recursive: true });

      const initialSettings = {
        theme: "cyberpunk-2077",
        telemetry: false,
        userPreferences: {
          tabSize: 2,
          renderWhitespace: "boundary"
        },
        mcpServers: {
          "custom-analytics-mcp": {
            command: "python",
            args: ["-m", "analytics_server"],
            env: { PORT: "9090" }
          }
        }
      };

      fs.writeFileSync(
        path.join(geminiDir, "settings.json"),
        JSON.stringify(initialSettings, null, 2)
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", tempDir]);
      expect(proc.exitCode).toBe(0);

      const updatedSettings = JSON.parse(
        fs.readFileSync(path.join(geminiDir, "settings.json"), "utf-8")
      );

      // Verify preserved fields
      expect(updatedSettings.theme).toBe("cyberpunk-2077");
      expect(updatedSettings.telemetry).toBe(false);
      expect(updatedSettings.userPreferences).toEqual({
        tabSize: 2,
        renderWhitespace: "boundary"
      });
      expect(updatedSettings.mcpServers["custom-analytics-mcp"]).toEqual({
        command: "python",
        args: ["-m", "analytics_server"],
        env: { PORT: "9090" }
      });

      // Verify injected server
      expect(updatedSettings.mcpServers["codebase-memory-mcp"]).toEqual({
        command: "bunx",
        args: ["codebase-memory-mcp"]
      });

      // Execute a second time to ensure idempotency
      const procSecond = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", tempDir]);
      expect(procSecond.exitCode).toBe(0);

      const idempSettings = JSON.parse(
        fs.readFileSync(path.join(geminiDir, "settings.json"), "utf-8")
      );
      expect(idempSettings).toEqual(updatedSettings);
    });
  });

  describe("Scenario 3: Dry-Run Mode and Structured Output", () => {
    it("does not modify disk and returns status: planned with --dry-run --json", async () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "mcp",
        "wire",
        tempDir,
        "--dry-run",
        "--json"
      ]);

      expect(proc.exitCode).toBe(0);

      // Verify NO files or directories created
      expect(fs.existsSync(path.join(tempDir, ".cursor"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".gemini"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".claude"))).toBe(false);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.status).toBe("planned");
      expect(parsed.dryRun).toBe(true);
      expect(parsed.command).toBe("mcp wire");
      expect(Array.isArray(parsed.targets)).toBe(true);
      expect(parsed.targets.length).toBe(3);

      for (const target of parsed.targets) {
        expect(target.status).toBe("planned");
        expect(target.action).toBe("create");
      }
    });

    it("outputs human-readable dry run summary when --json is omitted", async () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "mcp",
        "wire",
        tempDir,
        "--dry-run"
      ]);

      expect(proc.exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, ".cursor"))).toBe(false);

      const stdout = proc.stdout.toString();
      expect(stdout.toLowerCase()).toContain("dry-run");
      expect(stdout).toContain(".cursor/mcp.json");
    });
  });

  describe("Scenario 4: Canonical Versioned Grafana Dashboard", () => {
    it("ensures dashboards/matryoshka-grafana.json exists with metrics for search_graph", async () => {
      const dashboardPath = path.join(repoRoot, "dashboards", "matryoshka-grafana.json");
      expect(fs.existsSync(dashboardPath)).toBe(true);

      const raw = fs.readFileSync(dashboardPath, "utf-8");
      const dashboard = JSON.parse(raw);

      expect(dashboard.title).toBeDefined();
      expect(Array.isArray(dashboard.panels)).toBe(true);
      expect(dashboard.panels.length).toBeGreaterThanOrEqual(1);

      // Verify search_graph metric presence
      const dashboardString = JSON.stringify(dashboard);
      expect(dashboardString).toContain("search_graph");

      // Verify latency (p95) and error rate presence
      expect(dashboardString.toLowerCase()).toContain("p95");
      expect(dashboardString.toLowerCase()).toContain("error");
    });
  });

  describe("Strict Alias Parity (baba, bbyg, matryoshka)", () => {
    it("ensures mcp wire works identically across CLI aliases", async () => {
      const dirBaba = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-alias-baba-"));
      const dirBbyg = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-alias-bbyg-"));
      const dirMatryoshka = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-alias-mat-"));

      try {
        const procBaba = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", dirBaba, "--json"], {
          env: { ...process.env, BABA_ALIAS: "baba" }
        });
        const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", dirBbyg, "--json"], {
          env: { ...process.env, BABA_ALIAS: "bbyg" }
        });
        const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", dirMatryoshka, "--json"], {
          env: { ...process.env, BABA_ALIAS: "matryoshka" }
        });

        expect(procBaba.exitCode).toBe(0);
        expect(procBbyg.exitCode).toBe(0);
        expect(procMatryoshka.exitCode).toBe(0);

        const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
        const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
        const parsedMat = JSON.parse(procMatryoshka.stdout.toString().trim());

        expect(parsedBaba.status).toBe("success");
        expect(parsedBbyg.status).toBe("success");
        expect(parsedMat.status).toBe("success");
      } finally {
        fs.rmSync(dirBaba, { recursive: true, force: true });
        fs.rmSync(dirBbyg, { recursive: true, force: true });
        fs.rmSync(dirMatryoshka, { recursive: true, force: true });
      }
    });

    it("handles unknown subcommands under mcp gracefully with exit code 1", async () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "invalid-sub"]);
      expect(proc.exitCode).toBe(1);
      expect(proc.stderr.toString()).toContain("invalid-sub");
    });
  });
});
