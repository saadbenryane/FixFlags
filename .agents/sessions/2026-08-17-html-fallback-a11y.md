# Diagnosis: HTML-only a11y name checks over-rank after customer-visible ranking

**Date:** 2026-08-17
**Status:** implemented; verified this cycle
**SHIPPED / NEXT / VISION:** severity of existing deterministic Flags is SHIPPED Judge behavior. Browser axe confirmation and production mobile-CTA verdict grounding remain NEXT / owned elsewhere.

## Problem

Customer-visible ranking now prefers Experience over Reach SEO at the same severity. HTML-only accessible-name fallbacks still emit IMPORTANT. On well-built client-rendered sites those Flags become the first judgment even though axe never ran.

## Evidence

Offline fixture ranking after the shared comparator (`npx tsx .agents/artifacts/rank-diag.ts`):

- `linear-app.html`: top-3 is IMPORTANT `form-inputs-no-label`, `links-no-text`, `buttons-no-text`.
- `replit-com.html`: top Flag is IMPORTANT `form-inputs-no-label`.
- `shopify-com.html`: top Flag is IMPORTANT `buttons-no-text`.

Inspecting the counted nodes:

- Linear: a `tabindex="-1"` demo composer textarea with a placeholder, empty `tabindex="-1"` chrome buttons, and a logo-wall stretch link.
- Replit: a hero composer textarea with a placeholder.
- Shopify: one icon-only region-selector close button in the static snapshot.

The scan-accuracy skill forbids adjudicating accessibility bypasses from raw response HTML. The accuracy gate does not fail these because Linear is `structural` with empty `expectedTop3`.

Hypothesized headline FP `messaging-weak-value-prop` on Lovable/Bolt does **not** fire on current fixtures. That hill is already gated.

## Hypothesis

When axe-core results are absent, emit unlabeled-input / unnamed-button / unnamed-link Flags as POLISH. Keep axe-backed `serious`/`critical` findings IMPORTANT or CRITICAL. Every confirmed Flag stays visible. The first named Flag stops being an unverified HTML name count.

## Guardrails

- Do not hide Flags or invent verdicts.
- Do not skip the checks.
- Do not change axe-backed severity.
- Do not take `continuous-improvement-system` or `game-on-*` write scopes.
- Update corpus `expectedTop3` only when the new ranking is adjudicated correct.

## Expected outcome

Linear and Replit no longer lead with an IMPORTANT unlabeled-input Flag. A rendered axe violation can still outrank SEO hygiene.
