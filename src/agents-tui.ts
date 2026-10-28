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
  parseSkillFrontmatter
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
}

export interface InteractiveSelectorResult {
  confirmed: boolean;
  selectedSkills: SkillName[];
  items?: SkillItem[];
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

  let cursor = 0;
  let inPreview = false;

  const render = () => {
    // Print stack review header first
    const reviewText = formatArchetypeProfileReview(profile, projectPath);
    let output = reviewText + "\n";

    if (inPreview) {
      const current = items[cursor] ?? items[0];
      const def = current ? SKILL_DEFINITIONS[current.name] : undefined;
      const content = def?.content || "";
      const tokens = estimateTokens(content);
      const fm = parseSkillFrontmatter(content);

      output += pc.bold(pc.yellow(`\n🔍 Skill Preview: ${current?.name ?? "skill"} (${current?.title ?? ""})\n`));
      output += `  ${pc.dim("File:")}        .agents/skills/${def?.fileName || `${current?.name ?? "skill"}.md`}\n`;
      output += `  ${pc.dim("Estimated:")}   ~${tokens} tokens\n`;
      output += `  ${pc.dim("Description:")} ${fm?.description || current?.description || ""}\n`;
      output += pc.dim("\n  Press [Escape], [p], [i], or [Enter] to return to checklist.\n");
    } else {
      output += pc.bold(pc.cyan("Interactive Skills Checklist:\n"));
      output += pc.dim("  Use [↑/↓] or [j/k] to navigate, [Space] to toggle, [a] toggle all, [p/i] to inspect, [Enter] to confirm, [q] to quit.\n\n");

      items.forEach((item, index) => {
        const isCurrent = index === cursor;
        const pointer = isCurrent ? pc.cyan("❯ ") : "  ";
        const check = item.selected ? pc.green("◉ ") : pc.dim("◯ ");
        const nameText = isCurrent ? pc.bold(pc.white(item.name)) : pc.dim(item.name);
        const recTag = item.recommended ? pc.green(" [recommended]") : pc.dim(" [optional]");
        output += `${pointer}${check}${nameText} - ${item.title}${recTag}\n`;
      });
      output += "\n";
    }

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
        resolve({ confirmed: false, selectedSkills: [], items: items.map(it => ({ ...it })) });
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
      } else if (keyName === "p" || keyName === "i" || keyChar === "p" || keyChar === "i") {
        inPreview = true;
        render();
      } else if (keyName === "return" || keyName === "enter") {
        cleanup();
        const selectedSkills = items
          .filter((it) => it.selected)
          .map((it) => it.name);
        resolve({ confirmed: true, selectedSkills, items: items.map(it => ({ ...it })) });
      } else if (keyChar === "q" || keyName === "escape") {
        cleanup();
        resolve({ confirmed: false, selectedSkills: [], items: items.map(it => ({ ...it })) });
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
