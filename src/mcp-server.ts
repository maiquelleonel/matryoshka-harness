import * as fs from "node:fs";
import * as path from "node:path";
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
  type DetectResult,
  type DetectStackToolArgs,
  type ScanHarnessToolArgs,
  type GenerateAgentsToolArgs,
  type WrapContextToolArgs,
  type AuditRepositoryPromptArgs,
  type McpPromptArgument,
  type McpPromptDefinition,
  type McpResourceDefinition,
  type McpServerInfo,
  type McpServerOptions,
  type McpToolDefinition,
  type ProjectStack,
  type StderrLoggingGuardOptions,
} from "./types";

export const DETECT_STACK_TOOL_DEFINITION: McpToolDefinition = {
  name: "detect_stack",
  description: "Detect project framework, testing conventions, and repo archetype",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Target repository path to analyze (defaults to server working directory)",
      },
    },
  },
};

export const SCAN_HARNESS_TOOL_DEFINITION: McpToolDefinition = {
  name: "scan_harness",
  description: "Evaluate current L1-L4 harness score and generate maturity metrics",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Target repository path to scan (defaults to server working directory)",
      },
    },
  },
};

export const GENERATE_AGENTS_TOOL_DEFINITION: McpToolDefinition = {
  name: "generate_agents",
  description: "Autonomously produce lean AGENTS.md and modular .agents/skills/",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Target repository path (defaults to server working directory)",
      },
      force: {
        type: "boolean",
        description: "Overwrite existing files with backup creation",
      },
      dryRun: {
        type: "boolean",
        description: "Simulate generation without writing to disk",
      },
      maxTokens: {
        type: "number",
        description: "Maximum token budget for root AGENTS.md (default: 250)",
      },
      strictTokenGuard: {
        type: "boolean",
        description: "Enforce strict token guard threshold",
      },
    },
  },
};

export const WRAP_CONTEXT_TOOL_DEFINITION: McpToolDefinition = {
  name: "wrap_context",
  description: "Run polyglot AST audit and generate remediation plan",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Target repository path to audit (defaults to server working directory)",
      },
      threshold: {
        type: "number",
        description: "Minimum acceptable harness score (default: 80)",
      },
      strict: {
        type: "boolean",
        description: "Enforce strict mode (zero critical violations permitted)",
      },
    },
  },
};

export const MATRYOSHKA_MCP_TOOLS: McpToolDefinition[] = [
  DETECT_STACK_TOOL_DEFINITION,
  SCAN_HARNESS_TOOL_DEFINITION,
  GENERATE_AGENTS_TOOL_DEFINITION,
  WRAP_CONTEXT_TOOL_DEFINITION,
];

export const MATRYOSHKA_TOOL_NAMES = [
  "detect_stack",
  "scan_harness",
  "generate_agents",
  "wrap_context",
] as const;

export const AGENTS_RESOURCE_DEFINITION: McpResourceDefinition = {
  uri: "matryoshka://agents",
  name: "Current Compiled AGENTS.md",
  description: "Exposes currently compiled AGENTS.md",
  mimeType: "text/markdown",
};

export const DIAGNOSTIC_RESOURCE_DEFINITION: McpResourceDefinition = {
  uri: "matryoshka://diagnostic",
  name: "Latest DIAGNOSTIC.md Report",
  description: "Exposes latest DIAGNOSTIC.md",
  mimeType: "text/markdown",
};

export const MATRYOSHKA_MCP_RESOURCES: McpResourceDefinition[] = [
  AGENTS_RESOURCE_DEFINITION,
  DIAGNOSTIC_RESOURCE_DEFINITION,
];

export const MATRYOSHKA_RESOURCE_URIS = [
  "matryoshka://agents",
  "matryoshka://diagnostic",
] as const;

export const AUDIT_REPOSITORY_PROMPT_DEFINITION: McpPromptDefinition = {
  name: "audit_repository",
  description: "Guided system prompt for an agent to inspect and remediate repository harness score",
  arguments: [
    {
      name: "targetDir",
      description: "Path to repository to audit (defaults to server root)",
      required: false,
    },
    {
      name: "path",
      description: "Alias for targetDir",
      required: false,
    },
    {
      name: "strict",
      description: "Enforce strict zero-critical-violations quality gate",
      required: false,
    },
    {
      name: "threshold",
      description: "Minimum acceptable harness score (default: 80)",
      required: false,
    },
  ],
};

export const MATRYOSHKA_MCP_PROMPTS: McpPromptDefinition[] = [
  AUDIT_REPOSITORY_PROMPT_DEFINITION,
];

export const MATRYOSHKA_PROMPT_NAMES = [
  "audit_repository",
] as const;

export {
  JSONRPC_PARSE_ERROR,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_INVALID_PARAMS,
  JSONRPC_INTERNAL_ERROR,
  MCP_PROTOCOL_VERSION,
  type DetectStackToolArgs,
  type ScanHarnessToolArgs,
  type GenerateAgentsToolArgs,
  type WrapContextToolArgs,
  type AuditRepositoryPromptArgs,
  type McpPromptArgument,
  type McpPromptDefinition,
  type McpResourceDefinition,
  type McpServerInfo,
  type McpServerOptions,
  type McpToolDefinition,
  type StderrLoggingGuardOptions,
};

/**
 * Installs a guard on console methods (log, info, warn, debug) redirecting all standard output
 * to stderr so that stdout remains 100% clean for JSON-RPC MCP messages.
 */
export function installStderrLoggingGuard(
  options: StderrLoggingGuardOptions = {}
): () => void {
  const targetStderr = options.stderr || process.stderr;
  const prefix = options.prefix ?? "[matryoshka-mcp]";

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalDebug = console.debug;

  const redirect = (level: string, ...args: any[]) => {
    const msg = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    targetStderr.write(`${prefix} [${level}] ${msg}\n`);
  };

  console.log = (...args: any[]) => redirect("info", ...args);
  console.info = (...args: any[]) => redirect("info", ...args);
  console.warn = (...args: any[]) => redirect("warn", ...args);
  console.debug = (...args: any[]) => redirect("debug", ...args);

  return () => {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.debug = originalDebug;
  };
}

export class McpServer {
  public serverInfo: McpServerInfo;
  public capabilities: Record<string, any>;
  public rootDir: string;
  private methods = new Map<string, (params: any) => Promise<any> | any>();
  private tools = new Map<
    string,
    { definition: McpToolDefinition; handler: (args: any) => Promise<any> | any }
  >();
  private resources = new Map<
    string,
    { definition: McpResourceDefinition; handler: () => Promise<string> | string }
  >();
  private prompts = new Map<
    string,
    { definition: McpPromptDefinition; handler: (args: any) => Promise<any> | any }
  >();
  private activeStderr: NodeJS.WritableStream | null = null;

  constructor(options: McpServerOptions = {}) {
    this.serverInfo = options.serverInfo || {
      name: "matryoshka-mcp",
      version: "0.1.0",
    };
    this.rootDir = path.resolve(options.rootDir || options.projectPath || process.cwd());
    this.capabilities = options.capabilities || {
      tools: {},
      resources: {},
      prompts: {},
    };
    if (!this.capabilities.tools) {
      this.capabilities.tools = {};
    }
  }

  registerMethod(name: string, handler: (params: any) => Promise<any> | any): void {
    this.methods.set(name, handler);
  }

  registerTool(
    definition: McpToolDefinition,
    handler: (args: any) => Promise<any> | any
  ): void {
    this.tools.set(definition.name, { definition, handler });
    if (!this.capabilities.tools) {
      this.capabilities.tools = {};
    }
  }

  registerResource(
    definition: McpResourceDefinition,
    handler: () => Promise<string> | string
  ): void {
    this.resources.set(definition.uri, { definition, handler });
    if (!this.capabilities.resources) {
      this.capabilities.resources = {};
    }
  }

  registerPrompt(
    definition: McpPromptDefinition,
    handler: (args: any) => Promise<any> | any
  ): void {
    this.prompts.set(definition.name, { definition, handler });
    if (!this.capabilities.prompts) {
      this.capabilities.prompts = {};
    }
  }

  getTools(): McpToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  getTool(name: string): McpToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  getResources(): McpResourceDefinition[] {
    return Array.from(this.resources.values()).map((r) => r.definition);
  }

  getResource(uri: string): McpResourceDefinition | undefined {
    return this.resources.get(uri)?.definition;
  }

  hasResource(uri: string): boolean {
    return this.resources.has(uri);
  }

  unregisterResource(uri: string): boolean {
    return this.resources.delete(uri);
  }

  getPrompts(): McpPromptDefinition[] {
    return Array.from(this.prompts.values()).map((p) => p.definition);
  }

  getPrompt(name: string): McpPromptDefinition | undefined {
    return this.prompts.get(name)?.definition;
  }

  hasPrompt(name: string): boolean {
    return this.prompts.has(name);
  }

  unregisterPrompt(name: string): boolean {
    return this.prompts.delete(name);
  }

  log(level: string, message: string): void {
    const formatted = `[matryoshka-mcp] [${level}] ${message}\n`;
    if (this.activeStderr) {
      this.activeStderr.write(formatted);
    } else {
      process.stderr.write(formatted);
    }
  }

  async handleRawMessage(raw: string): Promise<string | null> {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    let payload: any;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      this.log("error", "Parse error: Invalid JSON payload");
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: JSONRPC_PARSE_ERROR,
          message: "Parse error: Invalid JSON payload",
        },
      });
    }

    // Strict validation of JSON-RPC 2.0 structure
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      payload.jsonrpc !== "2.0" ||
      typeof payload.method !== "string"
    ) {
      this.log("warn", "Invalid Request: expected JSON-RPC 2.0 object with valid method");
      const msgId =
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        "id" in payload &&
        (typeof payload.id === "string" || typeof payload.id === "number")
          ? payload.id
          : null;

      return JSON.stringify({
        jsonrpc: "2.0",
        id: msgId,
        error: {
          code: JSONRPC_INVALID_REQUEST,
          message: "Invalid Request: expected JSON-RPC 2.0 object with valid method",
        },
      });
    }

    const { id, method, params } = payload;
    const isNotification = typeof id === "undefined";

    // Handle notifications
    if (isNotification) {
      if (this.methods.has(method)) {
        try {
          await this.methods.get(method)!(params);
        } catch (err: any) {
          this.log("warn", `Error processing notification ${method}: ${err?.message || String(err)}`);
        }
      }
      return null;
    }

    // Handle registered custom methods first
    if (this.methods.has(method)) {
      try {
        const result = await this.methods.get(method)!(params);
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: result ?? {},
        });
      } catch (err: any) {
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: {
            code: JSONRPC_INTERNAL_ERROR,
            message: err?.message || String(err),
          },
        });
      }
    }

    // Built-in MCP handlers
    switch (method) {
      case "initialize": {
        this.log("info", `Client initialized (method: initialize, protocol: ${params?.protocolVersion || MCP_PROTOCOL_VERSION})`);
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: params?.protocolVersion || MCP_PROTOCOL_VERSION,
            serverInfo: this.serverInfo,
            capabilities: this.capabilities,
          },
        });
      }

      case "ping": {
        this.log("debug", "Received ping request");
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {},
        });
      }

      case "tools/list": {
        this.log("info", "Listing registered tools");
        const toolsList = Array.from(this.tools.values()).map((t) => t.definition);
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            tools: toolsList,
          },
        });
      }

      case "tools/call": {
        if (!params || typeof params !== "object" || Array.isArray(params)) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: params must be an object",
            },
          });
        }

        const toolName = params.name;

        if (!toolName || typeof toolName !== "string") {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: 'name' is required for tools/call",
            },
          });
        }

        this.log("info", `Dispatching tool call: ${toolName}`);

        if (
          params.arguments !== undefined &&
          (typeof params.arguments !== "object" ||
            params.arguments === null ||
            Array.isArray(params.arguments))
        ) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: 'arguments' must be an object",
            },
          });
        }

        const toolArgs = params.arguments || {};

        const tool = this.tools.get(toolName);
        if (!tool) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Tool '${toolName}' not found`,
                },
              ],
            },
          });
        }

        try {
          const rawResult = await tool.handler(toolArgs);
          if (
            rawResult &&
            typeof rawResult === "object" &&
            Array.isArray(rawResult.content)
          ) {
            return JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: rawResult,
            });
          }

          const text =
            typeof rawResult === "string"
              ? rawResult
              : JSON.stringify(rawResult, null, 2);

          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text,
                },
              ],
            },
          });
        } catch (err: any) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Tool error (${toolName}): ${err?.message || String(err)}`,
                },
              ],
            },
          });
        }
      }

      case "resources/list": {
        this.log("info", "Listing registered resources");
        const resourcesList = Array.from(this.resources.values()).map(
          (r) => r.definition
        );
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            resources: resourcesList,
          },
        });
      }

      case "resources/templates/list": {
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            resourceTemplates: [],
          },
        });
      }

      case "resources/read": {
        if (!params || typeof params !== "object" || Array.isArray(params)) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: params must be an object",
            },
          });
        }

        const uri = params.uri;
        if (!uri || typeof uri !== "string") {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: 'uri' is required for resources/read",
            },
          });
        }

        this.log("info", `Reading resource: ${uri}`);

        const resource = this.resources.get(uri);
        if (!resource) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: `Resource not found: ${uri}`,
            },
          });
        }

        try {
          const text = await resource.handler();
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: resource.definition.mimeType || "text/plain",
                  text,
                },
              ],
            },
          });
        } catch (err: any) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INTERNAL_ERROR,
              message: `Error reading resource ${uri}: ${err?.message || String(err)}`,
            },
          });
        }
      }

      case "prompts/list": {
        this.log("info", "Listing registered prompts");
        const promptsList = Array.from(this.prompts.values()).map(
          (p) => p.definition
        );
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            prompts: promptsList,
          },
        });
      }

      case "prompts/get": {
        if (!params || typeof params !== "object" || Array.isArray(params)) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: params must be an object",
            },
          });
        }

        const promptName = params.name;
        if (!promptName || typeof promptName !== "string") {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: 'name' is required for prompts/get",
            },
          });
        }

        this.log("info", `Getting prompt: ${promptName}`);

        if (
          params.arguments !== undefined &&
          (typeof params.arguments !== "object" ||
            params.arguments === null ||
            Array.isArray(params.arguments))
        ) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: "Invalid params: 'arguments' must be an object",
            },
          });
        }

        const prompt = this.prompts.get(promptName);
        if (!prompt) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INVALID_PARAMS,
              message: `Prompt not found: ${promptName}`,
            },
          });
        }

        try {
          const result = await prompt.handler(params?.arguments || {});
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            result,
          });
        } catch (err: any) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: JSONRPC_INTERNAL_ERROR,
              message: `Error executing prompt ${promptName}: ${err?.message || String(err)}`,
            },
          });
        }
      }

      default: {
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: {
            code: JSONRPC_METHOD_NOT_FOUND,
            message: `Method not found: ${method}`,
          },
        });
      }
    }
  }

  listenStdio(streams?: {
    in?: NodeJS.ReadableStream;
    out?: NodeJS.WritableStream;
    err?: NodeJS.WritableStream;
  }): { stop: () => void } {
    const inStream: NodeJS.ReadableStream = streams?.in || process.stdin;
    const outStream: NodeJS.WritableStream = streams?.out || process.stdout;
    this.activeStderr = streams?.err || process.stderr;

    const uninstallGuard = installStderrLoggingGuard({
      stderr: this.activeStderr,
    });

    this.log("info", `Matryoshka MCP server listening on stdio (root: ${this.rootDir})`);

    let active = true;
    let buffer = "";

    const onData = (chunk: Buffer | string) => {
      if (!active) return;
      buffer += chunk.toString();
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (line.length > 0) {
          this.handleRawMessage(line)
            .then((res) => {
              if (res !== null && active) {
                outStream.write(res + "\n");
              }
            })
            .catch((err) => {
              this.log("error", `Dispatcher failure: ${err?.message || String(err)}`);
            });
        }
      }
    };

    inStream.on("data", onData);

    const onEnd = () => {
      stop();
      if (!streams?.in) {
        process.exit(0);
      }
    };
    inStream.on("end", onEnd);

    const stop = () => {
      active = false;
      uninstallGuard();
      if (typeof (inStream as any).off === "function") {
        (inStream as any).off("data", onData);
        (inStream as any).off("end", onEnd);
      } else if (typeof (inStream as any).removeListener === "function") {
        (inStream as any).removeListener("data", onData);
        (inStream as any).removeListener("end", onEnd);
      }
      this.activeStderr = null;
    };

    return { stop };
  }
}

/**
 * Registers all canonical Matryoshka tools into an MCP server instance.
 */
export function registerMatryoshkaTools(
  server: McpServer,
  targetDir: string = process.cwd()
): void {
  const resolvedDir = path.resolve(targetDir);

  // Tool 1: detect_stack
  server.registerTool(DETECT_STACK_TOOL_DEFINITION, async (args: any) => {
    const p = path.resolve(args?.path || resolvedDir);
    const stack: ProjectStack = detectStack(p);
    const res: DetectResult = {
      status: "success",
      stack: {
        primary: stack.primary,
        frameworks: stack.frameworks,
        testRunner: stack.testRunner,
        archetype: stack.archetype,
      },
      rootPath: p,
    };
    return res;
  });

  // Tool 2: scan_harness
  server.registerTool(SCAN_HARNESS_TOOL_DEFINITION, async (args: any) => {
    const p = path.resolve(args?.path || resolvedDir);
    const result = await runMaturityScan(p);
    return {
      ...result,
      score: result.oracleScore,
      level: result.oracleLevel,
      gaps: result.remediationIssues,
    };
  });

  // Tool 3: generate_agents
  server.registerTool(GENERATE_AGENTS_TOOL_DEFINITION, async (args: any) => {
    const p = path.resolve(args?.path || resolvedDir);
    return generateAgents(p, {
      force: Boolean(args?.force),
      dryRun: Boolean(args?.dryRun),
      maxTokens: typeof args?.maxTokens === "number" ? args.maxTokens : undefined,
      strictTokenGuard: Boolean(args?.strictTokenGuard),
      json: true,
    });
  });

  // Tool 4: wrap_context
  server.registerTool(WRAP_CONTEXT_TOOL_DEFINITION, async (args: any) => {
    const p = path.resolve(args?.path || resolvedDir);
    const evalResult = await evaluateCompositeHarness(p, {
      threshold: typeof args?.threshold === "number" ? args.threshold : 80,
    });
    return {
      ...evalResult,
      actionPlan: evalResult.aggregatedGaps?.actionPlan || [],
      action_plan: evalResult.aggregatedGaps?.actionPlan || [],
    };
  });
}

/**
 * Registers canonical Matryoshka resources (matryoshka://agents, matryoshka://diagnostic).
 */
export function registerMatryoshkaResources(
  server: McpServer,
  targetDir: string = process.cwd()
): void {
  const resolvedDir = path.resolve(targetDir);

  // Resource 1: matryoshka://agents
  server.registerResource(AGENTS_RESOURCE_DEFINITION, async () => {
    const filePath = path.join(resolvedDir, "AGENTS.md");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "# AGENTS.md\n(No AGENTS.md compiled yet)";
  });

  // Resource 2: matryoshka://diagnostic
  server.registerResource(DIAGNOSTIC_RESOURCE_DEFINITION, async () => {
    const filePath = path.join(resolvedDir, "DIAGNOSTIC.md");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "# DIAGNOSTIC.md\n(No DIAGNOSTIC.md generated yet)";
  });
}

/**
 * Registers canonical Matryoshka prompts (audit_repository).
 */
export function registerMatryoshkaPrompts(
  server: McpServer,
  targetDir: string = process.cwd()
): void {
  const resolvedDir = path.resolve(targetDir);

  // Prompt: audit_repository
  server.registerPrompt(AUDIT_REPOSITORY_PROMPT_DEFINITION, async (args: any) => {
    const p = path.resolve(args?.targetDir || args?.path || resolvedDir);
    const strictMode = Boolean(args?.strict);
    const threshold = typeof args?.threshold === "number" ? args.threshold : 80;

    let text = `Please audit the repository at "${p}". First run detect_stack to understand project archetype, test runners and language idioms. Then run scan_harness and wrap_context to discover harness gaps and contextual AST vulnerabilities.`;
    if (strictMode) {
      text += ` Enforce strict mode with zero critical violations permitted.`;
    }
    if (threshold !== 80) {
      text += ` The minimum acceptable harness score threshold is ${threshold}.`;
    }
    text += ` Finally remediate identified critical issues and generate clean AGENTS.md and modular skills using generate_agents.`;

    return {
      description: AUDIT_REPOSITORY_PROMPT_DEFINITION.description,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text,
          },
        },
      ],
    };
  });
}

/**
 * Creates and initializes a Native Matryoshka MCP Server instance with all tools,
 * resources, and prompts registered.
 */
export function createMatryoshkaMcpServer(targetDir: string = process.cwd()): McpServer {
  const resolvedDir = path.resolve(targetDir);
  const server = new McpServer({
    rootDir: resolvedDir,
    serverInfo: {
      name: "matryoshka-mcp",
      version: "0.1.0",
    },
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  });

  // Register canonical tools, resources, and prompts
  registerMatryoshkaTools(server, resolvedDir);
  registerMatryoshkaResources(server, resolvedDir);
  registerMatryoshkaPrompts(server, resolvedDir);

  return server;
}
