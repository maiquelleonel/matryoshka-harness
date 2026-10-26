# 🔒 Security Policy

The **LeonelLabs Autonomous Systems Group** and the **Matryoshka-Harness** maintainers take the security of our deterministic governance engine, AST rulesets, and CLI distribution pipeline very seriously.

---

## 🛡️ Supported Versions

We actively provide security patches and vulnerability remediation for the following release lines:

| Version | Supported | Status |
| :--- | :---: | :--- |
| `0.17.x` | :white_check_mark: | Current Canonical Release |
| `< 0.17.0` | :x: | Deprecated / End-of-Life |

We strongly recommend always running the latest version available on npm (`@maiquelleonel/matryoshka`) or using zero-install invocation via `bunx @maiquelleonel/matryoshka@latest`.

---

## 🚨 Reporting a Vulnerability (Responsible Disclosure)

**Please do NOT file public GitHub issues for security vulnerabilities, zero-days, or token leaks.**

If you discover a security vulnerability in Matryoshka-Harness, the standalone binaries, or any of the protective shell wrappers (`@maiquelleonel/baba`, `@maiquelleonel/bbyg`), please report it privately:

1. **GitHub Private Vulnerability Reporting (Preferred):**  
   Submit a report via [GitHub Security Advisories](https://github.com/maiquelleonel/matryoshka-harness/security/advisories/new).
2. **Direct Security Contact:**  
   Email the lead maintainer directly at:  
   📧 **`skywishmtfk@gmail.com`** with the subject line `[SECURITY] Matryoshka Vulnerability Report`.

### 📋 What to Include in Your Report
To accelerate validation and triage, please provide:
- **Type of vulnerability:** (e.g., AST injection, path traversal, unsafe execution, denial of service in parsing, supply chain).
- **Component affected:** CLI, MCP server (`stdio`), Tree-sitter WASM parser, release pipeline, or protective shells.
- **Minimal Reproduction:** Code snippet, sample repository, or specific flags to trigger the issue.
- **Impact Assessment:** Plausible attack scenarios or impact on developer environments.

---

## ⏱️ Response & Disclosure Timeline

- **Initial Triage:** Within **24–48 hours**, an engineer will acknowledge receipt and review your report.
- **Reproduction & Patch Development:** A private patch will be prepared and validated against our regression suite.
- **Coordinated Release:** A patch release will be published to npm and GitHub Releases with a formal CVE / GitHub Security Advisory crediting your discovery (unless you prefer anonymity).

---

## 🔒 Architectural Security & Privacy Guarantees

Matryoshka-Harness is designed with strict security invariants for enterprise and autonomous AI agent operations:

1. **Zero Source Code Exfiltration:**  
   All AST parsing and pattern matching run 100% locally in-process via Tree-sitter WebAssembly (WASM). No source code, diffs, file trees, or AST nodes are ever transmitted to any remote cloud endpoint, telemetry server, or third-party service.
2. **Deterministic Air-Gapped Execution:**  
   The engine does not evaluate dynamic JavaScript/Python code at runtime. All linting, rule enforcement, and maturity evaluations are purely deterministic graph traversals.
3. **Stream Isolation (`stdio` Hygiene):**  
   The native Model Context Protocol (MCP) server strictly isolates JSON-RPC 2.0 communication on `stdout`. Diagnostic logs, human notices, and error messages are redirected to `stderr`, preventing agent buffer corruption or payload poisoning.
4. **Non-Destructive AST Remediation:**  
   The remediation engine operates non-destructively: it never overwrites source files without explicit CLI confirmation, ensuring working trees remain intact.
5. **Typosquatting Shell Defense:**  
   The official shells (`@maiquelleonel/baba`, `@maiquelleonel/bbyg`, `@maiquelleonel/matrioska`, `@maiquelleonel/matryoska`, `@maiquelleonel/baba-yaga`) are cryptographically published and verified by the maintainer to shield the community against malicious namespace squatters.
