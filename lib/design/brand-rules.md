# FixFlags Brand Rules - UI Kit v2.0

Source: brand assets June 2026. Reference files in `public/brand/incoming/`.

## Identity

- **Name:** FixFlags
- **Mark:** Seven-bar equalizer (short, tall, short, orange flagpole, short, tall, short). Center Flag bar is tallest, extends below the others, flag points up-right.
- **Wordmark:** Satoshi Bold, title case `FixFlags`, tracking -0.02em
- **Tagline:** FLAG ISSUES. **FOCUS** WHAT MATTERS. (FOCUS in Flag orange)

## Color palette (moodboard v2.0)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| Flag (primary) | `#FF4D2E` | `#FF4D2E` | CTAs, flags, scores, focus rings |
| Flag hover | `#FF744D` | `#FF744D` | Button hover |
| Background | `#FFFFFF` | `#0B0B0D` (Ink) | Page canvas |
| Foreground | `#0B0B0D` (Ink) | `#FFFFFF` | Headings, body |
| Graphite | — | `#1E1F23` | Dark cards / surfaces |
| Steel | `#6B7178` | `#2A2D33` | Light muted text / dark muted surface |
| Mist | `#A3A7AE` | `#A3A7AE` | Dark muted text |
| Border | `#E5E7EB` | `#1E1F23` | Inputs, dividers |
| Success | `#22C55E` | `#22C55E` | Grade A, fixed states |
| Warning | `#FACC15` | `#FACC15` | Warnings |
| Error | `#EF4444` | `#EF4444` | Destructive, grade F |
| Info / links | `#3B82F6` | `#3B82F6` | Inline links |

Accent usage: use Flag orange sparingly for flags, highlights, and critical states.

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

Re-authored, not inverted. Orange stays `#FF4D2E`. Bars and text flip to white on dark surfaces.
