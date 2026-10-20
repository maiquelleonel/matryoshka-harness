# 📐 SPEC-5: GitHub Actions CI Verification Gate & Automated SemVer Release

## 🎯 1. Specification Metadata
- **Spec ID:** SPEC-5
- **Subtask:** Subtask 1 - Continuous Integration Verification Workflow
- **Issue:** #5 - ci(governance): github actions ci verification gate & automated semver release
- **Target Runtime:** Bun v1.3+ / GitHub Actions

---

## 📋 2. Functional Description
Provide an automated continuous integration verification workflow in `.github/workflows/ci.yml` that guards repository health. Every pull request and push to task branches or the main branch must automatically execute a deterministic test and build sequence using Bun.

---

## 🛠️ 3. Technical Requirements

### 3.1. Workflow File Location
The workflow must reside in `.github/workflows/ci.yml`.

### 3.2. Triggers
The workflow must trigger on:
- `pull_request`:
  - `branches: [main]`
- `push`:
  - `branches: [main, 'task/**']`

### 3.3. Job Configuration
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

---

## 🧪 4. Acceptance Criteria & Test Scenarios (BDD)

### Scenario 1: Workflow Declaration Integrity
- **Given** `.github/workflows/ci.yml` exists,
- **When** the workflow definition is inspected,
- **Then** it must define push triggers for `main` and `task/**`, PR triggers for `main`, and run on `ubuntu-latest`.

### Scenario 2: Pipeline Execution Steps
- **Given** the steps defined in `.github/workflows/ci.yml`,
- **When** step commands are inspected,
- **Then** `bun install --frozen-lockfile`, `bun test`, and `bun run build` must be present.

### Scenario 3: Build Script Availability
- **Given** `package.json`,
- **When** `scripts.build` is inspected,
- **Then** it must define a valid build command that compiles the project via `bun build`.
