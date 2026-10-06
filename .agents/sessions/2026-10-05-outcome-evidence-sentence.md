# Outcome evidence uses the customer sentence

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b`.

## Customer failure

The Outcome evidence card turned a binding result into title case. A blocked Checkout showed "Blocked" and "No buy control" even after the assessment and Home card had the purchase sentence. Signup and page availability did the same with their reason codes.

## Repair

The evidence card now renders `OutcomeBindingResult`. Checkout uses `checkoutResultCopy`: the summary is the result, and the evidence sentence sits under it. Other bindings use `summaryFor`, so a protected Signup and an unavailable page keep their existing customer sentences. The method name, observation time, and technical JSON stay where they were.

## Evidence

- `components/sites/__tests__/OutcomeBindingResult.test.tsx` renders the component the Outcome page mounts. Both runs passed 4 tests. A blocked Checkout shows the purchase summary and evidence, and does not show "Blocked" or "No buy control". A successful Checkout shows the reached-checkout sentences. A protected Signup and an unavailable page show their customer sentences.
- ESLint on the card, page, and outcome-state files passed.
- No signed-in browser walk. The rendered component is the evidence block on the Outcome page.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed.
