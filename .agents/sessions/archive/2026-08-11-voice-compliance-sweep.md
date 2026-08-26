# Voice Compliance Sweep — 2026-08-11

## Scope and method

Release-facing marketing copy and marketing/report UI components, checked against `SOUL.md` and `docs/voice-and-copy.md`.

- `lib/marketing/copy.ts` is a re-export barrel. Real copy strings live in `lib/marketing/copy/*.ts`. Scanned both.
- Em dash scan: byte-level grep for U+2014 (`E2 80 94`) plus a Python cross-check across `lib/marketing/copy/`, `components/marketing`, `components/report`, `components/pricing`, `components/audit`, and `app/` marketing surfaces.
- Banned-filler scan: case-insensitive grep for every SOUL + voice-and-copy banned phrase (unlock, 10x, game-changing, world-class, cutting-edge, revolutionary, visionary, ecosystem, bespoke, seamless, holistic, elevate, empower, supercharge, startup journey, clarity sprint, irrefutable, transformative, leverage, book a demo, start your free trial today, complete audit, comprehensive, robust, release readiness layer, trained on real product standards, "your users will", "read-only review", "compatibility is not endorsement", "claim the report", graded-as-adjective). Also scanned readiness adjectives per the doctrine: prefer paste verbs over `ready`, `AI-ready`, `Agent-ready`, `fix prompt ready` and `X-ready` compounds.
- Write scope: `lib/marketing/copy.ts` (and its `copy/` modules) only. No code edits were made.

## Result summary

- Em dashes found in scope: 0.
- Code edits applied: 0.
- Fixed count: 0.

The marketing copy source is already clean of em dashes and of hard banned filler (unlock, 10x, leverage, etc. never appear as rendered copy). Every grep hit was investigated. None qualified as "unambiguous banned filler" for auto-fix. Two are confirmed SOUL-banned phrases or word-family hits in shipped copy, but they are marketing-voice and product-accuracy wording, which the escalation matrix routes to the Captain for review.

## Em dash verification (mission gate)

Command: `grep -n '—' lib/marketing/copy.ts`
Output: none. Exit code 1 (zero matches). GATE PASS.

Em dashes only exist out of scope, in `lib/design/tokens.css` and `lib/audit/__tests__/fixtures/sites/*.html` (captured snapshots of external live sites). Neither is FixFlags customer copy. Left untouched.

## Banned-filler scan, copy source

### Non-violation (noted, no action)

- `lib/marketing/copy/auth.ts:22` — `unlocking: 'Preparing your fix list'`
  - `unlocking` is an internal auth-flow state key, not rendered text. The consumer `app/(auth)/post-login/page.tsx:102` selects `AUTH.reportContext.unlocking` and renders its value, "Preparing your fix list", which contains no banned word. The grep hit is the key name only.

### Confirmed SOUL-banned phrase in shipped copy, left for CEO review (ASK CAPTAIN)

- `lib/marketing/copy/brand.ts:103` — `C: 'Not bad, but your users will notice.'` (roast grade-C tagline, `ROAST_COPY.taglines.C`)
  - SOUL "What the product would never say" explicitly bans "Your users will… (when only an AI agent was tested)." FixFlags tests only via an AI agent, so the condition holds. This is a confirmed banned phrase in user-facing copy.
  - Escalation: it is a marketing tagline with curated roast voice. Rephrasing it, even meaning-preserving, alters a marketing message, which the escalation matrix routes to the Captain. Not auto-fixed.
  - Recommended meaning-preserving reword for approval: "Not bad. A few issues visitors notice." or "Not bad. Some issues visitors notice."

### Readiness adjectives on marketing copy, left for CEO review (ASK CAPTAIN)

The voice-and-copy doctrine says "Paste verbs over readiness adjectives." The hits below use `ready` or an `X-ready` compound as an adjective rather than as the verb "is/are ready". Flagged for review, not auto-fixed, because each is marketing or UX-label wording.

- `lib/marketing/copy/brand.ts:110` — `A: 'Clear, focused, conversion-ready.'` (roast EXPERIENCE grade-A verdict)
- `lib/marketing/copy/auth.ts:129` — `client-ready share links` (sign-up plan title, TEAM)
- `lib/marketing/copy/plans.ts:68` — `Client-ready public share links` (Pro feature)
- `lib/marketing/copy/plans.ts:273` — `client-ready summaries` (Studio feature)
- `lib/marketing/copy/landing.ts:593` — `status: "Ready to update review"` (hero sample-flow status label)
- `lib/marketing/copy/landing.ts:597` — `promptStatus: "Ready for your AI editor"` (hero sample-flow status label)
- `lib/marketing/copy/landing.ts:792` — body, `editor-ready fix`
- `lib/marketing/copy/landing.ts:794` — headline, `Every fix, ranked and ready`

Note: verb usage of "ready" ("Your report is ready", "publish when you are ready", "This is ready for humans") was not flagged, since the doctrine targets readiness adjectives, not the verb "is/are ready".

### Borderline word-family hit, left for CEO review

- `lib/marketing/copy/errors.ts:34` and `lib/marketing/copy/landing.ts:1153` — `partialReport: 'Some optional evidence was unavailable. Unassessed rubrics remain ungraded rather than being inferred.'`
  - "ungraded" trips the "graded, grades (as verb/adjective)" ban family. But here it carries the inverse intent: an honesty statement that rubrics which were NOT scored are left ungraded rather than faked. Rewording could weaken the accuracy claim.
  - Escalation: product-accuracy wording. Left for review. Suggested alternative if the Captain wants the word family cleared: "Unassessed rubrics are left unmeasured rather than inferred."

## Marketing/report UI component scan (report only, DO NOT TOUCH)

No em dashes. No banned-filler. Readiness wording in rendered labels only:

- `components/marketing/ExamplesFilterBar.tsx:11` — `'studio-ready': 'Studio-ready'` (filter tag)
- `components/marketing/ExampleAuditCard.tsx:21` — `'studio-ready': 'Studio-ready'` (filter tag)
- `components/marketing/landing/HomepageReportPreview.tsx:223` — `Ready for your editor` (preview label)

All other component "ready" / "unlock" / "elevate" hits are non-copy identifiers, not voice:

- `components/report/ReportPromptsUnlockedTracker.tsx:5` (component name) and `:13` (`'report_prompts_unlocked'` analytics event) — "Unlocked" is the prompts-becoming-un-gated product state, a technical identifier.
- `components/pricing/PricingPageClient.tsx:215` — `variant="elevated"` (component prop token)
- `components/audit/ActiveAuditBanner.tsx:81` — `glass-surface-elevated` (CSS utility class)
- `components/audit/AuditReport.tsx:194` — `// ...never unlock via client sessionStorage.` (internal security comment)
- `components/cli/CliAuthorizeCard.tsx:9,47,107` — `'ready'` (CLI auth state value)
- `components/report/__tests__/ReportCanvasPanel.test.tsx:28` — `status: 'READY'` (test fixture value)

None of these are customer-facing marketing copy.

## Verification

- `grep -n '—' lib/marketing/copy.ts` → exit 1 (zero em dashes). PASS.
- `npm run validate:quick` → the pre-existing WIP tree has `package.json` modified, so `validate.mjs` escalated the plan to full validation (this is unrelated to the sweep; zero code edits were made). Under full, `scripts/next-build.mjs` (`next build`) compiled successfully, emitting the full route and chunk summary, so the `typecheck` and `lint` steps that run earlier in the plan passed.
- Caveat, not a regression: the build-step repo-state guard threw `Validation command "build" modified project files` (modified `.agents/sessions/credentialed-journey-matrix.md`; untracked `.agents/sessions/2026-08-11-finance-launch-posture.md`). `next-build.mjs` does not author those files (only `scripts/project-agent.mjs` references a different session file), so the writes are from a concurrent crewmate session landing in the shared `.agents/sessions/` working tree during the build. I did not author or edit those files, and per the preserve-working-tree mandate I left them untouched.

## Bottom line

- Em dashes in scope: 0.
- Auto-fixes applied to `lib/marketing/copy.ts`: 0.
- Confirmed SOUL-banned phrase in shipped copy, pending Captain decision: `brand.ts:103` ("your users will notice", roast tagline).
- Readiness-adjective / "ready" wording pending Captain decision: `brand.ts:110`, `auth.ts:129`, `plans.ts:68`, `plans.ts:273`, `landing.ts:593`, `landing.ts:597`, `landing.ts:792`, `landing.ts:794`.
- Borderline "graded" word-family (accuracy statement) pending Captain decision: `errors.ts:34` and `landing.ts:1153` ("ungraded").
- Non-violation noted: `auth.ts:22` (`unlocking` is an internal key; its rendered value is clean).
- No code files changed by this sweep.
