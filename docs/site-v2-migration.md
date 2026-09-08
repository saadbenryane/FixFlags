# Site version migration and reuse

**Implementation design, 2026-09-08. Not a completed migration.** The [vision](../knowledge/vision.md) determines the experience; this file owns the transition from current code. [ROADMAP.md](../ROADMAP.md) orders the work.

## Baseline and history

Observed HEAD at planning time: 201c14e08cb32dc247a4458f3821a8011386de07. The workspace contains extensive uncommitted application and Shopify work from existing tasks. That commit is a reference, not a complete snapshot of this workspace or an attested production release.

Before implementation changes, inventory the actual working tree with its owners and make a deliberate Git checkpoint of reconciled work. Never reset, clean, stage everything, or declare uncommitted work backed up by GitHub. This documentation pass does not create a release, tag, push or deployment.

## Reuse map

| Existing foundation | Target role | Transition requirement |
| --- | --- | --- |
| Project, productIntelligence, owned URL, watch fields | Customer-facing Site backing and persistent understanding | Keep physical Project naming initially; introduce a coherent Site-domain projection; enforce owner/session isolation |
| Prisma Site and Page mapped to graph_site / graph_page | Existing shared growth-intelligence data only | Do not reuse as private customer Site/pages; no public graph access to private Site learning |
| Audit and AuditPage, execution ledger, capture/check worker | Timestamped analysis and evidence history | Analysis is an internal execution of the Site; stop making reports the customer object |
| Flag occurrences, Improvement and attempts/verification | Durable customer Flag with observations and recovery history | Prefer adapter over destructive rename; prove identity/recurrence and independently verified recovery; separate customer wording from legacy storage names |
| lib/audit browser and checks | Verify evidence infrastructure | Preserve Playwright, source attachments, safe interactions and fresh evidence; outcome verification can be targeted when criteria and scope are explicit |
| lib/products/application and projections | Starting application boundary for Site operations | Extend one command/query path; avoid separate dashboard, report and Shopify truths |
| lib/signals and ProductSignal storage | Seed for purpose-specific Observe evidence | Existing narrow signals are not broad RUM; define minimum schema, consent, sampling, retention and cost before expanding |
| Project watch and recovery scheduler | Durable Site care | Current plan scheduling does not fulfill the promised Free Site; add policy, coverage freshness, resource budgets and alert behavior |
| ShopifyShop, RevenuePath, lib/shopify and lib/integrity | Commerce connection and reusable journey probes | Explicit verified tenant/Site link; preserve token/auth isolation and native installation; convert observations to the same Outcomes/Flags |
| Authentication and /post-login claim flow | Keep watching identity and idempotent claim | Preserve existing security; claim the same provisional Site/history and activate one schedule |
| Stripe, plans, billing and entitlement code | Commercial foundation | Preserve customer/subscription IDs and existing access; adopt new responsibility limits only with deliberate entitlement transition |
| Brand tokens, UI primitives, evidence capture/display | Shared visual foundation | Keep original brand orange and typography; replace layout and report navigation; reuse components only if they suit the new contract |

Current source starting points: prisma/schema.prisma, lib/products/application/, lib/improvements/, lib/audit/task-contracts.ts, lib/audit/project-watch.ts, lib/queue/recovery-scheduler.ts, lib/integrity/, lib/shopify/, lib/billing/ and lib/auth/entitlements.ts.

## Domain and persistence sequence

1. Introduce customer Site types and an adapter over Project without renaming global graph tables. For new private entities, use unambiguous names such as SitePage and SiteOutcome rather than overloading Page or Site. Final Prisma names belong in the Phase 1 migration.
2. Store page/action associations to Outcomes as many-to-many, scoped to the customer Site. Preserve inference source and user corrections separately.
3. Normalize evidence and coverage by behavior, page, viewport, source and timestamp. Keep attempts separate from successful verification. Cadence, freshness, exclusions and missing context are explicit.
4. Establish durable Flag identity over repeated occurrences with safe matching. Reuse Improvement history where compatible; no global merge based solely on URL/title. Preserve source evidence and verification receipts.
5. Add provisional anonymous Site ownership and idempotent account claim. Same hostname is not identity or authorization. Handle repeat imports and native Shopify linking explicitly.
6. Add connection ownership and history events. ShopifyShop currently has its own domain identity; host detection alone cannot connect it to an arbitrary account's Project.

## Replace the experience

The new primary surface is the Site with Home, Flags and Site navigation. Retire score-first report entry, Agent | Report split, report-as-product navigation, fixed customer rubric taxonomy, and separate Shopify commercial onboarding from the new journey.

Keep old report URLs, public-safe evidence and existing APIs working as compatibility behavior until the transition is tested. A public old report link must never redirect an unauthenticated viewer into private Site history. Owners may receive a deliberate transition link. Do not mutate immutable historical evidence to resemble new output.

Old review rubric/check IDs can remain internal compatibility fields. They neither dictate customer navigation nor limit new coverage. Old tests for old routes remain meaningful until those routes retire. Add new behavior tests for the Site; do not rewrite expectations to hide a broken migration.

## Billing and monitoring

The current monthly review model and Studio scheduling are baseline behavior, not the v2 business model. Phase 4 must define sustainable free watch and paid responsibilities with measured execution cost. Preserve plan infrastructure and historical usage; specify how legacy balances/limits map before enabling the new model. No silent downgrade, retroactive charge or invented quota.

“Keep watching” requires an acknowledged durable schedule and visible scope. If account creation succeeds but scheduling fails, retain the Site, show the failure, and offer retry. “You're covered” is not merely a signup success message.

## Cutover and rollback

Use additive data changes and exercised adapters first. Backfill only necessary ownership and provenance; dry-run on disposable fixtures, with resumable/idempotent execution and row-count reconciliation. Preserve original references until parity is proven.

Before removing old UI or tables, prove existing login, subscriptions, anonymous claim, shared access, worker recovery and old link handling. Keep a documented deployment rollback compatible with additive schema and preserved data. Do not create permanent off-by-default feature paths; a temporary migration path must have an owner and removal criterion.

Release readiness requires the project's existing exact-revision deployment evidence plus the new Site acceptance journey. Neither this plan nor a green legacy report suite is a v2 launch receipt.

