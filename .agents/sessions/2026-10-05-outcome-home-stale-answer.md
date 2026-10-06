# Home says a stale Clear needs a fresh verification

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

The Outcome page for an expired Clear already said Stale and asked for a fresh verification. Home still led with “FixFlags completed every required check for this Outcome.” and “Last verified,” so the first screen read as a result the customer could rely on.

## Repair

The Home card keeps that last answer and adds “Run a fresh verification before relying on this result.” The freshness line uses the same disclosure as the Outcome page, so a stale result says it stays current for 8 days and that this result is past that window. A current Clear does not get that next step. The detail loader uses the same recovery sentence.

## Evidence

- Before the repair, the Site board test found Stale and the completed-check sentence, and did not find the fresh-verification sentence.
- After the repair, `components/sites/__tests__/SiteBoard.test.tsx`, `lib/sites/__tests__/outcome-detail-evidence.test.ts`, and `lib/sites/__tests__/outcome-state.test.ts` passed twice (53/53). A current Clear stays free of the stale next step. ESLint passed.
- Signed-in walk on `http://127.0.0.1:3107`. Home and the page-loads Outcome both returned 200. Home showed Stale, the completed-check sentence, the fresh-verification sentence, 8 days, and “This result is past that window.” The Outcome page showed the same answer, the same recovery sentence, and the same past-window line after How this is checked was opened. No horizontal overflow at 1280×900 or 375×812. No console errors.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

The local page-loads check is still from 2026-09-23. A fresh verification would replace Stale with a current Clear or a real Flag. That run was not started.
