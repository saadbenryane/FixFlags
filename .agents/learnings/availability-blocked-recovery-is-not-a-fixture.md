# A blocked page recovery is not a fixture review

**Date:** 2026-10-05
**Scope:** Outcome detail recovery line for page availability
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/outcome-detail-evidence.test.ts` calls `loadSiteOutcomeDetail`. It received the fixture sentence, then passed twice (17/17).

## Discovery

Couldn’t verify used one recovery sentence for every kind except Checkout. Signup needs a fixture. A page check does not.

## Why it matters

The limitation can already say the page is not public, or that it redirected. A following line about a fixture sends the customer to a Signup control they do not have.

## Correct approach

Page recovery follows the newest HTTP availability execution. The sentence names the page next step. Signup keeps the fixture sentence. A confirmed unavailable response stays on the Flag.

## Prevention

The detail test covers a newer `not_public` result after an older success, a redirect, a challenge, a missing rendered page, a request that did not complete, an unrecognized page reason, protected Signup, and an unavailable-page Flag.

## Limit

A missing rendered page can mean the check stored no HTML metadata. The recovery says the check had nothing rendered to read.
