---
name: fixflags-design-system
description: FixFlags visual design tokens, kerning, spacing, border radius, 60-30-10 color theory, typography scale. Use when building or polishing any FixFlags UI, marketing page, or component. Triggers on typography, spacing, colors, border radius, kerning, design tokens, or "make it feel designed."
---

# FixFlags Design System

UI Kit v2.0. Tokens: `lib/design/tokens.css`. Brand hex: `lib/design/brand-spec.ts`. Rules: `lib/design/brand-rules.md`.

## Color theory (60-30-10)

| Share | Token | Role |
|-------|-------|------|
| 60% | `--background`, `--muted` | White / dark surfaces |
| 30% | `--foreground` | Ink structure, headings |
| 10% | `--brand` (`#FF4D1F`) | CTAs, flags, scores, focus |

**Rules:**
- Brand is Flag orange `#FF4D1F`, hover `#FF744D`
- Links use `--link` (info blue `#3B82F6`), not brand orange
- Focus rings use brand orange on inputs
- Dark mode is re-authored (`#0F1115` canvas), orange unchanged
- Cards: `rounded-card` + border + `shadow-card`

## Typography — Satoshi

| Role | Font | Use |
|------|------|-----|
| All UI + marketing headings | Satoshi (`font-sans`) | H1–body, logo wordmark |
| Scores / labels | IBM Plex Mono (`font-mono`) | Grades, tabular nums |

**Avoid:** Fraunces, Inter, DM Sans on new work.

## Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-input` | 6px | Buttons, inputs |
| `--radius-card` | 12px | Cards, panels |

**Anti-pattern:** `rounded-full` on buttons (legacy). Use `rounded-md`.

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
- [ ] Primary buttons: orange, `rounded-md`
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
