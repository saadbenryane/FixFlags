---
name: fixflags-design-system
description: FixFlags visual design tokens, kerning, spacing, border radius, 60-30-10 color theory, typography scale. Use when building or polishing any FixFlags UI, marketing page, or component. Triggers on typography, spacing, colors, border radius, kerning, design tokens, or "make it feel designed."
---

# FixFlags Design System

UI Kit v3.0. Tokens: `lib/design/tokens.css`. Brand hex: `lib/design/brand-spec.ts`. Rules: `lib/design/brand-rules.md`.

## Color theory (60-30-10)

| Share | Token | Role |
|-------|-------|------|
| 60% | Peach mesh backdrop + glass surfaces | Page canvas, cards |
| 30% | `--foreground` | Ink structure, headings |
| 10% | `--brand` (`#FF4D1F`) | CTAs, flags, scores, focus |

**Rules:**
- Brand is Flag orange `#FF4D1F`, hover `#FF744D`
- Links use `--link` (info blue `#3B82F6`), not brand orange
- Focus rings use brand orange on inputs
- Dark mode is re-authored (`#0F1115` canvas), orange unchanged
- Cards: `rounded-card` + `glass-surface` + `shadow-card` — **no borders**

## Typography — Satoshi

| Role | Font | Use |
|------|------|-----|
| All UI + marketing headings | Satoshi (`font-sans`) | H1–body, logo wordmark |
| Scores / labels | IBM Plex Mono (`font-mono`) | Grades, tabular nums |

**Avoid:** Fraunces, Inter, DM Sans on new work.

## Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-pill` | 9999px | Buttons, inputs, selects |
| `--radius-card` | 12px | Glass cards, panels |

**Required:** `rounded-full` on all buttons and inputs.
**Anti-pattern:** `rounded-md` on controls (legacy v2).

## Page canvas

- Global peach mesh: `GlobalMeshBackdrop` in `SiteShell`
- Cards use `.glass-surface` or `.glass-surface-elevated` — frosted, borderless
- Hero URL input: concentric pill group (`InputGroup` + `AuditInput` landing variant)

## Logo

- Component: `components/brand/Logo.tsx` — variants `mark`, `wordmark`, `lockup`
- SVG assets: `public/brand/`
- Mark: four ink bars (short·tall · tall·short) flanking one orange pole that flies a right-pointing flag

## Dual-token accent

- **`--link`**: info blue for inline links (`TextLink`)
- **`--brand`**: orange for CTAs, scores, flagged states
- **`--focus-ring`**: brand orange

## Rebrand file layout

| File | Purpose |
|------|---------|
| `lib/design/tokens.css` | CSS variables (light + `.dark`) |
| `lib/design/brand-spec.ts` | Hex for OG, email, manifest |
| `lib/design/fonts.ts` | Satoshi + IBM Plex Mono |
| `lib/design/og-templates.tsx` | OG + favicon |
| `lib/design/logo-mark.tsx` | Flag-bar SVG |
| `components/brand/Logo.tsx` | Logo component |

**Rule:** No raw hex in components. Use Tailwind semantic tokens or `brand-spec.ts`.

## Pre-ship checklist

- [ ] Headings use `font-sans`, balance wrap on h1–h2
- [ ] Primary buttons: orange, `rounded-full`
- [ ] Inputs and selects: `rounded-full`, borderless or glass fill
- [ ] Cards: frosted glass, no borders
- [ ] Brand orange ≤5× above fold on marketing
- [ ] Focus rings on all interactive elements
- [ ] Scores use `font-mono tabular-nums`
- [ ] Logo lockup in header (light/dark SVG swap)

## Companion skills

- `fixflags-design-philosophy`, the *why* (NN/g + Apple HIG) + pre-ship review rubric
- `color-theory`, palette validation, contrast
- `make-interfaces-feel-better`, shadows, micro-interaction
- `ui-craft`, anti-slop
- `fixflags-marketing/lean-visual.md`
