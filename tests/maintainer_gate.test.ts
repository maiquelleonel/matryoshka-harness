import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyMaintainerAuthorization } from "../src/governance";

describe("SPEC-5: Subtask 2 - Maintainer Merge Gate & Protected Branches", () => {
  const rootDir = process.cwd();
  const codeownersPath = join(rootDir, ".github", "CODEOWNERS");
  const maintainerWorkflowPath = join(
    rootDir,
    ".github",
    "workflows",
    "maintainer-gate.yml",
  );

  describe("File declarations & configuration", () => {
    it("should have .github/CODEOWNERS present with @maiquelleonel as owner", () => {
      expect(existsSync(codeownersPath)).toBe(true);
      const content = readFileSync(codeownersPath, "utf-8");
      expect(content).toMatch(/^\*\s+@maiquelleonel\b/m);
    });

    it("should have .github/workflows/maintainer-gate.yml present", () => {
      expect(existsSync(maintainerWorkflowPath)).toBe(true);
    });

    it("should configure pull_request and pull_request_review triggers targeting main", () => {
      const content = readFileSync(maintainerWorkflowPath, "utf-8");
      expect(content).toContain("pull_request:");
      expect(content).toMatch(/branches:.*main/s);
      expect(content).toContain("pull_request_review:");
    });

    it("should run on ubuntu-latest and verify maintainer authorization", () => {
      const content = readFileSync(maintainerWorkflowPath, "utf-8");
      expect(content).toContain("runs-on: ubuntu-latest");
      expect(content).toContain("maiquelleonel");
    });
  });

  describe("Governance business logic", () => {
    it("should authorize pull requests authored by @maiquelleonel", () => {
      const result = verifyMaintainerAuthorization({
        author: "maiquelleonel",
        reviews: [],
      });
      expect(result.authorized).toBe(true);
      expect(result.reason).toContain("@maiquelleonel");
    });

    it("should authorize pull requests authored by maiquelleonel with leading @", () => {
      const result = verifyMaintainerAuthorization({
        author: "@maiquelleonel",
        reviews: [],
      });
      expect(result.authorized).toBe(true);
    });

    it("should authorize pull requests from external contributors if approved by @maiquelleonel", () => {
      const result = verifyMaintainerAuthorization({
        author: "contributor-bob",
        reviews: [
          { user: { login: "someone-else" }, state: "COMMENTED" },
          { user: { login: "maiquelleonel" }, state: "APPROVED" },
        ],
      });
      expect(result.authorized).toBe(true);
    });

    it("should reject pull requests from external contributors without @maiquelleonel approval", () => {
      const result = verifyMaintainerAuthorization({
        author: "contributor-bob",
        reviews: [
          { user: { login: "someone-else" }, state: "APPROVED" },
          { user: { login: "maiquelleonel" }, state: "CHANGES_REQUESTED" },
        ],
      });
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain("maiquelleonel");
    });

    it("should reject pull requests from external contributors with no reviews", () => {
      const result = verifyMaintainerAuthorization({
        author: "external-actor",
        reviews: [],
      });
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain("maiquelleonel");
    });
  });
});
