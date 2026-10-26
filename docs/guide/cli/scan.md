# baba scan

Audit repository maturity across 5 governance axes against the canonical `paladini/harness-score` oracle and generate dynamic SVG compliance badges.

---

## 🚀 Synopsis

```bash
baba scan [path] [options]
```

### Command Aliases
`baba scan` guarantees identical behavior across all aliases:
* `baba scan` — Short 4-letter CLI shortcut
* `bbyg scan` — Baba-Yaga alias
* `matryoshka scan` — Formal package executable

---

## 📖 Description

The `scan` command evaluates the engineering hygiene and agentic maturity of your repository. It reconciles structural file markers against the canonical **`paladini/harness-score`** oracle model across five governance axes, computing an objective score out of **105 maximum points** and assigning a maturity tier from **L0** to **L4**.

If the external oracle binary is unavailable in the execution environment, Matryoshka activates a resilient in-memory evaluator with zero network calls and zero host crashes.

---

## ⚙️ Arguments & Options

### Positional Arguments
* `[path]` — Target directory to scan. Defaults to current directory (`.`).

### Options
* `--badge [path]` — Generate an accessible SVG maturity badge. Defaults to `./harness-badge.svg` if path is omitted.
* `--json` — Output strictly valid JSON with complete scoring breakdowns and remediation plans.
* `-h, --help` — Display command help and usage instructions.

---

## 📊 The 5 Governance Axes (105 Points Max)

| Governance Axis | Max Points | Inspected Criteria |
|:---|:---:|:---|
| **Context** | 25 | Presence and token budget of `AGENTS.md`, architecture docs, `README.md` |
| **Skills** | 20 | Modular `.agents/skills/`, YAML frontmatter completeness, domain coverage |
| **Guardrails** | 25 | Linter configs (Biome, ESLint, Ruff), strict TypeScript/compiler flags, CI gates |
| **Sensors** | 20 | Test coverage runners, telemetry configs, AST rule suites |
| **Hygiene** | 15 | Standard `.gitignore`, lockfile freshness, zero vendor leakages |

### Maturity Tiers (L0 to L4)
* **L0 — Unharnessed (0–20 pts):** No context boundaries, missing tests, raw LLM slop hazard.
* **L1 — Foundational (21–45 pts):** Basic `README.md` and tests present; rudimentary scripts.
* **L2 — Monitored (46–65 pts):** Basic linter and type-checking configured; partial CI.
* **L3 — Governed (66–85 pts):** Strict context fencing, modular skills, comprehensive CI gates.
* **L4 — Autonomous (86–105 pts):** Full AST remediation, zero false-green tests, automated MCP auto-wiring.

---

## 🏷️ Dynamic SVG Badge Calibration

When invoked with `--badge`, Matryoshka emits a standalone, accessible SVG badge with dynamic color calibration based on the attained maturity tier:

| Level | Range | Hex Color | Visual Classification |
|:---:|:---:|:---:|:---|
| **L0** | 0–20 | `#cf222e` | Critical / Unharnessed (Red) |
| **L1** | 21–45 | `#d97706` | Foundational (Orange) |
| **L2** | 46–65 | `#d4a72c` | Monitored (Yellow) |
| **L3** | 66–85 | `#0969da` | Governed (Blue) |
| **L4** | 86–105 | `#2ea44f` | Autonomous / Fully Remediated (Green) |

The generated badge includes semantic SVG attributes (`role="img"`, `aria-label`, `<title>`) for accessibility and seamless embedding in GitHub READMEs:

```markdown
![Harness Maturity](harness-badge.svg)
```

---

## 📋 Examples

### Human-Readable Audit
Inspect the current repository in the terminal:
```bash
baba scan
```

Output:
```text
🛡️  Matryoshka Maturity Scanner
────────────────────────────────────────
Primary Stack:       typescript
Oracle Level:        L3 (Governed)
Harness Score:       78 / 105

Remediation Plan:
  [Context] Add token-fenced AGENTS.md (< 200 tokens)
  [Skills] Add YAML frontmatter to .agents/skills/
  [Guardrails] Enable strict compiler null checks
```

### Exporting an Official SVG Badge
Generate an SVG badge in the repository root:
```bash
baba scan --badge
```

Specify a custom badge path:
```bash
baba scan --badge ./badges/harness-badge.svg
```

### Structured JSON Output
For CI pipelines, score aggregators, and agent orchestration:
```bash
baba scan --json
```

Output:
```json
{
  "status": "success",
  "command": "scan",
  "primaryStack": "typescript",
  "oracleScore": 82,
  "oracleLevel": "L3",
  "remediationIssues": [
    {
      "axis": "Context",
      "severity": "medium",
      "message": "Optimize AGENTS.md token consumption below 200 tokens"
    }
  ]
}
```
