# A refused Verify must keep its reason

**Date:** 2026-10-05
**Scope:** Outcome Verify
**Confidence:** HIGH
**Evidence:** The button test missed the server sentence, and the verify route returned 500. After the repair those tests, plus the run-request suite, passed.

## Discovery

The Outcome Verify button read `error`. Site routes send `message`. A busy Site was a plain `Error`, so the route replaced it with “Could not start this verification.”

## Why it matters

The page asks the customer to verify again. A generic failure gives them nothing to do when the Site is already running, signed out, or out of allowance.

## Correct approach

Throw `SiteRunRefusal` for a customer refusal. Let `handleRouteError` return its message and status. Read `message` on the button. Leave unexpected errors generic.

## Prevention

The button test expects the sign-in sentence from a `message` body. The route test expects 409 and the busy-Site sentence, and expects an unexpected error to stay generic. The run-request test expects that busy Site to throw `SiteRunRefusal` with status 409.
