# Outcome proof uses customer method names and the shared clock

**Date:** 2026-10-05
**Scope:** Outcome detail evidence card and proof times
**Confidence:** HIGH
**Evidence:** Outcome page render failed on the internal titles, then the page and state tests passed twice (6/6). A signed-in Home and page-loads Outcome both showed “Sep 23, 2026, 10:57 PM UTC.”

## Discovery

The proof card titled a binding with a title-cased mechanism enum. The same page formatted last verified, last success, observed evidence, and history with `Date.toLocaleString()`. Home already used `formatEvidenceTimestamp`.

## Why it matters

A customer comparing Home with the Outcome page saw two clocks for one check, and the proof heading named an internal method.

## Correct approach

Name the method with `customerMechanismLabel`: Purchase path, Form, Page availability, or Check. Stamp every proof time on this page with `formatEvidenceTimestamp`.

## Prevention

The Outcome page test renders a checkout journey, a safe form, page availability, and an unknown mechanism. It expects the customer headings and the shared UTC string, and it rejects the title-cased enums.
