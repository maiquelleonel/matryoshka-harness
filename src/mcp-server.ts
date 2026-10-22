import * as fs from "node:fs";
import * as path from "node:path";
import type { Readable, Writable } from "node:stream";
import { detectStack } from "./detector";
import { runMaturityScan } from "./scanner";
import { generateAgents } from "./agents";
import { evaluateCompositeHarness } from "./scorer";
import {
  JSONRPC_PARSE_ERROR,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_INVALID_PARAMS,
  JSONRPC_INTERNAL_ERROR,
  MCP_PROTOCOL_VERSION,
  MATRYOSHKA_MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  type JsonRpcErrorResponse,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpInitializeResult,
  type McpPromptDefinition,
  type McpPromptResult,
  type McpResourceContent,
  type McpResourceDefinition,
  type McpServerOptions,
  type McpToolCallResult,
  type McpToolDefinition,
} from "./types";

export {
  JSONRPC_PARSE_ERROR,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_INVALID_PARAMS,
  JSONRPC_INTERNAL_ERROR,
  MCP_PROTOCOL_VERSION,
  MATRYOSHKA_MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
};

export type MethodHandler = (params: any, id: string | number | null) => Promise<any> | any;
export type ToolHandler = (args: any) => Promise<McpToolCallResult | any>;
export type ResourceHandler = (uri: string) => Promise<McpResourceContent | string>;
export type PromptHandler = (args: any) => Promise<McpPromptResult>;

export interface StdioStreamOptions {
  in?: Readable | NodeJS.ReadableStream;
  out?: Writable | NodeJS.WritableStream;
  err?: Writable | NodeJS.WritableStream;
}

export interface StdioTransportController {
  stop: () => void;
}

/**
 * Native Model Context Protocol (MCP) Server running over stdio or message streams.
 * Complies with JSON-RPC 2.0 and MCP Protocol 2024-11-05.
 */
export class McpServer {
  private methodHandlers: Map<string, MethodHandler> = new Map();
  private tools: Map<string, { definition: McpToolDefinition; handler: ToolHandler }> = new Map();
  private resources: Map<string, { definition: McpResourceDefinition; handler: ResourceHandler }> = new Map();
  private prompts: Map<string, { definition: McpPromptDefinition; handler: PromptHandler }> = new Map();
  private options: McpServerOptions;
  private stderrStream: Writable | NodeJS.WritableStream | null = null;

  constructor(options: McpServerOptions = {}) {
    this.options = options;
    this.registerBuiltinHandlers();
  }

  /**
   * Registers default MCP protocol methods (initialize, ping, notifications/initialized, tools, resources, prompts).
   */
  private registerBuiltinHandlers(): void {
    // Protocol Handshake: initialize
    this.registerMethod("initialize", async (params: any) => {
      const result: McpInitializeResult = {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
          logging: {},
        },
        serverInfo: this.options.serverInfo || {
          name: MATRYOSHKA_MCP_SERVER_NAME,
          version: MCP_SERVER_VERSION,
        },
        instructions:
          this.options.instructions ||
          "Matryoshka-Harness MCP Server: Adaptive context-fencing, anti-slop AGENTS.md generator and L4 harness score remediation.",
      };
      return result;
    });

    // Client Initialized Notification
    this.registerMethod("notifications/initialized", async () => {
      // Notifications produce no return value and no response
      return undefined;
    });

    // Keepalive Ping
    this.registerMethod("ping", async () => {
      return {};
    });

    // Tools List
    this.registerMethod("tools/list", async () => {
      return {
        tools: Array.from(this.tools.values()).map((t) => t.definition),
      };
    });

    // Tools Call
    this.registerMethod("tools/call", async (params: any) => {
      const toolName = params?.name;
      if (!toolName || typeof toolName !== "string") {
        return {
          isError: true,
          content: [{ type: "text", text: "Error: Missing or invalid 'name' in tools/call parameters" }],
        };
      }

      const toolEntry = this.tools.get(toolName);
      if (!toolEntry) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: Tool '${toolName}' not found` }],
        };
      }

      try {
        const rawResult = await toolEntry.handler(params?.arguments || {});

        if (
          rawResult &&
          typeof rawResult === "object" &&
          Array.isArray(rawResult.content)
        ) {
          return rawResult as McpToolCallResult;
        }

        const serialized =
          typeof rawResult === "string"
            ? rawResult
            : JSON.stringify(rawResult, null, 2);

        return {
          content: [{ type: "text", text: serialized }],
        };
      } catch (err: any) {
        this.log("error", `Exception in tool '${toolName}': ${err?.message || String(err)}`);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool execution failed for '${toolName}': ${err?.message || String(err)}`,
            },
          ],
        };
      }
    });

    // Resources List
    this.registerMethod("resources/list", async () => {
      return {
        resources: Array.from(this.resources.values()).map((r) => r.definition),
      };
    });

    // Resources Read
    this.registerMethod("resources/read", async (params: any) => {
      const uri = params?.uri;
      if (!uri || typeof uri !== "string") {
        throw new Error("Missing or invalid 'uri' parameter for resources/read");
      }

      const resourceEntry = this.resources.get(uri);
      if (!resourceEntry) {
        throw new Error(`Resource '${uri}' not found`);
      }

      const content = await resourceEntry.handler(uri);
      if (typeof content === "object" && content !== null && "uri" in content) {
        return { contents: [content] };
      }

      return {
        contents: [
          {
            uri,
            mimeType: resourceEntry.definition.mimeType || "text/plain",
            text: String(content),
          },
        ],
      };
    });

    // Prompts List
    this.registerMethod("prompts/list", async () => {
      return {
        prompts: Array.from(this.prompts.values()).map((p) => p.definition),
      };
    });

    // Prompts Get
    this.registerMethod("prompts/get", async (params: any) => {
      const promptName = params?.name;
      if (!promptName || typeof promptName !== "string") {
        throw new Error("Missing or invalid 'name' parameter for prompts/get");
      }

      const promptEntry = this.prompts.get(promptName);
      if (!promptEntry) {
        throw new Error(`Prompt '${promptName}' not found`);
      }

      return await promptEntry.handler(params?.arguments || {});
    });
  }

  /**
   * Registers a generic JSON-RPC method handler.
   */
  public registerMethod(method: string, handler: MethodHandler): void {
    this.methodHandlers.set(method, handler);
  }

  /**
   * Registers an MCP tool with its metadata schema and execution callback.
   */
  public registerTool(definition: McpToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * Registers an MCP resource provider.
   */
  public registerResource(definition: McpResourceDefinition, handler: ResourceHandler): void {
    this.resources.set(definition.uri, { definition, handler });
  }

  /**
   * Registers an MCP prompt template provider.
   */
  public registerPrompt(definition: McpPromptDefinition, handler: PromptHandler): void {
    this.prompts.set(definition.name, { definition, handler });
  }

  /**
   * Writes diagnostic messages strictly to stderr, preserving clean stdout for JSON-RPC.
   */
  public log(level: string, message: string, data?: any): void {
    const formatted = `[matryoshka-mcp][${level}] ${message}${data ? ` ${JSON.stringify(data)}` : ""}\n`;
    if (this.stderrStream && typeof (this.stderrStream as any).write === "function") {
      (this.stderrStream as any).write(formatted);
    } else {
      process.stderr.write(formatted);
    }
  }

  /**
   * Processes a single parsed JSON-RPC message object.
   * Returns a response message, or null for notifications.
   */
  public async handleMessage(message: unknown): Promise<JsonRpcResponse | JsonRpcErrorResponse | null> {
    if (typeof message !== "object" || message === null || Array.isArray(message)) {
      return {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: JSONRPC_INVALID_REQUEST,
          message: "Invalid Request: root payload must be a JSON object",
        },
      };
    }

    const msg = message as Record<string, any>;

    if (msg.jsonrpc !== "2.0") {
      return {
        jsonrpc: "2.0",
        id: msg.id ?? null,
        error: {
          code: JSONRPC_INVALID_REQUEST,
          message: "Invalid Request: 'jsonrpc' must be '2.0'",
        },
      };
    }

    if (typeof msg.method !== "string" || msg.method.trim().length === 0) {
      return {
        jsonrpc: "2.0",
        id: msg.id ?? null,
        error: {
          code: JSONRPC_INVALID_REQUEST,
          message: "Invalid Request: 'method' must be a non-empty string",
        },
      };
    }

    const isNotification = msg.id === undefined;
    const handler = this.methodHandlers.get(msg.method);

    if (!handler) {
      if (isNotification) {
        this.log("warn", `Unhandled notification method '${msg.method}'`);
        return null;
      }
      return {
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: JSONRPC_METHOD_NOT_FOUND,
          message: `Method not found: ${msg.method}`,
        },
      };
    }

    try {
      const result = await handler(msg.params, msg.id ?? null);
      if (isNotification) {
        return null;
      }
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: result ?? {},
      };
    } catch (err: any) {
      this.log("error", `Error executing method '${msg.method}': ${err?.message || String(err)}`);
      if (isNotification) {
        return null;
      }
      return {
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: JSONRPC_INTERNAL_ERROR,
          message: err?.message || String(err),
        },
      };
    }
  }

  /**
   * Processes a raw string message (validating JSON parsing, then handling message).
   * Returns a JSON string response or null (for notifications).
   */
  public async handleRawMessage(raw: string): Promise<string | null> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err: any) {
      const errorResponse: JsonRpcErrorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: JSONRPC_PARSE_ERROR,
          message: `Parse error: Invalid JSON (${err?.message || String(err)})`,
        },
      };
      return JSON.stringify(errorResponse);
    }

    const response = await this.handleMessage(parsed);
    if (response === null) {
      return null;
    }
    return JSON.stringify(response);
  }

  /**
   * Attaches the server to stdio or custom streams.
   * Consumes line-delimited JSON-RPC messages and writes responses to stdout.
   */
  public listenStdio(options: StdioStreamOptions = {}): StdioTransportController {
    const inStream = options.in || process.stdin;
    const outStream = options.out || process.stdout;
    const errStream = options.err || process.stderr;

    this.stderrStream = errStream;

    let buffer = "";
    let isStopped = false;

    const onData = async (chunk: Buffer | string) => {
      if (isStopped) return;
      buffer += chunk.toString("utf-8");

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const response = await this.handleRawMessage(trimmed);
          if (response && !isStopped) {
            (outStream as any).write(response + "\n");
          }
        } catch (err: any) {
          this.log("error", `Fatal error in stdio transport line dispatcher: ${err?.message || String(err)}`);
        }
      }
    };

    (inStream as any).on("data", onData);

    const stop = () => {
      isStopped = true;
      (inStream as any).removeListener("data", onData);
    };

    return { stop };
  }
}

/**
 * Creates and configures a Matryoshka MCP Server equipped with all native tools and resources.
 */
export function createMatryoshkaMcpServer(
  projectPath: string = process.cwd(),
  options: McpServerOptions = {}
): McpServer {
  const resolvedPath = path.resolve(projectPath);

  const server = new McpServer({
    projectPath: resolvedPath,
    serverInfo: {
      name: MATRYOSHKA_MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    instructions:
      "Matryoshka-Harness MCP Server: Use 'detect_stack' to inspect frameworks, 'scan_harness' to evaluate maturity (L0-L4), 'generate_agents' to create lean AGENTS.md, and 'wrap_context' to run AST audits and generate DIAGNOSTIC.md.",
    ...options,
  });

  // Tool 1: detect_stack
  server.registerTool(
    {
      name: "detect_stack",
      description: "Detect project framework, testing conventions, and repo archetype.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Target repository directory (defaults to server root)",
          },
        },
      },
    },
    async (args: any) => {
      const targetDir = args?.path ? path.resolve(args.path) : resolvedPath;
      const stack = detectStack(targetDir);
      return {
        status: "success",
        stack: {
          primary: stack.primary,
          frameworks: stack.frameworks,
          testRunner: stack.testRunner,
          archetype: stack.archetype,
        },
        rootPath: targetDir,
      };
    }
  );

  // Tool 2: scan_harness
  server.registerTool(
    {
      name: "scan_harness",
      description: "Evaluate current L1-L4 harness score, gaps, and maturity metrics.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Target repository directory (defaults to server root)",
          },
        },
      },
    },
    async (args: any) => {
      const targetDir = args?.path ? path.resolve(args.path) : resolvedPath;
      const scanResult = await runMaturityScan(targetDir);
      return scanResult;
    }
  );

  // Tool 3: generate_agents
  server.registerTool(
    {
      name: "generate_agents",
      description: "Autonomously produce lean AGENTS.md (<200 tokens) and modular .agents/skills/.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Target repository directory (defaults to server root)",
          },
          force: {
            type: "boolean",
            description: "Overwrite existing AGENTS.md (creates backup .bak)",
          },
          dryRun: {
            type: "boolean",
            description: "Simulate without writing files to disk",
          },
        },
      },
    },
    async (args: any) => {
      const targetDir = args?.path ? path.resolve(args.path) : resolvedPath;
      const result = generateAgents(targetDir, {
        force: Boolean(args?.force),
        dryRun: Boolean(args?.dryRun),
      });
      return result;
    }
  );

  // Tool 4: wrap_context
  server.registerTool(
    {
      name: "wrap_context",
      description: "Run polyglot AST audit, detect antipatterns, and generate remediation plan.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Target repository directory (defaults to server root)",
          },
          threshold: {
            type: "number",
            description: "Minimum acceptable composite score threshold (default: 80)",
          },
        },
      },
    },
    async (args: any) => {
      const targetDir = args?.path ? path.resolve(args.path) : resolvedPath;
      const evaluation = await evaluateCompositeHarness(targetDir, {
        threshold: typeof args?.threshold === "number" ? args.threshold : 80,
      });
      return evaluation;
    }
  );

  // Resource 1: matryoshka://agents
  server.registerResource(
    {
      uri: "matryoshka://agents",
      name: "AGENTS.md",
      description: "Exposes the compiled root AGENTS.md guidelines for the workspace",
      mimeType: "text/markdown",
    },
    async (uri: string) => {
      const agentsPath = path.join(resolvedPath, "AGENTS.md");
      if (fs.existsSync(agentsPath)) {
        return fs.readFileSync(agentsPath, "utf-8");
      }
      return "# AGENTS.md not found\nRun 'generate_agents' to create adaptive governance.";
    }
  );

  // Resource 2: matryoshka://diagnostic
  server.registerResource(
    {
      uri: "matryoshka://diagnostic",
      name: "DIAGNOSTIC.md",
      description: "Exposes the latest DIAGNOSTIC.md remediation report",
      mimeType: "text/markdown",
    },
    async (uri: string) => {
      const diagnosticPath = path.join(resolvedPath, "DIAGNOSTIC.md");
      if (fs.existsSync(diagnosticPath)) {
        return fs.readFileSync(diagnosticPath, "utf-8");
      }
      return "# DIAGNOSTIC.md not found\nRun 'wrap_context' to analyze AST antipatterns and generate report.";
    }
  );

  // Prompt 1: audit_repository
  server.registerPrompt(
    {
      name: "audit_repository",
      description: "Guided system prompt for an agent to inspect and remediate repository harness score",
      arguments: [
        {
          name: "threshold",
          description: "Target harness score threshold (default 80)",
          required: false,
        },
      ],
    },
    async (args: any) => {
      const threshold = args?.threshold || 80;
      return {
        description: `Audit and remediate repository harness score targeting ${threshold}+`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a Matryoshka-Harness Auditor Agent. Inspect the repository at '${resolvedPath}' using 'scan_harness' and 'wrap_context'. Ensure the composite score satisfies the threshold (${threshold}). Remediate any critical AST violations immediately following SDD principles.`,
            },
          },
        ],
      };
    }
  );

  return server;
}
