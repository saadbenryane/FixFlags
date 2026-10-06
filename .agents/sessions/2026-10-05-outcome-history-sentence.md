# Outcome history uses the customer sentence

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

History titled each check with the binding key and a disposition word, then put the raw reason code underneath. A customer read "checkout-browser-v1 succeeded" and "checkout_reached", or "page-availability-v1 blocked" and "not_public". The evidence card on the same page already used a customer sentence.

## Repair

Each history attempt now uses `customerBindingResult`, the same sentence as the evidence card. The title is the result. The detail is the evidence sentence when one exists. The page omits an empty detail line. Older attempts stay on the timeline. The mechanism disclosure still lists the binding key.

## Evidence

- Before the repair, the history test received `checkout-browser-v1 succeeded` / `checkout_reached`, `page-availability-v1 blocked` / `not_public`, `signup-safe-form-v1 blocked` / `protected_or_irreversible`, and `checkout-browser-v1 blocked` / `no_buy_control`. Receipt: scratch `outcome-history-sentence-red.log` (vitest exit 1 at 23:06:00, 1 failed, 17 passed).
- After the repair, `lib/sites/__tests__/outcome-detail-evidence.test.ts` passed twice (18/18). The four attempts use the Checkout, page, and Signup sentences, in newest-first order. Receipts: `outcome-history-sentence-1.log` and `outcome-history-sentence-2.log`.
- ESLint on the loader, the test, and the Outcome page passed. Receipt: `outcome-history-sentence-eslint.log`.
- No signed-in browser walk. The Outcome page prints `event.title` and, when present, `event.detail` from this loader.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

The mechanism disclosure is recorded in `.agents/sessions/2026-10-05-outcome-mechanism-sentence.md`. A signed-in walk of the Outcome page is still missing.
