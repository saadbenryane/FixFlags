# Verify shows why it cannot start

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

The Outcome page told the customer to verify again, then hid the reason when Verify could not start. The button read `error`. The API sends `message`. A Site that already has a run threw a plain error, and the route turned that into a generic 500, “Could not start this verification.”

## Repair

`SiteRunRefusal` carries the customer sentence and a status. A busy Site, a conflicting idempotency key, a missing Outcome, and a missing verification source use it. `handleRouteError` returns that sentence. The Verify button shows `message`. An unexpected error stays the generic sentence and does not include the internal text.

## Evidence

- Before the repair, the button test did not find “Sign in to verify this Outcome.” The verify route returned 500 for a busy-Site refusal.
- After the repair, the button test, the verify route test, and `lib/sites/__tests__/run-requests.test.ts` passed (36/36). A second run that also included the Site runs route passed (40/40). A third run of the first three files passed again (36/36). The busy-Site case thrown by `requestSiteRun` is a `SiteRunRefusal` with status 409. An unexpected error stays “Could not start this verification” and does not include the internal text. ESLint passed.
- Signed-in walk of the local page-loads Outcome on `http://127.0.0.1:3107`. The page returned 200. Verify then showed “Another Site run is already in progress.” The generic failure line was absent. No horizontal overflow at 1280×900 or 375×812. No console errors. The browser answered that POST locally so the walk would not start a real run. The route test is what proves the server returns that sentence and status.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

The local page-loads check is still from 2026-09-23. A fresh verification that the server accepts would replace Stale with a current Clear or a real Flag. That run was not started.
