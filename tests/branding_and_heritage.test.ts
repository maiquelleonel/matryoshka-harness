import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("SPEC-14 Subtask 4: Cross-link Matryoshka from Ouroboros Engine hotsite and main README", () => {
  const rootDir = path.resolve(__dirname, "..");
  const readmePath = path.join(rootDir, "README.md");
  const siteHtmlPath = path.join(rootDir, "site", "index.html");
  const licensePath = path.join(rootDir, "LICENSE");
  const packageJsonPath = path.join(rootDir, "package.json");

  describe("AC-1 & AC-4: Main README Showcase, Quickstart & Cross-Links", () => {
    it("should exist and contain launch-grade title and canonical aliases", () => {
      expect(fs.existsSync(readmePath)).toBe(true);
      const readme = fs.readFileSync(readmePath, "utf-8");

      expect(readme).toContain("# 🪆 Matryoshka-Harness");
      expect(readme).toContain("baba");
      expect(readme).toContain("bbyg");
      expect(readme).toContain("matryoshka");
    });

    it("should articulate the Context-Rot & AI Slop Crisis problem narrative", () => {
      const readme = fs.readFileSync(readmePath, "utf-8");

      expect(readme).toMatch(/context[- ]rot/i);
      expect(readme).toMatch(/ai[- ]slop/i);
      expect(readme).toMatch(/token/i);
    });

    it("should detail the Concentric 5-Layer Russian Doll Architecture", () => {
      const readme = fs.readFileSync(readmePath, "utf-8");

      expect(readme).toContain("Layer 1");
      expect(readme).toContain("Layer 2");
      expect(readme).toContain("Layer 3");
      expect(readme).toContain("Layer 4");
      expect(readme).toContain("Layer 5");

      // Core technical components
      expect(readme).toMatch(/harness[- ]score|oracle/i);
      expect(readme).toMatch(/codebase[- ]memory[- ]mcp|semantic code graph/i);
      expect(readme).toMatch(/agents\.md/i);
      expect(readme).toMatch(/tree[- ]sitter|ast|wasm/i);
      expect(readme).toMatch(/mcp|model context protocol/i);
    });

    it("should provide zero-dependency quickstart commands with bunx and npx", () => {
      const readme = fs.readFileSync(readmePath, "utf-8");

      expect(readme).toContain("bunx @maiquelleonel/matryoshka");
      expect(readme).toContain("npx @maiquelleonel/matryoshka");
    });

    it("should contain downstream CI quality gate snippet", () => {
      const readme = fs.readFileSync(readmePath, "utf-8");

      expect(readme).toContain("baba wrap --strict");
      expect(readme).toContain("--threshold");
    });

    it("should feature canonical Ouroboros Seal attribution badge and footer", () => {
      const readme = fs.readFileSync(readmePath, "utf-8");

      // Attribution badge linking to Ouroboros Engine
      expect(readme).toContain("ouroboros.leonellabshq.dev");
      expect(readme).toMatch(/Built with mathematical rigor by.*Ouroboros Engine/i);
    });

    it("should cross-link to the interactive hotsite", () => {
      const readme = fs.readFileSync(readmePath, "utf-8");

      expect(readme).toMatch(/site\/index\.html|matryoshka\.leonellabshq\.dev|ouroboros\.leonellabshq\.dev/);
    });

    it("should cite MIT License with copyright attribution", () => {
      const readme = fs.readFileSync(readmePath, "utf-8");

      expect(readme).toContain("MIT");
      expect(readme).toContain("Maiquel Leonel");
    });
  });

  describe("AC-4: Ouroboros Engine Hotsite (site/index.html) Cross-Linking & Heritage", () => {
    it("should exist and contain cross-link to GitHub repository and README", () => {
      expect(fs.existsSync(siteHtmlPath)).toBe(true);
      const html = fs.readFileSync(siteHtmlPath, "utf-8");

      expect(html).toContain("https://github.com/maiquelleonel/matryoshka-harness");
    });

    it("should cross-link to Ouroboros Engine parent ecosystem", () => {
      const html = fs.readFileSync(siteHtmlPath, "utf-8");

      expect(html).toContain("https://ouroboros.leonellabshq.dev");
      expect(html).toContain("LeonelLabs Ouroboros Engine");
    });

    it("should contain canonical Ouroboros attribution in footer and i18n dictionaries", () => {
      const html = fs.readFileSync(siteHtmlPath, "utf-8");

      // Verify HTML footer element
      expect(html).toContain("footer_built");

      // Verify i18n PT & EN dictionaries
      expect(html).toContain("Construído com rigor matemático pela");
      expect(html).toContain("Built with mathematical rigor by");
    });

    it("should link to project documentation and interactive sections", () => {
      const html = fs.readFileSync(siteHtmlPath, "utf-8");

      expect(html).toContain("#concentric");
      expect(html).toContain("#anti-slop");
    });
  });

  describe("AC-3: License & Governance Parity", () => {
    it("should have valid MIT LICENSE file with copyright attribution", () => {
      expect(fs.existsSync(licensePath)).toBe(true);
      const license = fs.readFileSync(licensePath, "utf-8");

      expect(license).toContain("MIT License");
      expect(license).toContain("Copyright (c) 2026 Maiquel Leonel");
    });

    it("should have MIT license in package.json matching LICENSE", () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      expect(pkg.license).toBe("MIT");
      expect(pkg.author).toContain("Maiquel Leonel");
    });
  });
});
