import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import pc from "picocolors";
import type {
  ArchetypeProfile,
  SkillName,
  SkillDefinition,
  AgentArchetype
} from "./agents";
import {
  SKILL_DEFINITIONS,
  estimateTokens,
  parseSkillFrontmatter,
  profileArchetype,
  compileRootAgents,
  MAX_ROOT_AGENTS_TOKENS,
  resolveSkillContent
} from "./agents";

export interface SkillItem {
  name: SkillName;
  title: string;
  description: string;
  recommended: boolean;
  selected: boolean;
}

export const MODULAR_SKILLS_CATALOG: Array<{
  name: SkillName;
  title: string;
  description: string;
}> = [
  {
    name: "skill-backend",
    title: "Backend & ORM",
    description: "Framework-idiomatic ORM patterns, transactional boundaries, anti-N+1 query prevention, and async persistence.",
  },
  {
    name: "skill-database",
    title: "Database & Migrations",
    description: "Zero-downtime migrations, lock safety, column additions, and indexing strategies.",
  },
  {
    name: "skill-frontend",
    title: "Frontend & UI",
    description: "Reactivity best practices, layout shifts, pure rendering, accessibility standards (A11y), and state management.",
  },
  {
    name: "skill-security",
    title: "Security & Invariants",
    description: "OWASP Top 10 mitigation, strict input sanitization, secret leakage prevention, and defense-in-depth.",
  },
  {
    name: "skill-testing",
    title: "Testing & Fixtures",
    description: "The Seam contract, Red-to-Green TDD discipline, deterministic test fixtures, and mock isolation boundaries.",
  },
  {
    name: "custom-instructions",
    title: "Custom Instructions",
    description: "Repository-specific overrides, domain rules, bespoke workflows, and developer guidelines.",
  },
];

export interface TokenFootprintReport {
  rootTokens: number;
  skillsTokens: Record<SkillName, number>;
  totalSkillsTokens: number;
  totalTokens: number;
  selectedSkillsCount: number;
  totalAvailableSkillsCount: number;
  tokenBudget: number;
  budgetPercentage: number;
  isWithinBudget: boolean;
  savingsVsMonolithic: {
    monolithicCost: number;
    savedTokens: number;
    savingsPercentage: number;
  };
}

export interface DontVsDoSummary {
  skillName: SkillName | string;
  title: string;
  dos: string[];
  donts: string[];
  totalRules: number;
}

/**
 * Calculates the exact token footprint for selected skills and root AGENTS.md.
 */
export function calculateTokenFootprint(
  selectedSkills: SkillName[],
  options?: {
    profile?: ArchetypeProfile;
    projectPath?: string;
    tokenBudget?: number;
    maxTokens?: number;
  }
): TokenFootprintReport {
  const projectPath = options?.projectPath ?? process.cwd();
  const profile = options?.profile ?? profileArchetype(projectPath);
  const effectiveProfile: ArchetypeProfile = {
    ...profile,
    activeSkills: selectedSkills,
  };
  const maxTokens = options?.maxTokens ?? MAX_ROOT_AGENTS_TOKENS;
  const rootContent = compileRootAgents(effectiveProfile, { maxTokens });
  const rootTokens = estimateTokens(rootContent);

  const skillsTokens = {} as Record<SkillName, number>;
  let totalSkillsTokens = 0;

  for (const cat of MODULAR_SKILLS_CATALOG) {
    const isSelected = selectedSkills.includes(cat.name);
    const content = resolveSkillContent(cat.name, {
      projectPath,
      profile: effectiveProfile,
    });
    const tokens = estimateTokens(content);
    if (isSelected) {
      skillsTokens[cat.name] = tokens;
      totalSkillsTokens += tokens;
    }
  }

  const totalTokens = rootTokens + totalSkillsTokens;
  const tokenBudget = options?.tokenBudget ?? 2500;
  const budgetPercentage = Math.round((totalTokens / tokenBudget) * 100);
  const isWithinBudget = totalTokens <= tokenBudget;

  const monolithicCost = 1500;
  const savedTokens = Math.max(0, monolithicCost - rootTokens);
  const savingsPercentage = Math.round((savedTokens / monolithicCost) * 100);

  return {
    rootTokens,
    skillsTokens,
    totalSkillsTokens,
    totalTokens,
    selectedSkillsCount: selectedSkills.length,
    totalAvailableSkillsCount: MODULAR_SKILLS_CATALOG.length,
    tokenBudget,
    budgetPercentage,
    isWithinBudget,
    savingsVsMonolithic: {
      monolithicCost,
      savedTokens,
      savingsPercentage,
    },
  };
}

/**
 * Formats a live token footprint display with visual budget and FinOps breakdown.
 */
export function formatTokenFootprint(footprint: TokenFootprintReport): string {
  const statusBadge = footprint.isWithinBudget
    ? pc.green("✓ Within budget")
    : pc.red("⚠️ Exceeds budget");

  const lines: string[] = [
    pc.bold(pc.cyan("📊 Token Footprint:")),
    `  ${pc.dim("•")} Root AGENTS.md:   ${pc.yellow(`~${footprint.rootTokens}`)} tokens`,
    `  ${pc.dim("•")} Selected Skills:  ${pc.yellow(`~${footprint.totalSkillsTokens}`)} tokens (${footprint.selectedSkillsCount}/${footprint.totalAvailableSkillsCount} active)`,
    `  ${pc.dim("•")} Total Footprint:  ${pc.bold(pc.white(`~${footprint.totalTokens}`))} / ${footprint.tokenBudget} tokens (${footprint.budgetPercentage}% of budget) - [${statusBadge}]`,
  ];
  return lines.join("\n");
}

/**
 * Extracts and classifies rules into DO and DON'T directives from skill markdown content.
 */
export function extractDontVsDoGuidelines(
  content: string,
  skillName?: SkillName | string
): DontVsDoSummary {
  const title =
    (skillName && MODULAR_SKILLS_CATALOG.find((s) => s.name === skillName)?.title) ||
    skillName ||
    "Custom Guidelines";

  let body = content;
  if (content.startsWith("---\n")) {
    const endFm = content.indexOf("\n---\n", 4);
    if (endFm !== -1) {
      body = content.slice(endFm + 5);
    }
  }

  const dos: string[] = [];
  const donts: string[] = [];

  const lines = body.split("\n");
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith("* ") && !trimmed.startsWith("- ")) {
      continue;
    }

    const ruleText = trimmed.replace(/^[\*\-]\s+/, "").trim();
    if (!ruleText) continue;

    const strippedPrefix = ruleText.replace(/^\*\*[^\*]+:\*\*\s*/, "").trim();

    const isDont =
      /^(never|avoid|do not|don't|no\s+|prohibit|cannot|stop)\b/i.test(strippedPrefix) ||
      /\b(never|don't|do not)\b/i.test(strippedPrefix);

    if (isDont) {
      donts.push(ruleText);
    } else {
      dos.push(ruleText);
    }
  }

  return {
    skillName: skillName || "custom",
    title,
    dos,
    donts,
    totalRules: dos.length + donts.length,
  };
}

/**
 * Extracts aggregate Don't vs Do guidelines across all selected skills.
 */
export function extractAllSelectedGuidelines(
  selectedSkills: SkillName[],
  projectPath?: string,
  profile?: ArchetypeProfile
): DontVsDoSummary[] {
  return selectedSkills.map((name) => {
    const content = resolveSkillContent(name, { projectPath, profile });
    return extractDontVsDoGuidelines(content, name);
  });
}

export interface SkillPreviewData {
  skillName: SkillName;
  title: string;
  description: string;
  fileName: string;
  totalTokens: number;
  bodyTokens: number;
  frontmatterTokens: number;
  frontmatterYaml: string;
  frontmatter: Record<string, any> | null;
  guidelines: DontVsDoSummary;
  isSelected: boolean;
  isRecommended: boolean;
  footprint: TokenFootprintReport;
  rawContent: string;
}

/**
 * Extracts structured preview data for a specific modular skill, including
 * frontmatter metadata, token metrics, and Don't vs Do guidelines.
 */
export function getSkillPreviewData(
  skillName: SkillName,
  options?: {
    projectPath?: string;
    profile?: ArchetypeProfile;
    cumulativeSelectedSkills?: SkillName[];
    tokenBudget?: number;
    isSelected?: boolean;
    isRecommended?: boolean;
  }
): SkillPreviewData {
  const projectPath = options?.projectPath ?? process.cwd();
  const profile = options?.profile ?? profileArchetype(projectPath);
  const cat = MODULAR_SKILLS_CATALOG.find((s) => s.name === skillName);
  const def = SKILL_DEFINITIONS[skillName];
  let rawContent = resolveSkillContent(skillName, {
    projectPath,
    profile,
  });

  if (options?.projectPath) {
    const rootProj = path.resolve(options.projectPath);
    const canonicalDiskPath = path.join(
      rootProj,
      ".agents",
      "skills",
      def?.fileName || (skillName.replace(/^skill-/, "") + "/SKILL.md")
    );
    const legacyDiskPath = path.join(
      rootProj,
      ".agents",
      "skills",
      skillName + ".md"
    );
    const diskPath = fs.existsSync(canonicalDiskPath)
      ? canonicalDiskPath
      : (fs.existsSync(legacyDiskPath) ? legacyDiskPath : null);

    if (diskPath && fs.existsSync(diskPath)) {
      try {
        rawContent = fs.readFileSync(diskPath, "utf-8");
      } catch {
        // Fallback
      }
    }
  }
  const totalTokens = estimateTokens(rawContent);
  const frontmatter = parseSkillFrontmatter(rawContent);
  const guidelines = extractDontVsDoGuidelines(rawContent, skillName);

  let frontmatterYaml = "";
  if (rawContent.startsWith("---\n")) {
    const endFm = rawContent.indexOf("\n---\n", 4);
    if (endFm !== -1) {
      frontmatterYaml = rawContent.slice(0, endFm + 5).trim();
    }
  }
  const frontmatterTokens = frontmatterYaml ? estimateTokens(frontmatterYaml) : 0;
  const bodyTokens = Math.max(0, totalTokens - frontmatterTokens);

  const selected = options?.cumulativeSelectedSkills ?? [skillName];
  const isSelected = options?.isSelected !== undefined
    ? options.isSelected
    : selected.includes(skillName);
  const isRecommended = options?.isRecommended !== undefined
    ? options.isRecommended
    : profile.activeSkills.includes(skillName);

  const footprint = calculateTokenFootprint(selected, {
    projectPath,
    profile,
    tokenBudget: options?.tokenBudget,
  });

  return {
    skillName,
    title: cat?.title || skillName,
    description: (frontmatter?.description as string) || cat?.description || "",
    fileName: def?.fileName || `${skillName}.md`,
    totalTokens,
    bodyTokens,
    frontmatterTokens,
    frontmatterYaml,
    frontmatter: frontmatter as Record<string, any> | null,
    guidelines,
    isSelected,
    isRecommended,
    footprint,
    rawContent,
  };
}

/**
 * Formats a detailed skill preview modal including frontmatter, token footprint, and Don't vs Do breakdown.
 */
export function formatSkillPreview(
  skillName: SkillName,
  options?: {
    projectPath?: string;
    profile?: ArchetypeProfile;
    cumulativeSelectedSkills?: SkillName[];
    tokenBudget?: number;
    isSelected?: boolean;
    isRecommended?: boolean;
    currentIndex?: number;
    totalSkills?: number;
  }
): string {
  const data = getSkillPreviewData(skillName, options);

  const lines: string[] = [];
  const indexInfo = options?.currentIndex !== undefined && options?.totalSkills !== undefined
    ? ` [${options.currentIndex + 1}/${options.totalSkills}]`
    : "";

  const statusBadge = data.isSelected
    ? pc.green("◉ Selected")
    : pc.dim("◯ Unselected");
  const recBadge = data.isRecommended
    ? pc.green("[recommended]")
    : pc.dim("[optional]");

  lines.push(
    pc.bold(
      pc.yellow(`\n🔍 Skill Preview: ${data.skillName} (${data.title})${indexInfo}\n`)
    )
  );
  lines.push(`  ${pc.dim("File:")}        .agents/skills/${data.fileName}`);
  lines.push(`  ${pc.dim("Status:")}      ${statusBadge}  ${recBadge}`);
  lines.push(`  ${pc.dim("Estimated:")}   ~${data.totalTokens} tokens`);
  lines.push(`  ${pc.dim("Description:")} ${data.description}\n`);

  if (data.frontmatterYaml) {
    lines.push(pc.bold(pc.cyan("  📦 YAML Frontmatter:")));
    lines.push(pc.dim("    " + data.frontmatterYaml.split("\n").join("\n    ")) + "\n");
  }

  lines.push(pc.bold(pc.cyan("  📊 Token Footprint:")));
  lines.push(`    ${pc.dim("•")} Skill Body: ~${data.bodyTokens} tokens`);
  lines.push(`    ${pc.dim("•")} Frontmatter: ~${data.frontmatterTokens} tokens`);
  lines.push(
    `    ${pc.dim("•")} Cumulative with Selection: ~${data.footprint.totalTokens} / ${data.footprint.tokenBudget} tokens (${data.footprint.budgetPercentage}%)\n`
  );

  lines.push(pc.bold(pc.cyan("  📋 Don't vs Do Guidelines:")));
  if (data.guidelines.dos.length > 0) {
    lines.push(pc.bold(pc.green("    ✅ DO (Best Practices & Invariants):")));
    for (const d of data.guidelines.dos) {
      lines.push(`      ${pc.green("•")} ${d}`);
    }
  }
  if (data.guidelines.donts.length > 0) {
    lines.push(pc.bold(pc.red("    ❌ DON'T (Anti-Patterns & Prohibitions):")));
    for (const d of data.guidelines.donts) {
      lines.push(`      ${pc.red("•")} ${d}`);
    }
  }

  lines.push(
    pc.dim("\n  [Space] Toggle selection | [←/→] Prev/Next skill | [Esc/Enter/p/i] Return to checklist.\n")
  );

  return lines.join("\n");
}

/**
 * Formats aggregate Don't vs Do guidelines across multiple skills.
 */
export function formatDontVsDoGuidelines(
  summaries: DontVsDoSummary | DontVsDoSummary[]
): string {
  const list = Array.isArray(summaries) ? summaries : [summaries];
  const lines: string[] = [];

  lines.push(pc.bold(pc.cyan("\n📋 Don't vs Do Guidelines Preview:\n")));
  lines.push(pc.dim("━".repeat(68)));

  for (const item of list) {
    lines.push(pc.bold(pc.magenta(`• ${item.title} (${item.skillName})`)));
    if (item.dos.length > 0) {
      lines.push(pc.bold(pc.green("  ✅ DO:")));
      for (const d of item.dos) {
        lines.push(`    ${pc.green("•")} ${d}`);
      }
    }
    if (item.donts.length > 0) {
      lines.push(pc.bold(pc.red("  ❌ DON'T:")));
      for (const d of item.donts) {
        lines.push(`    ${pc.red("•")} ${d}`);
      }
    }
    lines.push("");
  }

  lines.push(pc.dim("━".repeat(68)));
  lines.push(pc.dim("  Press [Escape], [g], or [Enter] to return to checklist.\n"));
  return lines.join("\n");
}

/**
 * Formats a comprehensive, human-readable review of the detected archetype and stack profile.
 */
export function formatArchetypeProfileReview(
  profile: ArchetypeProfile,
  projectPath: string = process.cwd()
): string {
  const lines: string[] = [];

  lines.push(pc.bold(pc.cyan("\n🪆 Matryoshka Interactive Skill Inspector & Terminal Selector")));
  lines.push(pc.dim("━".repeat(68)));
  lines.push(`${pc.bold("• Review Detected Archetype & Stack Profile")}`);
  lines.push(`  ${pc.dim("Root Path:")}     ${projectPath}`);
  lines.push(`  ${pc.dim("Archetype:")}     ${pc.magenta(profile.archetype)}`);
  lines.push(
    `  ${pc.dim("Runtime:")}       ${profile.runtime} (${profile.packageManager})`
  );
  lines.push(`  ${pc.dim("Test Runner:")}   ${profile.testCommand}`);
  lines.push(
    `  ${pc.dim("Build / Lint:")}  ${profile.buildCommand} | ${profile.lintCommand}`
  );

  lines.push(pc.bold(pc.cyan("\n  Discovered Seams:")));
  lines.push(
    `    ${pc.dim("•")} Backend:   ${
      profile.seams.hasBackend ? pc.green("yes") : pc.dim("no")
    } (${profile.seams.routes.length} routes, ${profile.seams.controllers.length} controllers, ${profile.seams.services.length} services)`
  );
  lines.push(
    `    ${pc.dim("•")} Database:  ${
      profile.seams.hasDatabase ? pc.green("yes") : pc.dim("no")
    } (${profile.seams.models.length} models)`
  );
  lines.push(
    `    ${pc.dim("•")} Frontend:  ${
      profile.seams.hasFrontend ? pc.green("yes") : pc.dim("no")
    } (${profile.seams.views.length} views)`
  );
  lines.push(
    `    ${pc.dim("•")} Testing:   ${
      profile.seams.hasTesting ? pc.green("yes") : pc.dim("no")
    } (${profile.seams.tests.length} tests)`
  );
  lines.push(
    `    ${pc.dim("•")} Security:  ${
      profile.seams.hasSecurity ? pc.green("yes") : pc.dim("no")
    }`
  );

  lines.push(pc.bold(pc.cyan("\n  Recommended Skills:")));
  for (const skill of MODULAR_SKILLS_CATALOG) {
    const isRec = profile.activeSkills.includes(skill.name);
    const badge = isRec ? pc.green("[recommended]") : pc.dim("[optional]");
    lines.push(`    ${pc.dim("•")} ${pc.bold(skill.name)} (${skill.title}) ${badge}`);
  }

  lines.push(pc.dim("━".repeat(68)));
  return lines.join("\n");
}

export interface HeadlessEnvironmentOptions {
  stdin?: { isTTY?: boolean } | NodeJS.ReadableStream;
  env?: Record<string, string | undefined>;
}

/**
 * Detects whether execution is running in a headless or non-interactive environment (non-TTY stdin or CI).
 */
export function isHeadlessEnvironment(options: HeadlessEnvironmentOptions = {}): boolean {
  const env = options.env ?? process.env;
  const isCI = Boolean(
    env.CI === "true" ||
    env.CI === "1" ||
    env.CONTINUOUS_INTEGRATION === "1" ||
    env.CONTINUOUS_INTEGRATION === "true" ||
    Boolean(env.GITHUB_ACTIONS) ||
    env.DEBIAN_FRONTEND === "noninteractive"
  );
  const stdinIsTTY = options.stdin !== undefined
    ? Boolean((options.stdin as any).isTTY)
    : Boolean(process.stdin?.isTTY);

  return isCI || !stdinIsTTY;
}

export interface PromptDecisionOptions {
  stdin?: NodeJS.ReadableStream | { isTTY?: boolean };
  stdout?: NodeJS.WritableStream | { isTTY?: boolean };
  isYes?: boolean;
  isJson?: boolean;
  isInteractive?: boolean;
  ci?: boolean;
  env?: Record<string, string | undefined>;
}

/**
 * Evaluates whether an interactive TUI prompt should be launched based on terminal capabilities and flags.
 */
export function shouldRunInteractivePrompt(options: PromptDecisionOptions): boolean {
  if (options.isJson || options.isYes) {
    return false;
  }

  const env = options.env ?? process.env;
  const isCI = options.ci ?? Boolean(
    env.CI === "true" ||
    env.CI === "1" ||
    env.CONTINUOUS_INTEGRATION === "1" ||
    env.CONTINUOUS_INTEGRATION === "true" ||
    Boolean(env.GITHUB_ACTIONS) ||
    env.DEBIAN_FRONTEND === "noninteractive"
  );

  const stdinIsTTY = options.stdin !== undefined
    ? Boolean((options.stdin as any).isTTY)
    : Boolean(process.stdin?.isTTY);
  const stdoutIsTTY = options.stdout !== undefined
    ? Boolean((options.stdout as any).isTTY)
    : Boolean(process.stdout?.isTTY);

  const hasInteractiveTerminal = stdinIsTTY && stdoutIsTTY;

  if (!stdinIsTTY) {
    return false;
  }

  if (isCI && !options.isInteractive) {
    return false;
  }

  if (options.isInteractive && stdinIsTTY) {
    return true;
  }

  return hasInteractiveTerminal && !isCI;
}

export interface InteractiveSelectorOptions {
  profile: ArchetypeProfile;
  projectPath?: string;
  stdin?: any;
  stdout?: any;
  dryRun?: boolean;
  force?: boolean;
  maxTokens?: number;
  strictTokenGuard?: boolean;
  initialSelectedSkills?: SkillName[];
  fallbackNonInteractive?: boolean;
}

export interface InteractiveSelectorResult {
  confirmed: boolean;
  selectedSkills: SkillName[];
  items?: SkillItem[];
  footprint?: TokenFootprintReport;
  guidelinesSummary?: DontVsDoSummary[];
  headlessFallback?: boolean;
}

export interface InteractivePromptOptions {
  profile?: ArchetypeProfile;
  projectPath?: string;
  stdin?: any;
  stdout?: any;
  dryRun?: boolean;
  force?: boolean;
  maxTokens?: number;
  strictTokenGuard?: boolean;
  initialSelectedSkills?: SkillName[];
  fallbackNonInteractive?: boolean;
  isYes?: boolean;
  isJson?: boolean;
  isInteractive?: boolean;
  env?: Record<string, string | undefined>;
}

export interface InteractivePromptResult extends InteractiveSelectorResult {
  bypassed?: boolean;
  profile: ArchetypeProfile;
  renderedScreen?: string;
}

/**
 * InteractivePromptSession encapsulates the state and rendering logic
 * for the interactive skill inspector and terminal checklist.
 */
export class InteractivePromptSession {
  private profile: ArchetypeProfile;
  private projectPath: string;
  private items: SkillItem[];
  private cursor: number = 0;
  private inPreview: boolean = false;
  private inGuidelinesModal: boolean = false;
  private options: InteractivePromptOptions;

  constructor(options: InteractivePromptOptions = {}) {
    this.options = options;
    this.projectPath = options.projectPath ?? process.cwd();
    this.profile = options.profile ?? profileArchetype(this.projectPath);

    const initial = options.initialSelectedSkills ?? this.profile.activeSkills;

    this.items = MODULAR_SKILLS_CATALOG.map((cat) => ({
      name: cat.name,
      title: cat.title,
      description: cat.description,
      recommended: this.profile.activeSkills.includes(cat.name),
      selected: initial.includes(cat.name),
    }));
  }

  public getProfile(): ArchetypeProfile {
    return this.profile;
  }

  public getProjectPath(): string {
    return this.projectPath;
  }

  public getItems(): SkillItem[] {
    return this.items.map((it) => ({ ...it }));
  }

  public getSelectedSkills(): SkillName[] {
    return this.items.filter((it) => it.selected).map((it) => it.name);
  }

  public getCursor(): number {
    return this.cursor;
  }

  public getActiveItem(): SkillItem {
    const item = this.items[this.cursor] ?? this.items[0];
    if (!item) {
      throw new Error("No items in skill checklist");
    }
    return item;
  }

  public isInPreview(): boolean {
    return this.inPreview;
  }

  public isInGuidelines(): boolean {
    return this.inGuidelinesModal;
  }

  public moveUp(): void {
    if (this.items.length === 0) return;
    this.cursor = (this.cursor - 1 + this.items.length) % this.items.length;
  }

  public moveDown(): void {
    if (this.items.length === 0) return;
    this.cursor = (this.cursor + 1) % this.items.length;
  }

  public toggleCurrent(): boolean {
    const item = this.items[this.cursor];
    if (item) {
      item.selected = !item.selected;
      return item.selected;
    }
    return false;
  }

  public toggleSkill(name: SkillName, forceState?: boolean): boolean {
    const item = this.items.find((it) => it.name === name);
    if (item) {
      item.selected = forceState !== undefined ? forceState : !item.selected;
      return item.selected;
    }
    return false;
  }

  public toggleAll(): boolean {
    const allSelected = this.items.every((it) => it.selected);
    const target = !allSelected;
    for (const item of this.items) {
      item.selected = target;
    }
    return target;
  }

  public openPreview(): void {
    this.inPreview = true;
    this.inGuidelinesModal = false;
  }

  public closePreview(): void {
    this.inPreview = false;
  }

  public previewNext(): void {
    this.moveDown();
  }

  public previewPrevious(): void {
    this.moveUp();
  }

  public getActivePreviewData(): SkillPreviewData {
    const current = this.getActiveItem();
    return getSkillPreviewData(current.name, {
      projectPath: this.projectPath,
      profile: this.profile,
      cumulativeSelectedSkills: this.getSelectedSkills(),
      tokenBudget: this.options.maxTokens,
      isSelected: current.selected,
      isRecommended: current.recommended,
    });
  }

  public openGuidelines(): void {
    this.inGuidelinesModal = true;
    this.inPreview = false;
  }

  public closeGuidelines(): void {
    this.inGuidelinesModal = false;
  }

  public calculateFootprint(): TokenFootprintReport {
    const selected = this.getSelectedSkills();
    return calculateTokenFootprint(selected, {
      projectPath: this.projectPath,
      profile: this.profile,
      tokenBudget: this.options.maxTokens ?? 2500,
    });
  }

  public extractGuidelines(): DontVsDoSummary[] {
    const selected = this.getSelectedSkills();
    return extractAllSelectedGuidelines(selected, this.projectPath, this.profile);
  }

  public render(): string {
    return this.renderScreen();
  }

  public renderScreen(): string {
    if (this.inGuidelinesModal) {
      const summaries = this.extractGuidelines();
      return formatDontVsDoGuidelines(summaries);
    }

    if (this.inPreview) {
      const current = this.getActiveItem();
      if (current) {
        return formatSkillPreview(current.name, {
          projectPath: this.projectPath,
          profile: this.profile,
          cumulativeSelectedSkills: this.getSelectedSkills(),
          tokenBudget: this.options.maxTokens,
          isSelected: current.selected,
          isRecommended: current.recommended,
          currentIndex: this.cursor,
          totalSkills: this.items.length,
        });
      }
    }

    const reviewText = formatArchetypeProfileReview(this.profile, this.projectPath);
    let output = reviewText + "\n";

    output += pc.bold(pc.cyan("Interactive Skills Checklist:\n"));
    output += pc.dim(
      "  Use [↑/↓] or [j/k] to navigate, [Space] to toggle, [a] toggle all, [p/i] to inspect, [g] guidelines preview, [Enter] to confirm, [q] to quit.\n\n"
    );

    this.items.forEach((item, index) => {
      const isCurrent = index === this.cursor;
      const pointer = isCurrent ? pc.cyan("❯ ") : "  ";
      const check = item.selected ? pc.green("◉ ") : pc.dim("◯ ");
      const nameText = isCurrent ? pc.bold(pc.white(item.name)) : pc.dim(item.name);
      const recTag = item.recommended ? pc.green(" [recommended]") : pc.dim(" [optional]");
      output += `${pointer}${check}${nameText} - ${item.title}${recTag}\n`;
    });
    output += "\n";

    const footprint = this.calculateFootprint();
    output += formatTokenFootprint(footprint) + "\n\n";

    return output;
  }
}

/**
 * Runs an interactive TUI prompt to review archetype and toggle modular skills.
 */
export async function runInteractiveSkillSelector(
  options: InteractiveSelectorOptions
): Promise<InteractiveSelectorResult> {
  const {
    profile,
    projectPath = process.cwd(),
    stdin = process.stdin,
    stdout = process.stdout,
  } = options;

  const session = new InteractivePromptSession({
    profile,
    projectPath,
    stdin,
    stdout,
    dryRun: options.dryRun,
    force: options.force,
    maxTokens: options.maxTokens,
    strictTokenGuard: options.strictTokenGuard,
    initialSelectedSkills: options.initialSelectedSkills,
    fallbackNonInteractive: options.fallbackNonInteractive,
  });

  if (options.fallbackNonInteractive) {
    const selectedSkills = options.initialSelectedSkills ?? profile.activeSkills;
    const footprint = session.calculateFootprint();
    const guidelinesSummary = session.extractGuidelines();

    return {
      confirmed: true,
      selectedSkills,
      items: session.getItems(),
      footprint,
      guidelinesSummary,
      headlessFallback: true,
    };
  }

  const render = () => {
    stdout.write(session.renderScreen());
  };

  // Render initial view
  render();

  return new Promise<InteractiveSelectorResult>((resolve) => {
    let rawModeActive = false;
    let isFinished = false;
    const isTTY = Boolean((stdin as any).isTTY);

    if (isTTY && typeof (stdin as any).setRawMode === "function") {
      try {
        (stdin as any).setRawMode(true);
        rawModeActive = true;
      } catch {
        // ignore if setting raw mode fails
      }
    }

    if (typeof (stdin as any).resume === "function") {
      (stdin as any).resume();
    }
    if (typeof (stdin as any).setEncoding === "function") {
      (stdin as any).setEncoding("utf8");
    }

    try {
      (readline as any).emitKeypressEvents(stdin, { escapeCodeTimeout: 20 });
    } catch {
      readline.emitKeypressEvents(stdin);
    }

    const cleanup = () => {
      if (isFinished) return;
      isFinished = true;
      (stdin as any).removeListener("keypress", onKeyPress);
      (stdin as any).removeListener("data", onData);
      if (rawModeActive && typeof (stdin as any).setRawMode === "function") {
        try {
          (stdin as any).setRawMode(false);
        } catch {
          // ignore
        }
      }
    };

    let lastHandledKey = "";
    let lastHandledTime = 0;

    const handleAction = (keyName: string, keyCtrl?: boolean, keyChar?: string) => {
      if (isFinished) return;
      const now = Date.now();
      if (keyName && keyName === lastHandledKey && now - lastHandledTime < 15) {
        return;
      }
      lastHandledKey = keyName;
      lastHandledTime = now;
      if (keyCtrl && keyName === "c") {
        cleanup();
        stdout.write(pc.red("\nAborted by user (SIGINT).\n"));
        resolve({ confirmed: false, selectedSkills: [], items: session.getItems() });
        return;
      }

      if (session.isInGuidelines()) {
        if (
          keyName === "escape" ||
          keyName === "g" ||
          keyName === "return" ||
          keyName === "enter" ||
          keyChar === "g" ||
          keyChar === "q"
        ) {
          session.closeGuidelines();
          render();
        }
        return;
      }

      if (session.isInPreview()) {
        if (
          keyName === "escape" ||
          keyName === "p" ||
          keyName === "i" ||
          keyName === "return" ||
          keyName === "enter" ||
          keyChar === "q" ||
          keyName === "q" ||
          keyChar === "p" ||
          keyChar === "i"
        ) {
          session.closePreview();
          render();
        } else if (keyName === "space" || keyChar === " ") {
          session.toggleCurrent();
          render();
        } else if (
          keyName === "right" ||
          keyChar === "l" ||
          keyName === "tab" ||
          keyChar === "n" ||
          keyName === "down" ||
          keyChar === "j"
        ) {
          session.previewNext();
          render();
        } else if (
          keyName === "left" ||
          keyChar === "h" ||
          keyChar === "b" ||
          keyName === "up" ||
          keyChar === "k"
        ) {
          session.previewPrevious();
          render();
        }
        return;
      }

      if (keyName === "up" || keyChar === "k") {
        session.moveUp();
        render();
      } else if (keyName === "down" || keyChar === "j") {
        session.moveDown();
        render();
      } else if (keyName === "home") {
        while (session.getCursor() > 0) {
          session.moveUp();
        }
        render();
      } else if (keyName === "end") {
        const count = session.getItems().length;
        while (session.getCursor() < count - 1) {
          session.moveDown();
        }
        render();
      } else if (keyName === "space" || keyChar === " ") {
        session.toggleCurrent();
        render();
      } else if (keyChar === "a" || keyChar === "A") {
        session.toggleAll();
        render();
      } else if (keyName === "g" || keyChar === "g") {
        session.openGuidelines();
        render();
      } else if (keyName === "p" || keyName === "i" || keyChar === "p" || keyChar === "i") {
        session.openPreview();
        render();
      } else if (keyName === "return" || keyName === "enter") {
        cleanup();
        const selectedSkills = session.getSelectedSkills();
        const footprint = session.calculateFootprint();
        const guidelinesSummary = session.extractGuidelines();
        resolve({
          confirmed: true,
          selectedSkills,
          items: session.getItems(),
          footprint,
          guidelinesSummary,
        });
      } else if (keyChar === "q" || keyName === "q" || keyName === "escape") {
        cleanup();
        resolve({ confirmed: false, selectedSkills: [], items: session.getItems() });
      }
    };

    const onKeyPress = (str: string, key: any) => {
      const name = key?.name || "";
      const ctrl = Boolean(key?.ctrl);
      handleAction(name, ctrl, str);
    };

    const onData = (data: Buffer | string) => {
      const str = data.toString();
      // Handle Enter and standalone Escape directly if piped without keypress event
      if (str === "\r" || str === "\n" || str === "\r\n") {
        handleAction("return", false, "\r");
      } else if (str === "\u001b") {
        handleAction("escape", false, "\u001b");
      }
    };

    (stdin as any).on("keypress", onKeyPress);
    (stdin as any).on("data", onData);
  });
}

/**
 * High-level orchestrator that evaluates execution environment and either
 * launches the interactive TUI prompt or seamlessly falls back to non-interactive mode.
 */
export async function promptInteractiveSkillSelection(
  options: InteractivePromptOptions = {}
): Promise<InteractivePromptResult> {
  const projectPath = options.projectPath ?? process.cwd();
  const profile = options.profile ?? profileArchetype(projectPath);

  const shouldPrompt = shouldRunInteractivePrompt({
    stdin: options.stdin ?? process.stdin,
    stdout: options.stdout ?? process.stdout,
    isYes: options.isYes,
    isJson: options.isJson,
    isInteractive: options.isInteractive,
    ci: options.env ? Boolean(options.env.CI) : undefined,
    env: options.env,
  });

  const isHeadless = !shouldPrompt || options.fallbackNonInteractive;

  if (isHeadless) {
    const selectedSkills = options.initialSelectedSkills ?? profile.activeSkills;
    const footprint = calculateTokenFootprint(selectedSkills, {
      projectPath,
      profile,
      tokenBudget: options.maxTokens ?? 2500,
    });
    const guidelinesSummary = extractAllSelectedGuidelines(selectedSkills, projectPath, profile);

    return {
      confirmed: true,
      bypassed: true,
      headlessFallback: Boolean(!options.isYes && !options.isJson),
      selectedSkills,
      profile,
      items: MODULAR_SKILLS_CATALOG.map((cat) => ({
        name: cat.name,
        title: cat.title,
        description: cat.description,
        recommended: profile.activeSkills.includes(cat.name),
        selected: selectedSkills.includes(cat.name),
      })),
      footprint,
      guidelinesSummary,
    };
  }

  const selectorResult = await runInteractiveSkillSelector({
    profile,
    projectPath,
    stdin: options.stdin,
    stdout: options.stdout,
    dryRun: options.dryRun,
    force: options.force,
    maxTokens: options.maxTokens,
    strictTokenGuard: options.strictTokenGuard,
    initialSelectedSkills: options.initialSelectedSkills,
    fallbackNonInteractive: options.fallbackNonInteractive,
  });

  return {
    ...selectorResult,
    bypassed: false,
    profile,
  };
}
