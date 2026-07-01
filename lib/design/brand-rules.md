# FixFlags Brand Rules — Final Brand Guideline

Source: FixFlags Final Branding Guideline. Reference assets in `public/brand/`.

## Identity

- **Name:** FixFlags
- **One-liner:** FixFlags is the QA layer for AI-built products.
- **Campaign line:** Finish what your AI started.
- **Product loop:** Flag → Fix → Re-check.
- **Mark:** A clean waving flag — a rounded orange flagpole flying a soft wavy pennant to the right. Flat (reduced 3D), optically balanced curves. Icon-left, wordmark-right lockup.
- **Wordmark:** Editorial serif (Fraunces), title case `FixFlags`, medium weight, tracking ~-0.01em.

## Color palette (Final Guideline)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| Flag (primary) | `#FF4B00` | `#FF5C1A` | Flags, CTAs, active states, focus rings — signal, not decoration |
| Flag hover | tint of primary | tint of primary | Button hover |
| Background | Warm White `#FAF8F4` | Graphite `#111111` | Page canvas |
| Foreground | Ink `#080808` | Soft White `#F5F3EF` | Headings, body |
| Card / panel | Soft Stone `#EEEAE3` | Deep Charcoal `#1A1A1A` | Cards, panels, dividers, glass layers |
| Muted text | Muted Grey `#6D6A64` | Muted Dark `#A7A29A` | Secondary text |
| Glass | warm-white translucent | `rgba(255,255,255,0.06)` | Frosted glass surfaces |
| Border | Stone `#E6E1D8` | `#292929` | Dividers, tables (not cards) |
| Success | `#22C55E` | `#22C55E` | Grade A, fixed states |
| Warning | `#FACC15` | `#FACC15` | Warnings |
| Error | `#FF4444` | `#FF4444` | Destructive, grade F |
| Info / links | `#3B82F6` | `#3B82F6` | Inline links |

Accent usage: orange is a signal. Use sparingly — flags, primary CTA, issue markers, active states, small highlights, blurred background accents. The overall world is warm white, stone, ink, soft grey, controlled orange. Dark mode reads graphite, glass, quiet, premium — no neon.

## Typography — Fraunces (serif) + Satoshi (sans)

Editorial serif headlines + clean sans UI. This is the signature balance.

| Role | Family | Notes |
|------|--------|-------|
| Wordmark | Fraunces | Medium, ~-0.01em |
| Hero / display headlines | Fraunces | Medium/Semibold, serif |
| Section titles | Fraunces | Serif, used sparingly for premium effect |
| Product UI / body / labels | Satoshi | Sans only — clarity in dense report/table/settings views |
| Scores / grades / caps labels | IBM Plex Mono | Mono |

Serif for brand voice and marketing headlines; sans for everything functional. Never serif dense product UI.

## Radius & components

- **Buttons & inputs:** `rounded-full` (pill). Required for all CTAs and form controls.
- **Input groups:** outer pill + concentric inner pill button with uniform `p-1.5` inset.
- **Cards & panels:** `rounded-card` (~27px) frosted glass on soft stone. No borders; use `shadow-card` + blur.
- **Page canvas:** warm-white mesh backdrop (`GlobalMeshBackdrop` in `SiteShell`).
- **Nav:** sticky glass header (`glass-surface-elevated`), no bottom border.

Use glass tastefully for premium moments (hero cards, sample reports, overlays, modals, pricing). Use cleaner surfaces for dense reports, tables, technical details, settings.

## Report design system

The report is the product's main brand asset. Issue card order: severity/score → screenshot evidence → plain-English flag → why it matters → fix prompt → technical detail → re-check status.

Product language: **Flags** (Critical / UX / SEO / Performance / Accessibility / Trust / Resolved). Use "issues" only when clarity demands it.

## Voice

Calm senior product reviewer. Clear, direct, useful, specific; technical when needed. Show the fix, not just the problem. Avoid: "AI-powered insights", "optimization suite", "unlock growth", "revolutionary", "comprehensive platform", "actionable recommendations", "seamless experience".

## File layout

| File | Purpose |
|------|---------|
| `lib/design/tokens.css` | CSS variables (source of truth) |
| `lib/design/brand-spec.ts` | Hex for OG, email, manifest |
| `lib/design/fonts.ts` | Fraunces serif + Satoshi local + IBM Plex Mono |
| `lib/design/logo-mark.tsx` | Waving-flag SVG component |
| `lib/design/og-templates.tsx` | OG + favicon |
| `public/brand/*.svg` | Logo assets (mark + wordmark) |
| `public/fonts/Satoshi-*.woff2` | Self-hosted UI font |

## Dark mode

Re-authored, not inverted. Graphite canvas, charcoal panels, glass surfaces. Orange stays the signal. Text is soft white. No neon hacker look.
