import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detectStack } from "../src/detector";
import type { ProjectStack } from "../src/types";

describe("Polyglot Stack Detector (src/detector.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "matryoshka-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AC-1: Deterministic Primary Stack Detection", () => {
    it("detects Python with pyproject.toml and FastAPI + pytest", () => {
      fs.writeFileSync(
        path.join(tempDir, "pyproject.toml"),
        `[project]\nname = "demo"\ndependencies = ["fastapi>=0.100.0", "pytest>=7.0.0"]\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("python");
      expect(stack.frameworks).toContain("fastapi");
      expect(stack.testRunner).toBe("pytest");
    });

    it("detects Python with requirements.txt and Django", () => {
      fs.writeFileSync(
        path.join(tempDir, "requirements.txt"),
        `Django>=4.2.0\npytest-django>=4.5.0\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("python");
      expect(stack.frameworks).toContain("django");
      expect(stack.testRunner).toBe("pytest");
      expect(stack.archetype).toBe("opinionated-framework");
    });

    it("detects Python with Pipfile, Flask, and unittest", () => {
      fs.writeFileSync(
        path.join(tempDir, "Pipfile"),
        `[[source]]\nurl = "https://pypi.org/simple"\n[packages]\nflask = "*"\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("python");
      expect(stack.frameworks).toContain("flask");
      expect(stack.testRunner).toBe("unittest");
    });

    it("detects JS/TS with package.json, next, bun.lock and bun test", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "web-app",
          dependencies: { next: "14.2.0" },
          scripts: { test: "bun test" }
        })
      );
      fs.writeFileSync(path.join(tempDir, "bun.lock"), "");

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("typescript");
      expect(stack.frameworks).toEqual(["nextjs"]);
      expect(stack.testRunner).toBe("bun test");
      expect(stack.archetype).toBe("reactive-frontend");
    });

    it("detects JS/TS with React and Vitest", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "spa",
          dependencies: { react: "^18.2.0" },
          devDependencies: { vitest: "^1.0.0" }
        })
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("typescript");
      expect(stack.frameworks).toContain("react");
      expect(stack.testRunner).toBe("vitest");
      expect(stack.archetype).toBe("reactive-frontend");
    });

    it("detects JS/TS with Vue and Jest", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "vue-app",
          dependencies: { vue: "^3.4.0" },
          devDependencies: { jest: "^29.0.0" }
        })
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("typescript");
      expect(stack.frameworks).toContain("vue");
      expect(stack.testRunner).toBe("jest");
      expect(stack.archetype).toBe("reactive-frontend");
    });

    it("detects JS/TS with NestJS and Express", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "api",
          dependencies: { "@nestjs/core": "^10.0.0", express: "^4.19.0" }
        })
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("typescript");
      expect(stack.frameworks).toContain("nestjs");
      expect(stack.frameworks).toContain("express");
      expect(stack.archetype).toBe("opinionated-framework");
    });

    it("detects Go with go.mod and Gin + go test", () => {
      fs.writeFileSync(
        path.join(tempDir, "go.mod"),
        `module github.com/example/api\n\ngo 1.22\n\nrequire github.com/gin-gonic/gin v1.9.1\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("go");
      expect(stack.frameworks).toContain("gin");
      expect(stack.testRunner).toBe("go test");
      expect(stack.archetype).toBe("distributed-systems");
    });

    it("detects Go with Echo, Fiber, Chi", () => {
      fs.writeFileSync(
        path.join(tempDir, "go.mod"),
        `module github.com/example/service\n\nrequire (\n\tgithub.com/labstack/echo/v4 v4.11.0\n\tgithub.com/gofiber/fiber/v2 v2.52.0\n\tgithub.com/go-chi/chi/v5 v5.0.0\n)\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("go");
      expect(stack.frameworks).toContain("echo");
      expect(stack.frameworks).toContain("fiber");
      expect(stack.frameworks).toContain("chi");
      expect(stack.testRunner).toBe("go test");
    });

    it("detects Rust with Cargo.toml and Actix + cargo test", () => {
      fs.writeFileSync(
        path.join(tempDir, "Cargo.toml"),
        `[package]\nname = "rust-service"\nversion = "0.1.0"\n\n[dependencies]\nactix-web = "4.4.0"\ntokio = "1.0"\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("rust");
      expect(stack.frameworks).toContain("actix");
      expect(stack.frameworks).toContain("tokio");
      expect(stack.testRunner).toBe("cargo test");
      expect(stack.archetype).toBe("distributed-systems");
    });

    it("detects Rust with Axum and Rocket", () => {
      fs.writeFileSync(
        path.join(tempDir, "Cargo.toml"),
        `[package]\nname = "rust-api"\nversion = "0.1.0"\n\n[dependencies]\naxum = "0.7"\nrocket = "0.5"\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("rust");
      expect(stack.frameworks).toContain("axum");
      expect(stack.frameworks).toContain("rocket");
      expect(stack.testRunner).toBe("cargo test");
    });

    it("detects Ruby with Gemfile and Rails + rspec", () => {
      fs.writeFileSync(
        path.join(tempDir, "Gemfile"),
        `source "https://rubygems.org"\ngem "rails", "~> 7.1.0"\ngem "rspec-rails"\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("ruby");
      expect(stack.frameworks).toContain("rails");
      expect(stack.testRunner).toBe("rspec");
      expect(stack.archetype).toBe("opinionated-framework");
    });

    it("detects Ruby with Sinatra and default rake test runner", () => {
      fs.writeFileSync(
        path.join(tempDir, "Gemfile"),
        `source "https://rubygems.org"\ngem "sinatra"\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("ruby");
      expect(stack.frameworks).toContain("sinatra");
      expect(stack.testRunner).toBe("bundle exec rake test");
    });

    it("detects Ruby with Hanami", () => {
      fs.writeFileSync(
        path.join(tempDir, "Gemfile"),
        `source "https://rubygems.org"\ngem "hanami"\n`
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("ruby");
      expect(stack.frameworks).toContain("hanami");
      expect(stack.testRunner).toBe("bundle exec rake test");
    });

    it("detects PHP with composer.json and Laravel + Pest", () => {
      fs.writeFileSync(
        path.join(tempDir, "composer.json"),
        JSON.stringify({
          require: { "laravel/framework": "^11.0" },
          "require-dev": { "pestphp/pest": "^2.0" }
        })
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("php");
      expect(stack.frameworks).toContain("laravel");
      expect(stack.testRunner).toBe("pest");
      expect(stack.archetype).toBe("opinionated-framework");
    });

    it("detects PHP with Symfony + PHPUnit", () => {
      fs.writeFileSync(
        path.join(tempDir, "composer.json"),
        JSON.stringify({
          require: { "symfony/framework-bundle": "^7.0" },
          "require-dev": { "phpunit/phpunit": "^11.0" }
        })
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("php");
      expect(stack.frameworks).toContain("symfony");
      expect(stack.testRunner).toBe("phpunit");
    });

    it("detects PHP procedural CMS (WordPress and Drupal)", () => {
      fs.writeFileSync(
        path.join(tempDir, "composer.json"),
        JSON.stringify({
          require: { "johnpbloch/wordpress": "^6.4" }
        })
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("php");
      expect(stack.frameworks).toContain("wordpress");
      expect(stack.archetype).toBe("procedural-cms");
    });

    it("detects PHP Drupal as procedural CMS", () => {
      fs.writeFileSync(
        path.join(tempDir, "composer.json"),
        JSON.stringify({
          require: { "drupal/core": "^10.0" }
        })
      );

      const stack: ProjectStack = detectStack(tempDir);
      expect(stack.primary).toBe("php");
      expect(stack.frameworks).toContain("drupal");
      expect(stack.archetype).toBe("procedural-cms");
    });

    it("executes introspection in under 15ms (target < 10ms)", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "speed-test",
          dependencies: { next: "14.2.0" },
          scripts: { test: "bun test" }
        })
      );

      const start = performance.now();
      detectStack(tempDir);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(15);
    });
  });

  describe("AC-2: Graceful Fallback for Unharnessed Repositories (L0)", () => {
    it("returns primary: 'unknown', testRunner: null, frameworks: [] for empty directory", () => {
      const stack = detectStack(tempDir);
      expect(stack.primary).toBe("unknown");
      expect(stack.testRunner).toBeNull();
      expect(stack.frameworks).toEqual([]);
      expect(stack.archetype).toBe("generic");
    });

    it("returns primary: 'unknown' for non-existent directory without throwing", () => {
      const nonExistent = path.join(tempDir, "does-not-exist-dir");
      expect(() => {
        const stack = detectStack(nonExistent);
        expect(stack.primary).toBe("unknown");
        expect(stack.testRunner).toBeNull();
        expect(stack.frameworks).toEqual([]);
      }).not.toThrow();
    });

    it("returns primary: 'unknown' for directory with unrelated files", () => {
      fs.writeFileSync(path.join(tempDir, "notes.txt"), "hello world");
      fs.writeFileSync(path.join(tempDir, "data.csv"), "1,2,3");

      const stack = detectStack(tempDir);
      expect(stack.primary).toBe("unknown");
      expect(stack.testRunner).toBeNull();
      expect(stack.frameworks).toEqual([]);
    });
  });
});
