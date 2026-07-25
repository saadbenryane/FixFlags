# Lean visual checklist (marketing + report surfaces)

Short surface-specific rules. Full tokens: `fixflags-design-system/SKILL.md`.

## Cards and panels

- Outer shells: `border-0 shadow-card glass-surface rounded-card`
- Nested content inside padded cards: `rounded-nested-md` or `rounded-nested-sm` (concentric radii)
- Never hand-roll `rounded-lg border bg-*` panels — use `Card`, `Surface`, or `Callout`

## Controls

- Inputs, selects, textareas: `rounded-full` + glass fill via `components/ui/*` primitives
- Primary CTAs: brand orange, `rounded-full`

## Typography

- Marketing headlines: Inter Tight (`font-display` / `font-serif` alias)
- Functional UI, forms, report tables: Inter (`font-sans`)
- Grades and scores: JetBrains Mono (`font-mono tabular-nums`)

## Report + marketing polish

- Use semantic tokens (`bg-card`, `text-brand`, `border-border-subtle`) — no raw hex except `grade.*`
- Error/empty states: `Callout` or `EmptyState`, never silent failures
- API fetch errors: `parseApiErrorResponse` from `lib/api/parse-error.ts`

## Pre-ship (marketing page)

- [ ] Hero uses editorial serif; body uses sans
- [ ] Pill inputs via `AuditInput` or `Input` primitive
- [ ] Cards are borderless glass
- [ ] Copy from `lib/marketing/copy.ts` only
- [ ] No banned phrases (see AGENTS.md)
