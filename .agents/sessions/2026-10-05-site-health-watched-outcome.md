# A watched Outcome keeps the Site from reading healthy

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

Site health could say “0 Flags” and healthy after a finished check when a watched Outcome was stale, unverified, or a Flag. Zero open Flags was treated as a current answer.

## Repair

`siteCardHealth` reads enabled Outcome states before it returns healthy. A Flag says the watched result needs a fix. A stale result says it is out of date. An unverified result says it could not be verified. A paused Outcome does not change the Site label. Home passes those states into the same health decision.

## Evidence

- Before the repair, a finished Site with evidenced starter areas and one enabled stale Outcome still returned `healthy` and “0 Flags.”
- After the repair, the site-card and check-notice tests passed twice (24/24). ESLint passed. A current Clear is unchanged. A paused stale Outcome stays “0 Flags.” A Flag and an unverified Outcome do not.
- Signed-in Home on `http://127.0.0.1:3107` returned 200. The page showed Stale and did not say “0 Flags,” because that Site still has open Flags. No horizontal overflow at 1280×900 or 375×812. No console errors on the settled walk. An earlier request during hot reload logged a 500. The retry was clean. The zero-Flag case is the unit test, not this Site.
- A later signed-in Site with zero open Flags and one enabled stale Outcome returned 200. The Site status was “Coverage incomplete,” and the lead was “Checked some areas. Others are not verified yet.” Security and Tracking said “Not checked yet.” Checked areas still said “0 Flags.” The stale-Outcome branch did not decide the Site. No overflow at 1280 or 375. No console errors. That gap is owned by `site-module-coverage-2026-10-05`.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

The zero-Flag walk showed the stale-Outcome decision was unreachable while Security and Tracking stayed unevidenced. That follow-up counts completed module receipts. Pause, settings, and connection actions still read `error` on routes that send `message`. Those were not changed.
