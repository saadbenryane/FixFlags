---
name: fixflags-design-system
description: FixFlags visual design tokens, kerning, spacing, border radius, 60-30-10 color theory, typography scale. Use when building or polishing any FixFlags UI, marketing page, or component. Triggers on typography, spacing, colors, border radius, kerning, design tokens, or "make it feel designed."
---

# FixFlags Design System

**Read [`AGENTS.md`](../../AGENTS.md) first** for architecture counts. Tokens: `lib/design/tokens.css`. Brand hex: `lib/design/brand-spec.ts`. Rules: `lib/design/brand-rules.md`.

## Color theory (60-30-10)

| Share | Token | Role |
|-------|-------|------|
| 60% | Warm-white canvas + soft-stone glass surfaces | Page canvas, cards |
| 30% | `--foreground` (Ink `#080808`) | Ink structure, headings |
| 10% | `--brand` (`#FF4B00`) | CTAs, flags, scores, focus |

**Rules:**
- Brand is Flag orange `#FF4B00`. Orange is a signal, not decoration. Never everywhere.
- Canvas is Warm White `#FAF8F4`; cards/panels/dividers are Soft Stone `#EEEAE3`; secondary text is Muted Grey `#6D6A64`.
- Links use `--link` (info blue `#3B82F6`), not brand orange
- Focus rings use brand orange on inputs
- Dark mode is re-authored (Graphite `#111111` canvas, Charcoal `#1A1A1A` panels, soft-white `#F5F3EF` text), orange unchanged
- Cards: `rounded-card` + `glass-surface` + `shadow-card` — **no borders**

## Typography: Fraunces serif + Satoshi sans

| Role | Font | Use |
|------|------|-----|
| Headlines + logo wordmark | Fraunces (`font-serif` / `font-display`) | Hero, section titles, brand voice (serif) |
| Product UI + body + labels | Satoshi (`font-sans`) | Dense report/table/settings views (sans only) |
| Scores / labels | IBM Plex Mono (`font-mono`) | Grades, tabular nums |

**Rule:** editorial serif for headlines, clean sans for functional UI. Never serif dense product UI.

## Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-pill` | 9999px | Buttons, inputs, selects |
| `--radius-card` | 1.716rem | Glass cards, panels |
| `--radius-nested-md` | outer − 0.75rem gap | Inner shells inside `rounded-card` with ~12px padding |
| `--radius-nested-lg` | outer − 1rem gap | Inner shells inside `rounded-card` with 16px+ padding |

**Required:** `rounded-full` on all buttons and inputs.
**Anti-pattern:** `rounded-md` on controls (legacy v2).

**Nested prompts:** When `FixPromptBlock` or `TerminalShell` sits inside a `rounded-card` parent (hero sample, audit cards, report fix section), pass `nested` so the outer shell uses `rounded-nested-lg` — concentric corners per `inner = outer − gap` in `tokens.css`.

## Page canvas

- Global peach mesh: `GlobalMeshBackdrop` in `SiteShell`
- Marketing (`intensity="full"`): brand glow + warm depth only — **no grid/dot layer behind hero** (grid is `minimal` app/admin only; see `DESIGN.md`)
- Cards use `.glass-surface` or `.glass-surface-elevated` — frosted, borderless
- Hero URL input: concentric pill group (`InputGroup` + `AuditInput` landing variant)

## Layout widths

| Container variant | Max width | Use |
|-------------------|-----------|-----|
| `default` | `max-w-5xl` | Marketing pages, header, footer |
| `report` | `max-w-6xl` | Report pages, admin detail — wide enough for master-detail explorer |
| `prose` | `max-w-[720px]` | Long-form docs, legal |
| `narrow` | `max-w-2xl` | Settings, billing, account flows |

Report surfaces use `Container variant="report"` so `ReportExplorer` master-detail layout has room.

## Report explorer & screenshots

- **Flag browsing:** `ReportExplorer` only — list, filters, detail panel, fix prompts
- **Rubric summaries:** `RubricBar` (compact pills) on live/progressive reports; `RubricSummaryGrid` for marketing sample cards only
- **Screenshot highlights:** `ScreenshotWithHighlights` for evidence overlays; carousel/prev-next controls ≥ `min-h-11 min-w-11` (44px)
- **Sticky nav:** `ReportStickyToolbar` for section jumps (Contract, Priorities, Journey, Flow, Timeline, Flags, Previews, Launch, Re-check). No Overview tab.
- **Progressive:** same hero/RubricBar/sticky altitudes as completed; scanning labels from `lib/audit/progress-ui.ts`

## Logo

- Component: `components/brand/Logo.tsx` — variants `mark`, `wordmark`, `lockup`
- SVG assets: `public/brand/`
- Mark: four ink bars (short·tall · tall·short) flanking one orange pole that flies a right-pointing flag

## Dual-token accent

- **`--link`**: info blue for inline links (`TextLink`)
- **`--brand`**: orange for CTAs, scores, flagged states
- **`--focus-ring`**: brand orange

## Rebrand file layout

| File | Purpose |
|------|---------|
| `lib/design/tokens.css` | CSS variables (light + `.dark`) |
| `lib/design/brand-spec.ts` | Hex for OG, email, manifest |
| `lib/design/fonts.ts` | Satoshi + IBM Plex Mono |
| `lib/design/og-templates.tsx` | OG + favicon |
| `lib/design/logo-mark.tsx` | Flag-bar SVG |
| `components/brand/Logo.tsx` | Logo component |

**Rule:** No raw hex in product UI components. Use Tailwind semantic tokens or `brand-spec.ts`.
Exceptions (guard allowlists): `lib/design/tokens.css`, `brand-spec.ts`, demo CSS, prompt examples, `lib/audit/capture/*` Sharp overlays, and **SVG badge/roast artwork** under `app/api/badge/` + `app/api/tools/roast/`.

## Report chrome copy

Report section titles and sticky nav labels live in `REPORT_COPY.sectionTitles` / `REPORT_COPY.stickyNav` (`lib/marketing/copy.ts`). Do not hardcode "Product contract", "How we checked", sticky tab names, or "Copy Finish Plan (N)" in components. Finish Plan sticky id is `#report-finish-plan`.

## Typography surfaces

- Marketing + pricing + brand + **help editorial** may use `font-display` (`ui:drift-guard` allowlists `components/help/`)
- Report / product cards use `font-serif` or `SectionTitle` — not `font-display`

## Pre-ship checklist

- [ ] Marketing headlines use Fraunces (`font-serif` / `font-display`); product UI uses Satoshi (`font-sans`)
- [ ] Primary buttons: orange, `rounded-full`
- [ ] Inputs and selects: `rounded-full`, borderless or glass fill
- [ ] Cards: frosted glass, no borders
- [ ] Brand orange ≤5× above fold on marketing
- [ ] Focus rings on all interactive elements
- [ ] Scores use `font-mono tabular-nums`
- [ ] Logo lockup in header (light/dark SVG swap)
- [ ] Report pages use `Container variant="report"` (`max-w-6xl`)
- [ ] Marketing full mesh has no hero grid (see `GlobalMeshBackdrop` `intensity="full"`)
- [ ] Carousel and screenshot controls ≥ 44px touch targets
- [ ] `npm run brand:hex-guard` + `npm run ui:drift-guard` pass
- [ ] Report chrome strings come from `REPORT_COPY`

## Companion skills

- `fixflags-design-philosophy`, the *why* (NN/g + Apple HIG) + pre-ship review rubric
- `color-theory`, palette validation, contrast
- `make-interfaces-feel-better`, shadows, micro-interaction
- `ui-craft`, anti-slop
- `fixflags-marketing/lean-visual.md`
