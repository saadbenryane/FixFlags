# Dev Server Fix + Design Polish Plan

## Context

The user reports `npm run dev` silently exits on their terminal — no Next.js banner, no URL, just the shell prompt. The server works fine from AI tool shells but not from the user's interactive terminal. Investigation found the root cause and several design inconsistencies.

## Root Cause: Dev Server Silent Exit

**Primary cause:** `next-dev.js:68` uses `process.env.NODE_ENV = process.env.NODE_ENV || 'development'`. If `NODE_ENV` is pre-set to `production` anywhere in the user's shell environment (terminal emulator profile, shell init, IDE terminal config), `next dev` inherits it. This triggers `validateProductionEnv()` in `instrumentation.ts` which calls `validateAuthEnv()` which throws `BETTER_AUTH_URL must use https in production` — the error is printed to stderr but the parent process immediately exits with code 0, so the user never sees it.

**Contributing cause:** `scripts/doctor.mjs` imports `playwright` at module level (line 6), creating 2 dangling Socket handles. While not the primary cause, this adds startup latency and loads unnecessary browser management code.

## Plan

### Task 1: Fix dev server reliability

**Files to edit:**
- `package.json` — line 10: change `"dev": "next dev"` to `"dev": "NODE_ENV=development next dev"`
- `scripts/doctor.mjs` — move `import { chromium } from 'playwright'` from line 6 (module-level) to inside the `check('Chromium', ...)` callback as a dynamic `await import('playwright')`

**Why:** The `NODE_ENV=development` prefix is the canonical fix — it guarantees the correct mode regardless of terminal environment. The lazy playwright import removes dangling handles and startup overhead.

### Task 2: Fix non-token rubric colors on /issues pages

**Files to edit:**
- `app/(marketing)/issues/page.tsx` — lines 37-39: replace `bg-blue-100 text-blue-800 border-blue-200` etc. with semantic design tokens. Add rubric color tokens to `lib/design/tokens.css` and bridge through `tailwind.config.ts`:
  - MESSAGE: use `--brand-muted` / `--brand` / `--brand-border` (orange family)
  - EXPERIENCE: use amber from the existing palette
  - REACH: use emerald from the existing palette
- `app/(marketing)/issues/[checkId]/page.tsx` — lines 71-75: same fix

**Why:** DESIGN.md states "Grade colors (A-F) used only in report score contexts, not marketing" and "Do not layer multiple accent colors." The blue/amber/emerald utilities break the warm stone/orange visual language.

### Task 3: Fix typography consistency

**Files to edit:**

| File | Line | Current | Fix |
|------|------|---------|-----|
| `components/marketing/tools/MetaPreviewClient.tsx` | 130 | Raw `<h1>` with `font-bold tracking-tight` | Use `<Heading as="h1">` component |
| `components/marketing/tools/PlaceholderDetectorClient.tsx` | 80 | Same | Use `<Heading as="h1">` component |
| `app/(marketing)/blog/[slug]/page.tsx` | 69 | Raw `<h1>` with `font-semibold text-balance` | Use `<Heading as="h1">` component |
| `components/marketing/landing/HowItWorksLoopSection.tsx` | 112 | `<h3>` with `font-bold` | Change to `font-semibold` (matches Heading h3 spec) |
| `components/marketing/landing/CheckDimensionsSection.tsx` | 130 | `<h3>` with `font-bold` | Change to `font-semibold` |

**Why:** DESIGN.md specifies Fraunces serif at font-medium (h1/h2) and font-semibold (h3/h4) with `tracking-display` / `tracking-heading`. Raw headings bypass these tokens.

### Task 4: Replace tracking-tight with design tokens

**Files to edit (9 locations):**
- `components/pricing/PricingPageClient.tsx:64` — `tracking-tight` → `tracking-display`
- `components/audit/RecheckDiffStrip.tsx:46` — `tracking-tight` → `tracking-heading`
- `components/report/ScoreRingGauge.tsx:129` — `tracking-tight` → `tracking-display`
- `components/audit/ProductMemoryStrip.tsx:50` — `tracking-tight` → `tracking-heading`
- `components/audit/MarkdownPromptBox.tsx:36,41` — `tracking-tight` → `tracking-heading`
- `components/marketing/tools/MetaPreviewClient.tsx:130` — handled in Task 3
- `components/marketing/tools/PlaceholderDetectorClient.tsx:80` — handled in Task 3
- `components/marketing/landing/EditorToolMarks.tsx:41` — `tracking-tight` → `tracking-heading`

**Why:** DESIGN.md defines three tracking tokens: `tracking-display` (-0.02em), `tracking-heading` (-0.01em), `tracking-body` (0). Tailwind's `tracking-tight` is -0.025em which doesn't match any token.

### Task 5: Fix inline style in JourneyBar

**File:** `components/audit/JourneyBar.tsx` — line 99: replace `style={{ color: 'hsl(var(--background))' }}` with Tailwind class `text-background`.

**Why:** All other color usages use Tailwind semantic classes. This inline style is the only one that can be trivially replaced.

### Verification

After all edits:
1. `npm run dev` — confirm server starts and shows URL on both terminal and tool shell
2. `npm run lint` — confirm no lint errors
3. `npm run typecheck` — confirm no type errors
4. Visual check of `/issues` page, `/tools/meta-preview`, `/tools/placeholder-detector`, `/blog/[slug]` — confirm typography matches design system
