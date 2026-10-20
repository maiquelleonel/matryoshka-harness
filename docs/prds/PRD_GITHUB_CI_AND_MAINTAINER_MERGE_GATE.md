# 📋 PRD: GitHub Actions CI Verification Gate & Automated SemVer Release

**Status:** Approved for Development  
**Roadmap Phase:** Governance & Infrastructure (Issue #5)  
**Author:** Maiquel Leonel & Ouroboros Architecture Pod  
**Target:** Bun + GitHub Actions  

---

## 🎯 1. Objective & Overview
Establish a robust, automated continuous integration and delivery (CI/CD) pipeline on GitHub Actions for **Matryoshka-Harness**. This pipeline enforces strict automated verification gates on pull requests and task branches, restricts merge permissions on the default branch (`main`) to authorized maintainers, and automatically publishes Semantic Versioning (SemVer) releases with structured changelogs upon merging to `main`.

---

## 🛡️ 2. Architectural Scope & Subtasks

### Subtask 1: CI Verification Gate (`.github/workflows/ci.yml`)
- Trigger on `pull_request` targeting `main` and `push` events targeting `main` and `task/**` branches.
- Execution environment: `ubuntu-latest` with Bun setup (`oven-sh/setup-bun`).
- Mandatory pipeline steps:
  1. `actions/checkout@v4` (clone codebase).
  2. `oven-sh/setup-bun@v2` (install latest Bun runtime).
  3. `bun install --frozen-lockfile` (deterministic dependency lock).
  4. `bun test` (execute full automated test suite).
  5. `bun run build` (verify project packaging and compilation).

### Subtask 2: Maintainer Merge Gate & Protected Branches
- Branch protection and merge gate validation ensuring only authorized maintainers (`@maiquelleonel`) can approve and merge PRs into `main`.

### Subtask 3: Automated SemVer Release Pipeline (`.github/workflows/release.yml`)
- Trigger on push to `main`.
- Calculate next SemVer bump based on Conventional Commits (`feat:`, `fix:`, `feat!:`, `chore:`).
- Generate signed Git tags and GitHub Releases with categorized changelogs.

---

## ✅ 3. Acceptance Criteria (Subtask 1)

### AC-1: CI Workflow Configuration File
- **Given** the repository root,
- **When** checking `.github/workflows/ci.yml`,
- **Then** the file must exist, contain valid YAML syntax, and be named `CI`.

### AC-2: Trigger Matrix
- **Given** code pushed to any task branch matching `task/**` or `main`, or PRs targeting `main`,
- **When** the workflow evaluates triggers,
- **Then** it must include both `pull_request` (branches: `[main]`) and `push` (branches: `[main, "task/**"]`).

### AC-3: Strict Bun Pipeline Steps
- **Given** runner initialization on `ubuntu-latest`,
- **When** the CI job executes,
- **Then** it must execute `bun install --frozen-lockfile`, `bun test`, and `bun run build` in sequential order.

### AC-4: Deterministic Build Script in Manifest
- **Given** `package.json`,
- **When** `bun run build` is invoked,
- **Then** it must compile the entrypoint cleanly to `dist/` without errors.

---

## ✅ 4. Acceptance Criteria (Subtask 2)

### AC-5: Code Owners Definition (`.github/CODEOWNERS`)
- **Given** the repository root,
- **When** `.github/CODEOWNERS` is inspected,
- **Then** it must exist and configure `* @maiquelleonel` as the owner for all files across the repository.

### AC-6: Maintainer Merge Gate Workflow (`.github/workflows/maintainer-gate.yml`)
- **Given** a pull request targeting `main`,
- **When** the workflow `.github/workflows/maintainer-gate.yml` triggers on `pull_request` and `pull_request_review`,
- **Then** it must execute on `ubuntu-latest` and verify that the PR author or approving reviewer is `@maiquelleonel`.

### AC-7: Enforcement & Status Check Gate
- **Given** an unapproved pull request by an external contributor,
- **When** evaluated by the maintainer verification gate,
- **Then** it must fail the status check and block merge until an approved review by `@maiquelleonel` is registered.
