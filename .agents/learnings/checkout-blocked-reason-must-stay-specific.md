# A blocked Checkout must keep its purchase reason

**Date:** 2026-10-05
**Scope:** Outcome assessment reconcile
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/run-requests.test.ts` calls `reconcileOutcomeRunsForAudit` and passed twice (32/32).

## Discovery

Checkout Clear and Flag assessments used `checkoutResultCopy`. Couldn’t verify threw that sentence away and stored a generic coverage line. The walk’s blocked reason, including no buy control and a bot wall, never reached the Outcome page.

## Why it matters

Couldn’t verify is a common honest Checkout result. A coverage sentence tells the customer that FixFlags failed to finish, not whether the page had no purchase control or a bot wall stopped the browser.

## Correct approach

When the Checkout binding produced a reason, store that Checkout sentence. When the binding never ran, keep the coverage sentence. Do not give Signup or page availability the Checkout wording.

## Prevention

`reconcileOutcomeRunsForAudit` is the write path. `run-requests.test.ts` asserts the blocked purchase sentence, the bot-wall sentence, and the coverage sentence for a Checkout that never ran.
