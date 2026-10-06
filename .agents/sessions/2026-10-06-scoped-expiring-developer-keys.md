# Scoped, expiring developer keys

**Task:** `scoped-expiring-developer-keys-2026-10-05`
**Status:** locally implemented; production and external-client verification remain open

## Customer outcome

A customer creating a developer key can now choose what the agent may do and when the key expires. The default is `Read evidence` for 90 days. Starting runs and completing the Fix → Verify loop are explicit opt-ins. CLI device approval creates a 90-day full-workflow key so the existing one-command bridge remains usable without becoming permanent.

## Contract

- `Read evidence`: Sites, Outcomes, run results, and Flags only.
- `Run checks`: read access plus starting Outcome runs; no fix recording or verification.
- `Fix and verify`: the complete Outcome/Flag workflow.
- New keys expire after 30, 90, or 365 days and secrets remain one-time-only.
- Any non-empty scope set is enforced for API-key/stdio credentials as well as OAuth credentials.
- Existing empty-scope account keys retain historical full access and are labeled `Legacy full access` until replaced or revoked.
- Expired keys do not appear as active and do not consume the active-key limit.
- OAuth access tokens do not appear in the developer-key inventory or consume its five-key limit.

## Evidence

- Focused policy, OAuth, API route, CLI-device, and rendered UI tests: 5 files, 21 tests, all passed on 2026-10-06.
- The route tests prove default read-only/90-day creation, full access as opt-in, invalid policy rejection before secret creation, active-key filtering, and secret/hash redaction.
- The rendered UI test proves access and expiry are visible controls and the submitted contract is explicit.
- The scope test proves an audience-less read-only key cannot call `runs:write`, while historical empty-scope keys retain compatibility.
- A completed neighboring Site coverage change initially blocked TypeScript because its const projection froze a Prisma `in` array. The separate review repair in `.agents/sessions/2026-10-06-site-module-coverage-typecheck-unblock.md` preserved that behavior and restored integration.
- The 16-command affected manifest passed.
- The final full 30-command manifest passed after the ledger updates, including security audit, 5,000+ unit tests, coverage, accuracy, optimized Next build, worker bundle, and production container: `.agent-runs/2026-10-06T14-52-53-492Z-container-build.log`.

## Not proven

- No client authenticated with these keys against production.
- The Codex, Claude Code, and Cursor matrix remains open.
- MCP discovery remains off, the CLI package remains unpublished at 1.0.5, and no release/deploy occurred.
- Strict release continuity passed. The release foundation then stopped safely because the shared candidate contains tracked and untracked source changes; receipt: `test-results/release/2026-10-06-local-gate/foundation.json`. It did not run a database reset or deployment.
