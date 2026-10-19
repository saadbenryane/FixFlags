# Release evidence runbook

The current release profile is website-only public validation with one-website open-beta access. The [completion ledger](product-masterplan.md#public-website-validation-completion-ledger) supersedes broader machine-client launch obligations for this release. Parked MCP/CLI journeys cannot satisfy or block website acceptance. Account lifecycle, uptime, category rechecks, notification recovery, and acknowledged Site removal require actual execution evidence. GitHub Actions CI and Railway Wait for CI remain disabled by explicit release direction. Local verification and exact-revision deployment attestation must identify their actual proof source without manufacturing successful CI checks.

Record current domain, MX, receiving webhook, provider quota and runtime gate configuration in the candidate receipts. Credentials and enabled infrastructure do not establish lifecycle proof. Enable production automatic-account execution only after actual receiving-event processing and a controlled normal-engine lifecycle are verified. A natural scheduled production full-check cycle remains required. The owner subsequently directed this task to conduct usability review independently. Record agent task observations accurately, with no invented human participants or five-person study. Accelerated fixtures and automated interaction checks retain their separate evidence scope.

The isolated `public-validation` environment permits normal account execution only on its explicit controlled HTTPS origin while the production lifecycle gate remains false. The controlled target has its own database and external email/password signup, verification, session and deletion flows. Its protected controls induce real failures without adding test controls to customer routes. The required website capability journeys use a separate free-beta owner, including explicit acknowledgement when external account deletion remains unavailable.

Fixture binding requires `RELEASE_WATCH_MAILBOX`, a unique `validationalerts+<run>@fixflags.com` receiving alias. External notification proof uses `E2E_RESEND_API_KEY` only in the Node test process to inspect the stored provider message ID, Audit tag, delivery status and message count. No mailbox assertion endpoint substitutes for the actual provider. The fixture accelerates scheduling and remains separate from a natural production cycle. Historical Watch receipts retain null provider IDs when the reference was never recorded.

Operational companion to [the website completion ledger in the product
masterplan](product-masterplan.md#public-website-validation-completion-ledger). That ledger
is the contract. This file says how each item is actually proven, and which
items are still waiting on something outside this repository.

It does not check any box. A checkbox moves only when a receipt exists for the
exact candidate revision.

## The one rule

Local implementation is not proof.

`npm run verify:website` checks the website foundation. It does not prove a customer's Checkout
worked, that a Flag opened on a real site, or that Codex can drive the loop. A
route existing, a unit test passing, or "implemented locally" never satisfies a
launch criterion. The criteria are proven in a release environment and in
production, on a frozen SHA, and recorded as receipts.

## Rollback readiness

Before promotion, retain a private snapshot of the previous production web and worker deployment IDs, immutable image digests, custom variables and migration ledger. Recheck that the images remain restorable. Railway rollback restores the selected deployment's image and custom variables, so explicitly verify current authorization and automatic-account gates after restoration. A restart and a source rebuild establish different evidence. See [Railway rollback behavior](https://docs.railway.com/guides/roll-back-bad-deploy) and the [deployment API](https://docs.railway.com/integrations/api/manage-deployments).

The schema rehearsal generates the previous production client and exercises its actual reads and writes against the migrated candidate schema. Synthetic writes remain inside an intentionally rolled-back transaction, with absence verified afterward. Retain failed rehearsals and their corrected source separately. This proves schema compatibility, not an image restoration or a customer journey.

If rollback is required, retain the failed deployment and logs, stop admitting privileged work and let its current ownership settle before changing worker versions. Restore both recorded service deployments, preserve additive database changes and customer history, verify the exact prior SHA and image on each service, and inspect readiness and pending work before resuming execution. Keep automatic-account execution disabled until the restored implementation and retained lifecycle evidence justify it. Do not force-push, reverse additive migrations, delete queued history or label a rebuilt image as the previous immutable image.

The final production receipt must link the actual retained-image observation and schema rehearsal. A prepared command or a healthy endpoint alone cannot close rollback readiness.

## Historical migration custody

Production retains `20260723081407_scan_access` with a historical `manual-resolve` marker. That marker does not prove which SQL executed. Preserve it unchanged. The archived Git source contains drop/add statements and must not be restored to the active migration directory or replayed. The current migration history explicitly retains a no-op successor and creates the modern `scanAccessEncrypted` columns for fresh installs.

A read-only production inventory found the two additional `scan_access_encrypted` columns, with no populated values. The forward retirement migration locks both affected tables, checks both columns, and refuses the entire operation if either contains data. It preserves the modern encrypted-access columns. Required PostgreSQL acceptance covers empty retirement, rejection without a partial drop, idempotence and a writer that commits a legacy value while retirement waits for its lock.

Before production upgrade, compare the actual schema with the previous released schema plus this precisely described legacy variant, and retain the population observation. After the normal forward migrations, require an exact comparison with the candidate schema. Keep the historical execution limitation explicit; never replace its marker with an invented checksum or erase its receipt.

Task preparation is read only. The current Site control acknowledges a handoff after the native clipboard write completes, using the original source Flag and a hash of the prepared task. Changed guidance refuses acknowledgement. The `website-clipboard-v2` marker and separate idempotency keys preserve older request events and their timestamps. Historical requests remain unconfirmed clipboard observations. A direct compatibility API request does not establish physical clipboard completion. Published-repair acceptance must use the real Site control, native clipboard readback and the corresponding stored acknowledgement.

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
| Clipboard denial or pending work cannot record a copied handoff | `components/sites/__tests__/SitePromptCopyButton.test.tsx`, `lib/improvements/handoff-custody.integration.test.ts` |
| Verify independently reruns matching scope; failure stays open | `journey:outcome-loop`, the unrepaired-verify step |
| UI, Watch, deployment, API, Shopify, MCP share one run path | `lib/sites/__tests__/trigger-equivalence.test.ts` |
| Flag only after a confirmed failure | `lib/sites/__tests__/availability-execution.test.ts`, `checkout-execution.test.ts` |
| Safe Signup requires an authorized reversible fixture | `lib/sites/__tests__/safe-form-executor.test.ts` |
| Outcome-first UI responsive, accessible, keyboard reachable | `journey:site-surfaces`, `e2e/site-surface-bar.ts` |
| Another owner cannot read, run, or verify a Site | `journey:tenant-isolation` |

## Required external proof

Resolve access from the current environment and record the prerequisite check. Each item needs actual execution on the candidate revision; old credential and deployment snapshots cannot establish current readiness.

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
the production origin. Record the actual attestation and smoke receipts for the candidate; an earlier revision does not satisfy this requirement.

### 2. Codex, Claude Code, and Cursor sessions (parked)

Criterion: each agent authenticates, resolves Site and Outcome, runs, reconnects
and polls, inspects a Flag, records a fix, and verifies.

For each client, first connect with a `Read evidence` key and record that a
`fixflags.run` call is rejected with `INSUFFICIENT_SCOPE`. Then reconnect with a
non-expired `Fix and verify` key for the full loop. Also record rejection of one
expired key. This proves the client is using the credential under test rather
than an ambient account session and covers the permission/expiry boundary named
in the launch contract.

Requires real interactive sessions in three external tools, with a real API key
scoped to a real Site. `journey:mcp-full-loop` proves the MCP *protocol* works,
not that those three agents complete the loop. The October 6 local host preflight remains in Git history. It did not
establish client acceptance. Recheck installation, authentication and
authorization for each fresh candidate. Unproven.

### 3. Paid checkout opening

Stays closed. Opening requires blocker B5 in the masterplan: reliability and cost
evidence from real production Watch cycles. `DEV_SIMULATE_BILLING` exists for
tests and is not production evidence. Do not set `STRIPE_PAID_OPEN` or
`NEXT_PUBLIC_PAID_OPEN`. The `billing-open` release stage runs
`watch:launch-readiness -- --require-pass --release-gate` before its Stripe
journey and records the SHA-bound Watch projection as a hashed release artifact.
It cannot pass while any Watch gate is collecting, unavailable, or failed.

### 4. Cost and reliability evidence

Criterion: telemetry for Outcome, run, Flag, Verify, Watch, MCP, queue,
notification, and cost is available, and the numbers are good enough to price Pro.
Needs real production runs, not synthetic load.

## Release sequence

Release commands default to `RELEASE_PROFILE=free-launch`. This profile requires every stage below except `billing-open`; its credentialed core contains website journeys, including accounts, uptime, category rechecks and removal. The separate `RELEASE_PROFILE=paid-opening` profile retains `billing-open`, including production Watch cost/reliability proof. The `billing-closed` stage still requires its real Stripe test-mode and access-revocation proof but does not require the production Watch cost database. Each receipt records its profile; the final gate rejects missing or mixed-profile evidence. Historical receipts without the profile must be rerun.

MCP protocol and external agent sessions remain parked outside website acceptance. The historical credentialed matrix remains in Git history. Agent task observations identify their observer accurately and cannot establish a human usability study.

Run from a clean candidate revision, in this order. Do not commit between stages:
the repo side-effect guard in `scripts/validate.mjs` fails the run if the working
tree changes mid-gate.

```bash
npm run doctor
npm run verify:website         # website foundation; parked transports verify separately
npm run verify:release         # free-launch: foundation -> fixture-binding
                               # -> credentialed-core -> billing-closed -> external -> deployed
RELEASE_PROFILE=paid-opening npm run verify:release
                               # also requires billing-open before billing-closed
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
| `credentialed-core` | `outcome-loop`, `watch-truth`, `tenant-isolation`, `site-surfaces`, `category-recheck`, `automatic-account-lifecycle`, `uptime-lifecycle`, `site-removal`, `anonymous-claim`, `passkey-2fa-recovery` |
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

`billing-open` also requires `RELEASE_WATCH_READ_DATABASE_URL`, an
operator-controlled read-only PostgreSQL connection to the durable Watch cohort.
It must not identify the disposable `RELEASE_FRESH_DATABASE_URL`. The gate opens
a read-only transaction, writes no customer data, and stores only a database
identity hash plus aggregate reliability/economics evidence in the receipt. The
connection value is never serialized.

## Reporting a result honestly

Cite the staged or final release receipt produced by this runbook, not a chat
summary, archived session, or recollection.

If a gate could not run, say so and leave the box unchecked. A criterion with no
receipt is open, regardless of how complete the code looks.
