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

    it("supports scan and wrap subcommands with pending JSON responses", async () => {
      const procScan = Bun.spawnSync(["bun", "run", cliPath, "scan", tempDir, "--json"]);
      expect(procScan.exitCode).toBe(0);
      const scanParsed = JSON.parse(procScan.stdout.toString().trim());
      expect(scanParsed.status).toBe("pending");
      expect(scanParsed.command).toBe("scan");

      const procWrap = Bun.spawnSync(["bun", "run", cliPath, "wrap", tempDir, "--json"]);
      expect(procWrap.exitCode).toBe(0);
      const wrapParsed = JSON.parse(procWrap.stdout.toString().trim());
      expect(wrapParsed.status).toBe("pending");
      expect(wrapParsed.command).toBe("wrap");
    });
  });
});
