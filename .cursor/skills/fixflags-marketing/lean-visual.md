# Lean visual (marketing + product)

Use with `fixflags-design-system` and `writing-simple.md`.

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
- `Card` or `Surface variant="elevated"` for panels — not bordered card wrappers
- Upsells: shadow-first (`ContextualUpgradeCard`), never `border-2 border-primary/20`

## Palette (Final Brand Guideline)

| Token | Role |
|-------|------|
| `--background` | Warm White (`#FAF8F4`) |
| `--foreground` | Ink (`#080808`) |
| `--muted` / `--card` | Soft Stone (`#EEEAE3`) section wash + panels |
| `--muted-foreground` | Muted Grey (`#6D6A64`) secondary text |
| `--brand` | Flag orange (`#FF4B00`), signal only |
| `--accent` | Soft wash for hero radial only |

Test hierarchy in grayscale. Brand appears ≤3 times above the fold. Orange is a signal, not decoration.

## Typography + copy pairing

- Fraunces serif for headlines + wordmark (`font-serif` / `font-display`); Satoshi sans for all product UI, body, and labels
- Body stays readable; never tightened below token scale
- Section labels optional, drop when headline is enough
- Pain/workflow blocks: title + one line. No icons unless semantic.

## Marketing page structure (lean)

1. Hero — pitch, URL input, **one** product preview (sample label above preview)
2. Logo cloud — compact editor marks directly below hero report
3. Three dimensions — Message, Experience, Reach with checklist bullets + one example finding each
4. Grades + loop — vertical rubric scores beside scan → flag → fix → verify; link to full sample
5. Social proof — example feedback with visible disclaimer; no unverifiable member counts
6. Final CTA — repeat URL input + trust badges; outcome-led headline from `FINAL_CTA`

**Never** duplicate the interactive report explorer below the hero. Cut any section that repeats the hero promise.

## Pre-ship visual checklist

- [ ] No `border-y` on marketing sections
- [ ] Cards use `border-0 shadow-card`
- [ ] No checkmark pill rows
- [ ] No left accent stripes on pain cards
- [ ] Section labels removed unless necessary
- [ ] Copy under word budgets in writing-simple.md
