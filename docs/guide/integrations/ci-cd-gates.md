# CI/CD Quality Gates & Automated Pipeline Integration

Enforce mathematical governance, AST anti-pattern prevention, and maintainer branch security in Continuous Integration and Continuous Delivery (CI/CD) pipelines.

---

## 🚀 Overview

AI coding agents accelerate software development, but unchecked code generation introduces subtle vulnerabilities, missing assertions, and context drift. Matryoshka-Harness provides a multi-tiered **CI/CD Quality Gate Pipeline** designed to intercept security hazards, unverified test suites, and unauthorized merges before code reaches production.

By integrating `baba wrap --strict` into CI runners, teams establish an automated, non-negotiable threshold for repository health and code safety.

---

## 🏛️ The 5-Gate Quality Pipeline

The canonical Matryoshka quality pipeline organizes pull request verification and release automation across five concentric gates:

```mermaid
flowchart TD
  PR[Pull Request Submitted] --> Gate1[Gate 1: Lint & Code Style]
  Gate1 -->|Pass| Gate2[Gate 2: Bun Test Suite]
  Gate1 -->|Fail| Block1[CI Fails: Fix Formatting]
  Gate2 -->|Pass| Gate3[Gate 3: baba wrap --strict AST Scan]
  Gate2 -->|Fail| Block2[CI Fails: Fix Failing Tests]
  Gate3 -->|Fail: Score < Threshold or Critical AST Violations| Remediate[Inspect DIAGNOSTIC.md & Remediate]
  Remediate --> PR
  Gate3 -->|Pass: Clean Scan| Gate4[Gate 4: Maintainer Merge Gate (CODEOWNERS)]
  Gate4 -->|Approved Review| Merge[Merged into main]
  Gate4 -->|Blocked: Non-Maintainer| Wait[Await Maintainer Approval]
  Merge --> Gate5[Gate 5: Automated SemVer Release & NPM Distribution]
```

---

## 🚦 Gate 3: The `baba wrap --strict` Verification Gate

The core automated check of the pipeline executes the Polyglot AST Scanner in strict mode:

```bash
baba wrap --strict --threshold 80
```

### Deterministic Exit Codes
* **`exit code 0` (Clean Build):** The composite score meets or exceeds the required threshold, and zero critical AST violations were detected across parsed files.
* **`exit code 1` (Gate Failed):** The pipeline aborts immediately if:
  1. The composite score falls below `--threshold` (e.g. `< 80`).
  2. Any **Critical** AST anti-pattern violation is detected, regardless of overall score.

### Critical Anti-Patterns That Block CI
1. **`raw-sql` (CWE-89: SQL Injection):** Dynamic template string interpolation or unescaped string concatenation passed to database query methods.
2. **`hardcoded-credential` (Secret Leakage):** Plaintext secret tokens (`sk_live_`, `ghp_`, `AKIA`) or variables with high Shannon entropy hardcoded in source files.
3. **`assertionless-test` (False-Green Hazard):** Automated test functions (`it`, `test`, `def test_*`) executing production code without verifiable assertions (`expect`, `assert`). *(Enabled when `--include-tests` is passed)*.

---

## ⚙️ GitHub Actions Workflow Configurations

### 1. Verification Gate (`.github/workflows/ci.yml`)

The primary CI verification workflow triggers on pull requests targeting `main` and on push events to `main` and `task/**` branches:

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main
      - "task/**"

jobs:
  ci:
    name: Verification Gate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Bun runtime
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run test suite
        run: bun test

      - name: Run build packaging
        run: bun run build

      - name: Enforce AST Quality Gate
        run: bun run baba wrap --strict --threshold 80
```

### 2. Maintainer Merge Gate (`.github/workflows/maintainer-gate.yml`)

To prevent unauthorized or rogue merges by automated agents or external contributors, the maintainer merge gate ensures that PRs can only be merged when authored by or explicitly approved by authorized repository maintainers:

```yaml
name: Maintainer Merge Gate

on:
  pull_request:
    branches:
      - main
    types: [opened, synchronize, reopened, ready_for_review]
  pull_request_review:
    types: [submitted, edited, dismissed]

permissions:
  pull-requests: read
  contents: read

jobs:
  verify-maintainer:
    name: Verify Maintainer Approval
    runs-on: ubuntu-latest
    steps:
      - name: Verify maintainer approval or authorship
        uses: actions/github-script@v7
        with:
          script: |
            // Configure your team's authorized maintainers or tech leads:
            const authorizedMaintainers = ['your-github-username', 'lead-maintainer'];
            const pr = context.payload.pull_request;
            if (!pr) {
              core.setFailed('No pull request found in event context.');
              return;
            }

            const author = pr.user.login.toLowerCase();
            if (authorizedMaintainers.map(m => m.toLowerCase()).includes(author)) {
              core.info(`PR authored by authorized maintainer (${author}). Gate PASSED.`);
              return;
            }

            const { data: reviews } = await github.rest.pulls.listReviews({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: pr.number,
            });

            const hasMaintainerApproval = reviews.some((review) => {
              const reviewer = review.user.login.toLowerCase();
              return authorizedMaintainers.map(m => m.toLowerCase()).includes(reviewer) && review.state === 'APPROVED';
            });

            if (!hasMaintainerApproval) {
              core.setFailed(`PR requires approval from an authorized maintainer (${authorizedMaintainers.map(m => '@' + m).join(', ')}) before merging into main.`);
            }
```

> 💡 **Implementation Reference Note:** In this repository, the authorized maintainer is configured as `@maiquelleonel`. When adopting this template in your own project, configure `authorizedMaintainers` with your team's authorized GitHub usernames.

### 3. Repository Ownership Definition (`.github/CODEOWNERS`)

Code ownership is canonically configured in `.github/CODEOWNERS` to assign default review ownership across the entire codebase to your designated maintainer or tech lead team:

```
* @your-org/tech-leads
```

> 💡 **Implementation Reference Note:** In this repository, code ownership defaults to `* @maiquelleonel`. Replace this handle with your team's GitHub organization or maintainer handle.

---

## 📦 Automated SemVer Release Pipeline (`.github/workflows/release.yml`)

Upon successful merge into `main`, the automated release workflow coordinates versioning, asset compilation, and public distribution:

1. **Conventional Commits Analysis:** Computes next Semantic Versioning bump (`feat:` for minor, `fix:` for patch, `feat!:` or `BREAKING CHANGE` for major).
2. **Standalone Binary Compilation:** Executes `bun run build:binaries` to package native standalone binaries for 5 target platforms (`baba-linux-x64`, `baba-linux-arm64`, `baba-darwin-arm64`, `baba-darwin-x64`, `baba-windows-x64.exe`) and generates `checksums.txt`.
3. **Protective Typosquatting Shells:** Executes `bun run build:shells` to package scoped distribution wrappers (`@maiquelleonel/baba`, `@maiquelleonel/bbyg`, `@maiquelleonel/matrioska`, `@maiquelleonel/matryoska`).
4. **NPM & GitHub Release:** Publishes packages to the NPM registry and creates the tagged GitHub Release attaching compiled binary assets.

---

## 🔧 Developer & Agent Remediation Workflow

When `baba wrap --strict` halts a pull request in CI:

1. **Locate the Failure Report:** Download the CI run artifact or inspect the generated **`DIAGNOSTIC.md`** file in the workspace.
2. **Review Action Plan:** The report highlights file paths, line numbers, and actionable remediation steps for each violation:
   * **SQL Injection:** Replace raw string formatting with parameterized query syntax.
   * **Hardcoded Credentials:** Extract literal tokens to environment variables (`process.env`).
   * **Assertionless Tests:** Add assertions (`expect(...)`) verifying actual return states.
3. **Verify Locally:** Re-run `baba wrap --strict` on your local branch to ensure exit code 0 before pushing the commit.
