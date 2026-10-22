import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PassThrough } from "node:stream";
import {
  McpServer,
  createMatryoshkaMcpServer,
  JSONRPC_PARSE_ERROR,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_INVALID_PARAMS,
  JSONRPC_INTERNAL_ERROR,
  MCP_PROTOCOL_VERSION,
} from "../src/mcp-server";

describe("SPEC-12: Native MCP Server (Subtask 1: stdio transport & message dispatcher)", () => {
  let tempDir: string;
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-mcp-server-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Scenario 1: JSON-RPC 2.0 Message Parsing & Schema Validation", () => {
    it("returns -32700 Parse error on malformed JSON", async () => {
      const server = new McpServer();
      const raw = "{ malformed json ...";
      const res = await server.handleRawMessage(raw);
      expect(res).not.toBeNull();
      const parsed = JSON.parse(res!);
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBeNull();
      expect(parsed.error.code).toBe(JSONRPC_PARSE_ERROR);
      expect(parsed.error.message).toContain("Parse error");
    });

    it("returns -32600 Invalid Request when payload is not an object or missing jsonrpc 2.0", async () => {
      const server = new McpServer();

      // Array payload
      const resArray = await server.handleRawMessage("[]");
      const parsedArray = JSON.parse(resArray!);
      expect(parsedArray.error.code).toBe(JSONRPC_INVALID_REQUEST);

      // Primitive string
      const resPrim = await server.handleRawMessage('"hello"');
      const parsedPrim = JSON.parse(resPrim!);
      expect(parsedPrim.error.code).toBe(JSONRPC_INVALID_REQUEST);

      // Missing jsonrpc: "2.0"
      const resNoRpc = await server.handleRawMessage(JSON.stringify({ id: 1, method: "ping" }));
      const parsedNoRpc = JSON.parse(resNoRpc!);
      expect(parsedNoRpc.error.code).toBe(JSONRPC_INVALID_REQUEST);

      // Wrong jsonrpc version
      const resWrongRpc = await server.handleRawMessage(
        JSON.stringify({ jsonrpc: "1.0", id: 2, method: "ping" })
      );
      const parsedWrongRpc = JSON.parse(resWrongRpc!);
      expect(parsedWrongRpc.error.code).toBe(JSONRPC_INVALID_REQUEST);
    });

    it("returns -32601 Method not found for unregistered methods", async () => {
      const server = new McpServer();
      const raw = JSON.stringify({
        jsonrpc: "2.0",
        id: 42,
        method: "non_existent_method",
        params: {},
      });
      const res = await server.handleRawMessage(raw);
      const parsed = JSON.parse(res!);
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(42);
      expect(parsed.error.code).toBe(JSONRPC_METHOD_NOT_FOUND);
      expect(parsed.error.message).toContain("Method not found");
    });
  });

  describe("Scenario 2: Protocol Handshake (initialize, ping, notifications/initialized)", () => {
    it("handles initialize request with serverInfo and capabilities", async () => {
      const server = new McpServer({
        serverInfo: { name: "matryoshka-mcp", version: "0.1.0" },
      });

      const initReq = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      });

      const resStr = await server.handleRawMessage(initReq);
      const res = JSON.parse(resStr!);
      expect(res.jsonrpc).toBe("2.0");
      expect(res.id).toBe(1);
      expect(res.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(res.result.serverInfo.name).toBe("matryoshka-mcp");
      expect(res.result.capabilities).toBeDefined();
      expect(res.result.capabilities.tools).toBeDefined();
    });

    it("handles ping request returning empty object", async () => {
      const server = new McpServer();
      const pingReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "req-ping-99",
        method: "ping",
      });

      const resStr = await server.handleRawMessage(pingReq);
      const res = JSON.parse(resStr!);
      expect(res.jsonrpc).toBe("2.0");
      expect(res.id).toBe("req-ping-99");
      expect(res.result).toEqual({});
    });

    it("handles notifications/initialized producing zero output (returns null)", async () => {
      const server = new McpServer();
      const notifReq = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      });

      const resStr = await server.handleRawMessage(notifReq);
      expect(resStr).toBeNull();
    });
  });

  describe("Scenario 3: Non-blocking Async Dispatching & Concurrency", () => {
    it("dispatches multiple concurrent requests asynchronously preserving id correlation", async () => {
      const server = new McpServer();

      server.registerMethod("delayed_echo", async (params: any) => {
        const delay = params?.delay || 10;
        await new Promise((r) => setTimeout(r, delay));
        return { echoed: params?.text };
      });

      const req1 = server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "req-fast",
          method: "delayed_echo",
          params: { text: "fast", delay: 10 },
        })
      );

      const req2 = server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "req-slow",
          method: "delayed_echo",
          params: { text: "slow", delay: 30 },
        })
      );

      const [res1Str, res2Str] = await Promise.all([req1, req2]);
      const res1 = JSON.parse(res1Str!);
      const res2 = JSON.parse(res2Str!);

      expect(res1.id).toBe("req-fast");
      expect(res1.result.echoed).toBe("fast");

      expect(res2.id).toBe("req-slow");
      expect(res2.result.echoed).toBe("slow");
    });
  });

  describe("Scenario 4: Stdio Stream Transport & Clean Stream Separation", () => {
    it("processes newline-delimited requests over stdio and writes strictly to stdout", async () => {
      const server = new McpServer();
      const stdinStream = new PassThrough();
      const stdoutStream = new PassThrough();
      const stderrStream = new PassThrough();

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      stdoutStream.on("data", (chunk) => stdoutChunks.push(chunk.toString()));
      stderrStream.on("data", (chunk) => stderrChunks.push(chunk.toString()));

      const transport = server.listenStdio({
        in: stdinStream,
        out: stdoutStream,
        err: stderrStream,
      });

      // Write ping request
      stdinStream.write(
        JSON.stringify({ jsonrpc: "2.0", id: 101, method: "ping" }) + "\n"
      );

      // Wait a moment for async processing
      await new Promise((r) => setTimeout(r, 50));

      expect(stdoutChunks.length).toBeGreaterThan(0);
      const combinedStdout = stdoutChunks.join("");
      const lines = combinedStdout.split("\n").filter((l) => l.trim().length > 0);
      expect(lines.length).toBe(1);

      const firstLine = lines[0];
      expect(firstLine).toBeDefined();
      const parsed = JSON.parse(firstLine!);
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(101);
      expect(parsed.result).toEqual({});

      transport.stop();
    });

    it("routes diagnostic logs and telemetry strictly to stderr without corrupting stdout", async () => {
      const server = new McpServer();
      const stdinStream = new PassThrough();
      const stdoutStream = new PassThrough();
      const stderrStream = new PassThrough();

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      stdoutStream.on("data", (chunk) => stdoutChunks.push(chunk.toString()));
      stderrStream.on("data", (chunk) => stderrChunks.push(chunk.toString()));

      const transport = server.listenStdio({
        in: stdinStream,
        out: stdoutStream,
        err: stderrStream,
      });

      server.log("diagnostic", "Harness reconnaissance started");

      stdinStream.write(
        JSON.stringify({ jsonrpc: "2.0", id: 202, method: "ping" }) + "\n"
      );

      await new Promise((r) => setTimeout(r, 50));

      const combinedStdout = stdoutChunks.join("");
      const combinedStderr = stderrChunks.join("");

      // stdout must be strictly valid JSON line
      const stdoutLines = combinedStdout.trim().split("\n");
      for (const line of stdoutLines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      // stderr must capture the telemetry log
      expect(combinedStderr).toContain("Harness reconnaissance started");

      transport.stop();
    });
  });

  describe("Scenario 5: Fail-Safe Tool Execution", () => {
    it("catches tool exceptions and returns tool error payload without crashing server", async () => {
      const server = new McpServer();

      server.registerTool(
        {
          name: "failing_tool",
          description: "A tool that throws an unexpected error",
          inputSchema: { type: "object" },
        },
        async () => {
          throw new Error("Simulated database failure");
        }
      );

      const callReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: {
          name: "failing_tool",
          arguments: {},
        },
      });

      const resStr = await server.handleRawMessage(callReq);
      const res = JSON.parse(resStr!);

      expect(res.jsonrpc).toBe("2.0");
      expect(res.id).toBe("call-1");
      expect(res.result).toBeDefined();
      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain("Simulated database failure");
    });
  });

  describe("Scenario 6: Native Matryoshka MCP Server Factory & Built-in Tools", () => {
    it("creates server instance with all 4 required tools registered", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "sample-app", devDependencies: { bun: "latest" } })
      );

      const server = createMatryoshkaMcpServer(tempDir);

      const listReq = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      });

      const resStr = await server.handleRawMessage(listReq);
      const res = JSON.parse(resStr!);

      expect(res.result.tools).toBeDefined();
      const toolNames = res.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain("detect_stack");
      expect(toolNames).toContain("scan_harness");
      expect(toolNames).toContain("generate_agents");
      expect(toolNames).toContain("wrap_context");
    });

    it("executes detect_stack tool via tools/call returning valid stack inspection", async () => {
      fs.writeFileSync(
        path.join(tempDir, "pyproject.toml"),
        `[project]\nname = "fastapi-app"\ndependencies = ["fastapi", "pytest"]\n`
      );

      const server = createMatryoshkaMcpServer(tempDir);

      const callReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "call-detect",
        method: "tools/call",
        params: {
          name: "detect_stack",
          arguments: { path: tempDir },
        },
      });

      const resStr = await server.handleRawMessage(callReq);
      const res = JSON.parse(resStr!);

      expect(res.result.isError).toBeFalsy();
      const content = res.result.content[0].text;
      const parsedData = JSON.parse(content);
      expect(parsedData.status).toBe("success");
      expect(parsedData.stack.primary).toBe("python");
    });

    it("lists exposed resources and prompts", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // Resources list
      const resReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "r1",
        method: "resources/list",
      });
      const resStr = await server.handleRawMessage(resReq);
      const resResult = JSON.parse(resStr!);
      expect(resResult.result.resources).toBeDefined();
      const uris = resResult.result.resources.map((r: any) => r.uri);
      expect(uris).toContain("matryoshka://agents");
      expect(uris).toContain("matryoshka://diagnostic");

      // Prompts list
      const promptReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "p1",
        method: "prompts/list",
      });
      const promptStr = await server.handleRawMessage(promptReq);
      const promptResult = JSON.parse(promptStr!);
      expect(promptResult.result.prompts).toBeDefined();
      const promptNames = promptResult.result.prompts.map((p: any) => p.name);
      expect(promptNames).toContain("audit_repository");
    });
  });

  describe("Scenario 7: CLI Subcommand Integration (baba mcp serve)", () => {
    it("runs 'baba mcp serve' as a stdio MCP server responding to initialize", async () => {
      const proc = Bun.spawn(["bun", "run", cliPath, "mcp", "serve", tempDir], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      const initMsg =
        JSON.stringify({
          jsonrpc: "2.0",
          id: 555,
          method: "initialize",
          params: { protocolVersion: MCP_PROTOCOL_VERSION },
        }) + "\n";

      proc.stdin.write(initMsg);
      proc.stdin.flush();

      // Read response from stdout
      const reader = proc.stdout.getReader();
      const { value } = await reader.read();
      const stdoutText = new TextDecoder().decode(value);

      proc.kill();

      expect(stdoutText).toContain('"jsonrpc":"2.0"');
      expect(stdoutText).toContain('"id":555');
      const firstLine = stdoutText.trim().split("\n")[0];
      expect(firstLine).toBeDefined();
      const parsed = JSON.parse(firstLine!);
      expect(parsed.result.serverInfo.name).toBe("matryoshka-mcp");
    });
  });
});
