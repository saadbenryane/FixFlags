---
status: supporting
authority: architecture
reviewed_at: 2026-10-28
supersedes: []
---

# Stability refactoring plan

This plan covers the five opportunities reviewed on October 28. Code and focused
checks determine completion. Existing uncommitted work is preserved. The user
subsequently authorized integration of all changes into main and production
deployment on October 28.

## 1. Retire unused workspaces

Trace runtime and type references from application entrypoints. Delete confirmed
unused report, Product and Canvas components and their exclusive dependencies.
Replace guards that require retired implementations with guards for the current
saved-evidence experience. Keep active report, sharing and evidence readers.

Acceptance: no dangling imports, current report contracts pass, and unused Canvas
APIs remain absent. Retained historical database records are not deleted.

## 2. Converge audit execution

Use the progressive coordinator as the sole execution engine. Retire sequential
page orchestration. Give unfinished legacy admissions an explicit, fenced terminal
result and retry path rather than replaying side effects under a new engine.
Preserve completed evidence and interrupted completion-projection recovery.

Acceptance: new admissions use progressive execution; completed, failed, legacy
and duplicate coordinator deliveries have focused coverage; recovery cannot
re-enter the retired engine.

## 3. Make admission intent explicit

Replace independent optional admission flags with typed variants for new checks,
existing Site runs and retries. Keep a shared transactional creation core and its
owner, entitlement, fixture, schedule and credential fences. Migrate callers and
tests together so unsupported option combinations fail at compile time.

Acceptance: all production callers use explicit intent and focused admission,
idempotency and authorization tests pass.

## 4. Reduce Site read coupling

Separate the frequently refreshed Site overview from history, settings and
detail-only evidence reads. Reuse resolved Site identity and shared query results
within a request. Keep validated viewer-scoped refresh, cancellation and retained
evidence semantics.

Acceptance: overview refresh avoids detail-only reads; dedicated views retain
their data; contract and hook tests cover refresh, ownership and failures.

## 5. Separate tasks and evidence

Give queue execution tasks and verification receipts distinct persistence models
and typed relationships. Migrate existing task rows and their receipt references
without losing identity, generations, leases, artifacts or evidence provenance.
Move task writers, recovery, authorization fences and readers to the task model.

Acceptance: migration history applies to an isolated database with no schema
drift; task recovery and receipt publication tests pass; no operational reader
distinguishes tasks from receipts through string prefixes.

## Validation and delivery

Run focused non-E2E tests per phase, TypeScript checks and relevant source guards.
Use an isolated local database for migration and transaction checks. Browser/E2E
suites require a separate explicit user request under AGENTS.md. Record actual
results and remaining release gates here, without treating local checks as
production acceptance.

## Progress

- Baseline captured outside the checkout; no active ownership conflicts.
- Phase 1 complete: removed 49 unused source modules and 18 exclusive test files.
  Current saved-report, sharing and sample behavior remains covered. Source and
  tooling changes remove about 6,300 net non-test lines against the initial
  working tree, before counting schema, migration and documentation additions.
- Phase 2 complete: delivery has one progressive engine. Legacy retirement is
  fenced and preserves evidence; explicit retries may use the new engine without
  changing the recorded responsibility. The previously edited sequential source
  and its isolated regression fixture remain, with a guard against runtime imports.
- Phase 3 complete: all creation callers use explicit admission intent. Charging,
  reuse, retry parent and Site request creation remain in the shared transaction.
- Phase 4 complete: overview reads omit account-management and GitHub settings
  evidence. Settings refresh has a separate validated read scope and cache key.
  Flag detail reuses the authorized Site and connection read. History and captures
  remain in overview because the current home renders their evidence and trend;
  this phase does not replace visible history with an empty or stale substitute.
- Phase 5 complete: tasks and receipts have distinct tables, a same-Audit source
  relationship and a read-only combined evidence view. Existing IDs, generations,
  leases, artifacts, timestamps and original receipt provenance survive migration.

## Verification evidence

- TypeScript passes. Generated browser/release artifacts are excluded from source
  type checking, while application and worker source checks remain enforced.
- Scoped ESLint passes. The worker and parser bundles build successfully.
- Product, UI drift and module boundary guards pass. Twelve focused script guard
  tests pass.
- The broader server pass completed 3,426 assertions before the remaining affected
  assertions and socket-restricted fixtures were rerun. The focused rerun passed
  187 tests. Admission, retry and trigger-equivalence checks then passed 101 tests.
- Site scope, refresh ownership, contracts and related component checks passed
  79 tests. Flag/Outcome page and dashboard checks passed 26 tests.
- Isolated PostgreSQL/Redis verification passed 114 tests across 11 files. The
  native browser authority case was explicitly excluded. The full 139-migration
  history applied, retained-row upgrade checks passed, and `db:check` and
  `db:drift` both passed on that disposable database.
- Current-Site evidence projection passed 25 additional database tests, including
  settings-read isolation, retained conclusions across detector upgrades and
  unchanged historical Flag membership. Three final migration/model checks
  passed, including malformed-task visibility and refusal to admit over an
  unrecognized retained obligation. Seventy-four focused engine tests also pass.

## Release boundary

October 28 integration preserves release `3f231e0c` and its passkey/backup-code
compatibility fixes. Derived repair, Google and aggregate Search receipts now
retain their typed task source when one exists. A compiled regression first
observed a null repair task link, then passed with the actual completed task in
the same Audit. The native customer loop, passkey/backup recovery and 48 rendered
surface/theme/width observations pass locally, including unobstructed mobile
navigation targets. Client events for retired screens retain historical names;
current Site lifecycle facts keep their existing durable owner. The current
signup invitation records its actual click. The approved orange/white contrast
exception remains unchanged. Current-candidate Linux and production observations
are still required.

The authorized release is being integrated in the existing deployment workspace.
The task-splitting schema requires a coordinated cutover: drain and stop older
web/worker writers, migrate, then start both services from the same new revision.
Mixed-version writers are unsupported. Completion requires successful web and
worker deployments, matching live revisions, applied migrations and readiness.

Integration checks caught three fresh-receipt writers without their typed task
relationship. These writers now retain that relationship; 37 focused writer
tests pass. The remaining analytics and admission checks pass across 11 tests.
The deployment workspace also passed its separately authorized compiled browser
journey, including repair, recurrence, receipt custody and mobile navigation.
Real-provider delivery, email acceptance and representative-human usability
remain separate evidence boundaries. They are not established by local fixtures.

The final migration preserves the task table's physical identity and moves the
smaller receipt set. A storage-identity regression first failed on the copy-based
candidate. Its predecessor schema comes from the immutable historical migrations,
independently of the migration being tested. Same-Audit receipt references cannot
borrow a receipt as their task. The production inventory measured about 611 MB of
task payload versus 199 MB of receipt detail before selecting this cutover path.
