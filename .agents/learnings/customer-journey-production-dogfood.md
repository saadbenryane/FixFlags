# Production customer dogfood: trust gaps (2026-07-23)

- Date: 2026-07-23
- Scope: Live fixflags.com first-value journey (homepage → anon scan → Finish Plan → details → signup)
- Confidence: High

## Evidence

- Production `/api/health` commit `ed73147` while `main` already included `next.config.ts` `images.localPatterns` for `/brand/**` and `/marketing/**` (`24f4da9`). Optimizer returned 400 `"url" parameter is not allowed`; raw `/brand/*.png` returned 200.
- Live anon Finish Plan for example.com showed evidence boxes with `Create a free account to see evidence and fix prompts.` Copy prompt toasted success while clipboard was `Sign up to get the fix prompt.`
- `lib/audit/persist.ts` persists `TRIAGE_LOCKED_*` strings into AI flag rows; access stripping cannot restore real evidence that was never stored.
- PRODUCT.md / report-contract require visible evidence + exactly one demonstrated prompt; AGENTS had oversimplified to “all prompts gated.”

## Discovery

Deploy lag can look like a product bug. Separately, gating by writing placeholder strings into the database breaks the anonymous wedge even when read-time strippers are correct. A Copy control that always succeeds trains users that the product is lying.

## Why it matters

First-value trust is the acquisition surface. Broken logo + empty evidence + fake copy success converts curious builders into bounce, not signup.

## Correct approach

1. Brand: keep `/brand/**` + `/marketing/**` in `localPatterns`, serve compressed brand assets `unoptimized`, guard with `npm run image:local-patterns-guard` (shipped as `fix-live-images`; see `next-image-local-patterns-blank-assets.md`).
2. Persist real triage evidence/why; null fix prompts until prescription/claim paths fill them.
3. Grant `promptAccess: 'one'` only when `resolveFixPrompt` is a real prompt; never feed gate strings to Copy UI.
4. Keep PRODUCT.md / report-contract as the anon contract; keep AGENTS and skills aligned to that wording.
5. Treat remaining dogfood failures (anon evidence, dishonest Copy) as Phase 1 now-work, not “Touch later.”

## Where prevention was encoded

- Brand fix: `fix-live-images` + `.agents/learnings/next-image-local-patterns-blank-assets.md`
- `.agents/sessions/archive/customer-journey-completion-plan.md` (Phase 0 marked done 2026-07-23)
- `.agents/sessions/launch-readiness-completion-plan.md` immediate actions
- `.agents/sessions/credentialed-journey-matrix.md` anon row
- `AGENTS.md` anon invariant
- Skills: `fixflags-product`, `fixflags-completeness`, `fixflags-design-system`, `fixflags-marketing`, `fixflags-runtime-release`
