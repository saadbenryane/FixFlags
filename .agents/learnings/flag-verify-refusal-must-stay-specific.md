# Flag verification must show the server reason

**Date:** 2026-10-05
**Scope:** Flag verify action
**Confidence:** HIGH
**Evidence:** The Flag action test showed “Could not start verification” for a `message` body. After the repair the action and route tests passed twice (6/6).

## Discovery

`SiteFlagActions` read `error`. `apiError` sends `message`. The comparable-scope refusal and a busy Site never reached the Flag page.

## Why it matters

Verify fix is the customer’s recovery check. A generic failure hides whether the Flag can be checked at all.

## Correct approach

Show `message`, then `error`, then the generic sentence. Keep the signup redirect on `signup` or 401.

## Prevention

The action test expects the comparable-scope sentence from a `message` body and still expects an `error` body. The route test expects that sentence in `message` at 400, and a busy-Site refusal at 409.
