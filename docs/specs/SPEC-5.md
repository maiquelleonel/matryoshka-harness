# 📐 SPEC-5: GitHub Actions CI Verification Gate & Automated SemVer Release

## 🎯 1. Specification Metadata
- **Spec ID:** SPEC-5
- **Subtasks Covered:**
  - Subtask 1: Continuous Integration Verification Workflow (`.github/workflows/ci.yml`)
  - Subtask 2: Maintainer Merge Gate & Protected Branches (`.github/CODEOWNERS`, `.github/workflows/maintainer-gate.yml`)
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
