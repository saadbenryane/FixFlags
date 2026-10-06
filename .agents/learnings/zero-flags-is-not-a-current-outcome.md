# Zero Flags is not a current watched Outcome

**Date:** 2026-10-05
**Scope:** Site card health
**Confidence:** HIGH
**Evidence:** A finished, fully evidenced Site with a stale Outcome stayed healthy, then the site-card and check-notice tests passed twice (24/24).

## Discovery

`siteCardHealth` returned “0 Flags” from coverage and the open Flag list. It did not read watched Outcome state. Home already had that state.

## Why it matters

A customer can see a healthy Site while Checkout or page availability is stale or unverified.

## Correct approach

Before the healthy return, an enabled Flag, stale, or unverified Outcome replaces “0 Flags.” A paused Outcome does not. Home passes the Outcome states into that decision.

## Prevention

The site-card test builds a healthy coverage fixture, then expects Stale, Couldn’t verify, and Needs a fix for those Outcome states. A paused stale Outcome still allows “0 Flags.”
