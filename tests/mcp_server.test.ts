import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PassThrough } from "node:stream";
import {
  McpServer,
  createMatryoshkaMcpServer,
  registerMatryoshkaTools,
  MATRYOSHKA_MCP_TOOLS,
  DETECT_STACK_TOOL_DEFINITION,
  SCAN_HARNESS_TOOL_DEFINITION,
  GENERATE_AGENTS_TOOL_DEFINITION,
  WRAP_CONTEXT_TOOL_DEFINITION,
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

      const firstLine = lines[0] ?? "";
      expect(firstLine).toBeDefined();
      const parsed = JSON.parse(firstLine);
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

  describe("Scenario AC-2: Subtask 2 - Tool registration & schema definitions", () => {
    it("exports canonical tool definitions with valid schemas (MATRYOSHKA_MCP_TOOLS)", () => {
      expect(MATRYOSHKA_MCP_TOOLS).toBeDefined();
      expect(MATRYOSHKA_MCP_TOOLS.length).toBe(4);

      const names = MATRYOSHKA_MCP_TOOLS.map((t) => t.name);
      expect(names).toContain("detect_stack");
      expect(names).toContain("scan_harness");
      expect(names).toContain("generate_agents");
      expect(names).toContain("wrap_context");

      for (const tool of MATRYOSHKA_MCP_TOOLS) {
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(tool.description.length).toBeGreaterThan(5);
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
      }

      // Check specific definitions
      expect(DETECT_STACK_TOOL_DEFINITION.name).toBe("detect_stack");
      expect(SCAN_HARNESS_TOOL_DEFINITION.name).toBe("scan_harness");
      expect(GENERATE_AGENTS_TOOL_DEFINITION.name).toBe("generate_agents");
      expect(WRAP_CONTEXT_TOOL_DEFINITION.name).toBe("wrap_context");

      // Verify generate_agents properties
      expect(GENERATE_AGENTS_TOOL_DEFINITION.inputSchema.properties?.force).toBeDefined();
      expect(GENERATE_AGENTS_TOOL_DEFINITION.inputSchema.properties?.dryRun).toBeDefined();

      // Verify wrap_context properties
      expect(WRAP_CONTEXT_TOOL_DEFINITION.inputSchema.properties?.threshold).toBeDefined();
    });

    it("provides server tool registry inspection methods (getTools, getTool, hasTool, unregisterTool)", () => {
      const server = createMatryoshkaMcpServer(tempDir);

      expect(server.getTools().length).toBe(4);
      expect(server.hasTool("detect_stack")).toBe(true);
      expect(server.hasTool("unknown_tool")).toBe(false);

      const toolDef = server.getTool("detect_stack");
      expect(toolDef).toBeDefined();
      expect(toolDef?.name).toBe("detect_stack");

      const unregSuccess = server.unregisterTool("detect_stack");
      expect(unregSuccess).toBe(true);
      expect(server.hasTool("detect_stack")).toBe(false);
      expect(server.getTools().length).toBe(3);

      const unregFail = server.unregisterTool("non_existent");
      expect(unregFail).toBe(false);
    });

    it("supports registerMatryoshkaTools helper on a bare McpServer", async () => {
      const bareServer = new McpServer();
      expect(bareServer.getTools().length).toBe(0);

      registerMatryoshkaTools(bareServer, tempDir);
      expect(bareServer.getTools().length).toBe(4);
      expect(bareServer.hasTool("wrap_context")).toBe(true);
    });

    it("validates tools/call parameters rejecting missing name and non-object arguments with -32602", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // Missing name
      const noName = await server.handleRawMessage(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {} })
      );
      expect(JSON.parse(noName!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-string name
      const nonStringName = await server.handleRawMessage(
        JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: 123 } })
      );
      expect(JSON.parse(nonStringName!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-object arguments (string)
      const stringArgs = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "detect_stack", arguments: "invalid" },
        })
      );
      expect(JSON.parse(stringArgs!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-object arguments (array)
      const arrayArgs = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "detect_stack", arguments: [1, 2, 3] },
        })
      );
      expect(JSON.parse(arrayArgs!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Unregistered tool
      const unreg = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "non_existent_tool", arguments: {} },
        })
      );
      const parsedUnreg = JSON.parse(unreg!);
      expect(parsedUnreg.result.isError).toBe(true);
      expect(parsedUnreg.result.content[0].text).toContain("Tool 'non_existent_tool' not found");
    });

    it("executes detect_stack tool via tools/call with default and explicit paths", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "my-ts-app", devDependencies: { vitest: "latest" } })
      );

      const server = createMatryoshkaMcpServer(tempDir);

      // Default path (empty arguments)
      const resDefault = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-default",
          method: "tools/call",
          params: { name: "detect_stack", arguments: {} },
        })
      );
      const parsedDefault = JSON.parse(resDefault!);
      expect(parsedDefault.result.isError).toBeFalsy();
      const dataDefault = JSON.parse(parsedDefault.result.content[0].text);
      expect(dataDefault.status).toBe("success");
      expect(dataDefault.stack.primary).toBe("javascript_typescript");

      // Sub-repo with python
      const pySubDir = path.join(tempDir, "python-sub");
      fs.mkdirSync(pySubDir, { recursive: true });
      fs.writeFileSync(
        path.join(pySubDir, "pyproject.toml"),
        `[project]\nname = "fastapi-service"\ndependencies = ["fastapi", "pytest"]\n`
      );

      const resExplicit = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-explicit",
          method: "tools/call",
          params: { name: "detect_stack", arguments: { path: pySubDir } },
        })
      );
      const parsedExplicit = JSON.parse(resExplicit!);
      expect(parsedExplicit.result.isError).toBeFalsy();
      const dataExplicit = JSON.parse(parsedExplicit.result.content[0].text);
      expect(dataExplicit.status).toBe("success");
      expect(dataExplicit.stack.primary).toBe("python");
    });

    it("executes scan_harness tool via tools/call returning maturity metrics", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "scan-test-app", scripts: { test: "bun test" } })
      );

      const server = createMatryoshkaMcpServer(tempDir);

      const resStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-scan",
          method: "tools/call",
          params: { name: "scan_harness", arguments: { path: tempDir } },
        })
      );
      const parsed = JSON.parse(resStr!);
      expect(parsed.result.isError).toBeFalsy();

      const scanData = JSON.parse(parsed.result.content[0].text);
      expect(scanData.score).toBeDefined();
      expect(scanData.level).toBeDefined();
      expect(scanData.primaryStack).toBe("javascript_typescript");
    });

    it("executes generate_agents tool via tools/call in dryRun and live modes with overwrite guardrails", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "agent-gen-app", scripts: { test: "bun test" } })
      );

      const server = createMatryoshkaMcpServer(tempDir);

      // 1. Dry run: touches 0 files
      const dryRunRes = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-gen-dry",
          method: "tools/call",
          params: { name: "generate_agents", arguments: { path: tempDir, dryRun: true } },
        })
      );
      const parsedDry = JSON.parse(dryRunRes!);
      expect(parsedDry.result.isError).toBeFalsy();
      const dryData = JSON.parse(parsedDry.result.content[0].text);
      expect(dryData.dryRun).toBe(true);
      expect(dryData.plannedFiles.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);

      // 2. Live run: creates AGENTS.md
      const liveRes = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-gen-live",
          method: "tools/call",
          params: { name: "generate_agents", arguments: { path: tempDir, force: true } },
        })
      );
      const parsedLive = JSON.parse(liveRes!);
      expect(parsedLive.result.isError).toBeFalsy();
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);

      // 3. Second run without force: catches overwrite error and returns tool error fail-safe
      const failRes = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-gen-noforce",
          method: "tools/call",
          params: { name: "generate_agents", arguments: { path: tempDir, force: false } },
        })
      );
      const parsedFail = JSON.parse(failRes!);
      expect(parsedFail.result.isError).toBe(true);
      expect(parsedFail.result.content[0].text).toContain("already exists");
    });

    it("executes wrap_context tool via tools/call returning composite score, violations, and action plan", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "wrap-app", scripts: { test: "bun test" } })
      );
      fs.writeFileSync(
        path.join(tempDir, "index.ts"),
        `export function add(a: number, b: number): number { return a + b; }\n`
      );

      const server = createMatryoshkaMcpServer(tempDir);

      const wrapRes = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-wrap",
          method: "tools/call",
          params: { name: "wrap_context", arguments: { path: tempDir, threshold: 75 } },
        })
      );
      const parsedWrap = JSON.parse(wrapRes!);
      expect(parsedWrap.result.isError).toBeFalsy();

      const wrapData = JSON.parse(parsedWrap.result.content[0].text);
      expect(wrapData.compositeScore).toBeDefined();
      expect(wrapData.status).toBeDefined();
      expect(wrapData.threshold).toBe(75);
      expect(wrapData.actionPlan).toBeDefined();
      expect(wrapData.action_plan).toBeDefined();
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
      const firstLine = stdoutText.trim().split("\n")[0] ?? "";
      expect(firstLine).toBeDefined();
      const parsed = JSON.parse(firstLine);
      expect(parsed.result.serverInfo.name).toBe("matryoshka-mcp");
    });
  });
});
