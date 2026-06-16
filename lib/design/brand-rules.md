# FixFlags Brand Rules - UI Kit v2.0

Source: brand assets June 2026. Reference files in `public/brand/incoming/`.

## Identity

- **Name:** FixFlags
- **Mark:** Five vertical bars; center bar is orange with flag tip
- **Wordmark:** Satoshi Bold, title case `FixFlags`
- **Tagline:** FLAG ISSUES. **FOCUS** WHAT MATTERS. (FOCUS in brand orange)

## Color palette

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| Primary | `#FF4D1F` | `#FF4D1F` | CTAs, flags, scores, focus rings |
| Primary hover | `#FF744D` | `#FF744D` | Button hover |
| Background | `#FFFFFF` | `#0F1115` | Page canvas |
| Foreground | `#0F1115` | `#FFFFFF` | Headings, body |
| Muted text | `#5B7380` | `#8B9BAA` | Secondary copy |
| Border | `#E5E7EB` | `#1C1F26` | Inputs, dividers |
| Surface | `#FFFFFF` | `#1C1F26` / `#2A2F3A` | Cards |
| Success | `#22C55E` | `#22C55E` | Grade A, fixed states |
| Warning | `#FACC15` | `#FACC15` | Warnings |
| Error | `#EF4444` | `#EF4444` | Destructive, grade F |
| Info / links | `#3B82F6` | `#3B82F6` | Inline links |

60-30-10: neutrals dominate, ink structure, orange accent sparingly above fold.

## Typography - Satoshi

| Role | Size | Weight |
|------|------|--------|
| Display | 56px | 400–500 |
| H1 | 32px | 500 |
| H2 | 24px | 600 |
| H3 | 20px | 700 |
| Body | 16px | 400 |
| Caption | 12px | 400 |

Mono (IBM Plex): scores, grades, labels only.

## Radius & components

- Buttons: `rounded-md` (6px), primary orange fill
- Inputs: `rounded-md`, orange border on focus
- Cards: 12px radius, light border + shadow
- Nav: flat header with bottom border (not glass pill)

## File layout

| File | Purpose |
|------|---------|
| `lib/design/tokens.css` | CSS variables |
| `lib/design/brand-spec.ts` | Hex for OG, email, manifest |
| `lib/design/fonts.ts` | Satoshi local + IBM Plex Mono |
| `lib/design/logo-mark.tsx` | Flag-bar SVG component |
| `lib/design/og-templates.tsx` | OG + favicon |
| `public/brand/*.svg` | Logo assets |
| `public/fonts/Satoshi-*.woff2` | Self-hosted fonts |

## Dark mode

Re-authored, not inverted. Orange stays `#FF4D1F`. Bars and text flip to white on dark surfaces.
