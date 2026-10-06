# Security and measurement receipts count toward Site coverage

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

A Site with no open Flags and one enabled stale watched Outcome still read as coverage incomplete. Security and Tracking said they were not checked. The Site never reached the stale watched-result answer. Checked areas still said “0 Flags.”

Home loaded only the accessibility module receipt. Finished local audits already stored completed trust, security, and measurement receipts.

## Repair

A completed trust receipt and a completed security receipt evidence Security. A completed measurement receipt evidences Tracking. A not-applicable receipt does not. Home loads those receipts with the accessibility receipt. The card answers are “Security checked” and “Measurement checked.”

## Evidence

- Before the repair, completed trust, security, and measurement receipts still left Security as “Not checked yet.”
- After the repair, the site-card and check-notice tests passed twice (25/25). ESLint passed. One completed module is not enough for Security. Not-applicable receipts leave both areas unknown. With both security receipts and the measurement receipt, a stale enabled Outcome makes the Site status “Stale” and the answer “A watched result is out of date.”
- A signed-in local Site with zero open Flags, one enabled stale Outcome, a finished check, and those three completed receipts returned 200. The lead was “A watched result is out of date.” The Site status was “Stale,” and its state was unknown. The watched Outcome showed the fresh-verification sentence. Security and Tracking no longer said “Not checked yet.” No Current Flags section. No horizontal overflow at 1280×900 or 375×812. No console errors.
- Those three receipts on the local Site use the same target keys and completed status the check pipeline stores. They were not a new browser run of that host. Separate local audits already had completed trust, security, security-headers, and measurement receipts before this change.
- Checked areas still show “0 Flags” on the area signal. That names the area, not the Site. The Site status does not say “0 Flags.”
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Area signals still say “0 Flags” when that area has no Flag, including beside a stale Site. That was left as the area fact.
