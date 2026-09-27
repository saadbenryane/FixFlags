# Release evidence runbook

Operational companion to [the launch acceptance criteria in the product
masterplan](product-masterplan.md#11-launch-acceptance-criteria). That checklist
is the contract. This file says how each item is actually proven, and which
items are still waiting on something outside this repository.

It does not check any box. A checkbox moves only when a receipt exists for the
exact candidate revision.

## The one rule

Local implementation is not proof.

`npm run verify` proves the engine runs. It does not prove a customer's Checkout
worked, that a Flag opened on a real site, or that Codex can drive the loop. A
route existing, a unit test passing, or "implemented locally" never satisfies a
launch criterion. The criteria are proven in a release environment and in
production, on a frozen SHA, and recorded as receipts.

## Proven locally, still needs a receipt

These have a real test in this repository. They are wired into a release stage, so
`npm run verify:release` runs them for real. Until that run passes on the
candidate SHA, they are *implemented and specified*, not *proven*.

| Criterion | Proof |
| --- | --- |
| Outcome state scoped/current; untested behavior never Clear | `lib/sites/__tests__/binding-assessment.test.ts`, `lib/sites/outcome-state.ts`, plus `journey:outcome-loop` |
| One RunRequest executes every required binding | `lib/sites/__tests__/trigger-equivalence.test.ts` (7 triggers), `journey:outcome-loop` |
| One durable Outcome-linked Flag with evidence and limitation | `journey:outcome-loop` |
| Fix records change context without changing the verdict | `journey:outcome-loop`, the handoff step |
| Verify independently reruns matching scope; failure stays open | `journey:outcome-loop`, the unrepaired-verify step |
| UI, Watch, deployment, API, Shopify, MCP share one run path | `lib/sites/__tests__/trigger-equivalence.test.ts` |
| Flag only after a confirmed failure | `lib/sites/__tests__/availability-execution.test.ts`, `checkout-execution.test.ts` |
| Safe Signup requires an authorized reversible fixture | `lib/sites/__tests__/safe-form-executor.test.ts` |
| Outcome-first UI responsive, accessible, keyboard reachable | `journey:site-surfaces`, `e2e/site-surface-bar.ts` |
| Another owner cannot read, run, or verify a Site | `journey:tenant-isolation` |

## Waiting on credentials this repository does not hold

These cannot be closed here. Each needs a real session or a real deployment.

### 1. Production canary and exact-SHA attestation

Needs a real deployment of the candidate revision.

```bash
PRODUCTION_URL=https://fixflags.com \
RELEASE_EXPECTED_GIT_SHA=$(git rev-parse HEAD) \
npm run verify:release:stage deployed
```

`scripts/release-deployment-attestation.mjs` records the deployed commit.
`scripts/release-revision-attestation.mjs` refuses a release environment whose
reported commit is not the full expected SHA. `npm run smoke:release` then probes
the production origin. None of this has run.

### 2. Codex, Claude Code, and Cursor sessions

Criterion: each agent authenticates, resolves Site and Outcome, runs, reconnects
and polls, inspects a Flag, records a fix, and verifies.

Requires real interactive sessions in three external tools, with a real API key
scoped to a real Site. `journey:mcp-full-loop` proves the MCP *protocol* works,
not that those three agents complete the loop. Unproven.

### 3. Paid checkout opening

Stays closed. Opening requires blocker B5 in the masterplan: reliability and cost
evidence from real production Watch cycles. `DEV_SIMULATE_BILLING` exists for
tests and is not production evidence. Do not set `STRIPE_PAID_OPEN` or
`NEXT_PUBLIC_PAID_OPEN`.

### 4. Cost and reliability evidence

Criterion: telemetry for Outcome, run, Flag, Verify, Watch, MCP, queue,
notification, and cost is available, and the numbers are good enough to price Pro.
Needs real production runs, not synthetic load.

## Release sequence

Run from a clean candidate revision, in this order. Do not commit between stages:
the repo side-effect guard in `scripts/validate.mjs` fails the run if the working
tree changes mid-gate.

```bash
npm run doctor
npm run verify                 # 29 local checks
npm run verify:release         # foundation -> fixture-binding -> credentialed-core
                               # -> billing-open -> billing-closed -> external
                               # -> deployed
```

`verify:release` owns stage order. Each stage writes a receipt under
`test-results/release/$RELEASE_RUN_ID/`, and `verify:release:final` refuses a
release whose receipts do not all share one run id, one Git SHA, one database
identity, and separate release and production origins.

## Journey ownership

`scripts/release-journeys.mjs` is the release contract, not documentation:

- a journey in the Playwright report that is not listed there fails the run
- a stage that owns a missing, skipped, or failing journey fails the run
- a required journey with no PASS receipt fails the final gate

`scripts/release-journey-contract.test.mjs` keeps those lists in step with the
real specs. When a journey is added or retired, update the list in the same
commit, or the release run fails in one direction or the other.

| Stage | Journeys |
| --- | --- |
| `credentialed-core` | `outcome-loop`, `watch-truth`, `tenant-isolation`, `site-surfaces`, `anonymous-claim`, `passkey-2fa-recovery` |
| `billing-open` | `billing-webhook-active` |
| `billing-closed` | `billing-revoked` |
| `external` | `watch-child-notification` |
| parked, cannot block the web release | `mcp-full-loop`, `cli-registry-loop` |

## Fixtures the release run needs

`E2E_SITE_ID` is the claimed Site. `E2E_SITE_OWNER_EMAIL` /
`E2E_SITE_OWNER_PASSWORD` own it. `E2E_OUTCOME_ID` pins the Outcome under test and
defaults to the Site's first independently executable Outcome.
`E2E_DEPLOYMENT_TRIGGER_URL` / `E2E_DEPLOYMENT_TRIGGER_TOKEN` drive the controlled
fixture that induces and repairs the failure being verified. A Flag that FixFlags
did not independently catch proves nothing, so this fixture is mandatory rather
than a convenience.

A second, unrelated owner is required by `tenant-isolation`; it uses
`E2E_GATE_NON_MEMBER_EMAIL` / `E2E_GATE_NON_MEMBER_PASSWORD` and falls back to
the existing `E2E_WATCH_*` probe account.

## Reporting a result honestly

Cite `.agents/sessions/*` and the heartbeat packet, not recollection:

```bash
npm run agent:heartbeat -- --json
```

If a gate could not run, say so and leave the box unchecked. A criterion with no
receipt is open, regardless of how complete the code looks.
