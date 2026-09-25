# Independent monitor launch engine

Date: 2026-09-22
Task: independent-monitor-launch-completion
Owner: grok

## What changed

Continued the in-progress Outcome run model. A RunRequest still selects one or more Outcomes and one Audit. The worker now executes every required binding, not the first Checkout binding.

- Checkout keeps the existing browser probe.
- Page availability uses a public HTTP check and opens a Flag when the response fails.
- Signup and other protected forms are recorded as blocked. FixFlags does not submit them unless a later safe fixture exists. Even an authorized reversible fixture currently stays Couldn’t verify, because no safe form runner is wired.
- Clear requires every required binding. Blocked or missing evidence stays Couldn’t verify. Stale is still derived from `validUntil` at read time.
- Reads do not reconcile. A copied fix still does not change the verdict.
- Watch selects every bound Outcome in one request. A Site with no required binding uses diagnostic care in the same application module.
- Railway accepts the API key and webhook secret only in headers, and only starts work for an owned Site.
- MCP publishes protected-resource and authorization-server metadata, authorization code with PKCE, audience-bound access tokens, refresh rotation, revocation, and 401/403 scope challenges. Existing API keys remain the CI and local-bridge credential.

## What was not proven

No credentialed Codex, Claude Code, or Cursor session. No production canary, migration rehearsal against a live database, or paid-checkout opening. The launch checklist in `docs/product-masterplan.md` stays open.

## Checks

`npx tsc --noEmit` passed. Focused Vitest: binding assessment, checkout execution, run requests, verify flag, project watch, OAuth contract, Railway webhook, and public scope. 79 tests in those files after the Signup case, plus the earlier 78 before that case was added.
