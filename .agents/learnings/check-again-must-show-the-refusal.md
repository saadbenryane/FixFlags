# Check again must show the refusal

**Date:** 2026-10-05
**Scope:** Site board Check again
**Confidence:** HIGH
**Evidence:** A 409 with “Another Site run is already in progress” rendered the generic start failure, then the Site board tests passed twice (30/30).

## Discovery

Check again showed `message` only for plan-limit codes. Every other refusal, including a busy Site, became “Could not start a new check.”

## Why it matters

A customer refreshing stale evidence cannot tell a busy Site from a broken check, and will press the button again.

## Correct approach

Show the server message for any refusal. Use the generic line only when that message is missing. Keep the 401 sign-in redirect.

## Prevention

The board test opens a stale card, answers Check again with the busy-Site refusal, and expects that sentence instead of the generic failure. The plan-limit case still expects its own sentence.
