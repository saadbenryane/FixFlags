# Flag attempts use a customer source and the shared clock

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

A Flag verification attempt printed the stored builder next to the host clock. A Site attempt read “site,” a copied handoff read “copy,” and an unknown token was shown raw. The time did not match the UTC evidence clock used on Home and Outcome proof.

## Repair

The attempt line uses `customerAttemptSource` and `formatEvidenceTimestamp`. Site and web attempts say “From this Site.” A copy says “Copied instructions.” Named editors keep their product names. Any other token says “Recorded attempt.”

## Evidence

- Before the repair, the Flag page test rendered “2026-09-23, 11:57:11 p.m.” beside `site`, `copy`, and `custom_signal`. It could not find “From this Site.”
- After the repair, the Flag page test and the attempt-source test passed twice (4/4). ESLint passed. The page shows From this Site, Copied instructions, and Recorded attempt with the shared UTC clock. The raw tokens are absent.
- The local database has no improvement attempts, so a stored Flag cannot show this line. A signed-in walk of an open Flag on `http://127.0.0.1:3107` returned 200, showed “No independent verify yet. Copy never resolves this Flag.” and Verify fix, and did not show a raw builder. No horizontal overflow at 1280×900 or 375×812. No console errors. The shipped page render is the proof of an attempt that exists.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Pause, settings, and connection actions still read `error` on routes that send `message`. Those were not changed.
