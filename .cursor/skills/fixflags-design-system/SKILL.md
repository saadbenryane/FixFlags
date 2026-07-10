---
name: fixflags-design-system
description: FixFlags visual design tokens, kerning, spacing, border radius, 60-30-10 color theory, typography scale. Use when building or polishing any FixFlags UI, marketing page, or component. Triggers on typography, spacing, colors, border radius, kerning, design tokens, or "make it feel designed."
---

# FixFlags Design System

Final Brand Guideline. Tokens: `lib/design/tokens.css`. Brand hex: `lib/design/brand-spec.ts`. Rules: `lib/design/brand-rules.md`.

## Color theory (60-30-10)

| Share | Token | Role |
|-------|-------|------|
| 60% | Warm-white canvas + soft-stone glass surfaces | Page canvas, cards |
| 30% | `--foreground` (Ink `#080808`) | Ink structure, headings |
| 10% | `--brand` (`#FF4B00`) | CTAs, flags, scores, focus |

**Rules:**
- Brand is Flag orange `#FF4B00`. Orange is a signal, not decoration. Never everywhere.
- Canvas is Warm White `#FAF8F4`; cards/panels/dividers are Soft Stone `#EEEAE3`; secondary text is Muted Grey `#6D6A64`.
- Links use `--link` (info blue `#3B82F6`), not brand orange
- Focus rings use brand orange on inputs
- Dark mode is re-authored (Graphite `#111111` canvas, Charcoal `#1A1A1A` panels, soft-white `#F5F3EF` text), orange unchanged
- Cards: `rounded-card` + `glass-surface` + `shadow-card` — **no borders**

## Typography: Fraunces serif + Satoshi sans

| Role | Font | Use |
|------|------|-----|
| Headlines + logo wordmark | Fraunces (`font-serif` / `font-display`) | Hero, section titles, brand voice (serif) |
| Product UI + body + labels | Satoshi (`font-sans`) | Dense report/table/settings views (sans only) |
| Scores / labels | IBM Plex Mono (`font-mono`) | Grades, tabular nums |

**Rule:** editorial serif for headlines, clean sans for functional UI. Never serif dense product UI.

## Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-pill` | 9999px | Buttons, inputs, selects |
| `--radius-card` | 1.716rem | Glass cards, panels |
| `--radius-nested-md` | outer − 0.75rem gap | Inner shells inside `rounded-card` with ~12px padding |
| `--radius-nested-lg` | outer − 1rem gap | Inner shells inside `rounded-card` with 16px+ padding |

**Required:** `rounded-full` on all buttons and inputs.
**Anti-pattern:** `rounded-md` on controls (legacy v2).

**Nested prompts:** When `FixPromptBlock` or `TerminalShell` sits inside a `rounded-card` parent (hero sample, audit cards, report fix section), pass `nested` so the outer shell uses `rounded-nested-lg` — concentric corners per `inner = outer − gap` in `tokens.css`.

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
