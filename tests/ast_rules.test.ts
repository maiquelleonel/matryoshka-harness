import { describe, expect, it } from "bun:test";
import { parseSource } from "../src/ast";
import {
  SqlInterpolationRule,
  AssertionlessTestRule,
  HardcodedCredentialRule,
  AstRuleSuite,
  runAstRules,
  calculateShannonEntropy,
  isPotentialSql,
} from "../src/rules";
import type { ParsedFileAst, AstViolation } from "../src/types";

describe("SPEC-11: Contextual AST Antipattern Rule Suite (Subtask 2)", () => {
  describe("Utility: calculateShannonEntropy & isPotentialSql", () => {
    it("calculates 0 entropy for empty or single-character repetitive strings", () => {
      expect(calculateShannonEntropy("")).toBe(0);
      expect(calculateShannonEntropy("aaaaaaaaaa")).toBe(0);
    });

    it("calculates high entropy for random/cryptographic keys", () => {
      const highEntropyKey = "a8f9b4c2e1d09876543210abcdef";
      const entropy = calculateShannonEntropy(highEntropyKey);
      expect(entropy).toBeGreaterThan(3.0);
    });

    it("detects standard SQL statements and keywords", () => {
      expect(isPotentialSql("SELECT * FROM users WHERE id = 1")).toBe(true);
      expect(isPotentialSql("INSERT INTO accounts (name) VALUES ('test')")).toBe(true);
      expect(isPotentialSql("UPDATE orders SET status = 'paid' WHERE id = 5")).toBe(true);
      expect(isPotentialSql("DELETE FROM sessions WHERE expired = true")).toBe(true);
      expect(isPotentialSql("DROP TABLE temp_data")).toBe(true);
      expect(isPotentialSql("console.log('hello world')")).toBe(false);
      expect(isPotentialSql("const count = 42;")).toBe(false);
    });
  });

  describe("Rule 1: SqlInterpolationRule (sql-interpolation)", () => {
    const rule = new SqlInterpolationRule();

    it("has canonical rule metadata", () => {
      expect(rule.id).toBe("sql-interpolation");
      expect(rule.defaultSeverity).toBe("critical");
      expect(rule.name).toBeDefined();
      expect(rule.description).toBeDefined();
    });

    it("detects unparameterized SQL dynamic queries via template literals in TypeScript", () => {
      const tsCode = `
import { db } from "./db";

export async function getUser(userId: string) {
  return await db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
}
      `.trim();

      const parsed = parseSource(tsCode, "typescript", { cwd: "/app" });
      parsed.relativePath = "src/db/users.ts";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBeGreaterThanOrEqual(1);
      const v = violations[0]!;
      expect(v.ruleId).toBe("sql-interpolation");
      expect(v.severity).toBe("critical");
      expect(v.relativePath).toBe("src/db/users.ts");
      expect(v.line).toBeGreaterThanOrEqual(4);
      expect(v.codeSnippet).toContain("SELECT * FROM users");
      expect(v.remediation).toContain("parameterized");
    });

    it("detects dynamic SQL template literal assigned to intermediate variable", () => {
      const tsCode = `
const sql = \`SELECT * FROM accounts WHERE email = '\${email}'\`;
await db.query(sql);
      `.trim();

      const parsed = parseSource(tsCode, "typescript");
      parsed.relativePath = "src/services/account.ts";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBeGreaterThanOrEqual(1);
      const v = violations[0]!;
      expect(v.severity).toBe("critical");
      expect(v.codeSnippet).toContain("SELECT * FROM accounts");
    });

    it("detects dynamic SQL concatenation via + operator in TypeScript", () => {
      const tsCode = `
const query = "SELECT * FROM users WHERE id = " + userId;
db.query(query);
      `.trim();

      const parsed = parseSource(tsCode, "typescript");
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]!.codeSnippet).toContain("SELECT * FROM users");
    });

    it("detects unparameterized SQL dynamic queries via Python f-strings", () => {
      const pyCode = `
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
      `.trim();

      const parsed = parseSource(pyCode, "python");
      parsed.relativePath = "backend/db.py";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]!.severity).toBe("critical");
      expect(violations[0]!.codeSnippet).toContain("SELECT * FROM users");
    });

    it("detects dynamic SQL in Go via fmt.Sprintf or concatenation", () => {
      const goCode = `
package db

import "fmt"

func GetUser(id string) {
    q := fmt.Sprintf("SELECT * FROM users WHERE id = %s", id)
    db.Query(q)
}
      `.trim();

      const parsed = parseSource(goCode, "go");
      parsed.relativePath = "pkg/db/user.go";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]!.severity).toBe("critical");
    });

    it("does NOT flag safely parameterized queries", () => {
      const safeTs = `
await db.query('SELECT * FROM users WHERE id = $1', [userId]);
const staticQuery = "SELECT id, name FROM roles";
await db.query(staticQuery);
      `.trim();

      const parsed = parseSource(safeTs, "typescript");
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(0);
    });
  });

  describe("Rule 2: AssertionlessTestRule (assertionless-test)", () => {
    const rule = new AssertionlessTestRule();

    it("has canonical rule metadata", () => {
      expect(rule.id).toBe("assertionless-test");
      expect(rule.defaultSeverity).toBe("high");
      expect(rule.name).toBeDefined();
      expect(rule.description).toBeDefined();
    });

    it("flags assertionless test cases in TypeScript/JavaScript (it/test)", () => {
      const tsTest = `
describe("Auth Module", () => {
  it("authenticates the user", async () => {
    const client = new AuthClient();
    await client.login("user", "pass");
  });
});
      `.trim();

      const parsed = parseSource(tsTest, "typescript");
      parsed.relativePath = "tests/unit/auth.test.ts";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBe(1);
      const v = violations[0]!;
      expect(v.ruleId).toBe("assertionless-test");
      expect(v.severity).toBe("high");
      expect(v.line).toBeGreaterThanOrEqual(2);
      expect(v.remediation).toContain("assertion");
    });

    it("flags empty test functions in TypeScript/JavaScript", () => {
      const tsTest = `
test("pending feature", () => {});
      `.trim();

      const parsed = parseSource(tsTest, "typescript");
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(1);
    });

    it("does NOT flag TypeScript tests with valid assertions (expect, assert)", () => {
      const tsTest = `
describe("Auth Module", () => {
  it("authenticates the user", async () => {
    const client = new AuthClient();
    const ok = await client.login("user", "pass");
    expect(ok).toBe(true);
  });

  test("validates token", () => {
    assert.strictEqual(1, 1);
  });
});
      `.trim();

      const parsed = parseSource(tsTest, "typescript");
      parsed.relativePath = "tests/auth.test.ts";
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(0);
    });

    it("flags assertionless test functions in Python (def test_*)", () => {
      const pyTest = `
def test_login():
    client = AuthClient()
    client.login("user", "pass")
      `.trim();

      const parsed = parseSource(pyTest, "python");
      parsed.relativePath = "tests/test_auth.py";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBe(1);
      expect(violations[0]!.severity).toBe("high");
      expect(violations[0]!.codeSnippet).toContain("test_login");
    });

    it("does NOT flag Python tests with assert statements", () => {
      const pyTest = `
def test_login():
    client = AuthClient()
    res = client.login("user", "pass")
    assert res.status_code == 200
      `.trim();

      const parsed = parseSource(pyTest, "python");
      parsed.relativePath = "tests/test_auth.py";
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(0);
    });

    it("flags assertionless test functions in Go (func Test*)", () => {
      const goTest = `
package auth_test

import "testing"

func TestAuth(t *testing.T) {
    client := NewClient()
    client.Login("admin", "secret")
}
      `.trim();

      const parsed = parseSource(goTest, "go");
      parsed.relativePath = "pkg/auth/auth_test.go";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBe(1);
      expect(violations[0]!.codeSnippet).toContain("TestAuth");
    });

    it("does NOT flag Go tests with t.Fatal / assert", () => {
      const goTest = `
package auth_test

import "testing"

func TestAuth(t *testing.T) {
    client := NewClient()
    err := client.Login("admin", "secret")
    if err != nil {
        t.Fatalf("login failed: %v", err)
    }
}
      `.trim();

      const parsed = parseSource(goTest, "go");
      parsed.relativePath = "pkg/auth/auth_test.go";
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(0);
    });

    it("ignores non-test functions", () => {
      const normalCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `.trim();

      const parsed = parseSource(normalCode, "typescript");
      parsed.relativePath = "src/math.ts";
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(0);
    });
  });

  describe("Rule 3: HardcodedCredentialRule (hardcoded-credential)", () => {
    const rule = new HardcodedCredentialRule();

    it("has canonical rule metadata", () => {
      expect(rule.id).toBe("hardcoded-credential");
      expect(rule.defaultSeverity).toBe("critical");
      expect(rule.name).toBeDefined();
      expect(rule.description).toBeDefined();
    });

    it("detects sensitive variable names with hardcoded string credentials", () => {
      const tsCode = `
const apiKey = "[REDACTED]";
const dbPassword = "ProductionPassword2026!#";
      `.trim();

      const parsed = parseSource(tsCode, "typescript");
      parsed.relativePath = "src/config.ts";
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBe(2);
      expect(violations[0]!.severity).toBe("critical");
      expect(violations[0]!.codeSnippet).toContain("apiKey");
      expect(violations[1]!.codeSnippet).toContain("dbPassword");
    });

    it("detects known secret token prefixes even with generic variable names", () => {
      const tsCode = `
const githubToken = "ghp_0123456789abcdefghijklmnopqrstuvwxyz";
const slackBotToken = "[REDACTED]-1234567890123-abcdefghijklmnopqrstuvwx";
      `.trim();

      const parsed = parseSource(tsCode, "typescript");
      const violations = rule.check({ file: parsed });

      expect(violations.length).toBe(2);
    });

    it("does NOT flag environment variable readings", () => {
      const tsCode = `
const apiKey = process.env.API_KEY || "";
const secret = process.env["APP_SECRET"];
const dbPass = os.getenv("DB_PASS");
      `.trim();

      const parsed = parseSource(tsCode, "typescript");
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(0);
    });

    it("does NOT flag empty strings or non-sensitive constants", () => {
      const tsCode = `
const apiKey = "";
const mode = "production";
const greeting = "Hello World";
      `.trim();

      const parsed = parseSource(tsCode, "typescript");
      const violations = rule.check({ file: parsed });
      expect(violations.length).toBe(0);
    });
  });

  describe("AstRuleSuite & runAstRules Aggregator", () => {
    it("runs all default rules across multiple files and compiles structured results", () => {
      const file1 = parseSource(
        `const sql = \`SELECT * FROM users WHERE id = \${id}\`;\ndb.query(sql);`,
        "typescript"
      );
      file1.relativePath = "src/db.ts";

      const file2 = parseSource(
        `it("does nothing", () => { const x = 1; });`,
        "typescript"
      );
      file2.relativePath = "tests/test.ts";

      const file3 = parseSource(
        `const apiKey = "[REDACTED]";`,
        "typescript"
      );
      file3.relativePath = "src/auth.ts";

      const fileClean = parseSource(
        `export function add(a: number, b: number) { return a + b; }`,
        "typescript"
      );
      fileClean.relativePath = "src/math.ts";

      const suite = new AstRuleSuite();
      const result = suite.run([file1, file2, file3, fileClean]);

      expect(result.scannedFilesCount).toBe(4);
      expect(result.cleanFilesCount).toBe(1);
      expect(result.totalViolations).toBe(3);
      expect(result.bySeverity.critical).toBe(2);
      expect(result.bySeverity.high).toBe(1);
      expect(result.byRule["sql-interpolation"]).toBe(1);
      expect(result.byRule["assertionless-test"]).toBe(1);
      expect(result.byRule["hardcoded-credential"]).toBe(1);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("supports disabling specific rules via disabledRuleIds", () => {
      const file = parseSource(
        `const apiKey = "[REDACTED]";`,
        "typescript"
      );
      file.relativePath = "src/auth.ts";

      const result = runAstRules(file, {
        disabledRuleIds: ["hardcoded-credential"],
      });

      expect(result.totalViolations).toBe(0);
    });

    it("supports minSeverity filtering", () => {
      const file1 = parseSource(
        `const sql = \`SELECT * FROM users WHERE id = \${id}\`;`,
        "typescript"
      );
      const file2 = parseSource(
        `it("test", () => {});`,
        "typescript"
      );

      const result = runAstRules([file1, file2], {
        minSeverity: "critical",
      });

      expect(result.violations.every((v) => v.severity === "critical")).toBe(true);
    });

    it("supports severityOverrides for custom tuning", () => {
      const file = parseSource(
        `it("test", () => {});`,
        "typescript"
      );

      const result = runAstRules(file, {
        severityOverrides: {
          "assertionless-test": "low",
        },
      });

      expect(result.violations[0]?.severity).toBe("low");
    });
  });
});
