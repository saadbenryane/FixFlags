# An expired Clear answer is Stale

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

The signed-in Outcome page for the local page-loads Outcome showed one Clear sentence in evidence, history, and How this is checked. The same history row was titled Couldn’t verify. The assessment was Clear and past its freshness window, so the current answer is Stale. The loader already had the next step, “Run a fresh verification before relying on this result,” and the page hid it because that line lived only inside the limitation section. How this is checked said the evidence remains current for 11520 minutes.

A first walk attempt against `localhost:3000` never left `/sign-in`. Better Auth rejected that origin. The configured auth origin is `http://127.0.0.1:3107`.

## Repair

History uses `outcomeStatusLabel(currentOutcomeState(assessment))`, the same words as the current answer. Stale stays Stale. The fresh-verification sentence renders with the current answer, including when there is no limitation section. The freshness line states the window, in days or hours when the minutes divide evenly, and a stale result adds “This result is past that window.”

## Evidence

- Before the title repair, `loadSiteOutcomeDetail` returned Couldn’t verify for an expired Clear assessment. After it, `lib/sites/__tests__/outcome-detail-evidence.test.ts` and `lib/sites/__tests__/outcome-state.test.ts` passed twice (24/24). A current Clear assessment is titled Clear. ESLint passed on the loader, the page, the state module, and both tests.
- The disclosure function was missing, then `outcomeFreshnessDisclosure` returned the 8-day rule for a current result and added the past-window sentence for Stale.
- Signed-in walk on `http://127.0.0.1:3107`, document status 200. Current answer: Stale. Recovery sentence visible. History title Stale, with the completed-check sentence as its detail, and no Couldn’t verify title. Evidence, history, and How this is checked include “FixFlags completed every required check for this Outcome.” No binding key and no version. The disclosure says 8 days and that this result is past that window. The limitation section is absent. No horizontal overflow at 1280×900 or 375×812. No console errors on the settled load. One earlier request during hot reload returned 500 from a webpack module error. The settled request did not.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Home now repeats this next step. That repair is `.agents/sessions/2026-10-05-outcome-home-stale-answer.md`. This local Outcome is still stale because its only check is from 2026-09-23. A fresh verification would replace Stale with a current Clear or a real Flag. That run was not started.
