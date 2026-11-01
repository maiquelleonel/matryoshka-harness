# baba detect

Inspect repository manifests and source tree layout to discover primary programming languages, application frameworks, testing harnesses, and architectural archetypes.

---

## 🚀 Synopsis

```bash
baba detect [path] [options]
```

### Command Aliases
`baba detect` provides 100% strict alias parity across all registered binary entry points:

* `baba detect` — Slavic matriarch of nesting dolls (4 letters, ergonomic)
* `bbyg detect` — Baba-Yaga mythology (silicon wizardry)
* `matryoshka detect` — Formal academic package name

---

## 📖 Description

The `detect` command inspects the target directory to determine the architectural DNA of the codebase. It scans package manifests, lockfiles, build descriptors, and directory structures to identify:

1. **Primary Language:** The dominant programming language of the codebase.
2. **Frameworks:** Supported application frameworks powering the service or web app.
3. **Test Runner:** The active testing harness configured for verification.
4. **Archetype Classification:** The architectural category dictating agent governance boundaries.

---

## ⚙️ Arguments & Options

### Positional Arguments
* `[path]` — Target repository or directory to analyze. Defaults to the current working directory (`.`).

### Options
* `--json` — Output strictly valid JSON formatted for programmatic consumption by CI runners and agent orchestrators.
* `-h, --help` — Display command help and usage examples.

---

## 🔍 Detection Capabilities

### Polyglot Language Matrix
The detection engine recognizes primary languages from manifests and directory fingerprints:

* **TypeScript:** Detected via `tsconfig.json`, `package.json`, `.ts`/`.tsx` files.
* **JavaScript:** Detected via `package.json`, `.js`/`.mjs` files without `tsconfig.json`.
* **Python:** Detected via `pyproject.toml`, `requirements.txt`, `Pipfile`, `setup.py`.
* **Go:** Detected via `go.mod`, `go.sum`.
* **Rust:** Detected via `Cargo.toml`, `Cargo.lock`.
* **Ruby:** Detected via `Gemfile`, `.ruby-version`.
* **PHP:** Detected via `composer.json`.

### Application Frameworks
* **TypeScript / JavaScript:** Next.js, Nuxt, Remix, Astro, SvelteKit, Express, NestJS, Fastify.
* **Python:** FastAPI, Django, Flask.
* **Go:** Gin, Echo, Fiber.
* **Rust:** Actix, Axum, Rocket.
* **Ruby / PHP:** Rails, Laravel, Symfony.

### Testing Harness Discovery
* `bun test` (via `bun.lock` or `bun.lockb` with test scripts)
* `vitest` (via `vitest.config.ts` or package scripts)
* `jest` (via `jest.config.js` or package scripts)
* `pytest` (via `pyproject.toml`, `setup.cfg`, `pytest.ini`)
* `go test` (via Go test files and modules)
* `cargo test` (via Cargo manifests)
* `rspec` (via `Gemfile`, `.rspec`, or `spec/` directory)

---

## 🏛️ Archetype Classification

The detector automatically categorizes the repository into one of five canonical archetypes:

| Archetype | Architectural Seams | Governance Focus |
|:---|:---|:---|
| `api_backend` | Controllers, Services, Models, Routes | OpenAPI validation, SQL injection safety, rate limiting |
| `opinionated_monolith` | Full-stack MVC (Rails, Django, Laravel) | ORM N+1 prevention, template hygiene, migration safety |
| `reactive_frontend` | Components, Hooks, State Stores (React, Vue) | Core Web Vitals, CLS prevention, semantic A11y |
| `systems_microservice` | High-throughput Go/Rust services | Concurrency safety, memory boundaries, zero panic |
| `fullstack_hybrid` | Integrated API and client applications | Monorepo package fencing, cross-boundary contracts |

---

## 📋 Examples

### Basic Detection
Inspect the current working directory:
```bash
baba detect
```

Output:
```text
🔍 Matryoshka Stack Detector
────────────────────────────────────────
Primary Stack:       TypeScript
Frameworks:          Next.js
Test Runner:         bun test
Archetype:           fullstack_hybrid
Root Path:           /workspace
```

### Specifying a Project Path
Analyze a sub-package or external project directory:
```bash
baba detect ./packages/backend
```

### Structured JSON Output
Emit machine-readable JSON for downstream pipelines:
```bash
baba detect --json
```

Output:
```json
{
  "status": "success",
  "command": "detect",
  "rootPath": "/workspace",
  "stack": {
    "primary": "typescript",
    "frameworks": [
      "nextjs"
    ],
    "testRunner": "bun test"
  },
  "archetype": "fullstack_hybrid"
}
```
