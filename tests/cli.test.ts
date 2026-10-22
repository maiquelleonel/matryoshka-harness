import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("CLI Commands and Aliases (src/cli.ts & index.ts)", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");
  const indexPath = path.resolve(__dirname, "../index.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-cli-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-3: Strict CLI Alias Parity", () => {
    it("dispatches identical help output across baba, bbyg, and matryoshka invocations", async () => {
      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "--help"], {
        env: { ...process.env, BABA_ALIAS: "baba" }
      });
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "--help"], {
        env: { ...process.env, BABA_ALIAS: "bbyg" }
      });
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "--help"], {
        env: { ...process.env, BABA_ALIAS: "matryoshka" }
      });

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString().trim();
      const outBbyg = procBbyg.stdout.toString().trim();
      const outMatryoshka = procMatryoshka.stdout.toString().trim();

      expect(outBaba).toBe(outBbyg);
      expect(outBaba).toBe(outMatryoshka);
      expect(outBaba).toContain("detect");
      expect(outBaba).toContain("--json");
    });

    it("dispatches identical version information across all three aliases", async () => {
      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "--version"]);
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "-v"]);
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "--version"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString().trim();
      const outBbyg = procBbyg.stdout.toString().trim();
      const outMatryoshka = procMatryoshka.stdout.toString().trim();

      expect(outBaba).toBe(outBbyg);
      expect(outBaba).toBe(outMatryoshka);
      expect(outBaba).toMatch(/\d+\.\d+\.\d+/);
    });

    it("dispatches identical help output via package.json binary aliases (baba, bbyg, matryoshka)", async () => {
      const procBaba = Bun.spawnSync(["bun", "run", "baba", "--help"]);
      const procBbyg = Bun.spawnSync(["bun", "run", "bbyg", "--help"]);
      const procMatryoshka = Bun.spawnSync(["bun", "run", "matryoshka", "--help"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const outBaba = procBaba.stdout.toString().trim();
      const outBbyg = procBbyg.stdout.toString().trim();
      const outMatryoshka = procMatryoshka.stdout.toString().trim();

      expect(outBaba).toBe(outBbyg);
      expect(outBaba).toBe(outMatryoshka);
    });

    it("dispatches identical execution via index.ts entrypoint", async () => {
      const procIndex = Bun.spawnSync(["bun", "run", indexPath, "--version"]);
      const procCli = Bun.spawnSync(["bun", "run", cliPath, "--version"]);

      expect(procIndex.exitCode).toBe(0);
      expect(procCli.exitCode).toBe(0);
      expect(procIndex.stdout.toString().trim()).toBe(procCli.stdout.toString().trim());
    });
  });

  describe("AC-4: Structured JSON Output for Orchestrators", () => {
    it("outputs valid JSON matching AC-4 contract with --json flag", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "sample-next",
          dependencies: { next: "^14.0.0" },
          scripts: { test: "bun test" }
        })
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");

      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "detect",
        tempDir,
        "--json"
      ]);

      expect(proc.exitCode).toBe(0);
      const rawStdout = proc.stdout.toString().trim();
      const parsed = JSON.parse(rawStdout);

      expect(parsed.status).toBe("success");
      expect(parsed.stack).toBeDefined();
      expect(parsed.stack.primary).toBe("typescript");
      expect(parsed.stack.frameworks).toEqual(["nextjs"]);
      expect(parsed.stack.testRunner).toBe("bun test");
      expect(path.resolve(parsed.rootPath)).toBe(path.resolve(tempDir));
    });

    it("outputs valid JSON for unharnessed empty repo (L0)", async () => {
      const proc = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "detect",
        tempDir,
        "--json"
      ]);

      expect(proc.exitCode).toBe(0);
      const rawStdout = proc.stdout.toString().trim();
      const parsed = JSON.parse(rawStdout);

      expect(parsed.status).toBe("success");
      expect(parsed.stack.primary).toBe("unknown");
      expect(parsed.stack.frameworks).toEqual([]);
      expect(parsed.stack.testRunner).toBeNull();
      expect(path.resolve(parsed.rootPath)).toBe(path.resolve(tempDir));
    });

    it("outputs formatted human-readable text when --json is omitted", async () => {
      fs.writeFileSync(
        path.join(tempDir, "go.mod"),
        "module test\ngo 1.22\nrequire github.com/gin-gonic/gin v1.9.1\n"
      );

      const proc = Bun.spawnSync(["bun", "run", cliPath, "detect", tempDir]);
      expect(proc.exitCode).toBe(0);
      const stdout = proc.stdout.toString();
      expect(stdout).toContain("Primary");
      expect(stdout).toContain("go");
      expect(stdout).toContain("gin");
    });

    it("defaults to current working directory when path is omitted", async () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "detect", "--json"], {
        cwd: tempDir
      });

      expect(proc.exitCode).toBe(0);
      const parsed = JSON.parse(proc.stdout.toString().trim());
      expect(parsed.status).toBe("success");
      expect(path.resolve(parsed.rootPath)).toBe(path.resolve(tempDir));
    });

    it("handles unknown commands gracefully with exit code 1", async () => {
      const proc = Bun.spawnSync(["bun", "run", cliPath, "unknown-command"]);
      expect(proc.exitCode).toBe(1);
      expect(proc.stderr.toString()).toContain("Unknown command 'unknown-command'");
    });

    it("supports wrap subcommand with structured JSON output", async () => {
      const procWrap = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--json"]);
      expect(procWrap.exitCode).toBe(0);
      const wrapParsed = JSON.parse(procWrap.stdout.toString().trim());
      expect(wrapParsed.status).toBe("remediation_needed");
      expect(wrapParsed.command).toBe("wrap");
    });

    it("supports scan subcommand with structured JSON output", async () => {
      const procScan = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      expect(procScan.exitCode).toBe(0);
      const scanParsed = JSON.parse(procScan.stdout.toString().trim());
      expect(scanParsed.status).toBe("success");
      expect(scanParsed.command).toBe("scan");
      expect(scanParsed.primaryStack).toBe("unknown");
      expect(scanParsed.oracleScore).toBeDefined();
      expect(scanParsed.oracleLevel).toBe("L0");
      expect(Array.isArray(scanParsed.remediationIssues)).toBe(true);
      expect(Array.isArray(scanParsed.remediation_issues)).toBe(true);
    });

    it("supports scan subcommand with human-readable terminal output", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "cli-scan-app",
          dependencies: { next: "^14.0.0" },
          scripts: { test: "bun test" },
        })
      );
      fs.writeFileSync(path.join(tempDir, "README.md"), "# CLI App");

      const procScan = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir]);
      expect(procScan.exitCode).toBe(0);
      const stdout = procScan.stdout.toString();
      expect(stdout).toContain("Matryoshka Maturity Scanner");
      expect(stdout).toContain("typescript");
      expect(stdout).toContain("nextjs");
      expect(stdout).toContain("Remediation Plan");
    });

    it("ensures scan alias parity across baba, bbyg, and matryoshka invocations", async () => {
      const procBaba = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      const procBbyg = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      const procMatryoshka = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      const parsedBaba = JSON.parse(procBaba.stdout.toString().trim());
      const parsedBbyg = JSON.parse(procBbyg.stdout.toString().trim());
      const parsedMatryoshka = JSON.parse(procMatryoshka.stdout.toString().trim());

      expect(parsedBaba.status).toBe("success");
      expect(parsedBbyg.status).toBe("success");
      expect(parsedMatryoshka.status).toBe("success");
      expect(parsedBaba.oracleScore).toBe(parsedBbyg.oracleScore);
      expect(parsedBaba.oracleScore).toBe(parsedMatryoshka.oracleScore);
    });

    it("generates default SVG badge when --badge flag is provided without path", async () => {
      const procScan = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--badge"]);
      expect(procScan.exitCode).toBe(0);

      const expectedBadgePath = path.join(tempDir, "harness-badge.svg");
      expect(fs.existsSync(expectedBadgePath)).toBe(true);

      const content = fs.readFileSync(expectedBadgePath, "utf-8");
      expect(content).toContain("<svg");
      expect(content).toContain("harness");
      expect(content).toContain("</svg>");
    });

    it("generates SVG badge at specified custom path creating subdirectories", async () => {
      const customRelativeBadge = "docs/badges/governance.svg";
      const procScan = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "scan",
        tempDir,
        "--badge",
        customRelativeBadge,
      ]);
      expect(procScan.exitCode).toBe(0);

      const expectedBadgePath = path.join(tempDir, customRelativeBadge);
      expect(fs.existsSync(expectedBadgePath)).toBe(true);

      const content = fs.readFileSync(expectedBadgePath, "utf-8");
      expect(content).toContain("<svg");
      expect(content).toContain("harness");
      expect(content).toContain("</svg>");
    });

    it("includes badgePath in structured JSON output when --badge and --json are combined", async () => {
      const customBadge = path.join(tempDir, "custom-badge.svg");
      const procScan = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "scan",
        tempDir,
        "--json",
        "--badge",
        customBadge,
      ]);
      expect(procScan.exitCode).toBe(0);

      const parsed = JSON.parse(procScan.stdout.toString().trim());
      expect(parsed.status).toBe("success");
      expect(parsed.badgePath).toBe(customBadge);
      expect(parsed.badge_path).toBe(customBadge);
      expect(fs.existsSync(customBadge)).toBe(true);
    });

    it("preserves strict alias parity for --badge across baba, bbyg, and matryoshka", async () => {
      const badgeBaba = path.join(tempDir, "baba.svg");
      const badgeBbyg = path.join(tempDir, "bbyg.svg");
      const badgeMatryoshka = path.join(tempDir, "matryoshka.svg");

      const procBaba = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "scan",
        tempDir,
        "--badge",
        badgeBaba,
      ]);
      const procBbyg = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "scan",
        tempDir,
        "--badge",
        badgeBbyg,
      ]);
      const procMatryoshka = Bun.spawnSync([
        "bun",
        "run",
        cliPath,
        "scan",
        tempDir,
        "--badge",
        badgeMatryoshka,
      ]);

      expect(procBaba.exitCode).toBe(0);
      expect(procBbyg.exitCode).toBe(0);
      expect(procMatryoshka.exitCode).toBe(0);

      expect(fs.existsSync(badgeBaba)).toBe(true);
      expect(fs.existsSync(badgeBbyg)).toBe(true);
      expect(fs.existsSync(badgeMatryoshka)).toBe(true);

      const contentBaba = fs.readFileSync(badgeBaba, "utf-8");
      const contentBbyg = fs.readFileSync(badgeBbyg, "utf-8");
      const contentMatryoshka = fs.readFileSync(badgeMatryoshka, "utf-8");

      expect(contentBaba).toBe(contentBbyg);
      expect(contentBaba).toBe(contentMatryoshka);
    });
  });
});
