# A blocked Checkout recovery is not a fixture review

**Date:** 2026-10-05
**Scope:** Outcome detail recovery line
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/outcome-detail-evidence.test.ts` calls `loadSiteOutcomeDetail`. It received the fixture sentence, then passed twice (10/10).

## Discovery

Couldn’t verify always used one recovery sentence: review the method or fixture. Signup is the flow that needs a fixture. Checkout blocks because the purchase could not be attempted.

## Why it matters

The evidence card can already say that no purchase control was found. A following line about a fixture tells the customer to inspect the wrong thing, and another verification of the same page will block again.

## Correct approach

Checkout recovery follows the newest Checkout execution. The sentence names the purchase next step. Signup keeps the fixture sentence. A confirmed purchase failure does not grow a second repair line on the Outcome, because that repair is the Flag.

## Prevention

The detail test covers a newer `no_buy_control` after an older success, a bot challenge, a password gate, a timeout, disagreeing attempts, an unrecognized Checkout reason, protected Signup, and a Checkout Flag.
