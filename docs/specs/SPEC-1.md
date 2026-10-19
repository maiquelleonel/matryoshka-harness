# SPEC-1: Polyglot Stack Detector & Base CLI Scaffold (baba / bbyg / matryoshka)

**Status:** IMPLEMENTED  
**Roadmap Phase:** Phase 1 (Issue #1)  
**Author:** Maiquel Leonel & Ouroboros Architecture Pod  
**Target:** Bun + TypeScript  

---

## 🎯 1. Objective & Overview
Build the core codebase introspection engine of **Matryoshka-Harness**, capable of inspecting any project directory in under 10ms, detecting its primary language stack, framework ecosystem, and canonical test runner, exposing this intelligence through an ergonomic CLI supporting the canonical aliases `baba`, `bbyg`, and `matryoshka`.

---

## 🔍 2. Polyglot Detection Matrix

| Ecosystem | Manifest Signatures | Detected Frameworks | Supported Test Runners |
| :--- | :--- | :--- | :--- |
| **Python** | `pyproject.toml`, `requirements.txt`, `Pipfile` | FastAPI, Django, Flask | `pytest`, `unittest` |
| **JS / TS** | `package.json`, `bun.lock`, `package-lock.json` | Next.js, React, Vue, NestJS, Express | `bun test`, `vitest`, `jest` |
| **Go** | `go.mod` | Gin, Echo, Fiber, Chi | `go test` |
| **Rust** | `Cargo.toml` | Actix, Axum, Tokio, Rocket | `cargo test` |
| **Ruby** | `Gemfile` | Rails, Sinatra, Hanami | `rspec`, `bundle exec rake test` |
| **PHP** | `composer.json` | Laravel, Symfony, WordPress, Drupal | `pest`, `phpunit` |

---

## ⚡ 3. Terminal Ergonomics (Canonical Aliases)
The CLI binary responds with strict functional parity across all three aliases:
1. `baba <command>` (The Slavic matriarch of nesting dolls — 4 letters, zero typos)
2. `bbyg <command>` (Baba-Yaga mythology — pure silicon wizardry)
3. `matryoshka <command>` (Formal academic name)

### Base Subcommand:
```bash
baba detect [path] [--json]
```

---

## ✅ 4. Acceptance Criteria (BDD)

### AC-1: Deterministic Primary Stack Detection
* **Given** a project directory containing one of the supported manifests (`pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`),
* **When** `detectStack(projectPath)` is executed,
* **Then** it must return a `ProjectStack` object containing `primary`, detected `frameworks`, and `testRunner` in < 15ms.

### AC-2: Graceful Fallback for Unharnessed Repositories (L0)
* **Given** an empty directory or a repository without recognizable dependency manifests,
* **When** stack detection is executed,
* **Then** it must return `primary: "unknown"`, `testRunner: null`, and `frameworks: []` without raising unhandled exceptions.

### AC-3: Strict CLI Alias Parity
* **Given** execution via command line,
* **When** invoked as `baba`, `bbyg`, or `matryoshka`,
* **Then** the binary must dispatch identical argument parsing, help output, and version information.

### AC-4: Structured JSON Output for Orchestrators
* **Given** the `--json` flag,
* **When** the command is executed,
* **Then** stdout must output strictly valid, parseable JSON matching:
  ```json
  {
    "status": "success",
    "stack": {
      "primary": "typescript",
      "frameworks": ["nextjs"],
      "testRunner": "bun test"
    },
    "rootPath": "/path/to/project"
  }
  ```

---

## 📋 5. Subtasks & Delivery Checklist
- [x] Subtask 1: Implement polyglot stack detector in `src/detector.ts` (Python, TS/JS, Go, Rust, Ruby, PHP) with < 10ms introspection
- [x] Subtask 2: Implement CLI commands and aliases in `src/cli.ts` and `index.ts` (detect command with `--json` flag for baba, bbyg, matryoshka)
- [x] Subtask 3: Add comprehensive Bun test suite in `test/detector.test.ts` with 100% passing tests
