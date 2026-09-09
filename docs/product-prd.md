# FixFlags next version: product requirements

**TARGET, accepted direction 2026-09-08.** Implements the [full vision](../knowledge/vision.md); customer IA in [product-architecture.md](product-architecture.md); delivery order in [product-masterplan.md](product-masterplan.md) and [ROADMAP.md](../ROADMAP.md). Customer-facing words (Analyze, Flag, Recommendation, Flag. Fix. Verify., 0 Flags) live in [voice-and-copy.md](voice-and-copy.md). This replaces the old report/chat PRD. Current compatibility behavior remains in [PRODUCT.md](../PRODUCT.md).

## Product outcome

A business enters a URL, understands what its website needs, resolves a meaningful Flag, and asks FixFlags to keep watching the same Site. A quiet, recently verified healthy Site is success. The system must show what it knows and what it could not check.

## Domain contract

| Object | Requirement |
| --- | --- |
| Site | Permanent, private to its owning account or provisional anonymous session; stable identity, canonical address, understanding, coverage, history and connections |
| Page and action | Belong to a Site; retain URL and evidence provenance. A page can contribute to several Outcomes or none |
| Outcome | A business result such as Buy or Get in touch; **customer language: Journey**; inferred with confidence and small Looks right / Edit confirmation; related pages/actions and verification scope |
| Check execution | Timestamped observation with source, viewport, expected behavior, actual result, coverage limits and evidence; never itself a demand for attention |
| Flag | Durable customer attention item associated with Site and relevant page/Outcome; evidence occurrences over time, priority, next action and recovery history |
| Coverage | Which pages/behaviors/contexts can be checked, which actually were, cadence, latest attempt and latest relevant success, freshness, exclusions and failures |
| Connection | Tenant-authorized context source with provenance, purpose, health, permissions and revocation; enriches existing objects |
| History event | Relevant change, detection, attempted fix, verification, recovery, or context update with time and source; correlation does not establish causation |

Physical schema choices and reusable models are in [site-v2-migration.md](site-v2-migration.md). Do not interpret customer Site as permission to reuse the existing global graph Site table.

## Primary journey requirements

1. **Enter a URL.** “Your website, looked after.” with URL field and “Analyze.” Validate unsafe/private network targets using the existing security boundary. No installation prerequisite. Useful anonymous results remain the target; resource limits are explicit.
2. **Learn visibly.** Create or resume a provisional Site before analysis. Persist discovered facts and render them as progress. Show failures and partial results in the same shell. No invented page counts, outcomes, pixels or completed checks.
3. **Confirm understanding.** Infer important Journeys. Offer Looks right / Edit with minimal interruption; an uncertain inference is clearly editable. Users can correct intent without configuring a funnel builder.
4. **Become the dashboard.** Keep the same Site identity and navigation (Home · Flags; settings separately). Home answers whether anything needs attention. Show Journey state, prioritized Flags, coverage, latest checks and meaningful changes. No redirect into a separate report application. The FixFlags Agent is a FAB over this Site, not a competing workspace.
5. **Open a Flag.** Show what happened, where, certainty, business meaning, proof, and next step before technical detail. Evidence matches the affected URL and viewport; missing captures are explicit. Detail progressively serves owner, marketer, developer and agent.
6. **Fix this.** Offer copy/send to AI, controlled sharing and technical evidence according to actual capabilities and access. A copy records handoff, not implementation. External sending requires the user's action/authorization. Avoid sensitive data in share/export.
7. **Verify fix.** Run fresh, relevant independent behavior against the changed deployment. Preserve failed and inconclusive attempts. Resolve only when required verification criteria pass; absence from a new scan is insufficient.
8. **Keep watching.** Save/claim this Site through account creation/login without losing history or creating a duplicate. Activate durable checking before stating “You're covered.” Show paused, delayed, quota-limited or unconfigured states honestly.
9. **Continue quietly.** Relevant failures produce or update a Flag. Interruptions pass a separate alert policy. Healthy runs update scoped coverage/history without manufacturing work.
10. **Enrich when useful.** Suggest a connection beside the existing Outcome or Flag it can explain better. Same Site after Shopify native install; no parallel Shopify-only dashboard concept.

## Truth and access

[Evidence rules](../knowledge/evidence-rules.md) own certainty, health, lifecycle and verification semantics. UI status cannot infer “healthy” from zero Flags or a successful HTTP fetch. Unknown and stale required coverage remains visible even when the last known behavior passed.

A provisional Site is private to its session. Authentication and claim are server-side, idempotent and ownership checked. Existing public report evidence is a separate compatibility surface; it cannot expose a new private Site, connections or history. Phase 1 defines these boundaries before new routes expose data. Sharing must select a deliberately sanitized Flag projection, not entire Site state.

Keep current billing and prompt-access protections working during development. The first useful analysis must show evidence and an understandable next action; existing plan restrictions must not silently determine the new free monitoring design. Define any v2 capability gates explicitly before public rollout.

## Phase 1–2 implementation backlog

| Order | Work item | Completion evidence |
| --- | --- | --- |
| 1 | Add Site-domain projection and tenancy contract over current persistence; anonymous identity and claim design | Ownership and cross-tenant tests; duplicate/retry behavior; no graph model access |
| 2 | Add Site pages/actions, inferred Outcomes and editable confirmation; retain inference provenance | One page in two Outcomes; a page in none; corrected Outcome survives fresh analysis |
| 3 | Adapt current browser/check evidence to normalized coverage and truth | Pass/fail/partial/blocked/stale fixtures; no loss of source, viewport or evidence |
| 4 | Project durable Flags and match repeated observations conservatively | Repeated same failure updates one Flag; different variant/viewport is not incorrectly merged; old occurrences retained |
| 5 | Build mobile-first Home · Flags using existing brand tokens | Useful healthy, Flags-present, couldn't-verify, loading, empty and failure views at mobile and desktop sizes |
| 6 | Connect URL submission and real persisted progress to the same Site | Refresh/retry/recovery does not spawn another Site; first result is already its dashboard |
| 7 | Exercise the slice through the actual worker and browser | Owned test site with broken contact behavior, healthy sibling behavior, evidence and real timestamps |

Proposed customer routes for this slice are /sites/[siteId], /sites/[siteId]/flags, /sites/[siteId]/flags/[flagId], and Site settings (not a required /site third product). These are an implementation default. Keep API boundary details with the application module and route registry when implemented.

## Acceptance scenarios for the complete core

| Scenario | Required outcome |
| --- | --- |
| All relevant checked behavior passes | Scoped healthy state, current coverage and latest verification; no fabricated Flag |
| No important behavior could be verified | Explicit gap and retry/context action; no reassuring all-clear |
| A mobile action fails while desktop works | Mobile evidence and scope; desktop pass does not cancel mobile failure |
| Potential tracking failure without purchase proof | Qualified certainty; commerce and measurement facts stay distinct |
| Customer edits inferred Outcome | New intent retained; old evidence remains historically attributable |
| Fix attempted but problem persists | Flag remains open with failed verification evidence |
| Check disappears or becomes blocked | No resolution from absence; inconclusive verification and coverage gap |
| Exact behavior passes after fix | Durable resolved record with independent evidence, time and scope |
| Failure recurs | Same recognizable issue reopens with a new occurrence and history |
| Anonymous user signs in twice or a request retries | One claimed Site and one schedule; no duplicate usage or lost evidence |
| Watch restarts, runs late, or hits resource limits | Durable recovery; coverage accurately describes delay; no false “covered” claim |
| Repeated low-priority warning | Visible when worth attention, no repeated alert noise |
| Important failure persists | Prioritized Flag and deduplicated, actionable notification |
| Connection revoked or telemetry absent | Core browser analysis still usable; affected context marked unavailable |
| Existing subscriber enters new version | Billing identity, access and history survive the explicit migration mapping |

## Scope limits and evaluation

The full vision is not Phase 1 scope. General analytics, session replay, broad SEO dashboards, ad management, arbitrary funnels, **chat-first navigation**, and an integration marketplace remain outside the product. A persistent FixFlags Agent (bottom-right, context-aware, optional support escalation) is in the intended architecture and is not chat-first navigation. Protective actions require separate authorization and evidence design.

Measure useful first value, valid Outcome corrections, false-positive and unverifiable rates, verified recovery, time to attention, alert relevance, ongoing free value and cost per watched Site. Numeric targets follow baseline measurement. No conversion or revenue-uplift guarantees.

Use real fixture and browser evidence for each phase. Update public copy only to the capability level actually released. [Product architecture](product-architecture.md), [UI contract](workspace-interface.md), [migration](site-v2-migration.md), [strategy](../knowledge/strategy.md), and [privacy](../knowledge/privacy.md) provide the supporting constraints.
