---
name: qualityos-ui-upgrade
description: Orchestrator for QualityOS UI upgrades — typography, polish, anti-slop, and skill routing. Use when the user says "upgrade yourself", "polish the UI", "make it feel designed", or asks to improve fonts, spacing, or visual quality across the app.
---

# QualityOS UI Upgrade

Run this skill when improving visual quality project-wide. **Read the project skill first**, then pull from global skills as needed.

## Step 0 — Always read first

1. [qualityos-design-system/SKILL.md](../qualityos-design-system/SKILL.md) — tokens, fonts, spacing
2. [qualityos-marketing/lean-visual.md](../qualityos-marketing/lean-visual.md) — if touching marketing/report surfaces

## Font stack (current)

| Role | Font | Use |
|------|------|-----|
| Display | Fraunces (SOFT 50, opsz) | Hero h1, section h2, logo, **not** app page titles at hero scale |
| App titles | `PageTitle` / `PageHeader` | Dashboard, settings, billing, admin — 1.625–1.875rem |
| Body | Source Sans 3 | UI, forms, paragraphs |
| Mono | IBM Plex Mono | Grades, scores, labels, code |

**Never** use `Heading as="h1"` on app/admin pages — use `PageHeader` + `PageTitle`.

## Global skills (read before editing)

| Task | Skill path |
|------|------------|
| Bold aesthetic direction | `~/.agents/skills/frontend-design/SKILL.md` |
| Post-build polish pass | `~/.agents/skills/impeccable-design-polish/SKILL.md` |
| Typography rendering | `~/.agents/skills/make-interfaces-feel-better/typography.md` |
| Color/contrast | `~/.agents/skills/color-theory/SKILL.md` |
| Auth/dashboard recipes | `~/.agents/skills/ui-craft/references/recipe-auth.md`, `recipe-dashboard.md` |
| A11y audit | `~/.agents/skills/web-design-guidelines/SKILL.md` |
| Marketing copy | `~/.cursor/skills/landing-page-copy/SKILL.md` |

## Upgrade checklist (in order)

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

- Inter, DM Sans, Instrument Serif, Roboto
- `font-bold` on page titles (use `PageTitle` or `Heading`)
- Hero-sized display type on dashboard/settings
- Purple gradients, generic 3-card grids, border-heavy cards
- `tracking-tight` on body text

## Files to touch for a full UI pass

- `lib/design/tokens.css`, `app/globals.css`, `tailwind.config.ts`
- `components/ui/typography.tsx`, `components/layout/PageHeader.tsx`
- `app/(marketing)/**`, `app/(app)/**`, `app/admin/**`
- `.cursor/skills/qualityos-design-system/SKILL.md` (keep in sync)
