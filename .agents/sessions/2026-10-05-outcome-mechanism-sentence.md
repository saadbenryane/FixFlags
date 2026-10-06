# How this is checked uses the evidence-card sentence

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

"How this is checked" listed each method as its binding key and version, for example `checkout-browser-v1 · version 1`. The evidence card on the same page already stated the result in a customer sentence.

## Repair

`loadSiteOutcomeDetail` now sets `customerSentence` from `customerBindingResult`, the same headline the evidence card renders. A method with no execution uses "This method has not produced evidence yet." The disclosure renders that sentence. The binding key remains the React key and stays out of the visible line. The version left that line with the key.

## Evidence

- Before the repair, the detail test received `undefined` where the Checkout sentence should have been. Receipt: scratch `outcome-mechanism-sentence-red.log` (vitest exit 1 at 23:08, 1 failed, 18 passed).
- After the repair, `lib/sites/__tests__/outcome-detail-evidence.test.ts` passed twice (19/19). The newest Checkout execution produces "FixFlags independently reached checkout." The page failure produces "The page was unavailable." A method with no execution produces the empty-evidence sentence. None of those lines contain the binding key or the word version. Receipts: `outcome-mechanism-sentence-1.log` and `outcome-mechanism-sentence-2.log`.
- ESLint on the loader, the test, and the Outcome page passed. Receipt: `outcome-mechanism-sentence-eslint.log`.
- No signed-in browser walk. The disclosure prints `customerSentence` from this loader.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

A later signed-in walk confirmed these sentences on the local page-loads Outcome, and found that an expired Clear was titled Couldn’t verify. That repair is `.agents/sessions/2026-10-05-outcome-stale-label.md`.
