---
status: supporting
authority: evidence
reviewed_at: 2026-10-28
supersedes: []
---

# Foundation completion review

This is a code-backed reassessment and delivery plan for the deployed website
product at `a7ab7ab8844718015ce763d692c66d87f935b1f7`. It supplements the
[existing completion plan](product-masterplan.md), which remains the execution
home. It does not replace the accepted product model, reopen commercial gates,
or establish that the remaining work has shipped.

The product must let an owner understand a consequential problem, inspect its
evidence, give a useful task to a developer or AI, publish a repair, independently
verify the result, and leave the Site being watched. A finished analysis, copied
prompt or healthy deployment is evidence of only its own step.

## Review scope and current evidence

- Source and focused tests were inspected on clean `main` at the deployed
  revision. The completed five-part refactor remains the baseline, not a new
  rewrite assignment.
- The preceding release verified matching web/worker revisions and preservation
  hashes for 154,098 retained tasks and 131,702 receipts. The task table retained
  its identity. Actual production-backup restoration remains unverified.
- A new public health read at 15:38 UTC on October 28 returned the same revision,
  HTTP 200 and healthy `free-launch` readiness. Automatic accounts remained
  explicitly disabled. Monitoring diagnostics reported no current schedule or
  notification gaps in that snapshot.
- That same read reported `browser_context_leak` in worker diagnostics. Three
  further observations at 15:38:45, 15:39:01 and 15:39:16 UTC each reported one
  browser context, no active/waiting/delayed execution jobs, no unfinished Audit,
  and a fresh worker heartbeat. The anomaly is observed; its owner and root cause
  are not established. It must not be dismissed as a harmless race or declared a
  proven orphan without further investigation.
- Retained light-theme Overview, Flag and Settings renders were inspected at
  320px and 1280px. Their UI source is unchanged by the final migration-only
  revision. They exercise a deliberately incomplete local fixture, including
  missing capture and unavailable written summary. They are evidence about those
  states, not proof that production capture fails or the ordinary first visit is
  unusable.
- Forty existing component and operational unit checks passed across four files.
  They verify current behavior, including some presentation that needs review.
  No fresh browser/E2E run, provider send, account mutation or production database
  access was performed for this reassessment.

Local observation artifacts are retained under
`test-results/runtime/foundation-review-20261028/`. They are ignored, checkout-local
evidence, not a portable acceptance certificate.

## Keep the completed foundation

Preserve the persistent Site and claim identity, one progressive execution
engine, typed admission intent, physical task/receipt separation, immutable
observations, same-Audit provenance, effect-time authority, and viewer-scoped
resource ownership. Preserve historical report compatibility and original
customer decisions. Do not rebuild a second engine, task system or dashboard.

The current Site audit selectors in
`lib/sites/application/site-execution.ts` already omit full `workInput` and
`workResult` payloads. The settings read scope also removes its private management
queries from overview refresh. Further read splitting needs measured query,
payload and interaction costs. Visible history must not disappear merely to make
a loader smaller. File length alone is not refactoring evidence.

Keep the approved Inter/Inter Tight system, folded-F identity, authored themes,
tonal cards, whitespace grouping and shared controls. Preserve the owner's
orange/white contrast exception and disclose it. It is not an AA pass. Fix other
accessibility defects independently. Keep paid enrollment, public MCP/CLI
expansion and unvalidated connections under their existing decisions.

## Findings that change the remaining plan

| ID | Classification | Finding and implementation owner | Required result |
| --- | --- | --- | --- |
| F01 | P0, observed live anomaly | Worker diagnostics retain a native context while all counted execution lanes are idle. `lib/queue/estimate.ts` counts the audit/progressive queues; `lib/admin/runtime.ts` also runs a separate administrative queue. A context count alone cannot identify its owner. | Account for every legitimate browser owner, then either correct the diagnostic omission or close the actual lifetime defect. Demonstrate correct physical cleanup and capacity accounting. |
| F02 | P1, confirmed diagnostic semantics | `touchWorkerHeartbeat` refreshes `lastSuccessfulBrowserProbeAt` whenever `browserOk` is true, while the worker supplies browser connection status. `stalledJobCount` is a lifetime Redis increment, not a current stalled-work gauge. The worker bootstrap HTTP server also returns unconditional 200 before child readiness. | Separate connected, actual probe success, current work, historical events, and application readiness. Each timestamp and status must have a real producer. |
| F03 | P1, confirmed visible state ambiguity | `BoardCard.tsx` renders compact zero-count cards as `0 Flags` for unknown as well as healthy categories. The limitation is available to assistive technology and depth, but the visible distinction can depend on dot color. Row presentation already exposes partial status. | Show the producer's meaningful incomplete/unchecked status visibly in compact cards. Keep counts separate from coverage and preserve the correct row behavior. |
| F04 | P1, confirmed incomplete state contract | `SitePreviewCard` receives captures but no collection/terminal disposition. An absent artifact always selects `No screenshot yet`, including missing-device and completed states. | Distinguish pending, not recorded, unavailable/expired and available evidence from attributable producer facts. Preserve previous dated captures. Do not promise an eventual image when no work is pending. |
| F05 | P1, confirmed evidence/copy mismatch | Accessibility evidence flattens selector, axe `failureSummary` and HTML into one string. The Flag render can put repair alternatives inside Observed. `verification-rules.ts` describes button success using visible text or `aria-label`, omitting valid `aria-labelledby` naming. | Present the recorded observation, expected result and repair separately. Preserve raw technical evidence in depth. Align human instructions with the actual verifier, including valid accessible-name mechanisms. |
| F06 | P1, composition and task-review gap | In the retained 320px incomplete Overview, global handoff actions, a missing preview and summary counts occupy the first viewport before an actionable Flag. A full-page image alone cannot establish a focus-obscuration failure. | Prototype and assess the complete mobile composition. Lead with the relevant result and next action; preserve reachable navigation, evidence and secondary actions. Verify actual viewport, scroll and focus behavior separately. |
| F07 | P0, acceptance gap | Public entry, email/receiving, PageSpeed, private evidence lifecycle, authorized account lifecycle and the external published repair loop still lack a complete current acceptance record. Configured provider keys and local substitutes do not close it. | Produce bounded attributable observations for each promised boundary. Keep an unavailable capability honest and gated until its own proof is complete. |
| F08 | P0/P1, demonstrated release/recovery gap | The last incompatible schema cutover stopped writers before cloud builds. The recorded stopped-writer observation and first successful public probe span roughly 27 minutes, not a continuous availability measurement. The actual backup archive was not restored. | Prepare immutable artifacts before a maintenance boundary, prove schema compatibility or explicit rollback, and complete an authorized restore drill with protected data handling. |
| F09 | P1, internal availability-language risk | The capability report lists 302 registered checks, 108 mapped homepage responsibilities and 52 capabilities described as live. The latter includes gated account/Google functionality. These are different inventories, not execution or public-availability proof. | Reconcile implementation, runtime eligibility, consent, release policy and actual evidence using existing owners. Correct misleading internal labels; do not infer a public defect without tracing its consumer. |
| F10 | P1, confirmed documentation drift | The active masterplan/roadmap still describe completed work as uncommitted or undeployed. `PRODUCT.md` has an older inventory. Current production provider metadata identifies PostgreSQL 18; `SECURITY.md` names 16 and uses a pre-revenue/no-sensitive-data assumption despite the credential and customer-data model. | Publish one current implementation/proof baseline, retain dated history, and reconcile environment versions, data classification and approved operator paths. |
| F11 | P0/P1, usefulness and performance gap | Existing analytics explicitly keep `customerUsefulnessAssessed: false`. Local completion counts and an 88ms localhost LCP do not establish customer usefulness, representative INP or field performance. | Demonstrate understandable, actionable and independently verified repair. Measure real interactions and report lab, field, agent and human evidence separately. |
| F12 | P0/P1, operational proof gap | Repository/release evidence does not establish a continuously configured external monitor of the operational contract. Railway deployment healthchecks run during deployment, not continuously. | Inventory existing monitoring first. Ensure post-deploy operational failure, lost monitoring obligations and exhausted capacity reach an accountable operator with deduplicated, actionable alerts. |

P0 requires immediate investigation or closes a claim-critical acceptance gap.
P1 work is also required now before experience sign-off. A proof gap is not a
demonstrated provider failure. A proposed usability improvement is not a measured
conversion gain.

## Complete delivery order

This is a dependency sequence, not a reason to defer essential work. Investigate
F01 and reconcile the current baseline first. Prepare provider authorization,
restore destinations, operational monitoring, performance baselines and task
assessment while those corrections proceed. Implement state, copy and composition
together, consolidating code at the affected owner. Start authorized natural-time
observation as soon as a safe candidate exists. Converge on one current acceptance
record after the corrections; do not wait until then to begin learning or prepare
the recovery path.

### 1. Resolve the live resource anomaly and operational truth

Start here. Use the approved administrative/diagnostic boundary to identify
context ownership across Audit tasks, administrative work, account cleanup,
probes and closing resources. Preserve privacy; identifiers and lifecycle facts
are sufficient without exposing cookies, credentials, page bodies or mail.

Reuse `openAuditContext`, the shared browser and existing capacity/authority
owners. Audit setup, completion, abort, timeout, owner loss and rejected close.
Capacity remains occupied until Chromium confirms physical release. Do not hide
the warning, return a fabricated zero, increase concurrency to mask a lost slot,
or restart a shared browser underneath another Site's work.

Correct probe/event semantics and bootstrap readiness at the same ownership
boundary. Add focused non-browser regressions for timestamps and readiness, then
the explicitly authorized native lifetime cases needed to prove cleanup.

**Done:** the observed context is attributed or its defect is reproduced and
fixed; settled work returns physical resources to baseline; sibling Sites remain
intact; telemetry names correspond to actual facts. A connected browser is not
reported as a freshly successful probe solely because a heartbeat arrived.

### 2. Complete the visible state and evidence contract

Address F03/F04/F05 together across producer, validated DTO, shared presentation,
copy and both live/sample consumers. Begin with regressions for the current
compact unknown card, terminal missing capture and valid button naming.

Keep execution, coverage, freshness, guidance and media availability independent.
Show one useful visible limitation at its primary location. Keep a genuine zero
count as a count, not a substitute for an unavailable result. Do not relabel a
healthy backend verdict merely to simplify the card.

Use structured source facts where available. Where historical evidence contains
only raw diagnostics, label that limitation and retain the original text. Do not
invent measured attributes by parsing a remediation paragraph or rewriting old
evidence. Reuse exact copy modules instead of scattering new strings.

**Done:** incomplete and healthy compact states are distinguishable without
color; a terminal missing image is not pending; Observed contains attributable
facts; expected results agree with the native verifier; original evidence and
supporting scope survive unchanged.

### 3. Finish the ordinary entry, repair and return journey

Trace a new visitor entering an authorized public HTTPS URL through validation,
queued/progressive results, signup/sign-in, claim of that same Site, Flag depth,
prepared task, actual clipboard handoff, externally published repair, independent
verification, recurrence and a later return. Do not seed a completed Audit or
verified identity and describe that as proof of the omitted entry steps.

Exercise wrong URL, blocked scope, refused entitlement, expired session,
permission change, offline/reconnect, worker interruption, unavailable guidance,
failed capture, inconclusive verification and removal with unresolved cleanup.
Each state needs a recoverable action and preserved truthful evidence.

**Done:** the ordinary supported path works end to end, durable identity survives
the transitions, source repair is real, and successful versus inconclusive
verification is understandable. A copied prompt alone is not a repaired Site.

### 4. Prove the supported promise and provider boundaries

Reconcile the three existing inventories without creating another registry.
Registration, local implementation, enabled configuration, authorized scope and
successful execution are separate facts. Trace the public claim to its current
release policy and actual evidence. Preserve useful native work when an optional
provider is unavailable; never manufacture its missing result.

Prepare one bounded validation manifest using existing approved targets,
mailboxes, recipient/send limits and receiving routes. Obtain any still-required
specific authorization only against that concrete manifest. Verify PageSpeed
page/device/profile, private-object write/read/expiry/removal and tenant refusal,
provider acceptance versus actual email delivery, and reversible account
signup/receiving/verification/reuse/deletion with interruption reconciliation.

Reuse the existing five-Site, three-analysis precision requirement when its
external scope is authorized. Review consequential false positives, duplicates,
unusable instructions, scope mismatch and actual cost. Fix their collectors,
rules, grounding or comparisons; do not suppress useful categories for a pass.

**Done:** every supported responsibility has attributable proof and explicit
limitations. Automatic accounts and planned Google context remain gated until
their lifecycle/property-specific requirements pass. Existing cleanup remains
available according to its separate permission contract.

### 5. Make the information architecture effortless

Prototype complete compositions using current tokens and shared components.
Prioritize the current result and the most useful next action. Put global/bulk
actions at the level where their scope is understood. A terminal empty preview
must not dominate an actionable mobile result. Preserve full labels and touch
targets while reducing repeated explanations and competing calls to action.

Keep the current destinations: Websites chooses the Site; Overview owns current
attention; Pages locates the problem; Flag depth owns evidence, repair and Verify;
Timeline owns change/recovery history; Integrations owns connected context;
Settings owns monitoring intent, notifications, access and removal. Help explains
those same objects. Job, provider and queue mechanics remain below the customer
model. Scope/cadence text must come from the admitted monitoring responsibility.

Review ordinary, empty, healthy, partial, stale, blocked, long-content and
recovery/recurrence compositions. Cover both themes, 320/375/768/1280px,
200/400% reflow, reduced motion, keyboard, useful focus restoration, safe areas,
screen-reader status feedback and the actual mobile viewport. Retained PNGs do
not replace this execution. Preserve the approved contrast exception explicitly.

Audit homepage, sample, pricing/beta offer, entry, email, Help, Docs and error copy
against the same promise. “Scheduled,” “checked,” “delivered” and “verified” must
keep their meanings. Do not add explanatory machinery to compensate for a weak
state model.

**Done:** an owner can find what matters, its evidence, the next action and the
latest verification result without understanding implementation taxonomy. No
essential interaction is hidden behind hover, clipped content or ambiguous
status color. Broad visual changes receive the established prototype review.

### 6. Streamline the remaining code and measure performance

Consolidate the proven conflicting owners from packages 1/2/5: browser resource
diagnostics, media disposition, compact result presentation, evidence/guidance
projection and capability language. Migrate all consumers, delete the superseded
derivation, and keep the focused behavior/authority regressions in the same change.

Profile query count/latency, serialization bytes, repeated refresh work, media
loading and expensive interaction before changing more read boundaries. Retain
the existing selector exclusions and viewer-scoped subscription/cache lifetime.
Use the measured hot path to choose further work, not a blanket split by file
size or a second frontend state store.

Measure the production build's LCP, INP and CLS on representative interactions
and network/device conditions. Target 2.5s, 200ms and 0.1 respectively. Assess
available field data at the 75th percentile by device. Keep missing field data
missing, and do not substitute localhost timings or a Lighthouse score for it.

**Done:** fewer competing owners, all supported callers migrated, no new data or
permission regression, and improvements supported by actual cost/performance
observations. A green build is not a performance result.

### 7. Make release, recovery and continued operation dependable

Prepare and validate an immutable artifact before a destructive maintenance
boundary. Promote the reviewed image digest to both process roles with their
runtime configuration. Preserve the current CI/Wait-for-CI owner decision.
Where public build configuration differs, reconcile it explicitly before
claiming one artifact is interchangeable between services.

Use backward-compatible expansion, migration/backfill and later contraction for
future schema changes where possible, with actual previous/new client reads and
writes tested. If compatibility is impossible, declare the maintenance boundary,
prove old writers have physically stopped, and prepare both the data recovery
and image paths. Never remove that fence to imitate a rolling deployment.

Inventory backup location, independent failure domain, encryption, retention,
recovery point and recovery time. Verify an actual retained archive through an
approved isolated restore destination, preferably inside the approved provider
boundary. Disable external effects in that environment and inspect only bounded
integrity results. Local customer-data export remains subject to specific
authorization; the previous automatic-review rejection is not bypassed. A
synthetic restore remains useful but does not close the real-archive proof gap.

Inventory any existing external monitoring before adding infrastructure. Observe
post-deploy availability, useful latency, errors, backlog/oldest work, capacity,
monitoring obligations and notification delivery gaps. Use existing operational
owners and actionable deduplicated alerts. Read the diagnostic body, not only its
HTTP 200 status. An accumulating stalled-event counter is not a current incident.

**Done:** promotion and failure recovery are rehearsed, the real archive has
attributable restore proof or remains an explicit open acceptance item, and a
post-deploy operational failure reaches an accountable operator. Checks continue
when the browser and coding agent are closed.

### 8. Accept usefulness and one coherent current release

Start the permitted agent task assessment now: identify the consequential issue,
explain the evidence, choose a repair, prepare the task, interpret an inconclusive
result, recognize recovery and understand what remains monitored. Fix observed
comprehension/action failures. Label this expert/agent review honestly; do not
invent representative users, disability testing or a human study.

Use the existing value/funnel reports and exact claim/occurrence/attempt lineage.
Keep analysis completion, useful guidance, actual handoff, published repair,
independent improvement and later scheduled execution separate. Do not flip
`customerUsefulnessAssessed` or rename completion receipts to manufacture value.
Begin authorized natural-time observation as soon as its safe candidate exists.
Keep immature cohorts collecting; retain the separate paid-opening window.

Reconcile the active masterplan, PRODUCT, ROADMAP, SECURITY and selected acceptance
records to one current baseline. Preserve historical rejected candidates and
update their readers/anchors if history is reorganized. Correct version and
sensitive-data assumptions from actual environment/model evidence.

Freeze the finished source. Run focused checks during implementation and the
appropriate current foundation, database, image, security, experience and release
checks at acceptance. Respect the explicit browser/E2E authorization requirement.
After an authorized release, compare pushed SHA, both deployment revisions,
actual readiness, original-data preservation and the real customer loop. Keep
code, provider, operational, usability and value evidence distinct.

**Done:** every current website requirement has a current attributable result or
is visibly open. No consequential reproduced defect is hidden by a mock, skipped
case, softened comparison, missing sample, fake event or manually written PASS.
“World class” remains a quality goal demonstrated through the experience, not a
label conferred by this plan.

## Research applied

- [Railway healthchecks](https://docs.railway.com/deployments/healthchecks) distinguish
  deployment gating from continuous monitoring. This informs F02/F12 and package 7.
- [Railway backup restoration](https://docs.railway.com/volumes/backups) documents
  provider-side restoration and environment boundaries. Actual account support,
  retained archives and a completed drill must still be verified.
- [Prisma v6 migration patterns](https://docs.prisma.io/docs/orm/v6/prisma-migrate/workflows/customizing-migrations)
  inform compatibility planning. Implementation must use this repository's
  installed Prisma version and actual previous/new clients.
- [Google SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
  supports actionable service signals and operator ownership, not alerting on
  every routine event.
- [BullMQ stalled jobs](https://docs.bullmq.io/guide/jobs/stalled) distinguishes a
  recovered stalled event from a current queue state. Preserve the existing
  effect/lease fences rather than simply replaying native actions.
- [WCAG use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
  and the [button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) support
  visible status distinctions and valid accessible-name expectations.
- [Deque result semantics](https://docs.dequelabs.com/devtools-for-web/4/en/needs-review-incomplete/)
  keep incomplete automated evidence distinct from violations and success.
- [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)
  distinguish metric targets and percentile assessment from a fast local sample.
- [W3C evaluation with users](https://www.w3.org/WAI/test-evaluate/involving-users/)
  explains why automated checks and expert inspection cannot establish universal
  accessibility or representative usability.

These sources inform the proposed application. None certifies FixFlags or replaces
the code, approved scope, current observations and acceptance requirements.
