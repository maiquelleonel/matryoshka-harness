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

    it("supports --targets=<list> and --target=<name> with equal-sign syntax", async () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "mcp",
        "wire",
        tempDir,
        "--targets=cursor,claude",
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

    it("isolates target error and sets overall status to error when writing fails", async () => {
      // Create a directory where the config file is expected to be, making writeFileSync fail
      const cursorDir = path.join(tempDir, ".cursor");
      fs.mkdirSync(cursorDir, { recursive: true });
      // Create a directory named mcp.json so writeFileSync(mcp.json) throws EISDIR
      fs.mkdirSync(path.join(cursorDir, "mcp.json"));

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
      expect(proc.exitCode).toBe(1);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.status).toBe("error");
      expect(parsed.targets.length).toBe(1);
      expect(parsed.targets[0].status).toBe("error");
      expect(parsed.targets[0].error).toBeDefined();
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

    it("preserves custom settings across all targets simultaneously (Cursor, Gemini, Claude)", async () => {
      const cursorDir = path.join(tempDir, ".cursor");
      const claudeDir = path.join(tempDir, ".claude");
      fs.mkdirSync(cursorDir, { recursive: true });
      fs.mkdirSync(claudeDir, { recursive: true });

      fs.writeFileSync(
        path.join(cursorDir, "mcp.json"),
        JSON.stringify({
          editorRules: { strict: true },
          mcpServers: {
            "github-context": { command: "docker", args: ["run", "gh-mcp"] }
          }
        })
      );

      fs.writeFileSync(
        path.join(claudeDir, "mcp.json"),
        JSON.stringify({
          autoApprove: ["read_file"],
          mcpServers: {
            "filesystem-mcp": { command: "node", args: ["fs-server.js"] }
          }
        })
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "wire", tempDir, "--json"]);
      expect(proc.exitCode).toBe(0);

      const cursorConfig = JSON.parse(fs.readFileSync(path.join(cursorDir, "mcp.json"), "utf-8"));
      const claudeConfig = JSON.parse(fs.readFileSync(path.join(claudeDir, "mcp.json"), "utf-8"));

      expect(cursorConfig.editorRules).toEqual({ strict: true });
      expect(cursorConfig.mcpServers["github-context"]).toEqual({
        command: "docker",
        args: ["run", "gh-mcp"]
      });
      expect(cursorConfig.mcpServers["codebase-memory-mcp"]).toEqual({
        command: "bunx",
        args: ["codebase-memory-mcp"]
      });

      expect(claudeConfig.autoApprove).toEqual(["read_file"]);
      expect(claudeConfig.mcpServers["filesystem-mcp"]).toEqual({
        command: "node",
        args: ["fs-server.js"]
      });
      expect(claudeConfig.mcpServers["codebase-memory-mcp"]).toEqual({
        command: "bunx",
        args: ["codebase-memory-mcp"]
      });
    });

    it("updates existing outdated codebase-memory-mcp configuration while preserving other servers", async () => {
      const cursorDir = path.join(tempDir, ".cursor");
      fs.mkdirSync(cursorDir, { recursive: true });

      const outdatedConfig = {
        mcpServers: {
          "codebase-memory-mcp": {
            command: "npx",
            args: ["legacy-mcp@0.0.1"]
          },
          "other-server": {
            command: "python",
            args: ["server.py"]
          }
        }
      };

      fs.writeFileSync(
        path.join(cursorDir, "mcp.json"),
        JSON.stringify(outdatedConfig, null, 2)
      );

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

      const updated = JSON.parse(fs.readFileSync(path.join(cursorDir, "mcp.json"), "utf-8"));
      expect(updated.mcpServers["codebase-memory-mcp"]).toEqual({
        command: "bunx",
        args: ["codebase-memory-mcp"]
      });
      expect(updated.mcpServers["other-server"]).toEqual({
        command: "python",
        args: ["server.py"]
      });

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.targets[0].action).toBe("update");
      expect(parsed.targets[0].status).toBe("updated");
    });

    it("prevents destructive overwrites when encountering corrupted or malformed JSON files (AC-2.1)", async () => {
      const cursorDir = path.join(tempDir, ".cursor");
      fs.mkdirSync(cursorDir, { recursive: true });
      const corruptedPath = path.join(cursorDir, "mcp.json");
      const corruptedContent = "{\n  \"invalid\": true,\n  corrupted: [ missing quotes\n";
      fs.writeFileSync(corruptedPath, corruptedContent, "utf-8");

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

      // Must exit with error to prevent data destruction
      expect(proc.exitCode).toBe(1);

      // Must NOT destroy the original file content
      const contentAfter = fs.readFileSync(corruptedPath, "utf-8");
      expect(contentAfter).toBe(corruptedContent);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.status).toBe("error");
      expect(parsed.targets[0].status).toBe("error");
      expect(parsed.targets[0].error).toContain("JSON");
    });

    it("achieves true idempotence on already configured targets without redundant disk writes (AC-2.2)", async () => {
      const geminiDir = path.join(tempDir, ".gemini");
      fs.mkdirSync(geminiDir, { recursive: true });
      const configPath = path.join(geminiDir, "settings.json");

      const readyConfig = {
        mcpServers: {
          "codebase-memory-mcp": {
            command: "bunx",
            args: ["codebase-memory-mcp"]
          }
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(readyConfig, null, 2) + "\n", "utf-8");

      // Mark file as read-only (0o444)
      fs.chmodSync(configPath, 0o444);

      try {
        const proc = Bun.spawnSync([
          "bun",
          "run",
          cliPath,
          "mcp",
          "wire",
          tempDir,
          "--targets",
          "gemini",
          "--json"
        ]);

        // If wireMcpTargets attempted to rewrite the unchanged file, it would fail with EACCES
        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString().trim());
        expect(parsed.status).toBe("success");
        expect(parsed.targets[0].action).toBe("unchanged");
        expect(parsed.targets[0].status).toBe("unchanged");
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(configPath, 0o644);
      }
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

    it("accurately reports planned actions (create, update, unchanged) in dry-run without writing to disk", async () => {
      const cursorDir = path.join(tempDir, ".cursor");
      const geminiDir = path.join(tempDir, ".gemini");
      fs.mkdirSync(cursorDir, { recursive: true });
      fs.mkdirSync(geminiDir, { recursive: true });

      // Cursor: already configured -> unchanged
      fs.writeFileSync(
        path.join(cursorDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            "codebase-memory-mcp": {
              command: "bunx",
              args: ["codebase-memory-mcp"]
            }
          }
        })
      );

      // Gemini: outdated -> update
      fs.writeFileSync(
        path.join(geminiDir, "settings.json"),
        JSON.stringify({
          mcpServers: {
            "codebase-memory-mcp": {
              command: "bunx",
              args: ["old-version"]
            }
          }
        })
      );

      // Claude: does not exist -> create

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

      // Verify no Claude directory was created
      expect(fs.existsSync(path.join(tempDir, ".claude"))).toBe(false);

      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.status).toBe("planned");
      expect(parsed.dryRun).toBe(true);

      const cursorTarget = parsed.targets.find((t: any) => t.target === "cursor");
      const geminiTarget = parsed.targets.find((t: any) => t.target === "gemini");
      const claudeTarget = parsed.targets.find((t: any) => t.target === "claude");

      expect(cursorTarget.action).toBe("unchanged");
      expect(cursorTarget.status).toBe("planned");

      expect(geminiTarget.action).toBe("update");
      expect(geminiTarget.status).toBe("planned");

      expect(claudeTarget.action).toBe("create");
      expect(claudeTarget.status).toBe("planned");

      // Verify original files were untouched
      const geminiRaw = JSON.parse(fs.readFileSync(path.join(geminiDir, "settings.json"), "utf-8"));
      expect(geminiRaw.mcpServers["codebase-memory-mcp"].args).toEqual(["old-version"]);
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
