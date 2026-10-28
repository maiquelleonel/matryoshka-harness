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
  }
): string {
  const cat = MODULAR_SKILLS_CATALOG.find((s) => s.name === skillName);
  const def = SKILL_DEFINITIONS[skillName];
  const content = resolveSkillContent(skillName, {
    projectPath: options?.projectPath,
    profile: options?.profile,
  });
  const tokens = estimateTokens(content);
  const fm = parseSkillFrontmatter(content);
  const guidelines = extractDontVsDoGuidelines(content, skillName);

  let fmBlock = "";
  if (content.startsWith("---\n")) {
    const endFm = content.indexOf("\n---\n", 4);
    if (endFm !== -1) {
      fmBlock = content.slice(0, endFm + 5).trim();
    }
  }
  const fmTokens = fmBlock ? estimateTokens(fmBlock) : 0;
  const bodyTokens = Math.max(0, tokens - fmTokens);

  const selected = options?.cumulativeSelectedSkills ?? [skillName];
  const footprint = calculateTokenFootprint(selected, {
    projectPath: options?.projectPath,
    profile: options?.profile,
    tokenBudget: options?.tokenBudget,
  });

  const lines: string[] = [];
  lines.push(
    pc.bold(
      pc.yellow(`\n🔍 Skill Preview: ${skillName} (${cat?.title || skillName})\n`)
    )
  );
  lines.push(`  ${pc.dim("File:")}        .agents/skills/${def?.fileName || `${skillName}.md`}`);
  lines.push(`  ${pc.dim("Estimated:")}   ~${tokens} tokens`);
  lines.push(`  ${pc.dim("Description:")} ${fm?.description || cat?.description || ""}\n`);

  if (fmBlock) {
    lines.push(pc.bold(pc.cyan("  📦 YAML Frontmatter:")));
    lines.push(pc.dim("    " + fmBlock.split("\n").join("\n    ")) + "\n");
  }

  lines.push(pc.bold(pc.cyan("  📊 Token Footprint:")));
  lines.push(`    ${pc.dim("•")} Skill Body: ~${bodyTokens} tokens`);
  lines.push(`    ${pc.dim("•")} Frontmatter: ~${fmTokens} tokens`);
  lines.push(
    `    ${pc.dim("•")} Cumulative with Selection: ~${footprint.totalTokens} / ${footprint.tokenBudget} tokens (${footprint.budgetPercentage}%)\n`
  );

  lines.push(pc.bold(pc.cyan("  📋 Don't vs Do Guidelines:")));
  if (guidelines.dos.length > 0) {
    lines.push(pc.bold(pc.green("    ✅ DO (Best Practices & Invariants):")));
    for (const d of guidelines.dos) {
      lines.push(`      ${pc.green("•")} ${d}`);
    }
  }
  if (guidelines.donts.length > 0) {
    lines.push(pc.bold(pc.red("    ❌ DON'T (Anti-Patterns & Prohibitions):")));
    for (const d of guidelines.donts) {
      lines.push(`      ${pc.red("•")} ${d}`);
    }
  }

  lines.push(
    pc.dim("\n  Press [Escape], [p], [i], or [Enter] to return to checklist.\n")
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

export interface ShouldRunInteractiveOptions {
  interactive?: boolean;
  yes?: boolean;
  isTTY?: boolean;
  ci?: boolean;
}

/**
 * Evaluates whether an interactive terminal prompt should be launched,
 * or smoothly fall back to deterministic non-interactive batch mode.
 */
export function shouldRunInteractive(options: ShouldRunInteractiveOptions = {}): boolean {
  if (options.yes) {
    return false;
  }
  const isCI =
    options.ci ??
    (Boolean(process.env.CI && process.env.CI !== "0" && process.env.CI !== "false") ||
      Boolean(process.env.CONTINUOUS_INTEGRATION));

  const isTTY =
    options.isTTY ?? Boolean(process.stdin?.isTTY && (process.stdout ? process.stdout.isTTY : true));

  if (options.interactive) {
    // If explicitly requested interactive, only run if stdin is indeed a TTY
    return isTTY;
  }

  // In CI environments, default to non-interactive
  if (isCI) {
    return false;
  }

  return isTTY;
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
  yes?: boolean;
  interactive?: boolean;
  fallbackToNonInteractive?: boolean;
  isTTY?: boolean;
  ci?: boolean;
}

export interface InteractiveSelectorResult {
  confirmed: boolean;
  selectedSkills: SkillName[];
  items?: SkillItem[];
  footprint?: TokenFootprintReport;
  guidelinesSummary?: DontVsDoSummary[];
  fallbackApplied?: boolean;
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

  // Build selectable items list
  const items: SkillItem[] = MODULAR_SKILLS_CATALOG.map((cat) => {
    const recommended = profile.activeSkills.includes(cat.name);
    const selected = options.initialSelectedSkills
      ? options.initialSelectedSkills.includes(cat.name)
      : recommended;
    return {
      name: cat.name,
      title: cat.title,
      description: cat.description,
      recommended,
      selected,
    };
  });

  const effectiveIsTTY =
    options.isTTY ??
    (options.stdin ? Boolean((options.stdin as any).isTTY) : Boolean(process.stdin?.isTTY));
  const effectiveCI =
    options.ci ??
    (Boolean(process.env.CI && process.env.CI !== "0" && process.env.CI !== "false") ||
      Boolean(process.env.CONTINUOUS_INTEGRATION));

  const canRunInteractive = shouldRunInteractive({
    interactive: options.interactive,
    yes: options.yes,
    isTTY: effectiveIsTTY,
    ci: effectiveCI,
  });

  const shouldFallback =
    Boolean(options.yes) || (Boolean(options.fallbackToNonInteractive) && !canRunInteractive);

  if (shouldFallback) {
    const activeSelected = items.filter((it) => it.selected).map((it) => it.name);
    const footprint = calculateTokenFootprint(activeSelected, {
      projectPath,
      profile,
      tokenBudget: options.maxTokens ?? 2500,
    });
    const summaries = extractAllSelectedGuidelines(activeSelected, projectPath, profile);

    return {
      confirmed: true,
      selectedSkills: activeSelected,
      items: items.map((it) => ({ ...it })),
      footprint,
      guidelinesSummary: summaries,
      fallbackApplied: true,
    };
  }

  let cursor = 0;
  let inPreview = false;
  let inGuidelinesModal = false;

  const render = () => {
    if (inGuidelinesModal) {
      const activeSelected = items.filter((it) => it.selected).map((it) => it.name);
      const summaries = extractAllSelectedGuidelines(activeSelected, projectPath, profile);
      stdout.write(formatDontVsDoGuidelines(summaries));
      return;
    }

    if (inPreview) {
      const current = items[cursor] ?? items[0];
      const activeSelected = items.filter((it) => it.selected).map((it) => it.name);
      if (current) {
        stdout.write(
          formatSkillPreview(current.name, {
            projectPath,
            profile,
            cumulativeSelectedSkills: activeSelected,
            tokenBudget: options.maxTokens,
          })
        );
      }
      return;
    }

    // Print stack review header first
    const reviewText = formatArchetypeProfileReview(profile, projectPath);
    let output = reviewText + "\n";

    output += pc.bold(pc.cyan("Interactive Skills Checklist:\n"));
    output += pc.dim(
      "  Use [↑/↓] or [j/k] to navigate, [Space] to toggle, [a] toggle all, [p/i] to inspect, [g] guidelines preview, [Enter] to confirm, [q] to quit.\n\n"
    );

    items.forEach((item, index) => {
      const isCurrent = index === cursor;
      const pointer = isCurrent ? pc.cyan("❯ ") : "  ";
      const check = item.selected ? pc.green("◉ ") : pc.dim("◯ ");
      const nameText = isCurrent ? pc.bold(pc.white(item.name)) : pc.dim(item.name);
      const recTag = item.recommended ? pc.green(" [recommended]") : pc.dim(" [optional]");
      output += `${pointer}${check}${nameText} - ${item.title}${recTag}\n`;
    });
    output += "\n";

    const currentSelected = items.filter((it) => it.selected).map((it) => it.name);
    const footprint = calculateTokenFootprint(currentSelected, {
      projectPath,
      profile,
      tokenBudget: options.maxTokens ?? 2500,
    });
    output += formatTokenFootprint(footprint) + "\n\n";

    stdout.write(output);
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

    readline.emitKeypressEvents(stdin);

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

    const handleAction = (keyName: string, keyCtrl?: boolean, keyChar?: string) => {
      if (isFinished) return;
      if (keyCtrl && keyName === "c") {
        cleanup();
        stdout.write(pc.red("\nAborted by user (SIGINT).\n"));
        resolve({ confirmed: false, selectedSkills: [], items: items.map((it) => ({ ...it })) });
        return;
      }

      if (inGuidelinesModal) {
        if (
          keyName === "escape" ||
          keyName === "g" ||
          keyName === "return" ||
          keyName === "enter" ||
          keyChar === "g" ||
          keyChar === "q"
        ) {
          inGuidelinesModal = false;
          render();
        }
        return;
      }

      if (inPreview) {
        if (
          keyName === "escape" ||
          keyName === "p" ||
          keyName === "i" ||
          keyName === "return" ||
          keyName === "enter" ||
          keyChar === "q"
        ) {
          inPreview = false;
          render();
        }
        return;
      }

      if (keyName === "up" || keyChar === "k") {
        cursor = (cursor - 1 + items.length) % items.length;
        render();
      } else if (keyName === "down" || keyChar === "j") {
        cursor = (cursor + 1) % items.length;
        render();
      } else if (keyName === "home") {
        cursor = 0;
        render();
      } else if (keyName === "end") {
        cursor = items.length - 1;
        render();
      } else if (keyName === "space" || keyChar === " ") {
        const item = items[cursor];
        if (item) {
          item.selected = !item.selected;
        }
        render();
      } else if (keyChar === "a" || keyChar === "A") {
        const allSelected = items.every((it) => it.selected);
        for (const item of items) {
          item.selected = !allSelected;
        }
        render();
      } else if (keyName === "g" || keyChar === "g") {
        inGuidelinesModal = true;
        render();
      } else if (keyName === "p" || keyName === "i" || keyChar === "p" || keyChar === "i") {
        inPreview = true;
        render();
      } else if (keyName === "return" || keyName === "enter") {
        cleanup();
        const selectedSkills = items
          .filter((it) => it.selected)
          .map((it) => it.name);
        const footprint = calculateTokenFootprint(selectedSkills, {
          projectPath,
          profile,
          tokenBudget: options.maxTokens ?? 2500,
        });
        const guidelinesSummary = extractAllSelectedGuidelines(selectedSkills, projectPath, profile);
        resolve({
          confirmed: true,
          selectedSkills,
          items: items.map((it) => ({ ...it })),
          footprint,
          guidelinesSummary,
        });
      } else if (keyChar === "q" || keyName === "escape") {
        cleanup();
        resolve({ confirmed: false, selectedSkills: [], items: items.map((it) => ({ ...it })) });
      }
    };

    const onKeyPress = (str: string, key: any) => {
      const name = key?.name || "";
      const ctrl = Boolean(key?.ctrl);
      handleAction(name, ctrl, str);
    };

    const onData = (data: Buffer | string) => {
      const str = data.toString();
      // Handle Enter directly if piped without keypress event
      if (str === "\r" || str === "\n" || str === "\r\n") {
        handleAction("return", false);
      }
    };

    (stdin as any).on("keypress", onKeyPress);
    (stdin as any).on("data", onData);
  });
}
