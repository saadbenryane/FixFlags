# FixFlags Brand Rules: Brand sheet 2026-07

Source: FixFlags brand guidelines. Reference assets in `public/brand/`.

## Identity

- **Name:** FixFlags
- **One-liner:** Finish what your AI started.
- **Campaign line:** Finish what your AI started.
- **Product loop:** Flag → Fix → Re-check.
- **Mark:** Official geometric folded-F from brand sheet raster (`public/brand/logo-mark.png`). Do not regenerate or invent SVG geometry. Icon-left, Inter Tight wordmark-right lockup via `components/brand/Logo.tsx`.
- **Wordmark:** Inter Tight, title case `FixFlags`, Fix heavier than Flags, tracking ~-0.02em.

## Color palette

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| Flag (primary) | `#FF5A00` | `#FF5C1A` | Flags, marketing CTAs, active states, focus rings. Signal, not decoration |
| Flag hover | tint of primary | tint of primary | Button hover |
| Background | White `#FFFFFF` | Ink `#0B0B0D` | Page canvas |
| Foreground | Ink `#0B0B0D` | Soft White `#F5F6F7` | Headings, body |
| Card / panel | Stone `#F5F6F7` | Gray 800 `#1D2024` | Cards, panels, dividers, glass layers |
| Muted text | Gray 600 `#61646B` | Gray 400 `#A7A8B2` | Secondary text |
| Glass | white translucent | `rgba(255,255,255,0.06)` | Frosted glass surfaces |
| Border | Gray 200 `#E6E6E8` | `#2A2C30` | Dividers, tables, control borders |
| Success | `#22C55E` | `#22C55E` | Grade A, fixed states |
| Warning | `#FACC15` | `#FACC15` | Warnings |
| Error | `#FF4444` | `#FF4444` | Destructive, grade F |
| Info / links | `#3B82F6` | `#3B82F6` | Inline links |

Accent usage: orange is a signal. Use sparingly: flags, marketing CTAs, issue markers, active states. Product primary CTAs use ink on light mode. Dark mode primary CTAs use orange.

## Typography: Inter Tight (display) + Inter (sans)

| Role | Family | Notes |
|------|--------|-------|
| Wordmark | Inter Tight | Semibold/Bold, ~-0.02em |
| Hero / display headlines | Inter Tight | Semibold/Bold |
| Section titles | Inter Tight | Semibold |
| Product UI / body / labels | Inter | Sans for clarity in dense report/table/settings views |
| Scores / grades / caps labels | JetBrains Mono | Mono |

Display for brand voice and marketing headlines; Inter for everything functional. Never use display weight in dense product tables.

## Radius & components

- **Buttons & inputs:** `rounded-[var(--radius-control)]` (~10px). Required for all CTAs and form controls.
- **Filter chips / avatars / switches:** may remain fully round as geometric shapes.
- **Cards & panels:** `rounded-card` (~24px) frosted glass on stone. Prefer shadow over heavy borders.
- **Page canvas:** quiet mesh backdrop (`GlobalMeshBackdrop` in `SiteShell`).
- **Nav:** sticky glass header (`glass-surface-elevated`), no bottom border.

Use glass tastefully for premium moments (hero cards, sample reports, overlays, modals, pricing). Use cleaner surfaces for dense reports, tables, technical details, settings.

## Report design system

The report is the product's main brand asset. Issue card order: severity/score → plain-English flag → why it matters → screenshot evidence → fix prompt → technical detail → re-check status.

Product language: **Flags**. Use "issues" only when clarity demands it. Core loop: Flag → Fix → Re-check.

## Voice

Calm senior product reviewer. Clear, direct, useful, specific; technical when needed. Show the fix, not just the problem. Avoid: "AI-powered insights", "optimization suite", "unlock growth", "revolutionary", "comprehensive platform", "actionable recommendations", "seamless experience".

## File layout

| File | Purpose |
|------|---------|
| `lib/design/tokens.css` | CSS variables (source of truth) |
| `lib/design/brand-spec.ts` | Hex for OG, email, manifest |
| `lib/design/fonts.ts` | Inter Tight display + Inter + JetBrains Mono |
| `lib/design/logo-mark.tsx` | Flag mark SVG component |
| `lib/design/og-templates.tsx` | OG + favicon |
| `public/brand/*` | Logo assets (mark + lockups + wordmarks) |

## Dark mode

Fully re-authored graphite/ink surfaces. Orange remains the precise accent. No neon.
