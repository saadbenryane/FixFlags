# Completed module receipts evidence starter areas

**Date:** 2026-10-05
**Scope:** Site coverage
**Confidence:** HIGH
**Evidence:** A signed-in Site with zero Flags and a stale Outcome stayed “Coverage incomplete” until Home read completed trust, security, and measurement receipts. The site-card and check-notice tests then passed twice (25/25).

## Discovery

`runAllChecks` stores a completed receipt per module. Home selected only `module:accessibility`. Security and Tracking therefore stayed “Not checked yet” on a clean finished check, so a stale watched Outcome could not become the Site answer.

## Why it matters

A customer with no Flags never saw a current Site answer, and a stale watched result stayed behind “Coverage incomplete.”

## Correct approach

Security needs both the trust and security receipts completed. Tracking needs the measurement receipt completed. Not-applicable receipts do not count. Home loads those keys with accessibility.

## Prevention

The site-card test expects Security and Tracking to stay unknown without those receipts, and to become checked only when the receipts are completed. The same fixture then expects the Site status “Stale” for an enabled stale Outcome.

## Rejected

Marking Security or Tracking checked because a finished audit exists, or because an area has no Flag. A missing or not-applicable receipt still means that area was not checked.
