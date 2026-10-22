# 📐 SPEC-11: feat(ast): polyglot tree-sitter wasm engine and canonical baba wrap

**Módulo:** SDD Engine / Automated Architecture  
**Status:** in_progress (Subtask 1: Polyglot AST Walker & Tree-sitter WASM Engine)  
**Gatilho:** Issue #11  
**Target:** Bun + TypeScript + WebAssembly (WASM)  

---

## 🎯 1. Objetivo & Escopo
Implement Phase 4 of the Matryoshka-Harness roadmap: zero-host-dependency Polyglot AST Engine powered by WebAssembly (WASM) and the canonical `baba wrap` (`matryoshka wrap`, `bbyg wrap`) command. Refer to PRD: `docs/prds/PRD_POLYGLOT_AST_AND_BABA_WRAP.md`

### 1.1 Escopo das Subtasks
- **Subtask 1 (Ativa):** Polyglot AST Walker & Tree-sitter WASM Engine
- **Subtask 2:** Contextual AST Antipattern Rule Suite (SQL, Tests, Secrets)
- **Subtask 3:** Harness² Composite Scorer & Gap Aggregator
- **Subtask 4:** `DIAGNOSTIC.md` & JSON Report Compilers
- **Subtask 5:** CLI Subcommand Integration, Guardrails & Strict Mode

---

## 📋 2. Contratos de I/O & Interfaces (Subtask 1)

### 2.1 Tipos Canônicos de Linguagem e Nós
```typescript
export type AstLanguage = "typescript" | "javascript" | "python" | "go" | "rust";

export interface AstPoint {
  row: number; // 0-based
  column: number; // 0-based
}

export interface AstNode {
  type: string;
  text: string;
  startPosition: AstPoint;
  endPosition: AstPoint;
  children: AstNode[];
  parent?: AstNode | null;
  childCount: number;
  findChildByType(type: string): AstNode | null;
  findChildrenByType(type: string): AstNode[];
  walk(visitor: (node: AstNode) => void | boolean): void;
}
```

### 2.2 Interface de Arquivo AST Parsed
```typescript
export interface ParsedFileAst {
  filePath: string;
  relativePath: string;
  language: AstLanguage;
  sizeBytes: number;
  parseEngine: "tree-sitter-wasm" | "heuristic-fallback";
  parseTimeMs: number;
  rootNode: AstNode;
  content: string;
  lines: string[];
}
```

### 2.3 Opções e Resultados do Walker
```typescript
export interface AstWalkerOptions {
  cwd?: string;
  maxFileSizeKb?: number; // default: 500
  timeoutMs?: number; // default: 2000
  languages?: AstLanguage[];
  ignorePatterns?: string[];
  wasmGrammarPaths?: Partial<Record<AstLanguage, string>>;
  concurrency?: number;
}

export interface AstSkippedFile {
  filePath: string;
  relativePath: string;
  reason: "exceeds_max_size" | "binary" | "ignored" | "unsupported_language" | "timeout" | "parse_error";
  sizeBytes?: number;
  error?: string;
}

export interface AstWalkResult {
  totalFilesDiscovered: number;
  scannedFiles: ParsedFileAst[];
  skippedFiles: AstSkippedFile[];
  languagesCount: Record<AstLanguage, number>;
  executionTimeMs: number;
}
```

### 2.4 Funções Canônicas
- `detectFileLanguage(filePath: string): AstLanguage | null`
- `isBinaryContent(buffer: Buffer | Uint8Array): boolean`
- `isIgnoredFile(relativePath: string, customPatterns?: string[], gitignorePatterns?: string[]): boolean`
- `parseSource(source: string, language: AstLanguage, options?: AstWalkerOptions): ParsedFileAst`
- `parseFile(filePath: string, options?: AstWalkerOptions): Promise<ParsedFileAst>`
- `walkCodebase(projectPath: string, options?: AstWalkerOptions): Promise<AstWalkResult>`

---

## 🧪 3. Acceptance Criteria (BDD / Gherkin)
```gherkin
Feature: Polyglot AST Walker & Tree-sitter WASM Engine (SPEC-11 Subtask 1)

  Scenario: Language detection and mapping
    Given a list of polyglot source files (.ts, .js, .py, .go, .rs)
    When detectFileLanguage is called for each path
    Then it accurately returns the matching AstLanguage enum or null for unsupported files

  Scenario: Filtering vendor directories, .gitignore and binary files
    Given a repository with vendor directories (node_modules, .venv, target), .gitignore rules, and binary files
    When walkCodebase is executed
    Then all vendor dirs, ignored paths, and binary files are skipped with explicit reasons
    And only valid polyglot source files are processed

  Scenario: Enforcing max file size limit (500KB default)
    Given a source file larger than 500KB
    When walkCodebase is executed
    Then the large file is skipped with reason "exceeds_max_size"
    And memory bloat is prevented

  Scenario: AST Node tree structure and traversal
    Given source code in TypeScript, Python, or Go
    When parseSource or parseFile is invoked
    Then a deterministic AstNode tree is returned with type, positions (row/col), text, and children
    And findChildByType, findChildrenByType, and walk methods traverse the tree correctly

  Scenario: Timeout and failure isolation (Graceful Degradation)
    Given a file parsing that exceeds the timeout limit (2000ms) or contains malformed syntax
    When walkCodebase is executed
    Then the error or timeout is safely trapped without aborting the overall walk
    And the skipped file records reason "timeout" or "parse_error"

  Scenario: Idempotent and deterministic file order
    Given an identical project structure scanned multiple times
    When walkCodebase is called repeatedly
    Then the scannedFiles order is byte-for-byte identical and deterministic
```

---

## 🔒 4. As 9 Dimensões de Produção (Invariantes & Casos de Borda)
1. **Input Validation:** Validar paths contra path traversal (`..`). Ignorar arquivos binários (detecção de byte nulo `\0` nos primeiros 8KB) e pastas vendor (`node_modules`, `.venv`, `target`, `vendor`, `.git`, `dist`, `build`).
2. **Failure Modes & Timeout:** Parsing de AST limitado a 2000ms por arquivo. Em falhas de grammar ou timeouts, registrar warning/skip e continuar a execução.
3. **Idempotency & Retry:** Ordenação alfabética determinística de caminhos. Múltiplas execuções no mesmo código produzem resultados idênticos.
4. **Authorization & Scopes:** Acesso estritamente read-only aos arquivos do projeto.
5. **Concurrency & Locks:** Processamento assíncrono paralelo bounded pela capacidade de hardware (`navigator.hardwareConcurrency`).
6. **Data Lifecycle & TTL:** Liberação imediata de memória após o walk.
7. **External Fallbacks:** Tentativa de inicialização do runtime WebAssembly quando grammars forem fornecidas; fallback graceful para parser sintático heurístico estruturado em caso de ausência de grammars WASM.
8. **State Transitions:** Fluxo estrito `INIT` -> `DISCOVERY` -> `FILTERING` -> `PARSING` -> `COMPLETE`.
9. **Observability & Metrics:** Relatório de métricas de arquivos descobertos, escaneados, pulados e contagem por linguagem.

---

## 📁 5. Arquivos Afetados
- `docs/specs/SPEC-11.md`
- `src/types.ts`
- `src/ast.ts`
- `index.ts`
- `tests/ast_engine.test.ts`
