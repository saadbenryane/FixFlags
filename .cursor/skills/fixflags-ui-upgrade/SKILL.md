---
name: fixflags-ui-upgrade
description: Orchestrator for FixFlags UI upgrades — typography, polish, anti-slop, and skill routing. Use when the user says "upgrade yourself", "polish the UI", "make it feel designed", or asks to improve fonts, spacing, or visual quality across the app.
---

# FixFlags UI Upgrade

**Read [`AGENTS.md`](../../AGENTS.md) first.** Run this skill when improving visual quality project-wide.

## Step 0 — Always read first

1. [fixflags-design-philosophy/SKILL.md](../fixflags-design-philosophy/SKILL.md) — the *why* (NN/g + Apple HIG); use its pre-ship review rubric
2. [fixflags-design-system/SKILL.md](../fixflags-design-system/SKILL.md) — tokens, fonts, spacing
3. [fixflags-marketing/lean-visual.md](../fixflags-marketing/lean-visual.md) — if touching marketing/report surfaces

## Font stack (current — dual-typeface system)

| Role | Font | Use |
|------|------|-----|
| Headlines + wordmark | Fraunces (`font-serif` / `font-display`) | Hero h1, section h2, marketing headlines — editorial serif for brand voice |
| App titles | `PageTitle` / `PageHeader` | Dashboard, settings, billing, admin — 1.625–1.875rem, Satoshi |
| Body | Satoshi (`font-sans`) | UI, forms, paragraphs, all functional text |
| Mono | IBM Plex Mono | Grades, scores, labels, code |

**Rule:** Fraunces serif for marketing headlines only. Satoshi sans for everything functional. Never serif in dense product UI. **Never** use `Heading as="h1"` on app/admin pages — use `PageHeader` + `PageTitle`. Do not use Source Sans 3 (legacy).

## Global skills (read before editing)

| Task | Skill path |
|------|------------|
| Bold aesthetic direction | `~/.agents/skills/frontend-design/SKILL.md` |
| Post-build polish pass | `~/.agents/skills/impeccable-design-polish/SKILL.md` |
| Typography rendering | `~/.agents/skills/make-interfaces-feel-better/typography.md` |
| Color/contrast | `~/.agents/skills/color-theory/SKILL.md` |
| Auth/dashboard recipes | `~/.agents/skills/ui-craft/references/recipe-auth.md`, `recipe-dashboard.md` |
| A11y audit | `~/.agents/skills/web-design-guidelines/SKILL.md` |
| Marketing copy | `.cursor/skills/fixflags-marketing/SKILL.md` |

## Upgrade checklist (in order)

### Report density (when touching audit/report UI)
- [ ] Read [fixflags-design-philosophy](../fixflags-design-philosophy/SKILL.md) report density doctrine
- [ ] Explorer score ring is `sm` (68px); header `gap-3` / `pb-3`
- [ ] No severity filter pills; list is severity-ranked; rubric + page filters only
- [ ] Flag meta: `SeveritySignal` → Rubric → Impact (no truth pills)
- [ ] Device-specific evidence only (no healthy twin viewport)
- [ ] One share-status surface (`ShareStatusBanner`); hero is identity + `ScoreDot` only
- [ ] Sticky tabs match DOM; no Overview; Priorities when Top Priorities exist
- [ ] No FixLoop status row / duplicate count under filters
- [ ] **Progressive seam:** same `AuditReportHero` / `RubricBar` / sticky as completed; `getScanningLabel` wired; no `ReportHeroHeader` / progressive `RubricSummaryGrid` / `#report-overview`; COMPLETED holds frame + `router.refresh()`; partial Callout only on `PARTIAL`

### Typography
- [ ] Marketing heroes: `Heading as="h1"` or `h2`
- [ ] App/admin: `PageHeader` only
- [ ] Body: `Body` / `Muted` / `Lead` — no raw `text-muted-foreground` paragraphs on new work
- [ ] Scores/grades: `font-mono tabular-nums`
- [ ] `text-balance` on headings, `text-pretty` on body (already in globals)

### Surfaces
- [ ] Cards: `border-0 shadow-card` (see lean-visual)
- [ ] Depth via shadow, not borders — except tables/inputs
- [ ] Concentric radius on nested card headers

### Links vs brand
- [ ] Inline links: `TextLink` (`text-link`) — not `text-primary` or `text-brand`
- [ ] CTAs/scores: `--brand` only

### Motion
- [ ] `--motion-fast` (200ms) + `--ease-out` on hovers
- [ ] Respect `prefers-reduced-motion`

## Anti-patterns (reject on review)

- Inter, DM Sans, Instrument Serif, Roboto, Source Sans 3 (non-brand fonts)
- `font-bold` on page titles (use `PageTitle` or `Heading`)
- Hero-sized display type on dashboard/settings
- Purple gradients, generic 3-card grids, border-heavy cards
- `tracking-tight` on body text

## Files to touch for a full UI pass

- `lib/design/tokens.css`, `app/globals.css`, `tailwind.config.ts`
- `components/ui/typography.tsx`, `components/layout/PageHeader.tsx`
- `app/(marketing)/**`, `app/(app)/**`, `app/admin/**`
- `.cursor/skills/fixflags-design-system/SKILL.md` (keep in sync)
