# Outcome history must use the customer sentence

**Date:** 2026-10-05
**Scope:** Outcome detail history
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/outcome-detail-evidence.test.ts` calls `loadSiteOutcomeDetail`. History showed the binding key and reason code, then the test passed twice (18/18).

## Discovery

Attempt rows were titled with `bindingKey` and `disposition`, and the detail was the raw `reason`. The evidence card already translated those fields through `customerBindingResult`.

## Why it matters

History is where a customer compares an older block with a later success. A key such as `checkout-browser-v1` and a code such as `no_buy_control` do not say what the check found.

## Correct approach

Build each attempt from `customerBindingResult`. Keep every attempt. The mechanism disclosure later moved to the same sentence. See `.agents/learnings/outcome-mechanism-must-use-the-evidence-sentence.md`.

## Prevention

The detail test expects the Checkout reached sentence, the no-purchase-control sentence, the public-page sentence, and the protected Signup sentence, and rejects the binding keys and reason codes in those history fields.
