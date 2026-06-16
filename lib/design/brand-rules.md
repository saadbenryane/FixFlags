# FixFlags Brand Rules

Extracted from current design tokens and placeholder assets. Replace when reference images land in `public/brand/incoming/`.

## Identity

- **Name:** FixFlags (unchanged)
- **Mark:** Ochre rounded square with "Fi" monogram (`public/brand/mark-*.svg`)
- **Wordmark:** Fraunces-style serif "FixFlags" (`public/brand/wordmark-*.svg`)

## Color (60-30-10)

| Share | Role | Light | Dark |
|-------|------|-------|------|
| 60% | Surfaces | Warm paper `#fefcfa` | Ink `#0f0d0c` |
| 30% | Structure | Ink `#1e1b17` | Paper `#f5f2ed` |
| 10% | Accent | Ochre `#7a5c38` | Ochre `#c49a5a` |

- **Links:** Slate-blue (`--link`), never brand ochre
- **Grades:** A=success green, B=lime, C=brand ochre, D=orange, F=red
- **Dark mode:** Re-authored in `tokens.css`, not inverted light

## Typography

| Role | Font | Token |
|------|------|-------|
| Display | Fraunces | `font-display` |
| Body | Source Sans 3 | `font-sans` |
| Mono | IBM Plex Mono | `font-mono` |

## Radius & depth

- Cards: `--radius-card` (20px), `shadow-card`, borderless
- Buttons: pill (`rounded-full`)
- Nested elements: concentric formula (`inner = outer - gap`)

## File layout

| File | Purpose |
|------|---------|
| `lib/design/tokens.css` | CSS variables (light + dark) |
| `lib/design/brand-spec.ts` | Hex palette for OG, email, manifest |
| `lib/design/fonts.ts` | next/font loaders |
| `lib/design/og-templates.tsx` | Shared OG/favicon layouts |
| `components/brand/Logo.tsx` | Logo component |
| `public/brand/` | SVG assets |

## Accent usage

- Brand ochre: CTAs, scores, grade C, max ~5× above fold on marketing
- Never second accent hue on marketing pages
- Focus rings: `--focus-ring` (slate-blue)

## Swapping assets (Phase 2+)

1. Drop new SVGs into `public/brand/` (same filenames)
2. Update HSL values in `tokens.css` and `brand-spec.ts`
3. Update `lib/design/fonts.ts` if typography changes
4. Run visual QA on homepage, report, dashboard (light + dark)
