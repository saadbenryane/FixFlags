# FixFlags Design System

**Read `AGENTS.md` first.** Tokens: `lib/design/tokens.css`. Brand hex: `lib/design/brand-spec.ts`.

## Color theory (60-30-10)

| Share | Token | Role |
|-------|-------|------|
| 60% | Warm-white canvas + soft-stone glass surfaces | Page canvas, cards |
| 30% | `--foreground` (Ink `#080808`) | Ink structure, headings |
| 10% | `--brand` (`#FF4B00`) | CTAs, flags, scores, focus |

**Rules:**
- Brand is Flag orange `#FF4B00`. Orange is a signal, not decoration.
- Canvas is Warm White `#FAF8F4`; cards are Soft Stone `#EEEAE3`
- Links use `--link` (info blue), not brand orange
- Focus rings use brand orange on inputs
- Cards: `rounded-card` + `glass-surface` + `shadow-card` -- no borders

## Typography

| Role | Font | Use |
|------|------|-----|
| Headlines | Fraunces (`font-serif`) | Hero, section titles |
| Product UI | Satoshi (`font-sans`) | All functional text |
| Scores/labels | IBM Plex Mono (`font-mono`) | Grades, tabular nums |

## Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-pill` | 9999px | Buttons, inputs, selects |
| `--radius-card` | 1.716rem | Glass cards, panels |
| `--radius-nested-md` | outer - 0.75rem | Inner shells with ~12px padding |

## Rules

- `rounded-full` on ALL buttons and inputs
- No raw hex in components -- use Tailwind tokens or `brand-spec.ts`
- No em dashes in source code (use `--`)
- All marketing copy from `lib/marketing/copy.ts`
- Respect `prefers-reduced-motion`

## Anti-patterns

- `rounded-md` on controls (legacy v2)
- `font-bold` on page titles (use `PageTitle`)
- Purple gradients, generic 3-card grids
- Inter, DM Sans, Roboto (non-brand fonts)
