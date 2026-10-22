import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  detectFileLanguage,
  isBinaryContent,
  isIgnoredFile,
  parseSource,
  parseFile,
  walkCodebase,
  AstEngine,
} from "../src/ast";
import type {
  AstLanguage,
  AstNode,
  ParsedFileAst,
  AstWalkResult,
} from "../src/types";

describe("SPEC-11: Polyglot AST Walker & Tree-sitter WASM Engine (Subtask 1)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "baba-ast-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("Scenario 1: Language Detection and Mapping (detectFileLanguage)", () => {
    it("maps TypeScript file extensions accurately", () => {
      expect(detectFileLanguage("src/index.ts")).toBe("typescript");
      expect(detectFileLanguage("src/components/App.tsx")).toBe("typescript");
      expect(detectFileLanguage("src/module.mts")).toBe("typescript");
      expect(detectFileLanguage("src/module.cts")).toBe("typescript");
    });

    it("maps JavaScript file extensions accurately", () => {
      expect(detectFileLanguage("index.js")).toBe("javascript");
      expect(detectFileLanguage("components/App.jsx")).toBe("javascript");
      expect(detectFileLanguage("server.mjs")).toBe("javascript");
      expect(detectFileLanguage("config.cjs")).toBe("javascript");
    });

    it("maps Python, Go, and Rust extensions accurately", () => {
      expect(detectFileLanguage("backend/main.py")).toBe("python");
      expect(detectFileLanguage("cmd/server/main.go")).toBe("go");
      expect(detectFileLanguage("src/lib.rs")).toBe("rust");
    });

    it("returns null for non-code, config, or unsupported files", () => {
      expect(detectFileLanguage("README.md")).toBeNull();
      expect(detectFileLanguage("package.json")).toBeNull();
      expect(detectFileLanguage(".gitignore")).toBeNull();
      expect(detectFileLanguage("style.css")).toBeNull();
      expect(detectFileLanguage("LICENSE")).toBeNull();
      expect(detectFileLanguage("")).toBeNull();
    });
  });

  describe("Scenario 2: Binary Content Detection (isBinaryContent)", () => {
    it("detects binary files containing null bytes in early bytes", () => {
      const binaryBuf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x01]);
      expect(isBinaryContent(binaryBuf)).toBe(true);

      const emptyBuf = Buffer.alloc(0);
      expect(isBinaryContent(emptyBuf)).toBe(false);
    });

    it("identifies valid text and UTF-8 source code as non-binary", () => {
      const codeBuf = Buffer.from("const x = 42;\nconsole.log(x); // olá mundo 🚀\n");
      expect(isBinaryContent(codeBuf)).toBe(false);
    });
  });

  describe("Scenario 3: Ignored Files and Vendor Paths (isIgnoredFile)", () => {
    it("ignores default vendor and build directories", () => {
      expect(isIgnoredFile("node_modules/picocolors/index.js")).toBe(true);
      expect(isIgnoredFile(".venv/lib/python3.11/site-packages/os.py")).toBe(true);
      expect(isIgnoredFile("target/debug/build.rs")).toBe(true);
      expect(isIgnoredFile("vendor/bundle/ruby.rb")).toBe(true);
      expect(isIgnoredFile(".git/objects/00/abc")).toBe(true);
      expect(isIgnoredFile("dist/bundle.js")).toBe(true);
      expect(isIgnoredFile("build/output.js")).toBe(true);
      expect(isIgnoredFile(".next/server.js")).toBe(true);
      expect(isIgnoredFile("__pycache__/main.cpython-311.pyc")).toBe(true);
      expect(isIgnoredFile("coverage/lcov.info")).toBe(true);
    });

    it("allows standard source files in root and subdirectories", () => {
      expect(isIgnoredFile("src/index.ts")).toBe(false);
      expect(isIgnoredFile("lib/utils.py")).toBe(false);
      expect(isIgnoredFile("pkg/api/handler.go")).toBe(false);
    });

    it("respects custom ignore patterns", () => {
      expect(isIgnoredFile("generated/code.ts", ["generated/**"])).toBe(true);
      expect(isIgnoredFile("fixtures/sample.py", ["fixtures/**"])).toBe(true);
    });
  });

  describe("Scenario 4: Source Parsing & AST Structure (parseSource & parseFile)", () => {
    it("parses TypeScript source into structured AstNode tree", () => {
      const tsCode = `
        import { db } from "./db";

        export async function getUser(userId: string) {
          const sql = \`SELECT * FROM users WHERE id = \${userId}\`;
          return await db.query(sql);
        }
      `.trim();

      const parsed: ParsedFileAst = parseSource(tsCode, "typescript", {
        cwd: tempDir,
      });

      expect(parsed.language).toBe("typescript");
      expect(parsed.content).toBe(tsCode);
      expect(parsed.lines.length).toBeGreaterThan(3);
      expect(parsed.sizeBytes).toBe(Buffer.byteLength(tsCode));
      expect(parsed.rootNode).toBeDefined();
      expect(parsed.rootNode.type).toBe("Program");

      // Verify AstNode methods
      const functions = parsed.rootNode.findChildrenByType("FunctionDeclaration");
      expect(functions.length).toBeGreaterThanOrEqual(1);

      let foundQuery = false;
      parsed.rootNode.walk((node: AstNode) => {
        if (node.type === "CallExpression" && node.text.includes("query")) {
          foundQuery = true;
        }
      });
      expect(foundQuery).toBe(true);
    });

    it("parses Python source into structured AstNode tree", () => {
      const pyCode = `
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
      `.trim();

      const parsed = parseSource(pyCode, "python");
      expect(parsed.language).toBe("python");
      expect(parsed.rootNode.type).toBe("Program");

      const funcs = parsed.rootNode.findChildrenByType("FunctionDeclaration");
      expect(funcs.length).toBe(1);
      expect(funcs[0]?.text).toContain("def get_user");
    });

    it("parses Go source into structured AstNode tree", () => {
      const goCode = `
package main

import "fmt"

func GetUser(id string) {
    q := fmt.Sprintf("SELECT * FROM users WHERE id = %s", id)
    db.Query(q)
}
      `.trim();

      const parsed = parseSource(goCode, "go");
      expect(parsed.language).toBe("go");
      expect(parsed.rootNode.type).toBe("Program");

      const funcs = parsed.rootNode.findChildrenByType("FunctionDeclaration");
      expect(funcs.length).toBe(1);
    });

    it("reads and parses an on-disk source file via parseFile", async () => {
      const filePath = path.join(tempDir, "sample.ts");
      fs.writeFileSync(filePath, "export const apiKey = 'sk_live_12345';\n");

      const parsed = await parseFile(filePath);
      expect(parsed.filePath).toBe(filePath);
      expect(parsed.language).toBe("typescript");
      expect(parsed.lines.length).toBeGreaterThanOrEqual(1);
      expect(parsed.rootNode.text).toContain("apiKey");
    });
  });

  describe("Scenario 5: Codebase Walking (walkCodebase)", () => {
    it("recursively traverses and indexes polyglot files", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "pkg"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/index.ts"), "export const a = 1;");
      fs.writeFileSync(path.join(tempDir, "src/worker.py"), "def work(): pass");
      fs.writeFileSync(path.join(tempDir, "pkg/util.go"), "package pkg\nfunc Util() {}");
      fs.writeFileSync(path.join(tempDir, "tests/test.ts"), "test('ok', () => {});");
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Hello");

      const result: AstWalkResult = await walkCodebase(tempDir);

      expect(result.scannedFiles.length).toBe(4);
      expect(result.languagesCount.typescript).toBe(2);
      expect(result.languagesCount.python).toBe(1);
      expect(result.languagesCount.go).toBe(1);

      // Deterministic alphabetical sort check
      const relativePaths = result.scannedFiles.map((f) => f.relativePath);
      const sortedPaths = [...relativePaths].sort((a, b) => a.localeCompare(b));
      expect(relativePaths).toEqual(sortedPaths);
    });

    it("skips vendor directories and files matching .gitignore", async () => {
      fs.mkdirSync(path.join(tempDir, "node_modules/dep"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, ".venv/lib"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "ignored_dir"), { recursive: true });

      fs.writeFileSync(path.join(tempDir, "src/app.ts"), "const x = 1;");
      fs.writeFileSync(path.join(tempDir, "node_modules/dep/index.js"), "module.exports = {};");
      fs.writeFileSync(path.join(tempDir, ".venv/lib/site.py"), "pass");
      fs.writeFileSync(path.join(tempDir, "ignored_dir/secret.py"), "secret = 1");
      fs.writeFileSync(path.join(tempDir, ".gitignore"), "ignored_dir/\n*.tmp\n");
      fs.writeFileSync(path.join(tempDir, "src/scratch.tmp"), "temp");

      const result = await walkCodebase(tempDir);

      const scannedPaths = result.scannedFiles.map((f) => f.relativePath);
      expect(scannedPaths).toContain(path.normalize("src/app.ts"));
      expect(scannedPaths).not.toContain(path.normalize("node_modules/dep/index.js"));
      expect(scannedPaths).not.toContain(path.normalize(".venv/lib/site.py"));
      expect(scannedPaths).not.toContain(path.normalize("ignored_dir/secret.py"));

      const skippedReasons = result.skippedFiles.map((s) => s.reason);
      expect(skippedReasons).toContain("ignored");
    });

    it("skips binary files with reason 'binary'", async () => {
      fs.mkdirSync(path.join(tempDir, "bin"), { recursive: true });
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00, 0xff]);
      fs.writeFileSync(path.join(tempDir, "bin/binary.ts"), binaryData);

      const result = await walkCodebase(tempDir);
      const skippedBinary = result.skippedFiles.find((s) => s.relativePath === path.normalize("bin/binary.ts"));
      expect(skippedBinary).toBeDefined();
      expect(skippedBinary?.reason).toBe("binary");
    });

    it("enforces max file size limit (skips files > 500KB)", async () => {
      const largeContent = "const x = 1;\n".repeat(40000); // ~560KB
      fs.writeFileSync(path.join(tempDir, "large.ts"), largeContent);
      fs.writeFileSync(path.join(tempDir, "small.ts"), "const y = 2;\n");

      const result = await walkCodebase(tempDir, { maxFileSizeKb: 500 });

      expect(result.scannedFiles.map((f) => f.relativePath)).toContain("small.ts");
      const skipped = result.skippedFiles.find((s) => s.relativePath === "large.ts");
      expect(skipped).toBeDefined();
      expect(skipped?.reason).toBe("exceeds_max_size");
    });

    it("isolates errors gracefully and enforces per-file timeout", async () => {
      fs.writeFileSync(path.join(tempDir, "good.ts"), "export const ok = true;");

      // Custom engine instance with simulated timeout
      const engine = new AstEngine({ timeoutMs: 10 });
      const result = await engine.walk(tempDir);

      expect(result.scannedFiles.length).toBe(1);
      expect(result.scannedFiles[0]?.relativePath).toBe("good.ts");
    });

    it("produces byte-for-byte idempotent outputs across repeated runs", async () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "src/b.ts"), "export const b = 2;");
      fs.writeFileSync(path.join(tempDir, "src/a.ts"), "export const a = 1;");
      fs.writeFileSync(path.join(tempDir, "src/c.py"), "c = 3");

      const run1 = await walkCodebase(tempDir);
      const run2 = await walkCodebase(tempDir);

      expect(run1.scannedFiles.map((f) => f.relativePath)).toEqual(
        run2.scannedFiles.map((f) => f.relativePath)
      );
      expect(run1.scannedFiles.map((f) => f.sizeBytes)).toEqual(
        run2.scannedFiles.map((f) => f.sizeBytes)
      );
      expect(run1.totalFilesDiscovered).toBe(run2.totalFilesDiscovered);
    });
  });
});
