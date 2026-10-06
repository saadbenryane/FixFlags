# Outcome evidence must use the customer sentence

**Date:** 2026-10-05
**Scope:** Outcome detail evidence card
**Confidence:** HIGH
**Evidence:** `components/sites/__tests__/OutcomeBindingResult.test.tsx` renders the component mounted by the Outcome page and passed twice (4/4).

## Discovery

The evidence card title-cased `disposition` and `reason`. Customers saw "Blocked" and "No buy control" beside an assessment that already had a sentence.

## Why it matters

The evidence block is where a customer checks what the binding did. A reason code restates the status without saying whether FixFlags found a purchase control, stopped at a protected form, or found an unavailable page.

## Correct approach

Render the Checkout purchase sentence for a checkout binding. Render `summaryFor` for every other binding. Leave raw JSON behind the technical disclosure.

## Prevention

`OutcomeBindingResult` is the card the Outcome page renders. The render test covers a blocked Checkout, a successful Checkout, a protected Signup, and an unavailable page.
