# Roadmap

**Direction accepted 2026-09-08. Phase 0 complete: documentation and implementation preparation. Phases 1 onward are unimplemented target work unless backed by a completion receipt.**

The [owner's complete vision](knowledge/vision.md) is authoritative. This roadmap replaces earlier Shopify-only launch, Product Review completion, and two-product roadmaps. Existing tasks may supply reusable work; their earlier interface and commercial decisions do not govern this version.

Phase 0 evidence: [readiness receipt](.agents/sessions/site-v2-readiness-2026-09-08.md). Full-source coverage: [vision-to-phase map](docs/site-v2-vision-coverage.md).

Experience design is concrete in the [card-board contract](docs/card-board-experience.md) and interactive prototype at `prototypes/fixflags-board`. This is design evidence for Phase 2, not completion of production Phases 1–5. Phase 2 includes the flat starter board, in-board discovery, predefined card footprints, add/remove/pin/reorder, mobile priority, personalized library and progressive card detail. Phase 3 owns real cross-card Flag verification; Phase 5 enriches the same cards with connected data.

## Destination and boundaries

One persistent customer Site, a first analysis that becomes its dashboard, inferred Outcomes, evidence-backed Flags, and ongoing care. The brand stays FixFlags. Reuse billing, accounts, plans, safe browser checks, evidence, queues, history, and working infrastructure. Replace the report experience rather than reskinning it.

Scope is sequenced by observable customer value, not by integration count. No deadline or new pricing promise is implied. Git preserves earlier versions; a new docs entry does not establish a release checkpoint or commit existing uncommitted work.

## Phases

| Phase | Deliverable and scope | Exit evidence | Depends on |
| --- | --- | --- | --- |
| 0. Record and reconcile | Complete vision; sole canonical routing; new PRD and UI contract; legacy/target boundary; migration inventory; executable first slice | Source fidelity, local links, relevant skills, documentation drift checks; session receipt | Owner's September 8 revision |
| 1. Site foundation | Tenant-scoped Site projection over reusable persistence; pages/actions; inferred and editable Outcomes; explicit coverage and evidence contracts; stable Flag identity; fixtures and safe adapter from current checks | Isolation, idempotency, many-to-many page/Outcome tests; partial/unverifiable cases cannot become healthy; migration dry run on disposable data | Phase 0 |
| 2. URL to useful Site | URL entry, genuine discovery progress, same Site dashboard on completion; Home · Flags · Site; clear Flag detail; useful anonymous result | Real browser path at mobile and desktop widths: first URL through first Flag or honest healthy/partial state; refresh and failure recovery retain Site identity | Phase 1 |
| 3. Fix and verify | Fix this, copy/share evidence safely, technical depth; Verify fix reruns relevant behavior; durable verified recovery and history | Controlled broken → attempted → fresh relevant pass → resolved fixture; persistent failure, incomparable capture, blocked check, and recurrence cases; no self-certified recovery | Phase 2 |
| 4. Keep watching | Account/claim of the same Site; free ongoing monitoring; scheduling, coverage freshness, retries, alert deduplication, pause/delete; costed plan responsibilities | Durable claim + scheduler receipt; induced regression produces appropriate Flag/alert, healthy runs stay quiet, restart/lease/limit failures remain honest; free and paid responsibilities explicitly decided and tested | Phase 3 |
| 5. Add useful context | Shopify first as a connection/native install route into the same Site; purpose-specific observer next; Analytics, Search Console, Meta, deployment context as separately earned increments | Each connection improves a named existing Flag/Outcome answer with source/time attribution; revoke/delete works; lost connection becomes a coverage gap; privacy review and measured collection cost | Working core through Phase 4; each adapter independently gated |
| 6. Migrate and launch | Existing users/history; replace report navigation; current pricing/help/docs/metadata/sample/proof all match released capabilities; native Shopify path and shared Flag acquisition; retire obsolete shell after compatibility proof | End-to-end upgrade/claim/billing regression proof, authenticated and shared access, old URL policy, operator-approved plan terms, production release receipts and rollback rehearsal | Core through Phase 4; only proven Phase 5 adapters included |
| 7. Deepen responsibility | More coverage/depth/history, teams/agencies, agent automation, additional connections, safe protective actions where justified | Measured usefulness, sustainable cost, explicit authorization, trust and quietness retained | Launched core and actual usage evidence |

Phase 5 is incremental. An unavailable external connection must not block the URL-based core or force marketing to claim a speculative integration. Phase 6 can ship with only the connections actually verified.

## First implementation slice

Start with Phase 1, then carry it directly into Phase 2. Build one owned or anonymous Site with one inferred Outcome and one independently reproducible Flag. Use an owned fixture with a broken contact flow and a healthy sibling flow. The same URL and Site identity must survive loading, result, refresh, and account claim.

The exact work order and acceptance scenarios are in the [PRD](docs/product-prd.md). The [migration design](docs/site-v2-migration.md) names the existing modules to reuse and the database naming collision to avoid. Do not start by rewriting every check or building all integrations.

## Decisions settled by the owner

The complete vision is accepted; no second approval of its direction is needed. Site replaces report as the experience. Outcomes supply meaning. Flags supply attention. Health is scoped by coverage. Monitoring continues the find/fix/verify loop. Shopify is a wedge and connection. The brand and useful commercial foundations survive.

## Decisions due at their phase

| Decision | Default or constraint | Required before |
| --- | --- | --- |
| Tenant identity and URL ownership | Private customer Site; no ownership inferred from hostname alone; preserve public evidence separately | Phase 1 persistence |
| Outcome discovery safety | Public non-destructive interactions; confirmation before meaningful side effects; can't verify is valid | First browser walkthrough |
| Anonymous resource limits and retention | Useful result before account, bounded abuse/cost; Keep watching claims the same Site; no silent private-data sharing | Phase 2 public rollout |
| Monitoring frequency, scope, retention and quotas | Free must actually watch; paid buys greater responsibility; measure cost before selecting numbers | Phase 4 release |
| Alert channel and interruption thresholds | Start with existing email infrastructure if suitable; notification settings and durable deduplication | Phase 4 release |
| Existing subscriber transition | Preserve paid access and billing records; explicitly map old entitlements before any change | Phase 6 migration |
| Additional adapters and protective actions | Build only if a specific existing answer becomes better; no automatic ad pauses, deploys, or purchases | Respective increment |

These decisions do not block starting Phase 1. Numeric examples in the vision are not default SLA or plan commitments.

## Release honesty

Current code is not the completed target. [PRODUCT.md](PRODUCT.md) inventories the baseline. Passing old report tests proves compatibility, not the new experience. Each phase needs behavior evidence and an updated session record. Follow [QUALITY.md](QUALITY.md) and existing exact-revision release tooling for deployment claims.
