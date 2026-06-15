# Lean visual (marketing + product)

Use with `qualityos-design-system` and `writing-simple.md`.

## Depth without borders

| Use | Avoid |
|-----|-------|
| `shadow-card` on raised surfaces | `border border-border` on cards |
| `bg-muted/35` section alternation | `border-y border-border` section dividers |
| Spacing (`gap-10`, `py-16`) for rhythm | Decorative lines between workflow steps |
| `--shadow-raised` on hero proof card | Grid backgrounds, blur halos, rotated cards |

**Borders reserved for:** form inputs, data table row separators (30% opacity max), focus rings.

## App surfaces (dashboard, billing, settings)

- `Container` + `PageHeader` for page chrome
- `surface-raised shadow-card` for panels — not bordered card wrappers
- Upsells: shadow-first (`ContextualUpgradeCard`), never `border-2 border-primary/20`

## Palette (2026 lean)

| Token | Role |
|-------|------|
| `--background` | Warm paper white (42° hue) |
| `--foreground` | Warm ink |
| `--muted` | Section wash, not gray slab |
| `--brand` | Refined ochre (28° 62% 37%), not neon amber |
| `--accent` | Soft wash for hero radial only |

Test hierarchy in grayscale. Brand appears ≤3 times above the fold.

## Typography + copy pairing

- Display serif for headlines only
- Body stays Source Sans, never tightened
- Section labels optional, drop when headline is enough
- Pain/workflow blocks: title + one line. No icons unless semantic.

## Marketing page structure (lean)

1. Hero, pitch + input + proof card
2. Mechanism, 3 steps, no cards
3. Problem, 3 columns, no boxes
4. Workflow, numbered, no connector line
5. Proof / pricing / FAQ, shadow cards only where needed

Cut any section that repeats the hero promise.

## Pre-ship visual checklist

- [ ] No `border-y` on marketing sections
- [ ] Cards use `border-0 shadow-card`
- [ ] No checkmark pill rows
- [ ] No left accent stripes on pain cards
- [ ] Section labels removed unless necessary
- [ ] Copy under word budgets in writing-simple.md
