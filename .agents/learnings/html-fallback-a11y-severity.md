# HTML-only accessible-name checks must not lead as IMPORTANT

**Date:** 2026-08-17
**Check module:** `lib/audit/checks/accessibility.ts`
**Confidence:** HIGH
**Evidence:** Linear / Replit / Shopify fixtures, `npm run accuracy:eval` 0 failures, 339 focused tests, tsc EXIT 0

## Finding

After customer-visible ranking, Experience Flags outrank Reach SEO at the same severity. The HTML-only accessible-name fallback still emitted IMPORTANT for unlabeled inputs, unnamed buttons, and unnamed links whenever axe did not run.

On well-built client-rendered pages those counts are often demo composers, `tabindex="-1"` chrome, or icon buttons in the static snapshot:

- Linear: placeholder composer textarea (`tabindex="-1"`), empty chrome buttons, logo-wall stretch link. Top-3 was three IMPORTANT name Flags.
- Replit: hero composer textarea. Top Flag was IMPORTANT `form-inputs-no-label`.
- Shopify: one icon-only close button. Top Flag was IMPORTANT `buttons-no-text`.

The scan-accuracy skill already forbids adjudicating accessibility bypasses from raw HTML. The accuracy gate did not catch this because Linear is `structural` with an empty `expectedTop3`.

The earlier hypothesized headline FP `messaging-weak-value-prop` does not fire on current Lovable or Bolt fixtures.

## Fix

When axe results are absent, emit `form-inputs-no-label`, `buttons-no-text`, and `links-no-text` as POLISH with lower confidence. Axe-backed `serious` / `critical` name violations keep axe severity. The Flags stay visible.

Missing-alt fallback stays IMPORTANT. That signal is more reliable from HTML.

html5up top-3 is now `form-missing-validation`, `description-missing`, `messaging-headline-too-short`. The unlabeled subscribe input remains as POLISH.

## Prevention

- `lib/audit/__tests__/checks.test.ts` asserts HTML fallback is POLISH and axe `button-name` stays IMPORTANT.
- `lib/audit/__tests__/regression-sites.test.ts` fixtures use POLISH for HTML-only name counts.
- `lib/audit/__tests__/report-quality-eval.test.ts` fails if Linear or Replit still lead with an IMPORTANT HTML-only name Flag.
- `.agents/accuracy/false-positives.json` `fp-013`

## Next constraint

Whether the first named Flag is true on a rendered page. Production mobile-CTA verdict integrity is owned by `continuous-improvement-system`. Live axe confirmation is still the path that can restore IMPORTANT name findings. Do not raise HTML-only name counts back to IMPORTANT to satisfy a top-3 list.
