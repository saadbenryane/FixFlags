---
name: fixflags-design-philosophy
description: The "why" behind FixFlags design — first principles from Nielsen Norman Group heuristics and Apple Human Interface Guidelines, mapped to our surfaces (report, dashboard, marketing) and tokens. Use before designing or reviewing any layout, report, or component to make decisions principled instead of arbitrary. Triggers on design philosophy, UX principles, heuristics, "make it beautiful", report design, layout quality, "feels off", design review.
---

# FixFlags Design Philosophy

This is the **principles layer**. It sits above the mechanics:

- **Philosophy (this file)** — *why* a choice is right (NN/g + Apple HIG).
- [`fixflags-design-system`](../fixflags-design-system/SKILL.md) — *what* the tokens are.
- [`fixflags-ui-upgrade`](../fixflags-ui-upgrade/SKILL.md) — *how* to run an upgrade pass.

> **North star:** FixFlags finds the problems in someone's product. The report must feel
> calmer, clearer, and more trustworthy than the product it is critiquing. If our own UI has
> flags, we have no authority. **The interface is the proof.**

This is a **living document**. Improve it whenever we learn something (see [Changelog](#changelog)).

---

## 1. Three pillars (Apple HIG, reframed for us)

| Pillar | Apple's intent | FixFlags translation |
|--------|----------------|----------------------|
| **Clarity** | Text legible, icons precise, every element earns its place | One idea per screen region. The score, the verdict, the flags — each has a single obvious job. Ruthlessly delete decoration. |
| **Deference** | UI defers to content; chrome recedes | Content (the user's site, screenshots, flags) is the hero. Our chrome is quiet: neutral surfaces, depth via shadow not borders, orange used **only** to point. |
| **Depth** | Layers and motion convey hierarchy | Establish hierarchy with elevation (`shadow-card`), spacing rhythm, and type scale — not boxes-in-boxes. Motion (`--motion-fast` + `--ease-out`) clarifies, never decorates. |

When two options tie, pick the one with **less**.

---

## 2. Nielsen Norman's 10 heuristics → our application

| # | Heuristic | What it means here | Where it lives |
|---|-----------|--------------------|----------------|
| 1 | **Visibility of system status** | The user always knows what's happening: scan progress (Scan → Flag → Fix), partial report fill-in, save/share status. | `AuditReportProgressive`, `ReportFixLoop`, `Callout`, `ShareStatusBanner`, `ActiveAuditBanner` |
| 2 | **Match system & real world** | Plain language, not jargon. "Flag", "fix prompt", "re-check" — verbs a builder uses. Grades (A–F) are a universal mental model. | `ScoreDisplay`, rubric labels, verdict copy |
| 3 | **User control & freedom** | Reversible actions, clear exits, no dead ends. Collapsible sections; every error state offers a next step. | `RubricCard` accordion, error panels with CTAs |
| 4 | **Consistency & standards** | One way to do a thing. Same card = same radius, surface, shadow. Use shared primitives, never bespoke one-offs. | `Card`, `Callout`, `Button`, typography components |
| 5 | **Error prevention** | Validate before damage. Disable/guard destructive actions; confirm spend (plan changes). Re-checks are free — never gate behind quota. | `LaunchGates`, `AuditLimitGate`, checkout flows |
| 6 | **Recognition over recall** | Show, don't make them remember. Persistent `ReportStickyToolbar`, inline definitions, visible legends. | `ReportStickyToolbar`, `ScoringLegend` |
| 7 | **Flexibility & efficiency** | Defaults for novices, accelerators for pros. One-click copy fix prompts; keyboard focus order; sensible zero-config. | `FixPromptBlock`, `PromptCopyButton` |
| 8 | **Aesthetic & minimalist design** | Every element competes for attention — so most shouldn't exist. Prefer whitespace over dividers, one accent over many. | All layouts; the 60-30-10 rule |
| 9 | **Help users recognize & recover from errors** | Errors in human terms + a remedy. Never a raw stack trace; always "here's what to do next." | `AuditFailurePanel`, partial-report `Callout` |
| 10 | **Help & documentation** | Searchable, task-oriented, close to the point of need. Contextual hints beat a separate manual. | `/help`, `lib/help/contextual.ts`, inline tooltips, report section headers |

**Review move:** for any new surface, walk these 10 in order and name which ones it satisfies and which it ignores on purpose.

---

## 3. The laws we design by

- **Hick's Law** — more choices = slower decisions. Cap primary actions per view (ideally 1 primary CTA). Progressive-disclose the rest.
- **Fitts's Law** — targets that are bigger and closer are faster. Interactive rows ≥ `min-h-11` (44px, Apple's minimum). Primary CTAs are large and reachable.
- **Jakob's Law** — users expect us to work like everything else. Don't reinvent nav, forms, or scroll. Convention first; novelty only where it adds real value.
- **Miller's Law (~7±2)** — chunk. Three rubrics (Message, Experience, Reach), not thirty raw checks. Group flags by severity, summaries before detail.
- **Von Restorff (isolation)** — the different thing is remembered. Exactly one orange focal point per region; if everything pops, nothing does.
- **Aesthetic-Usability Effect** — polished UI is *perceived* as more usable and trustworthy. Optical alignment, tabular numbers on scores, real italics (never faux), tuned shadows — these compound into credibility.
- **Peak-End Rule** — people judge an experience by its peak and its end. Our peak is the **score reveal**; our end is the **fix prompt**. Invest disproportionately in both.
- **Doherty Threshold (<400ms)** — keep the system responsive. Optimistic UI, skeletons, and progress so the user never feels stalled.
- **Progressive disclosure** — summary first, detail on demand. The report opens at altitude (score + verdict + grid), then drills down.

---

## 4. Report doctrine (the report is the product)

The report is read in this emotional arc — design to it:

1. **Orient** — hostname, page type, page job. "Yes, this is my page."
2. **Verdict (the peak)** — score + one-sentence judgment. Must feel earned and human. Treat the verdict as a **pull quote**: brand accent rule, Satoshi medium, generous leading — *not* faux-italic.
3. **Triage** — rubric grid + flags by severity. Scannable in 5 seconds (Miller + recognition).
4. **Act (the end)** — copy-paste fix prompts. The most valuable pixels on the site; make copying frictionless and the result obviously useful.
5. **Trust** — pipeline proof, partial-data honesty. We never infer what we didn't measure; ungraded > guessed.

**Surface ownership:** `ReportExplorer` owns flag browsing (master-detail, filters, fix prompts). `RubricBar` is summary/link-only — it links into the explorer, not a second flag browser. Hero owns identity (`ScoreDot`), not a second score ring. Share status lives only in `ShareStatusBanner`.

**Density (report Flags header):**
- Working score ring is always `sm` (68px) beside filters — never `md`/`lg` in the explorer.
- No "Scanned · page type" status row, no "Top fix · Copy fix prompt" summary, no duplicate flag-count badge under filters (counts live in filter pills).
- Sticky toolbar offsets under site header (`--header-height`). Sticky tabs must match DOM sections; status callouts are not an Overview tab.
- Anon conversion: one value strip + `SampleFixCard` — do not stack a third claim-guide card.

Rules:
- Numbers (scores, grades, counts) are `font-mono tabular-nums` so they don't jitter.
- Partial/limited states are first-class, not apologies — a calm `Callout`, never a red scare.
- A grade of A in a rubric is a *celebration moment*, not an empty state.

---

## 5. Layout doctrine

- **Spacing rhythm** — vertical sections step on a scale (`space-y-8` page sections, `space-y-6` groups, `space-y-3` tight). Consistent rhythm reads as "designed."
- **Surfaces & depth** — cards are `rounded-card` + `border-0` + `shadow-card`. Depth comes from shadow, *not* borders (borders only on inputs/tables/dividers).
- **Radius system** — panels & notices: `rounded-card` (12px). Controls, inputs, chips: `rounded-md` (8px). **Avoid** `rounded-lg`/`rounded-xl` aliases (non-monotonic footgun) — prefer the semantic names.
- **60-30-10 color** — 60% neutral surface, 30% ink structure, 10% brand orange. If orange appears > ~5× above the fold, remove some.
- **Optical alignment** — trust your eye over the math; icons and number baselines often need a nudge.
- **Reading width** — body copy stays in `max-w-prose`; full-bleed is for evidence (screenshots), not paragraphs.

---

## 6. Pre-ship review rubric

Score each new/changed surface. Ship at all green.

- [ ] **One job per region** — could a stranger name each section's purpose in 3 words?
- [ ] **One focal point** — exactly one orange/primary draw per viewport region?
- [ ] **Status is visible** — loading, empty, partial, error, success all designed (not just the happy path)?
- [ ] **Hierarchy by type + space**, not boxes — remove a border; does it still read? If yes, keep it removed.
- [ ] **Touch & focus** — interactive targets ≥ 44px, visible focus ring, logical tab order?
- [ ] **Numbers are mono + tabular**, headings `text-balance`, body `text-pretty`?
- [ ] **Motion** respects `prefers-reduced-motion` and is ≤ `--motion-fast`?
- [ ] **Contrast** — text ≥ 4.5:1, UI ≥ 3:1, including on `#FF4B00`?
- [ ] **Peak & end** — is the score reveal and the fix-prompt step the most polished thing on the page?
- [ ] **Would I screenshot this?** If it's not screenshot-worthy, it's not done.

---

## 7. How we keep improving

This philosophy is versioned on purpose.

- **Trigger to revisit:** a usability surprise, a support theme, a "feels off" review, or a new surface type.
- **Process:** add/refine a principle → tie it to a concrete component or token → log it below → propagate the mechanic into `fixflags-design-system`.
- **Cadence:** revisit at every major UI pass and whenever this skill is loaded for a review.

### Changelog

- **v1.6 (Jul 2026)** — Report density: explorer score `sm`; sticky under `--header-height`; Overview tab removed (callouts after toolbar); Priorities in sticky; share status / score ownership one surface each; progressive gets `productContract` + truth-capable partial flags.
- **v1.5 (Jul 2026)** — Report surface cleanup: `ReportExplorer` owns flag browsing; `RubricsPanel` summary-only; removed `ReportMiniNav`/`CompletenessHeader`; homepage nav How it works / Sample / Pricing; primary CTA **Review my site**; re-checks free and unlimited.
- **v1.4 (Jun 2026)** — Landing language refinement: removed How-to-Start toggle and evidence section; logo cloud below hero; dimension cards restore checklists + example findings; outcome-led final CTA; concentric nested fix prompts via `FixPromptBlock nested`.
- **v1.3 (Jun 2026)** — Landing conversion restructure: one hero report, grades+loop two-column section, slim dimension cards with proof examples, evidence screenshots, honest social proof strip; cut synthetic before/after impact section.
- **v1.2 (Jun 2026)** — Landing completion: 3-dimension marketing model (Trust lives in Experience); live sample + wired CTAs; orphaned marketing components removed; app-wide `Card`/`Surface`/`Callout` adoption; `ui:drift-guard` script; Expert Review audit picker dialog.
- **v1.1 (Jun 2026)** — Design completion pass: live report `#report-fix` + `FixPromptBlock` arc; terminal tokens on fix prompts; `Callout` / `Card` / `Surface` standardized across audit surfaces; layout `Container variant="report"` alignment; `EmptyState` primitive; removed `surface-raised` utility.
- **v1.0 (Jun 2026)** — Established pillars, heuristics map, laws, report + layout doctrine, review rubric. Introduced `Callout` primitive and pull-quote verdict; standardized report radii on `rounded-card`.

---

## Companion skills

- `fixflags-design-system` — tokens, fonts, radius, logo
- `~/.agents/skills/make-interfaces-feel-better` — micro-interaction & rendering polish
- `~/.agents/skills/color-theory` — palette & contrast validation
- `~/.agents/skills/web-design-guidelines` — accessibility audit
