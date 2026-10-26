# 🤝 Contributing to Matryoshka-Harness

Thank you for your interest in contributing to **Matryoshka-Harness** (`@maiquelleonel/matryoshka`)!

Matryoshka is engineered for deterministic L4 governance, ultra-lean context-fencing (`AGENTS.md`), and sub-millisecond AST static analysis. To preserve strict architectural discipline and FinOps efficiency, we adhere to the standards outlined below.

---

## 🏛️ Guiding Architectural Principles

1. **System 1 Determinism:**  
   Avoid redundant AI judges or non-deterministic heuristics where AST grammar, graph analysis, or regex rules suffice. Prefer Tree-sitter WASM queries for code-level validations.
2. **Context-Fencing Discipline:**  
   `AGENTS.md` boundaries must remain concise (< 200 tokens). Modular domain skills belong in `.agents/skills/` and are resolved lazily on demand.
3. **Ergonomic Triad Parity:**  
   All features must function identically across the canonical command and its ergonomic aliases: `baba`, `bbyg`, and `matryoshka`.
4. **Strict `stdio` Hygiene for MCP:**  
   The Model Context Protocol implementation must strictly write valid JSON-RPC 2.0 frames to `stdout`. All diagnostic logs, info messages, and warnings must be routed to `stderr`.

---

## 🚀 Development Setup

We prioritize **Bun** as our official runtime and package manager.

```bash
# 1. Clone the repository
git clone https://github.com/maiquelleonel/matryoshka-harness.git
cd matryoshka-harness

# 2. Install dependencies (frozen lockfile)
bun install --frozen-lockfile

# 3. Run the full test suite
bun test

# 4. Verify compilation & type checks
bun run build
```

---

## 🧪 Testing Standards & TDD Workflow

We practice strict **Red-to-Green** test-driven engineering:

- **Unit & Contract Tests:** Located in `tests/` and executed via `bun test`.
- **Zero Flakiness:** All tests must pass deterministically without relying on network egress or external LLM API endpoints.
- **Spec Compliance:** Any new feature must align with a numbered specification (`docs/specs/SPEC-<ID>.md`) and maintain existing invariant checks.

```bash
# Run specific test suite
bun test tests/docs_site.test.ts

# Watch mode during local development
bun test --watch
```

---

## 📋 Pull Request & Merge Workflow

1. **Create a Topic Branch:**  
   Branch from `main` using structured naming:  
   - `task/issue-<ID>-<short-description>` (for issues tracked via GitHub Project)  
   - `fix/<short-description>` or `feat/<short-description>`
2. **Commit Hygiene:**  
   Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:  
   - `feat(ast): add python decorator detection rule`  
   - `fix(ci): configure setup-uv in verification gate`  
   - `docs(site): add cli reference guide`
3. **Local Gate Verification:**  
   Ensure your code passes tests, type checks, and build before pushing:
   ```bash
   bun test && bun run build
   ```
4. **CI & Maintainer Merge Gate:**  
   Every PR triggers two mandatory checks:  
   - **Verification Gate:** Runs `bun test` and `bun run build`.  
   - **Maintainer Merge Gate:** Requires explicit authorization/approval from the lead maintainer (`@maiquelleonel`).

---

## 🔒 Security Vulnerabilities

Please **do not** use public issues or PRs to report security vulnerabilities. Refer to our [SECURITY.md](SECURITY.md) for responsible disclosure guidelines.

---

## 📄 License

By contributing to Matryoshka-Harness, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
