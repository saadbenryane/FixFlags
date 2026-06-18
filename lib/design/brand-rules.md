# FixFlags Brand Rules - UI Kit v3.0

Source: brand assets June 2026. Reference files in `public/brand/incoming/`.

## Identity

- **Name:** FixFlags
- **Mark:** Equalizer with a flag at center. Pattern (L→R): short bar, tall bar, orange flagpole, tall bar, short bar - four ink bars flanking one orange pole. The pole is tallest, extends below the bars, and flies a right-pointing pennant from its top.
- **Wordmark:** Satoshi Bold, title case `FixFlags`, tracking -0.02em
- **Tagline:** FLAG ISSUES. **FOCUS** WHAT MATTERS. (FOCUS in Flag orange)

## Color palette (moodboard v3.0)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| Flag (primary) | `#FF4D1F` | `#FF4D1F` | CTAs, flags, scores, focus rings |
| Flag hover | `#FF744D` | `#FF744D` | Button hover |
| Background | Peach mesh gradient | Dark peach mesh | Page canvas (global backdrop) |
| Foreground | `#0F1115` (Ink) | `#FFFFFF` | Headings, body |
| Graphite | - | `#1E1F23` | Dark solid surfaces (terminal) |
| Steel | `#687380` | `#2A2D33` | Light muted text / dark muted surface |
| Mist | `#A3A7AE` | `#A3A7AE` | Dark muted text |
| Border | `#E5E7EB` | `#1E1F23` | Dividers, tables (not cards) |
| Success | `#22C55E` | `#22C55E` | Grade A, fixed states |
| Warning | `#FACC15` | `#FACC15` | Warnings |
| Error | `#FF4444` | `#FF4444` | Destructive, grade F |
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

- **Buttons & inputs:** `rounded-full` (pill) — required for all CTAs and form controls
- **Input groups:** outer pill + concentric inner pill button with uniform `p-1.5` inset
- **Cards & panels:** `rounded-card` (12px) frosted glass — no borders; use `shadow-card` + blur
- **Page canvas:** global peach mesh backdrop (`PeachyMeshBackdrop` / `GlobalMeshBackdrop`)
- **Nav:** sticky glass header (`glass-surface-elevated`), no bottom border

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

Re-authored, not inverted. Orange stays `#FF4D1F`. Bars and text flip to white on dark surfaces. Glass surfaces use dark-tinted frosted fills.
