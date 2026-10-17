# lib/audit/ - Audit engine

## Responsibility

Collect website facts, evaluate registered checks, retain evidence and supporting observations, assess repairs, and project recorded results. New website admissions use the canonical progressive execution path. Historical adapters remain available for their existing callers and stored evidence.

## Canonical execution

| Owner | Responsibility |
| --- | --- |
| `lib/sites/application/commands.ts` | Website application commands behind route adapters |
| `lib/sites/application/run-requests.ts` | Admission of a run with its frozen execution scope |
| `progressive/graph.ts` | Dependency graph for admitted work |
| `progressive/engine.ts` | Delivery, execution ownership, bounded retries, settlement and recovery |
| `progressive/collectors.ts` | Collection of recorded facts |
| `progressive/evaluators.ts` | Evaluation of collected task evidence |
| `progressive/results.ts` | Validated task artifacts |
| `checks/catalog.ts` and `checks/index.ts` | Shared registered page checks and their assertions |
| `execution-ownership.ts` | Write fencing for active execution |
| `flag-observations.ts` and `flag-identity.ts` | Supporting scope, custody and explicit finding identity |

## Journey responsibilities

| Owner | Responsibility |
| --- | --- |
| `journey/run-journey-reviews.ts` | Existing orchestration and compatibility entry points |
| `journey/review-scope.ts` | Pure selection of discovered and original recorded journey routes |
| `journey/plan-observation.ts` | Actual planner-page collection and private-context cleanup |
| `journey/run-template.ts` | Browser execution of the selected journey |
| `journey/review-findings.ts` | Pure interpretation of recorded findings, including allowed check scope |
| `journey/review-persistence.ts` | Locked evidence, supporting-observation and Flag persistence |

## Related Site owners

`lib/sites/domain/outcome-discovery.ts` derives page and journey candidates without database access. `lib/sites/outcomes.ts` retains tenant-scoped queries and transactional commands. `lib/sites/presentation/outcome-view.ts` and `outcome-detail-view.ts` project recorded facts without querying or mutating them. Website routes and UI consume the existing application and presentation contracts.

## Compatibility and supporting paths

`runner.ts`, `pipeline/run-page.ts`, `persist.ts` and `finalize.ts` retain their established adapter responsibilities. Their presence does not authorize a second admission path. `deterministic-audit.ts` supports controlled offline evaluation, which does not establish live provider accuracy. AI triage and prescription use the recorded findings and validated output contracts; unavailable or omitted evidence remains explicit.

## Invariants

- Collectors record facts, evaluators interpret them, persistence retains their custody, and presentation describes the recorded result.
- New admissions preserve the frozen scope and registered check versions. A later observation cannot silently replace an original verification obligation.
- Explicit equivalence may group an actionable Flag while retaining every original supporting observation. Similar wording alone is insufficient.
- A failed or unavailable independent task does not certify a healthy result or discard previously open Flags.
- Execution writes retain ownership and tenant fences. Historical readers do not invent missing provenance.
- Browser and storage limitations remain visible; unrelated captures cannot substitute for missing evidence.
- Unit fixtures, migrated-worker proof, provider acceptance and deployed customer outcomes are distinct evidence.
