# Check again shows why a Site check cannot start

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

Check again replaced every refusal except a plan limit with “Could not start a new check.” A Site that already had a run in progress, and any other refusal with its own sentence, looked like a broken button.

## Repair

Home shows the reason the server returned. When that reason is missing, the generic line remains. A plan-limit sentence still wins because it is the server message. Signing in on a 401 is unchanged.

## Evidence

- Before the repair, the board test could not find “Another Site run is already in progress.”
- After the repair, the Site board tests passed twice (30/30). ESLint passed. A spent allowance still shows the limit sentence. Stale evidence stays on the card, and Check again can be pressed again.
- A signed-in Home returned 200. A card whose last check was out of date offered Check again. The runs request was answered with the busy-Site refusal and did not start a check. The page showed “Another Site run is already in progress” and did not show “Could not start a new check.” No horizontal overflow at 1280×900 or 375×812. No console errors other than the refused request. The local fixture’s check time was restored afterward.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Pause, settings, and connection actions still read `error` on routes that send `message`. Those were not changed.
