---
name: fixflags-scan-accuracy
description: FixFlags scan accuracy — offline corpus, live probes, false-positive fixes, fixture capture, and accuracy CI gate. Use when improving check quality, adding regression fixtures, adjudicating gold-standard false positives, or wiring accuracy evals.
---

# FixFlags scan accuracy

Read `AGENTS.md` first. Accuracy expectations are product truth — do not weaken checks to go green.

**Canonical evidence:** `.agents/sessions/launch-accuracy-baseline.md`
**Completion plan:** `.agents/sessions/launch-readiness-completion-plan.md`

## Corpus architecture

| File | Role |
|------|------|
| `lib/audit/accuracy-corpus.ts` | Single source for fixture URLs, tiers, top-3, FPs, present flags |
| `lib/audit/fixture-html.ts` | Shared `runAccuracyFixtureChecks()` for offline HTML checks |
| `lib/audit/fixture-sanitize.ts` | Strip scripts/tracking meta before freezing live HTML |
| `scripts/accuracy-eval.ts` | CI gate — exits non-zero on regression |
| `lib/audit/__tests__/report-quality-eval.test.ts` | Vitest mirror of corpus top-3 assertions |

**Tiers:** `gold` (0 false CRITICAL/IMPORTANT), `builder`, `personal`, `broken`, `structural`, `control`.

## Commands

```bash
npm run accuracy:eval                              # offline gate (CI)
npm run accuracy:probe -- https://stripe.com ...   # rendered live adjudication
npm run accuracy:capture-fixtures                  # refresh lovable + bolt HTML
npm run demo:audit:offline                         # demo v1 repair proof
npm run agent -- context accuracy
npm run agent -- eval accuracy
```

## Fix workflow (no hacks)

1. Reproduce with `accuracy:probe` for live sites or a frozen fixture for offline checks
2. Fix in owning check under `lib/audit/checks/`
3. Update suppression in `lib/audit/suppress-overlapping.ts` if duplicate flags
4. Update expectations in `lib/audit/accuracy-corpus.ts` only when adjudicated correct
5. Run `npm run accuracy:eval` and targeted vitest
6. Record non-obvious learning in `.agents/learnings/`

## Adjudication rules

- **Gold (stripe, vercel, nextjs):** 0 false CRITICAL/IMPORTANT on HTML fixtures
- **Builder (lovable, bolt):** top-3 must be actionable; bolt allows ≤2 IMPORTANT (`trust-unsupported-claims`, `links-no-text`)
- **HTML-only vs browser:** Never adjudicate missing UI, visibility, geometry, or accessibility bypasses from raw response HTML. Client-rendered sites can contain real CTAs and skip links only after hydration.
- **Do not** remove checks that fire on correct practice
- **Do not** add URL-specific logic in production to satisfy fixtures

## Live vs offline limits

| Layer | Covers | Does not cover |
|-------|--------|----------------|
| HTML fixtures + `accuracy:eval` | Metadata, a11y names, messaging, trust heuristics | Flow paths, overlay clicks, PageSpeed live |
| `accuracy:probe` / `accuracy:browser` | Hydrated DOM checks, rendered CTA geometry, candidate semantics, visual metrics | PageSpeed and full pipeline persistence |
| `fixflags check <url> --wait --full` | Full prod pipeline (requires auth) | Not in CI without API key |
| `non-html-regression.json` | PageSpeed, overlay, network, flow check IDs | Live capture refresh |

## Verification before ship

```bash
npm run accuracy:eval
npx vitest run lib/audit/__tests__/report-quality-eval.test.ts lib/audit/__tests__/metadata.test.ts
npm run demo:audit:offline
```

## Anti-patterns

- Duplicating fixture expectations in scripts or tests — use `accuracy-corpus.ts`
- Committing full script bundles in fixtures — use `fixture-sanitize.ts`
- Substituting marketing copy to bypass secret scanners — strip scripts instead
- Claiming launch-ready without gold 0 false blockers and green `accuracy:eval`
