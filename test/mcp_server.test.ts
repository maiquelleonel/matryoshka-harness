import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PassThrough } from "node:stream";
import {
  McpServer,
  createMatryoshkaMcpServer,
  registerMatryoshkaTools,
  registerMatryoshkaResources,
  registerMatryoshkaPrompts,
  MATRYOSHKA_MCP_TOOLS,
  DETECT_STACK_TOOL_DEFINITION,
  SCAN_HARNESS_TOOL_DEFINITION,
  GENERATE_AGENTS_TOOL_DEFINITION,
  WRAP_CONTEXT_TOOL_DEFINITION,
  AGENTS_RESOURCE_DEFINITION,
  DIAGNOSTIC_RESOURCE_DEFINITION,
  MATRYOSHKA_MCP_RESOURCES,
  MATRYOSHKA_RESOURCE_URIS,
  AUDIT_REPOSITORY_PROMPT_DEFINITION,
  MATRYOSHKA_MCP_PROMPTS,
  MATRYOSHKA_PROMPT_NAMES,
  JSONRPC_PARSE_ERROR,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_INVALID_PARAMS,
  JSONRPC_INTERNAL_ERROR,
  MCP_PROTOCOL_VERSION,
  installStderrLoggingGuard,
  McpClient,
  type McpClientOptions,
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
      expect(["typescript", "javascript_typescript"]).toContain(dataDefault.stack.primary);

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
      expect(["typescript", "javascript_typescript"]).toContain(scanData.primaryStack);
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

  describe("Scenario AC-3: Subtask 3 - Resource & Prompt provider handlers", () => {
    it("exports canonical resource and prompt definitions", () => {
      expect(MATRYOSHKA_MCP_RESOURCES).toBeDefined();
      expect(MATRYOSHKA_MCP_RESOURCES.length).toBe(2);
      expect(MATRYOSHKA_RESOURCE_URIS).toEqual(["matryoshka://agents", "matryoshka://diagnostic"]);

      expect(AGENTS_RESOURCE_DEFINITION.uri).toBe("matryoshka://agents");
      expect(AGENTS_RESOURCE_DEFINITION.mimeType).toBe("text/markdown");
      expect(DIAGNOSTIC_RESOURCE_DEFINITION.uri).toBe("matryoshka://diagnostic");
      expect(DIAGNOSTIC_RESOURCE_DEFINITION.mimeType).toBe("text/markdown");

      expect(MATRYOSHKA_MCP_PROMPTS).toBeDefined();
      expect(MATRYOSHKA_MCP_PROMPTS.length).toBe(1);
      expect(MATRYOSHKA_PROMPT_NAMES).toEqual(["audit_repository"]);

      expect(AUDIT_REPOSITORY_PROMPT_DEFINITION.name).toBe("audit_repository");
      expect(AUDIT_REPOSITORY_PROMPT_DEFINITION.arguments).toBeDefined();
      const argNames = AUDIT_REPOSITORY_PROMPT_DEFINITION.arguments?.map((a) => a.name);
      expect(argNames).toContain("targetDir");
      expect(argNames).toContain("strict");
      expect(argNames).toContain("threshold");
    });

    it("provides server resource and prompt inspection methods", () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // Resources inspection
      expect(server.getResources().length).toBe(2);
      expect(server.hasResource("matryoshka://agents")).toBe(true);
      expect(server.hasResource("matryoshka://diagnostic")).toBe(true);
      expect(server.hasResource("matryoshka://unknown")).toBe(false);

      const agentRes = server.getResource("matryoshka://agents");
      expect(agentRes).toBeDefined();
      expect(agentRes?.uri).toBe("matryoshka://agents");

      const unregRes = server.unregisterResource("matryoshka://agents");
      expect(unregRes).toBe(true);
      expect(server.hasResource("matryoshka://agents")).toBe(false);
      expect(server.getResources().length).toBe(1);
      expect(server.unregisterResource("matryoshka://agents")).toBe(false);

      // Prompts inspection
      expect(server.getPrompts().length).toBe(1);
      expect(server.hasPrompt("audit_repository")).toBe(true);
      expect(server.hasPrompt("unknown_prompt")).toBe(false);

      const promptDef = server.getPrompt("audit_repository");
      expect(promptDef).toBeDefined();
      expect(promptDef?.name).toBe("audit_repository");

      const unregPrompt = server.unregisterPrompt("audit_repository");
      expect(unregPrompt).toBe(true);
      expect(server.hasPrompt("audit_repository")).toBe(false);
      expect(server.getPrompts().length).toBe(0);
      expect(server.unregisterPrompt("audit_repository")).toBe(false);
    });

    it("supports registerMatryoshkaResources and registerMatryoshkaPrompts on a bare McpServer", () => {
      const bareServer = new McpServer();
      expect(bareServer.getResources().length).toBe(0);
      expect(bareServer.getPrompts().length).toBe(0);

      registerMatryoshkaResources(bareServer, tempDir);
      registerMatryoshkaPrompts(bareServer, tempDir);

      expect(bareServer.getResources().length).toBe(2);
      expect(bareServer.hasResource("matryoshka://agents")).toBe(true);
      expect(bareServer.hasResource("matryoshka://diagnostic")).toBe(true);
      expect(bareServer.getPrompts().length).toBe(1);
      expect(bareServer.hasPrompt("audit_repository")).toBe(true);
    });

    it("handles resources/list returning all exposed resources", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      const resStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "res-list-1",
          method: "resources/list",
        })
      );
      const res = JSON.parse(resStr!);
      expect(res.jsonrpc).toBe("2.0");
      expect(res.id).toBe("res-list-1");
      expect(res.result.resources).toBeDefined();
      expect(res.result.resources.length).toBe(2);

      const uris = res.result.resources.map((r: any) => r.uri);
      expect(uris).toContain("matryoshka://agents");
      expect(uris).toContain("matryoshka://diagnostic");
    });

    it("handles resources/templates/list returning empty list", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      const resStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "tpl-1",
          method: "resources/templates/list",
        })
      );
      const res = JSON.parse(resStr!);
      expect(res.result.resourceTemplates).toEqual([]);
    });

    it("handles resources/read for matryoshka://agents with live and missing files", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // 1. Missing file -> returns placeholder
      const resMissingStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "read-agents-1",
          method: "resources/read",
          params: { uri: "matryoshka://agents" },
        })
      );
      const resMissing = JSON.parse(resMissingStr!);
      expect(resMissing.result.contents).toBeDefined();
      expect(resMissing.result.contents[0].uri).toBe("matryoshka://agents");
      expect(resMissing.result.contents[0].mimeType).toBe("text/markdown");
      expect(resMissing.result.contents[0].text).toContain("No AGENTS.md compiled yet");

      // 2. Existing file -> returns file content
      const sampleAgents = "# AGENTS.md\n\n## Canonical Commands\n- test: bun test\n";
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), sampleAgents, "utf-8");

      const resLiveStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "read-agents-2",
          method: "resources/read",
          params: { uri: "matryoshka://agents" },
        })
      );
      const resLive = JSON.parse(resLiveStr!);
      expect(resLive.result.contents[0].text).toBe(sampleAgents);
    });

    it("handles resources/read for matryoshka://diagnostic with live and missing files", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // 1. Missing file -> returns placeholder
      const resMissingStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "read-diag-1",
          method: "resources/read",
          params: { uri: "matryoshka://diagnostic" },
        })
      );
      const resMissing = JSON.parse(resMissingStr!);
      expect(resMissing.result.contents[0].uri).toBe("matryoshka://diagnostic");
      expect(resMissing.result.contents[0].text).toContain("No DIAGNOSTIC.md generated yet");

      // 2. Existing file -> returns file content
      const sampleDiag = "# DIAGNOSTIC.md\n\nScore: 85/100 (Level L3)\n";
      fs.writeFileSync(path.join(tempDir, "DIAGNOSTIC.md"), sampleDiag, "utf-8");

      const resLiveStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "read-diag-2",
          method: "resources/read",
          params: { uri: "matryoshka://diagnostic" },
        })
      );
      const resLive = JSON.parse(resLiveStr!);
      expect(resLive.result.contents[0].text).toBe(sampleDiag);
    });

    it("validates resources/read parameters rejecting missing, invalid, or unregistered uri with -32602", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // Missing uri
      const missingUri = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "err-uri-1",
          method: "resources/read",
          params: {},
        })
      );
      expect(JSON.parse(missingUri!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-string uri
      const nonStringUri = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "err-uri-2",
          method: "resources/read",
          params: { uri: 12345 },
        })
      );
      expect(JSON.parse(nonStringUri!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-object params
      const nonObjectParams = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "err-uri-3",
          method: "resources/read",
          params: "invalid",
        })
      );
      expect(JSON.parse(nonObjectParams!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Unregistered uri
      const unregUri = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "err-uri-4",
          method: "resources/read",
          params: { uri: "matryoshka://nonexistent" },
        })
      );
      const parsedUnreg = JSON.parse(unregUri!);
      expect(parsedUnreg.error.code).toBe(JSONRPC_INVALID_PARAMS);
      expect(parsedUnreg.error.message).toContain("Resource not found");
    });

    it("handles prompts/list returning all registered prompts with parameter schemas", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      const resStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "prompt-list-1",
          method: "prompts/list",
        })
      );
      const res = JSON.parse(resStr!);
      expect(res.jsonrpc).toBe("2.0");
      expect(res.id).toBe("prompt-list-1");
      expect(res.result.prompts).toBeDefined();
      expect(res.result.prompts.length).toBe(1);

      const prompt = res.result.prompts[0];
      expect(prompt.name).toBe("audit_repository");
      expect(prompt.description).toBeDefined();
      expect(prompt.arguments).toBeDefined();
      const argNames = prompt.arguments.map((a: any) => a.name);
      expect(argNames).toContain("targetDir");
      expect(argNames).toContain("strict");
      expect(argNames).toContain("threshold");
    });

    it("handles prompts/get for audit_repository with default and custom arguments", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // Default arguments
      const resDefaultStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "pget-1",
          method: "prompts/get",
          params: { name: "audit_repository" },
        })
      );
      const resDefault = JSON.parse(resDefaultStr!);
      expect(resDefault.result.messages).toBeDefined();
      expect(resDefault.result.messages.length).toBe(1);
      expect(resDefault.result.messages[0].role).toBe("user");
      const textDefault = resDefault.result.messages[0].content.text;
      expect(textDefault).toContain(tempDir);
      expect(textDefault).toContain("detect_stack");
      expect(textDefault).toContain("scan_harness");
      expect(textDefault).toContain("wrap_context");
      expect(textDefault).toContain("generate_agents");

      // Custom arguments with strict: true and threshold: 90
      const customSub = path.join(tempDir, "custom-sub");
      const resCustomStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "pget-2",
          method: "prompts/get",
          params: {
            name: "audit_repository",
            arguments: {
              targetDir: customSub,
              strict: true,
              threshold: 90,
            },
          },
        })
      );
      const resCustom = JSON.parse(resCustomStr!);
      const textCustom = resCustom.result.messages[0].content.text;
      expect(textCustom).toContain(customSub);
      expect(textCustom).toContain("strict");
      expect(textCustom).toContain("90");
    });

    it("validates prompts/get parameters rejecting missing, invalid, non-object arguments or unregistered prompts with -32602", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      // Missing name
      const missingName = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "pget-err-1",
          method: "prompts/get",
          params: {},
        })
      );
      expect(JSON.parse(missingName!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-string name
      const nonStringName = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "pget-err-2",
          method: "prompts/get",
          params: { name: 999 },
        })
      );
      expect(JSON.parse(nonStringName!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-object params
      const nonObjParams = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "pget-err-3",
          method: "prompts/get",
          params: "bad",
        })
      );
      expect(JSON.parse(nonObjParams!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Non-object arguments (array)
      const arrayArgs = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "pget-err-4",
          method: "prompts/get",
          params: { name: "audit_repository", arguments: [1, 2] },
        })
      );
      expect(JSON.parse(arrayArgs!).error.code).toBe(JSONRPC_INVALID_PARAMS);

      // Unregistered prompt name
      const unregPrompt = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "pget-err-5",
          method: "prompts/get",
          params: { name: "unknown_prompt" },
        })
      );
      const parsedUnreg = JSON.parse(unregPrompt!);
      expect(parsedUnreg.error.code).toBe(JSONRPC_INVALID_PARAMS);
      expect(parsedUnreg.error.message).toContain("Prompt not found");
    });

    it("handles resource and prompt execution failures fail-safe returning -32603", async () => {
      const server = new McpServer();

      server.registerResource(
        {
          uri: "matryoshka://error-resource",
          name: "Error Resource",
          mimeType: "text/plain",
        },
        async () => {
          throw new Error("Disk read failure");
        }
      );

      server.registerPrompt(
        {
          name: "error_prompt",
          description: "Throws an error",
        },
        async () => {
          throw new Error("Prompt compilation crashed");
        }
      );

      // Resource error
      const resErrStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "res-err-1",
          method: "resources/read",
          params: { uri: "matryoshka://error-resource" },
        })
      );
      const resErr = JSON.parse(resErrStr!);
      expect(resErr.error.code).toBe(JSONRPC_INTERNAL_ERROR);
      expect(resErr.error.message).toContain("Disk read failure");

      // Prompt error
      const promptErrStr = await server.handleRawMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "p-err-1",
          method: "prompts/get",
          params: { name: "error_prompt" },
        })
      );
      const promptErr = JSON.parse(promptErrStr!);
      expect(promptErr.error.code).toBe(JSONRPC_INTERNAL_ERROR);
      expect(promptErr.error.message).toContain("Prompt compilation crashed");
    });
  });

  describe("Scenario AC-4: Subtask 4 - CLI integration (baba mcp serve) with stderr logging guards", () => {
    it("installs and uninstalls stderr logging guard redirecting console methods cleanly", () => {
      const capturedChunks: string[] = [];
      const mockStderr = {
        write: (str: string) => {
          capturedChunks.push(str);
          return true;
        },
      } as any;

      const uninstall = installStderrLoggingGuard({
        stderr: mockStderr,
        prefix: "[test-guard]",
      });

      console.log("hello stdout log");
      console.info("hello info log");
      console.warn("hello warn log");
      console.debug("hello debug log");

      expect(capturedChunks.length).toBe(4);
      expect(capturedChunks[0]).toContain("[test-guard] [info] hello stdout log");
      expect(capturedChunks[1]).toContain("[test-guard] [info] hello info log");
      expect(capturedChunks[2]).toContain("[test-guard] [warn] hello warn log");
      expect(capturedChunks[3]).toContain("[test-guard] [debug] hello debug log");

      uninstall();

      const countBefore = capturedChunks.length;
      console.log("another log after uninstall");
      expect(capturedChunks.length).toBe(countBefore);
    });

    it("listenStdio guards console output and emits startup notice to stderr", async () => {
      const server = new McpServer();
      server.registerTool(
        {
          name: "noisy_tool",
          description: "A tool that accidentally calls console.log",
          inputSchema: { type: "object" },
        },
        async () => {
          console.log("A noisy internal library log");
          return { status: "clean" };
        }
      );

      const inStream = new PassThrough();
      const outStream = new PassThrough();
      const errStream = new PassThrough();

      const outChunks: string[] = [];
      const errChunks: string[] = [];

      outStream.on("data", (chunk) => outChunks.push(chunk.toString()));
      errStream.on("data", (chunk) => errChunks.push(chunk.toString()));

      const listener = server.listenStdio({
        in: inStream,
        out: outStream,
        err: errStream,
      });

      // Verify startup notice was emitted to stderr
      expect(errChunks.some((c) => c.includes("Matryoshka MCP server listening on stdio"))).toBe(true);

      // Call noisy tool
      const callMsg =
        JSON.stringify({
          jsonrpc: "2.0",
          id: "call-noisy",
          method: "tools/call",
          params: { name: "noisy_tool", arguments: {} },
        }) + "\n";

      inStream.write(callMsg);
      await new Promise((resolve) => setTimeout(resolve, 50));

      listener.stop();

      // Check stdout contains ONLY valid JSON-RPC
      const rawOut = outChunks.join("").trim();
      expect(rawOut.length).toBeGreaterThan(0);
      const parsedOut = JSON.parse(rawOut);
      expect(parsedOut.jsonrpc).toBe("2.0");
      expect(parsedOut.id).toBe("call-noisy");
      expect(parsedOut.result.content[0].text).toContain("clean");

      // Check stderr captured the noisy log
      const rawErr = errChunks.join("");
      expect(rawErr).toContain("A noisy internal library log");
    });

    it("routes telemetry for all protocol operations strictly to stderr", async () => {
      const server = createMatryoshkaMcpServer(tempDir);

      const inStream = new PassThrough();
      const outStream = new PassThrough();
      const errStream = new PassThrough();

      const outChunks: string[] = [];
      const errChunks: string[] = [];

      outStream.on("data", (chunk) => outChunks.push(chunk.toString()));
      errStream.on("data", (chunk) => errChunks.push(chunk.toString()));

      const listener = server.listenStdio({
        in: inStream,
        out: outStream,
        err: errStream,
      });

      // 1. Initialize
      inStream.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: MCP_PROTOCOL_VERSION },
        }) + "\n"
      );

      // 2. Tool call
      inStream.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "detect_stack", arguments: {} },
        }) + "\n"
      );

      // 3. Resource read
      inStream.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "resources/read",
          params: { uri: "matryoshka://agents" },
        }) + "\n"
      );

      // 4. Prompt get
      inStream.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "prompts/get",
          params: { name: "audit_repository" },
        }) + "\n"
      );

      // 5. Malformed payload
      inStream.write("{ bad-json ...\n");

      await new Promise((resolve) => setTimeout(resolve, 80));
      listener.stop();

      const rawErr = errChunks.join("");
      expect(rawErr).toContain("initialize");
      expect(rawErr).toContain("detect_stack");
      expect(rawErr).toContain("matryoshka://agents");
      expect(rawErr).toContain("audit_repository");
      expect(rawErr).toContain("Parse error");

      // All stdout messages are valid JSON-RPC
      const lines = outChunks.join("").trim().split("\n").filter(Boolean);
      expect(lines.length).toBe(5);
      for (const line of lines) {
        const msg = JSON.parse(line);
        expect(msg.jsonrpc).toBe("2.0");
      }
    });

    it("runs 'baba mcp serve [path]' with startup notice on stderr and pure JSON on stdout", async () => {
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

      // Read response from stderr
      const errReader = proc.stderr.getReader();
      const { value: errValue } = await errReader.read();
      const stderrText = new TextDecoder().decode(errValue);

      proc.kill();

      expect(stdoutText).toContain('"jsonrpc":"2.0"');
      expect(stdoutText).toContain('"id":555');
      const firstLine = stdoutText.trim().split("\n")[0] ?? "";
      const parsed = JSON.parse(firstLine);
      expect(parsed.result.serverInfo.name).toBe("matryoshka-mcp");

      expect(stderrText).toContain("[matryoshka-mcp]");
      expect(stderrText).toContain("Matryoshka MCP server listening on stdio");
    });

    it("ensures CLI alias parity across baba, bbyg, and matryoshka for mcp serve", async () => {
      const runMcpServeInit = async (binAlias: string) => {
        const proc = Bun.spawn(["bun", "run", binAlias, "mcp", "serve", tempDir], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        });

        const initMsg =
          JSON.stringify({
            jsonrpc: "2.0",
            id: 101,
            method: "initialize",
            params: { protocolVersion: MCP_PROTOCOL_VERSION },
          }) + "\n";

        proc.stdin.write(initMsg);
        proc.stdin.flush();

        const reader = proc.stdout.getReader();
        const { value } = await reader.read();
        const stdoutText = new TextDecoder().decode(value);

        const errReader = proc.stderr.getReader();
        const { value: errVal } = await errReader.read();
        const stderrText = new TextDecoder().decode(errVal);

        proc.kill();

        const firstLine = stdoutText.trim().split("\n")[0] ?? "";
        const parsed = JSON.parse(firstLine);

        return { parsed, stderrText };
      };

      const babaRes = await runMcpServeInit("baba");
      const bbygRes = await runMcpServeInit("bbyg");
      const matryoshkaRes = await runMcpServeInit("matryoshka");

      expect(babaRes.parsed.result.serverInfo.name).toBe("matryoshka-mcp");
      expect(bbygRes.parsed.result.serverInfo.name).toBe("matryoshka-mcp");
      expect(matryoshkaRes.parsed.result.serverInfo.name).toBe("matryoshka-mcp");

      expect(babaRes.stderrText).toContain("Matryoshka MCP server listening on stdio");
      expect(bbygRes.stderrText).toContain("Matryoshka MCP server listening on stdio");
      expect(matryoshkaRes.stderrText).toContain("Matryoshka MCP server listening on stdio");
    });

    it("serves custom target directory passed via positional CLI argument", async () => {
      const pySubDir = path.join(tempDir, "python-sub-repo");
      fs.mkdirSync(pySubDir, { recursive: true });
      fs.writeFileSync(
        path.join(pySubDir, "pyproject.toml"),
        `[project]\nname = "microservice-py"\ndependencies = ["fastapi", "pytest"]\n`
      );

      const proc = Bun.spawn(["bun", "run", cliPath, "mcp", "serve", pySubDir], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      const callDetectMsg =
        JSON.stringify({
          jsonrpc: "2.0",
          id: 777,
          method: "tools/call",
          params: { name: "detect_stack", arguments: {} },
        }) + "\n";

      proc.stdin.write(callDetectMsg);
      proc.stdin.flush();

      const reader = proc.stdout.getReader();
      const { value } = await reader.read();
      const stdoutText = new TextDecoder().decode(value);

      proc.kill();

      const line = stdoutText.trim().split("\n")[0] ?? "";
      const parsed = JSON.parse(line);
      expect(parsed.result.isError).toBeFalsy();
      const payload = JSON.parse(parsed.result.content[0].text);
      expect(payload.stack.primary).toBe("python");
      expect(payload.rootPath).toBe(pySubDir);
    });

    it("supports 'baba mcp serve --help' and rejects unknown subcommands gracefully", () => {
      // 1. Help flag
      const helpProc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "serve", "--help"]);
      expect(helpProc.exitCode).toBe(0);
      const helpText = helpProc.stdout.toString();
      expect(helpText).toContain("Usage: baba mcp serve [path]");
      expect(helpText).toContain("stdout");
      expect(helpText).toContain("stderr");

      // 2. Unknown subcommand
      const unknownProc = Bun.spawnSync(["bun", "run", cliPath, "mcp", "invalid_sub"]);
      expect(unknownProc.exitCode).toBe(1);
      const errText = unknownProc.stderr.toString();
      expect(errText).toContain("Unknown subcommand 'invalid_sub'");
      expect(errText).toContain("Usage: baba mcp");
    });
  });

  describe("Scenario AC-5: Subtask 5 - BDD acceptance tests verifying MCP client handshake and tool invocation", () => {
    function setupWorkspace(dir: string): void {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify(
          {
            name: "sample-service",
            version: "1.0.0",
            scripts: { test: "bun test", build: "bun run build" },
            dependencies: { fastapi: "false" },
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(dir, "bun.lock"), "");
      fs.writeFileSync(path.join(dir, "README.md"), "# Sample Service\n");

      const srcDir = path.join(dir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "index.ts"),
        `export function greet(name: string): string { return "Hello, " + name; }\n`
      );

      const testDir = path.join(dir, "tests");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(
        path.join(testDir, "index.test.ts"),
        `import { describe, it, expect } from "bun:test";\nimport { greet } from "../src/index";\ndescribe("greet", () => {\n  it("greets", () => { expect(greet("world")).toBe("Hello, world"); });\n});\n`
      );
    }

    it("AC-5.1: establishes complete handshake lifecycle (initialize, notifications/initialized, ping)", async () => {
      setupWorkspace(tempDir);
      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      // 1. initialize
      const initResult = await client.initialize({
        name: "test-cursor-agent",
        version: "1.2.3",
      });

      expect(initResult.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(initResult.serverInfo.name).toBe("matryoshka-mcp");
      expect(initResult.serverInfo.version).toBe("0.1.0");
      expect(initResult.capabilities.tools).toBeDefined();
      expect(initResult.capabilities.resources).toBeDefined();
      expect(initResult.capabilities.prompts).toBeDefined();

      // 2. notifications/initialized
      const stdoutCountBefore = client.getStdoutLines().length;
      client.notify("notifications/initialized");
      // Give tiny tick to verify no response emitted for notification
      await new Promise((r) => setTimeout(r, 40));
      expect(client.getStdoutLines().length).toBe(stdoutCountBefore);

      // 3. ping
      const pingResult = await client.ping();
      expect(pingResult).toEqual({});

      await client.close();
    });

    it("AC-5.2: inspects registered tools schemas via tools/list", async () => {
      setupWorkspace(tempDir);
      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      await client.initialize();

      const tools = await client.listTools();
      expect(tools.length).toBe(4);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("detect_stack");
      expect(toolNames).toContain("scan_harness");
      expect(toolNames).toContain("generate_agents");
      expect(toolNames).toContain("wrap_context");

      for (const tool of tools) {
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
      }

      await client.close();
    });

    it("AC-5.3: executes canonical tools end-to-end on target repository (detect_stack, scan_harness, generate_agents, wrap_context)", async () => {
      setupWorkspace(tempDir);
      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      await client.initialize();

      // 1. detect_stack
      const detectCall = await client.callTool("detect_stack", {});
      expect(detectCall.isError).toBeFalsy();
      expect(detectCall.content.length).toBeGreaterThan(0);
      const detectData = JSON.parse(detectCall.content[0].text!);
      expect(detectData.status).toBe("success");
      expect(detectData.stack.primary).toBe("typescript");
      expect(detectData.rootPath).toBe(tempDir);

      // 2. scan_harness
      const scanCall = await client.callTool("scan_harness", {});
      expect(scanCall.isError).toBeFalsy();
      const scanData = JSON.parse(scanCall.content[0].text!);
      expect(typeof scanData.score).toBe("number");
      expect(scanData.score).toBeGreaterThanOrEqual(0);
      expect(scanData.level).toBeDefined();
      expect(Array.isArray(scanData.gaps)).toBe(true);

      // 3. generate_agents in dryRun
      const dryRunCall = await client.callTool("generate_agents", { dryRun: true });
      expect(dryRunCall.isError).toBeFalsy();
      const dryRunData = JSON.parse(dryRunCall.content[0].text!);
      expect(dryRunData.dryRun).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(false);

      // 4. generate_agents with force: true
      const genCall = await client.callTool("generate_agents", { force: true });
      expect(genCall.isError).toBeFalsy();
      const genData = JSON.parse(genCall.content[0].text!);
      expect(genData.status).toBe("success");
      expect(fs.existsSync(path.join(tempDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".agents/skills"))).toBe(true);

      // 5. wrap_context
      const wrapCall = await client.callTool("wrap_context", { threshold: 80 });
      expect(wrapCall.isError).toBeFalsy();
      const wrapData = JSON.parse(wrapCall.content[0].text!);
      expect(typeof wrapData.compositeScore).toBe("number");
      expect(Array.isArray(wrapData.actionPlan)).toBe(true);

      await client.close();
    });

    it("AC-5.4: interacts with resources and prompts over stdio (resources/list, resources/read, prompts/list, prompts/get)", async () => {
      setupWorkspace(tempDir);
      // Pre-create AGENTS.md
      const sampleAgents = "# AGENTS.md\n\n## Governance Rules\n- Always test before commit\n";
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), sampleAgents, "utf-8");

      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      await client.initialize();

      // 1. resources/list
      const resources = await client.listResources();
      expect(resources.length).toBe(2);
      const uris = resources.map((r) => r.uri);
      expect(uris).toContain("matryoshka://agents");
      expect(uris).toContain("matryoshka://diagnostic");

      // 2. resources/read
      const readResult = await client.readResource("matryoshka://agents");
      expect(readResult.length).toBe(1);
      expect(readResult[0].uri).toBe("matryoshka://agents");
      expect(readResult[0].text).toBe(sampleAgents);

      // 3. prompts/list
      const prompts = await client.listPrompts();
      expect(prompts.length).toBe(1);
      expect(prompts[0].name).toBe("audit_repository");

      // 4. prompts/get
      const promptRes = await client.getPrompt("audit_repository", {
        strict: true,
        threshold: 90,
      });
      expect(promptRes.messages.length).toBe(1);
      expect(promptRes.messages[0].role).toBe("user");
      const text = promptRes.messages[0].content.text!;
      expect(text).toContain(tempDir);
      expect(text).toContain("strict");
      expect(text).toContain("90");

      await client.close();
    });

    it("AC-5.5: supports concurrent pipelined requests with deterministic ID correlation", async () => {
      setupWorkspace(tempDir);
      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      await client.initialize();

      // Launch 5 concurrent requests with distinct IDs
      const req1 = client.request("ping", {}, "req-ping-1");
      const req2 = client.request("tools/list", {}, "req-tools-2");
      const req3 = client.request("resources/list", {}, "req-res-3");
      const req4 = client.request("prompts/list", {}, "req-prompts-4");
      const req5 = client.request("tools/call", { name: "detect_stack", arguments: {} }, "req-call-5");

      const [res1, res2, res3, res4, res5] = await Promise.all([req1, req2, req3, req4, req5]);

      expect(res1.id).toBe("req-ping-1");
      expect(res1.result).toEqual({});

      expect(res2.id).toBe("req-tools-2");
      expect(res2.result.tools.length).toBe(4);

      expect(res3.id).toBe("req-res-3");
      expect(res3.result.resources.length).toBe(2);

      expect(res4.id).toBe("req-prompts-4");
      expect(res4.result.prompts.length).toBe(1);

      expect(res5.id).toBe("req-call-5");
      expect(res5.result.isError).toBeFalsy();

      await client.close();
    });

    it("AC-5.6: validates error resilience (-32700, -32600, -32601, -32602) without terminating server", async () => {
      setupWorkspace(tempDir);
      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      await client.initialize();

      // 1. Parse error (-32700) on malformed JSON
      const parseErrRes = await client.sendRawAndExpect("{ bad-json-syntax ...\n");
      expect(parseErrRes.error.code).toBe(JSONRPC_PARSE_ERROR);

      // 2. Invalid Request (-32600) on non-compliant JSON-RPC
      const invReqRes = await client.sendRawAndExpect(
        JSON.stringify({ not_jsonrpc: true, id: 99 }) + "\n"
      );
      expect(invReqRes.error.code).toBe(JSONRPC_INVALID_REQUEST);

      // 3. Method not found (-32601)
      const unkMethod = await client.request("unknown_nonexistent_method", {}, "err-method");
      expect(unkMethod.error.code).toBe(JSONRPC_METHOD_NOT_FOUND);

      // 4. Invalid params (-32602) when calling tool with missing name
      const invParams = await client.request("tools/call", {}, "err-params");
      expect(invParams.error.code).toBe(JSONRPC_INVALID_PARAMS);

      // 5. Unregistered tool returns tool error result with isError: true
      const unregTool = await client.callTool("unregistered_phantom_tool");
      expect(unregTool.isError).toBe(true);
      expect(unregTool.content[0].text).toContain("not found");

      // 6. Verify server is still alive and resilient
      const healthyPing = await client.ping();
      expect(healthyPing).toEqual({});

      await client.close();
    });

    it("AC-5.7: verifies strict stream isolation and diagnostic telemetry routing", async () => {
      setupWorkspace(tempDir);
      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      await client.initialize();
      await client.callTool("detect_stack", {});
      await client.callTool("scan_harness", {});

      const stdoutLines = client.getStdoutLines();
      expect(stdoutLines.length).toBeGreaterThanOrEqual(3);

      // Verify every single stdout line is strictly valid JSON-RPC 2.0
      for (const line of stdoutLines) {
        let parsed: any;
        expect(() => {
          parsed = JSON.parse(line);
        }).not.toThrow();
        expect(parsed.jsonrpc).toBe("2.0");
      }

      // Verify telemetry is strictly in stderr
      const stderrOutput = client.getStderrOutput();
      expect(stderrOutput).toContain("[matryoshka-mcp]");
      expect(stderrOutput).toContain("Matryoshka MCP server listening on stdio");
      expect(stderrOutput).toContain("detect_stack");
      expect(stderrOutput).toContain("scan_harness");

      await client.close();
    });

    it("AC-5.8: terminates cleanly with exit code 0 on EOF (stdin stream close)", async () => {
      setupWorkspace(tempDir);
      const client = McpClient.spawn({
        command: ["bun", "run", cliPath, "mcp", "serve", tempDir],
        cwd: tempDir,
      });

      await client.initialize();
      const exitCode = await client.close();
      expect(exitCode).toBe(0);
    });

    it("AC-5.9: preserves full client handshake and tool invocation parity across baba, bbyg, and matryoshka", async () => {
      setupWorkspace(tempDir);

      const aliases = ["baba", "bbyg", "matryoshka"];
      for (const alias of aliases) {
        const client = McpClient.spawn({
          command: ["bun", "run", alias, "mcp", "serve", tempDir],
          cwd: tempDir,
        });

        const initRes = await client.initialize();
        expect(initRes.serverInfo.name).toBe("matryoshka-mcp");

        const tools = await client.listTools();
        expect(tools.length).toBe(4);

        const detect = await client.callTool("detect_stack", {});
        expect(detect.isError).toBeFalsy();

        const exitCode = await client.close();
        expect(exitCode).toBe(0);
      }
    });
  });
});

