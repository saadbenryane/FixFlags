# Agent-led report workspace completion

**Status:** P0 through P6 implemented locally on `main`.
**Remaining:** P7 credentialed release and production journey proof.
**Canonical specification:** [`GOAL_BRIEF.md`](../../GOAL_BRIEF.md).

## Shipped contract

- One title-free Agent panel renders deterministic scan messages, confirmed Flag announcements, authenticated user messages, and model replies through one transcript contract.
- Deterministic scan messages are reconstructed from persisted audit facts, create no chat rows, and consume no model tokens.
- Anonymous visitors receive the progressive and completed Report, scores, all confirmed Flags, screenshots, textual evidence, and public-safe technology context.
- Anonymous visitors receive no fix prompts, interactive conversation, Timeline payload, private history, Product Memory, update-review controls, export, restricted sharing, or Canvas data.
- Authentication returns through `/post-login`, validates a signed anonymous claim, claims the review, and restores the same workspace.
- Free, Pro, and Studio Agent chat allowances are 25,000, 500,000, and 2,000,000 input-plus-output tokens per UTC calendar month.
- Timeline is authenticated.
- Canvas is paid, private, schema-driven, evidence-grounded, immutable by version, and records provider-reported model usage.
- Mobile uses Agent and Report tabs.
Active reviews default to Agent and never force a tab switch at completion.

## Local proof already collected

| Proof | Result |
|---|---|
| Focused Agent, report, access, claim, billing, history, and Canvas suites | Pass |
| Final focused integration selection | 72 tests passed |
| TypeScript and scoped lint | Pass |
| Database schema, migration status, and drift | Pass |
| `npm run completeness:audit` | Pass |
| `npm run accuracy:eval` | Pass |
| Full `npm run verify` | Pass: 3,800 tests, application build, worker build, npm audit, and container build |
| Real anonymous URL review | Pass: `example.com`, completed in 23 seconds with 18 Flags |
| Responsive browser review | Pass at 375, 768, and 1280 pixels with no horizontal overflow |
| Anonymous serialization | Pass: evidence present; prompts, Timeline, owner identity, pipeline internals, and private Product data absent |

After the final copy-only correction, all changed-file gates passed through the application and worker builds.
The container rerun could not start because Docker Desktop returned an internal metadata database I/O error and then reported that its daemon could not start.
An earlier full container build passed from the same implementation.

## Do not redo

- Do not rebuild the workspace, message projection, history service, allowance ledger, or Canvas domain without a failing acceptance journey.
- Do not restore the blocking anonymous report modal, separate Activity card, raw action labels as Agent messages, per-report chat turn cap, or anonymous demonstrated prompt.
- Do not add compatibility routes, feature flags, timer-based progress messages, or model-generated pipeline state.
- Preserve all current working-tree changes.

## P7 continuation procedure

1. Restore Docker Desktop health and prove `docker info` succeeds.
2. Run `npm run agent -- verify`.
3. Provision every input listed by `node scripts/release-preflight.mjs`.
Use a disposable release database and set `RELEASE_ALLOW_DATABASE_RESET=true` only with explicit operator consent.
4. Run `npm run verify:release` without skips.
5. Execute and sign the journeys in [`credentialed-journey-matrix.md`](./credentialed-journey-matrix.md): anonymous claim, Free chat and Timeline, Pro Canvas, Studio project allowance, revoked entitlement, protected sharing, update review, Product Watch, GitHub, MCP, and CLI.
6. Run production first-value dogfood: submit a new URL, observe truthful Agent updates, inspect every public Flag and its evidence, authenticate and confirm the same report is claimed, send a metered chat message, open Timeline, create and revise Canvas on a paid owner, then run an update review.
7. Inspect browser console and network responses at 375, 768, and 1280 pixels, reduced motion, dark mode, keyboard-only navigation, and 200% zoom.
8. Record report IDs, timestamps, screenshots, command results, and operator initials in the credentialed journey matrix.
9. If every row passes, mark `agent-p7-release-proof` and `fixflags-agent-workspace` done in `.agents/BOARD.md`, mark `.agents/GOAL.md` complete, and move the achieved summary into the completed board.

## Required release inputs

- `RELEASE_FRESH_DATABASE_URL`
- `RELEASE_ALLOW_DATABASE_RESET=true`
- `RELEASE_CONTAINER_ENV_FILE`
- `RELEASE_SMOKE_URL`
- `E2E_AUDIT_URL`
- Signup, 2FA, WebAuthn, Free billing, paid billing, protected-share, Product Watch, GitHub, MCP, and CLI sandbox fixtures printed by `node scripts/release-preflight.mjs`

Missing inputs remain blockers.
They must never be converted into skipped tests or local mocks.

## Completion verdict

The product implementation is locally complete.
The release verdict remains **PARTIAL** until the credentialed release command and production role matrix pass.
