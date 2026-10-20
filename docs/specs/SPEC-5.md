# 📐 SPEC-5: GitHub Actions CI Verification Gate & Automated SemVer Release

## 🎯 1. Specification Metadata
- **Spec ID:** SPEC-5
- **Subtasks Covered:**
  - Subtask 1: Continuous Integration Verification Workflow (`.github/workflows/ci.yml`)
  - Subtask 2: Maintainer Merge Gate & Protected Branches (`.github/CODEOWNERS`, `.github/workflows/maintainer-gate.yml`)
  - Subtask 3: Automated SemVer Release Pipeline (`.github/workflows/release.yml`, `src/release.ts`)
- **Issue:** #5 - ci(governance): github actions ci verification gate & automated semver release
- **Target Runtime:** Bun v1.3+ / GitHub Actions

---

## 📋 2. Functional Description

### 2.1. Subtask 1: CI Verification Gate
Provide an automated continuous integration verification workflow in `.github/workflows/ci.yml` that guards repository health. Every pull request and push to task branches or the main branch must automatically execute a deterministic test and build sequence using Bun.

### 2.2. Subtask 2: Maintainer Merge Gate & Protected Branches
Enforce repository governance such that only authorized maintainers (`@maiquelleonel`) can approve and merge pull requests targeting the `main` branch. This is enforced via two complementary mechanisms:
1. Native GitHub Code Ownership (`.github/CODEOWNERS`) declaring `@maiquelleonel` as the owner of all files.
2. Automated GitHub Actions status check (`.github/workflows/maintainer-gate.yml`) verifying maintainer authorship or maintainer review approval.

### 2.3. Subtask 3: Automated SemVer Release Pipeline
Automate versioning and release publishing whenever code is merged into `main`. The workflow in `.github/workflows/release.yml`:
1. Inspects Git history since the last release tag to parse Conventional Commits.
2. Determines the next SemVer version (`major`, `minor`, or `patch`).
3. Generates a structured markdown changelog categorized by commit types.
4. Generates a signed/annotated Git tag and publishes a GitHub Release with the generated release notes.

---

## 🛠️ 3. Technical Requirements

### 3.1. Workflow File Location (CI)
The workflow must reside in `.github/workflows/ci.yml`.

### 3.2. Triggers (CI)
The CI workflow must trigger on:
- `pull_request`:
  - `branches: [main]`
- `push`:
  - `branches: [main, 'task/**']`

### 3.3. Job Configuration (CI)
- **Job Name:** `ci` (or `test`)
- **Runs-on:** `ubuntu-latest`
- **Steps:**
  1. **Checkout:** `actions/checkout@v4`
  2. **Setup Bun:** `oven-sh/setup-bun@v2` with `bun-version: latest`
  3. **Install Dependencies:** `run: bun install --frozen-lockfile`
  4. **Run Tests:** `run: bun test`
  5. **Run Build:** `run: bun run build`

### 3.4. Package Manifest Updates (`package.json`)
- Add a `"build"` script to `package.json`:
  ```json
  "build": "bun build ./index.ts --outdir ./dist"
  ```
- Ensure `bun run build` succeeds deterministically.

### 3.5. Code Owners Declaration (`.github/CODEOWNERS`)
- File path: `.github/CODEOWNERS`
- Content pattern:
  ```text
  * @maiquelleonel
  ```
- Ensures GitHub branch protection rules require review from `@maiquelleonel` on all pull requests.

### 3.6. Maintainer Gate Workflow (`.github/workflows/maintainer-gate.yml`)
- File path: `.github/workflows/maintainer-gate.yml`
- **Workflow Name:** `Maintainer Merge Gate`
- **Triggers:**
  - `pull_request`:
    - `branches: [main]`
    - `types: [opened, synchronize, reopened, ready_for_review]`
  - `pull_request_review`:
    - `types: [submitted, edited, dismissed]`
- **Job Configuration:**
  - `name: Verify Maintainer Approval`
  - `runs-on: ubuntu-latest`
  - Validates whether the PR was authored by `@maiquelleonel` or has received an `APPROVED` review state from `@maiquelleonel`.
  - Exits with non-zero failure code if neither condition is satisfied.

### 3.7. Automated SemVer Release Workflow (`.github/workflows/release.yml`)
- File path: `.github/workflows/release.yml`
- **Workflow Name:** `Release`
- **Triggers:**
  - `push`:
    - `branches: [main]`
- **Permissions:**
  - `contents: write` (for creating tags and GitHub Releases)
- **Job Configuration:**
  - `name: Automated SemVer Release`
  - `runs-on: ubuntu-latest`
  - Steps:
    1. Checkout repository with `actions/checkout@v4` using `fetch-depth: 0` (unshallow commit history).
    2. Setup Bun runtime with `oven-sh/setup-bun@v2` (`bun-version: latest`).
    3. Install dependencies (`bun install --frozen-lockfile`).
    4. Run SemVer release process (`bun run release` or `bun run ./src/release.ts`).

### 3.8. Conventional Commits & SemVer Bump Logic (`src/release.ts`)
- Implements deterministic Conventional Commit parsing and SemVer bumping:
  - **Major bump:** Commits with breaking change indicator (`!` after type/scope, e.g., `feat!:`, `fix!:`) or `BREAKING CHANGE:` in description/footer.
  - **Minor bump:** Commits with type `feat` or `feat(...)`.
  - **Patch bump:** Commits with type `fix` or `fix(...)`, or other maintenance types (`perf`, `refactor`, `chore`) when changes require bumping.
  - Base version calculation: Reads latest Git tag (`vX.Y.Z`) or defaults to `0.1.0`.
  - Increments version correctly according to SemVer rules (`major`: `X+1.0.0`, `minor`: `X.Y+1.0`, `patch`: `X.Y.Z+1`).

### 3.9. Structured Changelog Generation
- Categorizes commit entries into structured markdown sections:
  - 💥 Breaking Changes
  - 🚀 Features
  - 🐛 Bug Fixes
  - ⚡ Performance Improvements
  - 🔧 Maintenance & Tooling (`chore`, `ci`, `docs`, `refactor`, `test`, `style`)
- Formats each item with its commit description and hash/reference.

### 3.10. Signed Git Tagging & GitHub Release Publishing
- Creates signed Git tag (`git tag -s` when GPG signing key is configured, or annotated `git tag -a` as standard fallback).
- Publishes GitHub Release using GitHub CLI (`gh release create`) or GitHub API with the computed tag and structured changelog.

---

## 🧪 4. Acceptance Criteria & Test Scenarios (BDD)

### Scenario 1: Workflow Declaration Integrity (CI)
- **Given** `.github/workflows/ci.yml` exists,
- **When** the workflow definition is inspected,
- **Then** it must define push triggers for `main` and `task/**`, PR triggers for `main`, and run on `ubuntu-latest`.

### Scenario 2: Pipeline Execution Steps (CI)
- **Given** the steps defined in `.github/workflows/ci.yml`,
- **When** step commands are inspected,
- **Then** `bun install --frozen-lockfile`, `bun test`, and `bun run build` must be present.

### Scenario 3: Build Script Availability
- **Given** `package.json`,
- **When** `scripts.build` is inspected,
- **Then** it must define a valid build command that compiles the project via `bun build`.

### Scenario 4: Global Code Owners Definition
- **Given** `.github/CODEOWNERS` exists,
- **When** code owner rules are inspected,
- **Then** the wildcard rule `* @maiquelleonel` must be present, establishing maintainer approval requirements.

### Scenario 5: Maintainer Merge Gate Workflow Declaration
- **Given** `.github/workflows/maintainer-gate.yml` exists,
- **When** workflow triggers and jobs are inspected,
- **Then** it must trigger on `pull_request` targeting `main` and `pull_request_review`, running on `ubuntu-latest`.

### Scenario 6: Maintainer Authorization Evaluation Logic
- **Given** pull request author and review states,
- **When** evaluated against authorized maintainers (`maiquelleonel`),
- **Then** it must authorize if authored by `maiquelleonel`, authorize if approved by `maiquelleonel`, and reject otherwise.

### Scenario 7: Release Workflow Declaration & Triggers
- **Given** `.github/workflows/release.yml` exists,
- **When** the workflow definition is inspected,
- **Then** it must trigger on `push` to `main`, configure `contents: write` permissions, and run on `ubuntu-latest`.

### Scenario 8: Release Workflow Step Integrity
- **Given** `.github/workflows/release.yml`,
- **When** steps are inspected,
- **Then** it must include checkout with `fetch-depth: 0`, setup Bun runtime, dependency installation, and release execution.

### Scenario 9: Conventional Commit Parsing & Bump Determination
- **Given** commit messages matching Conventional Commits syntax,
- **When** analyzed by the SemVer calculator,
- **Then** breaking changes yield `major`, `feat` yields `minor`, and `fix` yields `patch`.

### Scenario 10: SemVer Version Increment
- **Given** an existing version `0.1.0`,
- **When** bumping by `patch`, `minor`, and `major`,
- **Then** it must produce `0.1.1`, `0.2.0`, and `1.0.0` respectively.

### Scenario 11: Structured Changelog Grouping
- **Given** a list of parsed conventional commits,
- **When** a changelog is generated,
- **Then** commits must be grouped under corresponding markdown category headers.
