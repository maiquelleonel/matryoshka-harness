import { spawnSync } from "node:child_process";

export type BumpType = "major" | "minor" | "patch";

export interface ParsedCommit {
  raw: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  description: string;
  body?: string;
}

export interface ChangelogOptions {
  version: string;
  commits: (string | ParsedCommit)[];
  date?: string;
}

const CONVENTIONAL_REGEX = /^([a-zA-Z0-9_-]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

/**
 * Parses a commit message string according to Conventional Commits specification.
 */
export function parseConventionalCommit(message: string): ParsedCommit | null {
  if (!message || typeof message !== "string") {
    return null;
  }

  const lines = message.trim().split("\n");
  const header = lines[0]?.trim();

  if (!header) {
    return null;
  }

  const match = header.match(CONVENTIONAL_REGEX);

  if (!match || !match[1] || !match[4]) {
    return null;
  }

  const type = match[1].toLowerCase();
  const scope = match[2] ? match[2].trim() : null;
  const exclamationBreaking = Boolean(match[3]);
  const description = match[4].trim();
  const body = lines.slice(1).join("\n").trim();

  const bodyBreaking = /BREAKING[\s-]CHANGE:/i.test(message);
  const breaking = exclamationBreaking || bodyBreaking;

  return {
    raw: message,
    type,
    scope,
    breaking,
    description,
    body: body.length > 0 ? body : undefined,
  };
}

/**
 * Evaluates a collection of commits and determines the highest SemVer bump type.
 */
export function determineSemverBump(
  commits: (string | ParsedCommit)[],
): BumpType | null {
  if (!commits || commits.length === 0) {
    return null;
  }

  const parsed = commits
    .map((c) => (typeof c === "string" ? parseConventionalCommit(c) : c))
    .filter((c): c is ParsedCommit => c !== null);

  if (parsed.length === 0) {
    return "patch";
  }

  // Major: Any commit containing breaking change
  if (parsed.some((c) => c.breaking)) {
    return "major";
  }

  // Minor: Any feature commit without breaking change
  if (parsed.some((c) => c.type === "feat")) {
    return "minor";
  }

  // Patch: Fixes, perf, chore, refactor, ci, docs, etc.
  return "patch";
}

/**
 * Increments a SemVer string by the given bump type.
 */
export function incrementVersion(
  currentVersion: string,
  bump: BumpType,
): string {
  const clean = currentVersion.replace(/^v/, "").trim();
  const segments = clean.split(".").map((seg) => {
    const n = Number.parseInt(seg, 10);
    return Number.isNaN(n) ? 0 : n;
  });

  let major = segments[0] ?? 0;
  let minor = segments[1] ?? 1;
  let patch = segments[2] ?? 0;

  switch (bump) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Formats a clean version string into a Git release tag with 'v' prefix.
 */
export function formatReleaseTag(version: string): string {
  const clean = version.trim();
  return clean.startsWith("v") ? clean : `v${clean}`;
}

/**
 * Generates a structured markdown changelog grouped by category.
 */
export function generateStructuredChangelog(options: ChangelogOptions): string {
  const date =
    options.date ?? new Date().toISOString().split("T")[0];
  const cleanVersion = options.version.replace(/^v/, "");

  const parsed = options.commits
    .map((c) => (typeof c === "string" ? parseConventionalCommit(c) : c))
    .filter((c): c is ParsedCommit => c !== null);

  const breakingCommits: ParsedCommit[] = [];
  const featureCommits: ParsedCommit[] = [];
  const fixCommits: ParsedCommit[] = [];
  const perfCommits: ParsedCommit[] = [];
  const maintenanceCommits: ParsedCommit[] = [];

  for (const commit of parsed) {
    if (commit.breaking) {
      breakingCommits.push(commit);
    } else if (commit.type === "feat") {
      featureCommits.push(commit);
    } else if (commit.type === "fix") {
      fixCommits.push(commit);
    } else if (commit.type === "perf") {
      perfCommits.push(commit);
    } else {
      maintenanceCommits.push(commit);
    }
  }

  const formatList = (commits: ParsedCommit[]) =>
    commits
      .map((c) =>
        c.scope ? `- **${c.scope}**: ${c.description}` : `- ${c.description}`,
      )
      .join("\n");

  const sections: string[] = [`## [${cleanVersion}] - ${date}`];

  if (breakingCommits.length > 0) {
    sections.push(`### 💥 Breaking Changes\n${formatList(breakingCommits)}`);
  }
  if (featureCommits.length > 0) {
    sections.push(`### 🚀 Features\n${formatList(featureCommits)}`);
  }
  if (fixCommits.length > 0) {
    sections.push(`### 🐛 Bug Fixes\n${formatList(fixCommits)}`);
  }
  if (perfCommits.length > 0) {
    sections.push(
      `### ⚡ Performance Improvements\n${formatList(perfCommits)}`,
    );
  }
  if (maintenanceCommits.length > 0) {
    sections.push(`### 🔧 Maintenance\n${formatList(maintenanceCommits)}`);
  }

  return sections.join("\n\n");
}

/**
 * Inspects Git repository for latest tag and commits since that tag.
 */
export function getGitReleaseContext(cwd: string = process.cwd()): {
  latestTag: string | null;
  commits: string[];
} {
  let latestTag: string | null = null;
  const tagResult = spawnSync(
    "git",
    ["describe", "--tags", "--abbrev=0"],
    { cwd, encoding: "utf-8" },
  );

  if (tagResult.status === 0 && tagResult.stdout.trim().length > 0) {
    latestTag = tagResult.stdout.trim();
  }

  const gitLogArgs = latestTag
    ? ["log", `${latestTag}..HEAD`, "--pretty=format:%B%x00"]
    : ["log", "--pretty=format:%B%x00"];

  const logResult = spawnSync("git", gitLogArgs, {
    cwd,
    encoding: "utf-8",
  });

  const rawCommits =
    logResult.status === 0
      ? logResult.stdout.split("\0").map((s) => s.trim()).filter(Boolean)
      : [];

  return { latestTag, commits: rawCommits };
}

/**
 * Creates signed or annotated Git tag.
 * Uses GPG signed tag (-s) if signingkey is configured, otherwise fallback to annotated (-a).
 */
export function createGitTag(
  tagName: string,
  message: string,
  cwd: string = process.cwd(),
): boolean {
  const hasSigningKey =
    spawnSync("git", ["config", "--get", "user.signingkey"], { cwd })
      .status === 0;

  const tagFlag = hasSigningKey ? "-s" : "-a";
  const result = spawnSync("git", ["tag", tagFlag, tagName, "-m", message], {
    cwd,
    stdio: "inherit",
  });

  return result.status === 0;
}

/**
 * Main release automation runner.
 */
export async function runRelease(
  options: { dryRun?: boolean; cwd?: string } = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;

  console.log("🔍 Inspecting Git history for SemVer release...");
  const { latestTag, commits } = getGitReleaseContext(cwd);

  console.log(`📌 Latest tag detected: ${latestTag ?? "(none, initial release)"}`);
  console.log(`📝 Total commits detected: ${commits.length}`);

  if (commits.length === 0) {
    console.log("✨ No new commits found since last release. Nothing to publish.");
    return;
  }

  const bump = determineSemverBump(commits);
  if (!bump) {
    console.log("✨ No bump required. Nothing to publish.");
    return;
  }

  const currentVersion = latestTag ? latestTag.replace(/^v/, "") : "0.1.0";
  const nextVersion = latestTag
    ? incrementVersion(currentVersion, bump)
    : "0.1.0";
  const nextTag = formatReleaseTag(nextVersion);
  const changelog = generateStructuredChangelog({
    version: nextVersion,
    commits,
  });

  console.log(`🚀 Next Version: ${nextVersion} (Bump: ${bump})`);
  console.log(`🏷️ Next Tag: ${nextTag}`);
  console.log("\n📄 Generated Changelog:\n" + changelog + "\n");

  if (dryRun) {
    console.log("🧪 Dry-run mode enabled. Skipping Git tag creation and GitHub Release.");
    return;
  }

  console.log(`🏷️ Creating Git tag ${nextTag}...`);
  const tagCreated = createGitTag(nextTag, `Release ${nextTag}`, cwd);
  if (!tagCreated) {
    console.warn("⚠️ Failed to create local git tag or tag already exists.");
  }

  console.log("📤 Pushing tags to remote...");
  spawnSync("git", ["push", "origin", nextTag], { cwd, stdio: "inherit" });

  console.log("🌐 Publishing GitHub Release via GitHub CLI...");
  const ghResult = spawnSync(
    "gh",
    [
      "release",
      "create",
      nextTag,
      "--title",
      `Release ${nextTag}`,
      "--notes",
      changelog,
    ],
    { cwd, stdio: "inherit" },
  );

  if (ghResult.status === 0) {
    console.log(`🎉 Successfully published GitHub Release for ${nextTag}!`);
  } else {
    console.log("ℹ️ GitHub CLI release creation finished with exit code:", ghResult.status);
  }
}

// Execute directly if run as main script
if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  runRelease({ dryRun }).catch((err) => {
    console.error("Release failed:", err);
    process.exit(1);
  });
}
