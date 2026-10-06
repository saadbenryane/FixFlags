# Shared candidate integration

**Task:** `shared-candidate-integration-2026-10-06`
**Status:** locally integrated; not pushed or deployed

## Outcome

The shared workspace no longer leaves completed Outcome, Flag, developer-access, and dependency-security work as an anonymous dirty tree. The candidate preserves every current owner contribution together as one reviewable Git revision so later release receipts can attest an immutable SHA.

The integrated customer changes include:

- Checkout is inferred only from a page where a purchase can start, and Clear requires the independent attempt to use a buy control before reaching checkout.
- Outcome Home/detail and Flag verification surfaces retain the latest customer answer, specific refusal/recovery reason, stable UTC evidence time, and customer-readable mechanism/history language.
- Site health cannot say `0 Flags` while an enabled Outcome is stale, unverified, or has a Flag.
- Developer keys are permission-scoped and expiring, with read-only/90-day defaults and preserved legacy-key compatibility.
- Newly published runtime and build-tool advisories resolve to patched versions without weakening the permanent security gate.

## Coordination and review

- `collaboration.list_agents` showed only `/root` active before the Git operation.
- All 101 tracked and untracked source/evidence paths were inventoried. The source diff and new purchase, checkout-inference, run-refusal, Outcome-evidence, and developer-key modules were reviewed in place.
- Existing per-outcome session records remain the detailed evidence for their owner scopes. No contribution was discarded, rewritten, or selectively omitted.
- A changed-file scan found no focused/skipped tests, TODO/FIXME markers, or long secret-shaped `ff_live_` values.
- `git diff --check` passed.

## Verification

- The final pre-integration 30-command manifest passed on the exact source candidate, including database validation/drift, TypeScript, lint, all repository guards, runtime/toolchain audit, 5,000+ tests, coverage, accuracy, optimized Next build, worker bundle, and production container: `.agent-runs/2026-10-06T14-52-53-492Z-container-build.log`.
- A fresh `npm run security:audit` passed immediately before integration: the runtime graph is clean and the toolchain contains only the reviewed build-only `braces` chain.
- Heartbeat returned `ok: true` with no blocked or queued work.
- A read-only production check after integration returned healthy database, Redis, migrations, worker, browser, storage, AI, auth, billing, email, and Product Watch. Production still reported commit `dd1c247b32696822436af66d064d70164cb65e9f`, so none of this local candidate is represented as deployed evidence.

No push, deployment, database reset, MCP discovery opening, CLI publication, or paid-access change occurred.
