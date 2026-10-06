# Flag verification shows why it cannot start

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

Verify fix on a Flag read `error`. The Flag verify route sends `message` for a missing comparable scope, a missing Flag, an invalid change summary, and a busy Site. The page then said “Could not start verification.”

## Repair

The Flag action reads `message`, then `error`, then the generic sentence. Sign-in and claim responses that use `error` with `signup` still redirect. The route already returned `message`. That contract is now tested.

## Evidence

- Before the repair, the Flag action test received “Could not start verification” for a body whose `message` was “This Flag has no comparable source scope to verify.”
- After the repair, `components/sites/__tests__/SiteFlagActions.test.tsx` and the Flag verify route test passed twice (6/6). A `message` body and an `error` body both appear. The route returns that comparable-scope sentence in `message` at 400, and a busy-Site `SiteRunRefusal` at 409. An unexpected internal string is not the assertion here. ESLint passed.
- Signed-in walk of an open local Flag on `http://127.0.0.1:3107`. The page returned 200. Verify fix then showed “This Flag has no comparable source scope to verify.” The generic sentence was absent. No horizontal overflow at 1280×900 or 375×812. The only console error was the intercepted 400 from that Verify request. The browser answered the POST locally so the walk would not start a real run. The route test is what proves the server returns `message`.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Pause, settings, and connection actions still read `error` on routes that send `message`. Those were not changed.
