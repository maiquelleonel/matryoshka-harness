# 📐 SPEC-12: feat(mcp): native mcp server for ide agents (matryoshka mcp serve)

**Módulo:** SDD Engine / Automated Architecture  
**Status:** completed (Subtask 5: BDD acceptance tests verifying MCP client handshake and tool invocation)  
**Gatilho:** Issue #12  
**Target:** Bun + TypeScript + Model Context Protocol (stdio transport)  

---

## 🎯 1. Objetivo & Escopo
Implement Phase 5.1 of the Matryoshka-Harness roadmap: a zero-dependency Native Model Context Protocol (MCP) server running over `stdio`. This enables AI coding agents in Cursor, Zed, Gemini CLI, Claude Code, and Aider to consume Matryoshka tools directly inside their context loops.

### Escopo Arquitetural:
1. **MCP stdio Protocol Engine & Message Dispatcher (Subtask 1):**
   - Compatibilidade estrita com JSON-RPC 2.0 e especificação MCP (`2024-11-05`).
   - Códigos de erro padrão: `-32700` (Parse error), `-32600` (Invalid Request), `-32601` (Method not found), `-32602` (Invalid params), `-32603` (Internal error).
   - Handshake padrão: `initialize`, `notifications/initialized`, `ping`.
   - Separação limpa de canais: `stdout` exclusivo para JSON-RPC (newline-delimited JSON), `stderr` para telemetria/logs estruturados.
   - Dispatch assíncrono e não-bloqueante com fail-safe (exceções não encerram o processo do servidor).
2. **Tool Registration & Schema Definitions (Subtask 2):**
   - Ferramentas nativas: `detect_stack`, `scan_harness`, `generate_agents`, `wrap_context`.
   - Definições de schema JSON Schema válidas (`inputSchema`).
3. **Resource & Prompt Provider Handlers (Subtask 3):**
   - Recursos: `matryoshka://agents`, `matryoshka://diagnostic`.
   - Prompts: `audit_repository`.
4. **CLI Integration (Subtask 4):**
   - Subcomando `baba mcp serve [path]` e paridade total de aliases (`bbyg`, `matryoshka`).
5. **BDD Acceptance Suite (Subtask 5):**
   - Testes cobrindo ciclo de vida do cliente MCP via stdio pipes.

---

## 📋 2. Contratos de I/O & Tipagem

### 2.1 Mensagens JSON-RPC 2.0 & Protocolo MCP

```typescript
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, any> | any[];
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, any> | any[];
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: any;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: JsonRpcErrorObject;
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse
  | JsonRpcErrorResponse;
```

### 2.2 Constantes Canônicas de Erro

```typescript
export const JSONRPC_PARSE_ERROR = -32700;
export const JSONRPC_INVALID_REQUEST = -32600;
export const JSONRPC_METHOD_NOT_FOUND = -32601;
export const JSONRPC_INVALID_PARAMS = -32602;
export const JSONRPC_INTERNAL_ERROR = -32603;

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_NAME = "matryoshka-mcp";
export const MCP_SERVER_VERSION = "0.1.0";
```

### 2.3 Contratos de Ferramentas, Recursos e Prompts

```typescript
export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, unknown>;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo: McpServerInfo;
  instructions?: string;
}

export interface McpToolInputSchema {
  type: "object";
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

export interface McpToolCallResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

### 2.4 Schemas Canônicos das Ferramentas Matryoshka (Subtask 2)

```typescript
export interface DetectStackToolArgs {
  path?: string;
}

export interface ScanHarnessToolArgs {
  path?: string;
}

export interface GenerateAgentsToolArgs {
  path?: string;
  force?: boolean;
  dryRun?: boolean;
  maxTokens?: number;
  strictTokenGuard?: boolean;
}

export interface WrapContextToolArgs {
  path?: string;
  threshold?: number;
  strict?: boolean;
}

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

### 2.5 Schemas e Definições Canônicas de Recursos & Prompts Matryoshka (Subtask 3)

```typescript
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

### 2.6 CLI Integration & Stderr Logging Guards (Subtask 4)

```typescript
export interface StderrLoggingGuardOptions {
  stderr?: NodeJS.WritableStream;
  prefix?: string;
}

export function installStderrLoggingGuard(
  options?: StderrLoggingGuardOptions
): () => void;
```

### 2.7 MCP Client Contract & BDD Acceptance Test Harness (Subtask 5)

```typescript
export interface McpClientOptions {
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export class McpClient {
  public readonly proc: any;
  public readonly rootDir: string;

  constructor(options?: McpClientOptions);
  static spawn(options?: McpClientOptions): McpClient;

  request<T = any>(method: string, params?: Record<string, any>, id?: string | number): Promise<JsonRpcResponse<T>>;
  notify(method: string, params?: Record<string, any>): void;

  initialize(clientInfo?: McpServerInfo, protocolVersion?: string): Promise<McpInitializeResult>;
  ping(): Promise<Record<string, unknown>>;
  listTools(): Promise<McpToolDefinition[]>;
  callTool(name: string, args?: Record<string, any>): Promise<McpToolCallResult>;
  listResources(): Promise<McpResourceDefinition[]>;
  readResource(uri: string): Promise<McpResourceContent[]>;
  listPrompts(): Promise<McpPromptDefinition[]>;
  getPrompt(name: string, args?: Record<string, any>): Promise<McpPromptResult>;

  getStdoutLines(): string[];
  getStderrOutput(): string;
  close(): Promise<number | null>;
}
```

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
Feature: feat(mcp): native mcp server for ide agents (matryoshka mcp serve)

  Scenario: AC-1 - Subtask 1: Lightweight MCP Protocol stdio transport & message dispatcher
    Given A lightweight MCP Server instance configured with stdio stream separation
    When An "initialize" JSON-RPC 2.0 request is received with protocolVersion "2024-11-05"
    Then It returns the serverInfo "matryoshka-mcp" and capabilities for tools, resources, and prompts
    And A "ping" request returns an empty object result
    And Malformed JSON returns error code -32700 (Parse error)
    And Non-compliant requests return error code -32600 (Invalid Request)
    And Unknown methods return error code -32601 (Method not found)
    And Notifications like "notifications/initialized" produce zero response on stdout

  Scenario: AC-2 - Subtask 2: Tool registration & schema definitions
    Given The native MCP server with registered Matryoshka tools
    When A "tools/list" request is received
    Then It returns schemas for "detect_stack", "scan_harness", "generate_agents", and "wrap_context"
    And Each tool inputSchema has type "object" and documented properties
    And Calling "tools/call" with "detect_stack" executes non-destructively and returns structured JSON text
    And Calling "tools/call" with "scan_harness" executes non-destructively and returns maturity metrics
    And Calling "tools/call" with "generate_agents" in dryRun mode returns planned files without touching disk
    And Calling "tools/call" with "generate_agents" without force on existing AGENTS.md returns tool error without crashing server
    And Calling "tools/call" with "wrap_context" executes composite audit returning score, violations, and action plan
    And Calling "tools/call" with missing tool name returns error code -32602 (Invalid params)
    And Calling "tools/call" with non-object arguments returns error code -32602 (Invalid params)
    And Calling "tools/call" for unregistered tool returns result with isError true

  Scenario: AC-3 - Subtask 3: Resource & Prompt provider handlers
    Given The native MCP server
    When "resources/list" and "prompts/list" are called
    Then It exposes "matryoshka://agents" and "matryoshka://diagnostic"
    And It exposes prompt "audit_repository" with parameters "targetDir", "path", "strict", and "threshold"
    And Calling "resources/read" with "matryoshka://agents" when AGENTS.md exists returns its raw markdown content
    And Calling "resources/read" with "matryoshka://agents" when AGENTS.md is absent returns fallback placeholder markdown
    And Calling "resources/read" with "matryoshka://diagnostic" when DIAGNOSTIC.md exists returns its raw markdown content
    And Calling "resources/read" with "matryoshka://diagnostic" when DIAGNOSTIC.md is absent returns fallback placeholder markdown
    And Calling "resources/read" with missing or invalid "uri" returns error code -32602 (Invalid params)
    And Calling "resources/read" with unregistered URI returns error code -32602 (Invalid params)
    And Calling "resources/templates/list" returns empty resourceTemplates array
    And Calling "prompts/get" with "audit_repository" generates structured prompt messages instructing agent workflow
    And Calling "prompts/get" with missing or invalid "name" returns error code -32602 (Invalid params)
    And Calling "prompts/get" with non-object arguments returns error code -32602 (Invalid params)
    And Calling "prompts/get" for unregistered prompt returns error code -32602 (Invalid params)
    And Inspection methods getResources, getResource, hasResource, unregisterResource operate idempotently
    And Inspection methods getPrompts, getPrompt, hasPrompt, unregisterPrompt operate idempotently
    And Standalone registerMatryoshkaResources and registerMatryoshkaPrompts populate bare McpServer instances

  Scenario: AC-4 - Subtask 4: CLI integration (baba mcp serve) with stderr logging guards
    Given The CLI binary
    When Executed with "baba mcp serve [path]"
    Then It binds to stdio without writing non-JSON text to stdout
    And All startup notices and telemetry are strictly routed to stderr
    And Parity is preserved across "bbyg mcp serve" and "matryoshka mcp serve"
    And Stderr logging guard redirects any console.log, console.info, console.warn, and console.debug to stderr
    And Uninstalling the logging guard restores original console logging methods
    And Executing "baba mcp serve --help" outputs formatted CLI usage guide and exits with code 0
    And Supplying invalid MCP subcommands emits helpful guidance on stderr and exits with code 1

  Scenario: AC-5 - Subtask 5: BDD acceptance tests verifying MCP client handshake and tool invocation
    Given A subprocess executing "baba mcp serve"
    When A client performs the initialize handshake and executes tools over stdin
    Then Valid JSON-RPC responses are received on stdout
    And Stderr captures diagnostic telemetry without corrupting the message stream
    And Calling "tools/list" returns schemas for detect_stack, scan_harness, generate_agents, and wrap_context
    And Calling "tools/call" with "detect_stack" identifies project frameworks and archetype
    And Calling "tools/call" with "scan_harness" computes maturity level and gaps
    And Calling "tools/call" with "generate_agents" in dryRun mode returns planned files without touching disk
    And Calling "tools/call" with "generate_agents" with force creates AGENTS.md and modular skills
    And Calling "tools/call" with "wrap_context" runs AST audit and composite scorer returning action plan
    And Calling "resources/read" retrieves the compiled AGENTS.md content
    And Calling "prompts/get" with "audit_repository" generates structured workflow instructions
    And Concurrent pipelined requests receive matched responses by ID without interleaving
    And Malformed JSON and non-compliant requests return error codes -32700, -32600, -32601, and -32602
    And Subprocess terminates cleanly with exit code 0 when stdin stream closes
```

---

## 🔒 4. Invariantes & Casos de Borda
- **Stream Isolation:** Zero poluição em `stdout`. Apenas mensagens JSON-RPC 2.0 delimitadas por quebra de linha (`\n`) podem ser emitidas em `stdout`. Telemetria e logs vão estritamente para `stderr`.
- **Fail-Safe Dispatcher:** Falhas na execução de ferramentas nunca derrubam o processo do servidor; em vez disso, retornam `isError: true` com envelope MCP.
- **Idempotência & Concorrência:** Suporte a múltiplas requisições assíncronas concorrentes com preservação estrita do `id` do JSON-RPC correspondente.
- **Rejeição Estrita de Payloads Inválidos:** Payloads não-JSON ou sem `jsonrpc: "2.0"` geram códigos de erro canônicos RFC (-32700 e -32600).

---

## 📁 5. Arquivos Afetados
- `docs/specs/SPEC-12.md`
- `src/types.ts`
- `src/mcp-server.ts`
- `src/mcp.ts`
- `src/cli.ts`
- `index.ts`
- `tests/mcp_server.test.ts`
- `docs/EXPERIENCE.md`
