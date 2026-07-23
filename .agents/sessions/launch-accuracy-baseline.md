# Session — launch accuracy baseline

## Task

- **ID:** launch-quality-accuracy
- **Date:** 2026-07-23
- **Branch:** cursor/launch-quality-accuracy-bff3

## Baseline gates

| Gate | Result |
|------|--------|
| `npm run test:unit` | 2070 tests (2069 passed, 1 skipped) after fixes |
| `npm run accuracy:eval` | PASS (8 HTML corpus fixtures + demo v1 + non-HTML) |
| `npm run demo:audit:offline` | 16 baseline flags, v1 = 0 |

## Tier A — gold standard (HTML probe)

| URL | CRITICAL/IMPORTANT | Adjudication |
|-----|-------------------|--------------|
| stripe.com | 0 | PASS — POLISH only (risk reversal, analytics HTML, skip link) |
| vercel.com | 0 | PASS — POLISH only |
| linear.app | 3 IMPORTANT (HTML probe) | **Open:** run full Playwright pipeline (`npm run accuracy:probe` insufficient for SSR). Adjudicate FP/FN; freeze rendered fixture if needed. See credentialed-journey-matrix accuracy backlog. |
| fixflags.com/demo/v1 | 0 live probe | PASS after fetch context |

## Tier B — AI-builder archetype

| URL | CRITICAL/IMPORTANT | Top-3 quality |
|-----|-------------------|---------------|
| lovable.dev | 0 | PASS — security + social proof POLISH only |
| bolt.new | 2 IMPORTANT | ACCEPT — `trust-unsupported-claims` + `links-no-text` (1 link) are actionable |
| v0.dev | 0 | PASS — POLISH only after overlay-link parser fix |
| replit.com | ERROR 403 | Skipped (bot block) |

## Tier C — intentionally broken

| URL | Flags | Repair |
|-----|-------|--------|
| fixflags.com/demo (offline) | 16 | v1 clears all 16 in CI |

## Tier D — personal site

| URL | IMPORTANT | Notes |
|-----|-----------|-------|
| saadbenryane.com | 2 | `no-cta-detected`, `trust-no-direct-contact` — legitimate for portfolio; frozen in fixture |

## Metrics (knowledge/product.md)

| Metric | Result |
|--------|--------|
| Blocker recall (broken demo) | PASS — ≥8 real flags |
| False-blocker rate (Tier A stripe/vercel/lovable/v0) | 0 CRITICAL/IMPORTANT |
| Evidence correctness | Spot-checked top-3 on fixtures; evidence quotes DOM text |
| Verified repair rate | PASS — demo v1 = 0 in-scope flags |

## Fixes shipped in this pass

1. Accessible-name parser: hidden subtrees, sr-only labels, card stretch links (`absolute inset-0` + heading).
2. `messaging-weak-value-prop`: only fires when headline has neither audience nor outcome.
3. H1 extraction: dedupe responsive duplicates and repeated phrase runs.
4. Frozen fixtures: `lovable-dev.html`, `bolt-new.html` (live `v0.dev` probe passes; no frozen fixture — HTML-only corpus).
5. `npm run accuracy:eval` CI gate with gold/builder/personal/broken corpus.
6. Shared corpus: `lib/audit/accuracy-corpus.ts` (single expectation source).

## Persona validation (automated)

| Persona | Evidence |
|---------|----------|
| First-time developer (Launch Check) | `finish-plan.test.ts` — ≤3 fixes, exactly one anonymous prompt; `claim-anonymous.test.ts`; `v1-fixture-audit.test.ts` repair loop |
| Seasoned developer (external audit) | Tier A probe 0 false CRITICAL/IMPORTANT on stripe/vercel; gold fixtures in `accuracy:eval`; full flag explorer via `runAllChecks` on 9 HTML fixtures |

Manual report contract smoke (anonymous + signed-in) remains open — see QUALITY.md.


- [x] Tier A stripe/vercel: 0 false CRITICAL/IMPORTANT
- [x] Tier B lovable/v0: 0 false CRITICAL/IMPORTANT
- [x] Tier C demo baseline ≥8, v1 = 0
- [x] `npm run accuracy:eval` green
- [x] `npm run test:unit` green
- [ ] `verify:release` with production credentials (parallel track)
- [ ] Manual report contract smoke on anonymous + signed-in journey
- [ ] ≥100 completed scans for funnel P2 (defer scaling)

## Defer scaling until

- `verify:release` passes
- Credentialed journey matrix complete
- linear.app HTML-only IMPORTANT flags validated on full browser pipeline
