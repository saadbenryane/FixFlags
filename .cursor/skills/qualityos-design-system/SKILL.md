---
name: qualityos-design-system
description: QualityOS visual design tokens — kerning, spacing, concentric border radius, 60-30-10 color theory, typography scale. Use when building or polishing any QualityOS UI, marketing page, or component. Triggers on typography, spacing, colors, border radius, kerning, design tokens, or "make it feel designed."
---

# QualityOS Design System

Project tokens live in `lib/design/tokens.css` and `app/globals.css`. Read before changing UI.

## Color theory (60-30-10)

| Share | Token | Role |
|-------|-------|------|
| 60% | `--background`, `--muted`, `--border` | Warm stone surfaces — most of the screen |
| 30% | `--foreground`, `--primary` | Ink structure — headings, primary buttons, body |
| 10% | `--brand` (amber) | One accent — CTAs highlights, grades, focus rings, proof |

**Rules:**
- Never add a second accent hue on marketing pages
- `--brand` for interactive highlights; `--primary` for filled ink buttons
- Test hierarchy in grayscale — if structure breaks, fix contrast before hue
- Dark mode is re-authored, not inverted (see `.dark` in tokens.css)

## Kerning & letter-spacing

| Role | Token | When |
|------|-------|------|
| Display h1 | `--tracking-display` (-0.012em) | Large serif only — subtle optical tighten |
| Section h2–h3 | `--tracking-heading` (-0.006em) | Sans/semibold headings |
| Body | `--tracking-body` (0) | Let browser `kern` work — do not tighten body |
| Labels | `--tracking-label` (+0.12em) | Uppercase mono labels only |

**Never** use `tracking-tight` on body or muted text. **Always** use positive tracking on uppercase labels.

## Line-height & type scale

| Role | Leading | Size range |
|------|---------|------------|
| Display | `--leading-display` (1.18) | 2rem–4rem |
| Heading | `--leading-heading` (1.28) | 1.65rem–2.25rem |
| Body | `--leading-body` (1.6) | 1rem–1.125rem |
| Captions | 1.45 | 0.75rem–0.875rem |

Use `text-wrap: balance` on headings, `text-wrap: pretty` on body paragraphs.

## Font stack

- **Display:** Instrument Serif (`font-display`) — hero, section titles
- **Body:** DM Sans 400/500/600/700 (`font-sans`)
- **Mono:** JetBrains Mono — grades, labels, code blocks

Enable: `font-feature-settings: "kern" 1, "liga" 1, "calt" 1`

## Spacing (8px grid)

| Token | Value | Use |
|-------|-------|-----|
| 2 | 8px | Tight inline gaps |
| 3 | 12px | Icon + text |
| 4 | 16px | Card padding, form gaps |
| 6 | 24px | Section sub-blocks |
| 8 | 32px | Between related groups |
| 12–16 | 48–64px | Section vertical rhythm |

Tighter inside groups; generous between sections. Hero gets the most air.

## Concentric border radius

**Formula:** `inner = outer − gap`

| Token | Value | Use |
|-------|-------|-----|
| `--radius-input` | 6px | Small controls (non-pill) |
| `--radius-inner` | 10px | Badges, nested chips |
| `--radius-modal` | 14px | Dialogs, sheets |
| `--radius-outer` / `--radius-card` | 20px | Cards, marketing panels |
| `--radius-nested-md` | calc(20px − 12px) | Header/footer inside cards |

**Anti-pattern:** Same radius on parent and padded child — creates pinched corners.

Apply `rounded-t-[var(--radius-nested-md)]` on full-bleed card headers when outer is `--radius-card`.

## Component defaults

- **Buttons:** pill (`rounded-full`), primary = ink, outline = border
- **Inputs (audit):** pill — exception to 6px rule (signature pattern)
- **Cards:** `--radius-card`, shadow over heavy borders
- **Grade badges:** `--radius-inner`, tabular nums

## Pre-ship checklist

- [ ] Headings use balance wrap; body uses pretty wrap
- [ ] Only uppercase labels have wide tracking
- [ ] Nested rounded elements use concentric formula
- [ ] Brand amber appears ≤5 times above the fold
- [ ] Focus rings use `--ring` (brand), never removed
- [ ] Numbers in scores use `tabular-nums`

## Companion skills

- `color-theory` — palette validation, contrast, harmony
- `make-interfaces-feel-better` — concentric radius, shadows, micro-interaction
- `ui-craft` — anti-slop, craft knobs
- `web-design-guidelines` — a11y compliance audit
