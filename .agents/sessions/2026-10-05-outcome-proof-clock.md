# Outcome proof uses customer method names and the shared clock

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

The Outcome proof card titled each method by title-casing the internal mechanism. A page check read “Http availability,” a purchase check “Browser journey,” and a form “Safe form.” Last verified, last successful verification, observed evidence, and history used the host clock, so the same instant Home shows as “Sep 23, 2026, 10:57 PM UTC” appeared on the proof page as a different local time with no zone.

## Repair

The proof card uses `customerMechanismLabel`. Checkout is Purchase path, a safe form is Form, page availability is Page availability, and any other method is Check. Those four times use `formatEvidenceTimestamp`.

## Evidence

- Before the repair, the Outcome page test rendered Browser journey, Safe form, Http availability, and Custom signal, and stamped proof at “2026-09-23, 11:57:11 p.m.” It could not find Purchase path.
- After the repair, the Outcome page test and the method-name state test passed twice (6/6). ESLint passed. Purchase path, Form, Page availability, and Check are the headings. The shared UTC clock appears on the answer, the evidence, and history. The internal titles are absent.
- Settled signed-in walk on `http://127.0.0.1:3107`. Home and the local page-loads Outcome both returned 200. The Outcome stayed Stale. Evidence was titled Page availability. Http availability and Browser journey were absent. The answer, the observation, and history all read “Sep 23, 2026, 10:57 PM UTC,” and Home showed that same instant. No horizontal overflow at 1280×900 or 375×812. No console errors on the settled walk. An earlier Home request during hot reload returned 500. The retry was 200.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Flag verification attempts still format their time with the host clock and show the raw builder name. That line was not changed.
