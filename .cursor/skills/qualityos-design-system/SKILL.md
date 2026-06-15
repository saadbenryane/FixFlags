---
name: qualityos-design-system
description: QualityOS visual design tokens, kerning, spacing, concentric border radius, 60-30-10 color theory, typography scale. Use when building or polishing any QualityOS UI, marketing page, or component. Triggers on typography, spacing, colors, border radius, kerning, design tokens, or "make it feel designed."
---

# QualityOS Design System

Project tokens live in `lib/design/tokens.css` and `app/globals.css`. Read before changing UI.

## Color theory (60-30-10)

| Share | Token | Role |
|-------|-------|------|
| 60% | `--background`, `--muted` | Warm paper surfaces |
| 30% | `--foreground`, `--primary` | Ink structure |
| 10% | `--brand` (refined ochre) | CTAs, scores, focus, max 3× above fold |

**Rules:**
- Brand is ochre (28°), not neon amber
- Depth via `--shadow-card` / `--shadow-raised`, not borders on cards
- Section rhythm: `bg-muted/35` alternation, not `border-y`
- Never add a second accent hue on marketing pages
- Dark mode is re-authored, not inverted

See also: [lean-visual.md](../qualityos-marketing/lean-visual.md) for borderless marketing rules.

## Kerning & letter-spacing

| Role | Token | When |
|------|-------|------|
| Display h1 | `--tracking-display` (-0.012em) | Large serif only, subtle optical tighten |
| Section h2–h3 | `--tracking-heading` (-0.006em) | Sans/semibold headings |
| Body | `--tracking-body` (0) | Let browser `kern` work, do not tighten body |
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

- **Display:** Fraunces variable (`font-display`, SOFT 50), hero h1, section h2, logo
- **Body:** Source Sans 3 400/500/600/700 (`font-sans`), UI, paragraphs, forms
- **Mono:** IBM Plex Mono 400/500, grades, labels, code blocks

Enable: `font-feature-settings: "kern" 1, "liga" 1, "calt" 1` + `font-optical-sizing: auto`

**Avoid:** Instrument Serif, DM Sans, Inter, generic startup stacks. Do not tighten body tracking.

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

**Anti-pattern:** Same radius on parent and padded child, creates pinched corners.

Apply `rounded-t-[var(--radius-nested-md)]` on full-bleed card headers when outer is `--radius-card`.

## App shell (dashboard, billing, settings)

- Wrap pages in `Container` + `PageHeader`
- Raised panels: `surface-raised rounded-xl p-6 shadow-card` — not `rounded-xl border`
- Settings nav: `SETTINGS_NAV` in `lib/site/nav.ts`

## Shared constants

- Audit area order: `AREA_ORDER` from `lib/audit/constants.ts` (UI, judge repair, MCP)

## Component defaults

- **Upsells / upgrade cards:** `surface-raised` or `shadow-card`, not `border-2 border-primary/20`
- **Buttons:** pill (`rounded-full`), primary = ink, outline = border
- **Inputs (audit):** pill, exception to 6px rule (signature pattern)
- **Cards:** `--radius-card`, shadow over heavy borders
- **Grade badges:** `--radius-inner`, tabular nums

## Dual-token accent (links vs brand)

- **`--link` / `--focus-ring`**: slate-blue, text links, keyboard focus (never brand)
- **`--brand`**: refined ochre (~45% sat), CTAs, scores, badges only
- Use `TextLink` for inline links; `Button` primary for CTAs

## Layout grid

- `Container` variants: `default` (1280px), `prose` (720px), `report` (896px)
- `PageGrid` 12-col: `text` (7), `card` (5), `intro`/`content` splits
- Section titles align to same container left edge, no orphan `max-w-2xl` on outer Container

## Calm by default + progressive disclosure

- **Above the fold:** one primary action + one proof block; hide detail behind expand/chevron
- **Surfaces:** prefer `Surface` (`elevated` / `nested`) or `border-0 shadow-card` over bordered panels
- **Motion:** `--motion-fast` (200ms) + `--ease-out` for hovers; match buttons, nav, cards
- **Header offset:** use `top-[var(--header-offset)]` for sticky report nav, banners, scroll anchors
- **Filter pills:** reuse `FilterPill` for examples, report mini-nav, FAQ anchors

## Pre-ship checklist

- [ ] Headings use balance wrap; body uses pretty wrap
- [ ] Only uppercase labels have wide tracking
- [ ] Nested rounded elements use concentric formula
- [ ] Brand amber appears ≤5 times above the fold
- [ ] Focus rings use `--ring` (brand), never removed
- [ ] Numbers in scores use `tabular-nums`

## Companion skills

- `color-theory`, palette validation, contrast, harmony
- `make-interfaces-feel-better`, concentric radius, shadows, micro-interaction
- `ui-craft`, anti-slop, craft knobs
- `web-design-guidelines`, a11y compliance audit
