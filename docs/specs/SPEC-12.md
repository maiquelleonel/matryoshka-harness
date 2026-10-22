# 📐 SPEC-12: feat(mcp): native mcp server for ide agents (matryoshka mcp serve)

**Módulo:** SDD Engine / Automated Architecture  
**Status:** in_progress (Subtask 1: Lightweight MCP Protocol stdio transport & message dispatcher)  
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
    And Calling "tools/call" with "detect_stack" executes non-destructively and returns structured JSON text

  Scenario: AC-3 - Subtask 3: Resource & Prompt provider handlers
    Given The native MCP server
    When "resources/list" and "prompts/list" are called
    Then It exposes "matryoshka://agents" and "matryoshka://diagnostic"
    And It exposes prompt "audit_repository"

  Scenario: AC-4 - Subtask 4: CLI integration (baba mcp serve) with stderr logging guards
    Given The CLI binary
    When Executed with "baba mcp serve [path]"
    Then It binds to stdio without writing non-JSON text to stdout
    And All startup notices and telemetry are strictly routed to stderr
    And Parity is preserved across "bbyg mcp serve" and "matryoshka mcp serve"

  Scenario: AC-5 - Subtask 5: BDD acceptance tests verifying MCP client handshake and tool invocation
    Given A subprocess executing "baba mcp serve"
    When A client performs the initialize handshake and executes tools over stdin
    Then Valid JSON-RPC responses are received on stdout
    And Stderr captures diagnostic telemetry without corrupting the message stream
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
