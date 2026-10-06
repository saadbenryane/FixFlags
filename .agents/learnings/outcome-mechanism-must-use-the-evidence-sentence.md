# The mechanism disclosure must use the evidence-card sentence

**Date:** 2026-10-05
**Scope:** Outcome detail, How this is checked
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/outcome-detail-evidence.test.ts` calls `loadSiteOutcomeDetail`. The sentence field was missing, then the test passed twice (19/19).

## Discovery

The disclosure rendered `binding.key` and `version`. The evidence card already translated the newest execution through `customerBindingResult`.

## Why it matters

A customer who opens How this is checked should see what the method found, in the same words as the evidence card. A key such as `checkout-browser-v1` does not say that.

## Correct approach

Store the evidence-card headline on the detail binding as `customerSentence`. Use the empty-evidence sentence when the method has not run. Render that field. Keep the binding key as the React key only.

## Prevention

The detail test expects the reached-checkout headline, the unavailable-page headline, and the empty-evidence sentence, and rejects the binding keys and the word version in those lines.

## Correction

An earlier history note said the binding key could stay in this disclosure. That line now uses the customer sentence too.
