# QualityOS Design Brief

Anchors every UI decision. Read before building or polishing any surface.

## Product

QualityOS — AI-powered website quality audits. Users scan URLs, get graded reports with findings, screenshots, and launch-readiness signals. Tone: **editorial + technical credibility**, not generic SaaS template.

## Primary user

Founder or solo dev shipping a site who needs a clear, actionable quality report — not a wall of generic tips.

## Success metric

User understands their top blockers and next fix within 30 seconds of opening a report.

## Design style

**Rich Editorial** — warm paper neutrals, Fraunces display, shadow-first depth, restrained ochre accent. Lean marketing (no border crutches, no icon grids). Product surfaces: data-dense but calm.

## Knobs (defaults)

| Knob | Value | Notes |
|------|-------|-------|
| CRAFT_LEVEL | 8 | Polish pass on shipped UI |
| MOTION_INTENSITY | 4 | Hover + soft reveal; no scroll gimmicks |
| VISUAL_DENSITY | 6 | Audit reports dense; marketing airy |

## Color (60-30-10)

| Share | Tokens | Role |
|-------|--------|------|
| 60% | `--background`, `--muted` | Warm paper surfaces |
| 30% | `--foreground`, `--primary` | Ink structure, primary buttons |
| 10% | `--brand` (ochre 28°) | CTAs, scores, focus — ≤3× above fold on marketing |

- Never second accent hue on marketing
- Dark mode re-authored in `tokens.css`, not inverted
- Test hierarchy in grayscale

## Typography

- **Display:** Fraunces (`font-display`, SOFT 50) — h1, h2, logo
- **Body:** Source Sans 3 — never tighten tracking on body
- **Mono:** IBM Plex Mono — grades, uppercase labels only
- Headings: `text-wrap: balance`, `tracking-display` / `tracking-heading`
- Labels: `section-label` class, positive tracking only

## Depth & radius

- Cards: `shadow-card`, `rounded-card` — **no borders on cards**
- Concentric: `inner = outer − gap` (see `--radius-nested-*`)
- Buttons: pill (`rounded-full`); inputs on audit: pill (signature)
- Section rhythm: `bg-muted/35` alternation, not `border-y`

## Anti-slop (never)

- Identical 3-column icon+text feature grids
- Purple/cyan gradients, blur orbs, glassmorphism + neon
- ALL CAPS headings (except 11px mono labels)
- Colored trend pills, left accent stripes on cards
- `transition: all`, bounce easing
- Inter, DM Sans, generic startup stacks

## Signature details

- Pill audit URL input (product signature)
- Grade badges with tabular nums + `--radius-inner`
- Real audit screenshots as proof (never mock illustrations)
- Terminal-styled code blocks for MCP / dev surfaces

## Companion docs

- Tokens: `lib/design/tokens.css`, `app/globals.css`
- Skill: `.cursor/skills/qualityos-design-system/SKILL.md`
- Marketing visual: `.cursor/skills/qualityos-marketing/lean-visual.md`
- Copy: `.cursor/skills/qualityos-marketing/writing-simple.md`

## Pre-ship checklist

- [ ] Tokens used — no raw hex except grade scale
- [ ] Brand ≤5 accent placements per viewport
- [ ] Nested radii concentric
- [ ] `tabular-nums` on scores/counts
- [ ] `focus-visible:ring-ring` preserved
- [ ] `prefers-reduced-motion` honored
