# Canonical sources

One authoritative home per concept. The September 8 [vision](knowledge/vision.md) replaces earlier product direction. Companion documents operationalize it; they must not introduce competing product definitions.

| Concept | Canonical home | Scope |
| --- | --- | --- |
| Product vision | [knowledge/vision.md](knowledge/vision.md) | Complete owner narrative, accepted 2026-09-08. Customer vocabulary defers to voice-and-copy |
| Product information architecture | [docs/product-architecture.md](docs/product-architecture.md) | Customer objects, navigation, cards, Agent, support, history, integrations, report retirement |
| How FixFlags speaks | [docs/voice-and-copy.md](docs/voice-and-copy.md) | Positioning, vocabulary, Flag/Recommendation, Analyze, Flag. Fix. Verify., two AIs, notifications, privacy; rendered copy comes from lib/marketing/copy.ts |
| Evidence and health truth | [knowledge/evidence-rules.md](knowledge/evidence-rules.md) | Certainty, coverage, lifecycle, independent resolution |
| Complete implementation plan | [docs/product-masterplan.md](docs/product-masterplan.md) | Now/Next/Later, waves, truth matrix, critical path; not a claim that the product already shipped |
| Site engineering phases | [ROADMAP.md](ROADMAP.md) | Tenancy, coverage, Fix/Verify/Watch cutover, exit evidence; does not replace the masterplan |
| New behavior requirements | [docs/product-prd.md](docs/product-prd.md) | Target contracts and acceptance scenarios; IA owned by product-architecture |
| New interface states | [docs/workspace-interface.md](docs/workspace-interface.md) | Progressive states and Flag detail; nav follows product-architecture |
| Card-board design | [docs/card-board-experience.md](docs/card-board-experience.md) | Flat grid, card anatomy, library, prototype; first card is Pages |
| Current implementation | [PRODUCT.md](PRODUCT.md) | Code baseline and gaps; never future feature promises |
| Persistence reuse | [docs/site-v2-migration.md](docs/site-v2-migration.md) | Tenant model, adapters, history, billing, cutover |
| Site understanding | [knowledge/product-intelligence.md](knowledge/product-intelligence.md) | Persistent model and private learning boundary |
| Checking architecture | [knowledge/integrity-engine.md](knowledge/integrity-engine.md), [docs/audit-pipeline.md](docs/audit-pipeline.md) | Target evidence role; current execution mechanics respectively |
| Pricing direction | [knowledge/strategy.md](knowledge/strategy.md) | Free relationship and paid responsibility; runtime prices/limits come from lib/billing |
| Privacy and security | [knowledge/privacy.md](knowledge/privacy.md), [SECURITY.md](SECURITY.md) | Collection minimization and enforced security boundaries |
| Brand identity | [SOUL.md](SOUL.md) | Personality and enduring promise |
| Visual system | [DESIGN.md](DESIGN.md) | Existing tokens and visual rules; code tokens are authoritative values |
| Former messaging-migration plan | [docs/messaging-migration.md](docs/messaging-migration.md) | Stub. Use the masterplan |
| Current code architecture | [ARCHITECTURE.md](ARCHITECTURE.md), [CODEMAP.md](CODEMAP.md) | Existing code structure, not a new UI mandate |
| Quality and release proof | [QUALITY.md](QUALITY.md) | Relevant checks, real-path proof and release receipts |
| Legacy report compatibility | [knowledge/report-contract.md](knowledge/report-contract.md) | Existing report routes only; retired as target experience |
| Durable decisions | [DECISIONS.md](DECISIONS.md) | Active decision plus explicitly scoped historical record |
| Task ownership | [.agents/BOARD.md](.agents/BOARD.md) | Scope and owner; not competing commercial strategy |
| Version preparation receipt | [.agents/sessions/site-v2-readiness-2026-09-08.md](.agents/sessions/site-v2-readiness-2026-09-08.md) | What this documentation pass did and checked |
| Agent routing | [AGENTS.md](AGENTS.md), [.agents/README.md](.agents/README.md) | Work entrypoint and scope discipline |
| Knowledge index | [knowledge/README.md](knowledge/README.md) | Links and vocabulary, not another full vision |

## Historical, stub, or compatibility documents

These must not be treated as the live product definition.

| Document | Status |
| --- | --- |
| [docs/messaging-migration.md](docs/messaging-migration.md) | Stub → masterplan |
| [knowledge/site-intelligence.md](knowledge/site-intelligence.md) | Superseded draft pointer |
| [docs/live-review-and-product-intelligence-prd.md](docs/live-review-and-product-intelligence-prd.md) | Retired stub |
| [docs/offering.md](docs/offering.md) | Stub |
| [docs/product-ui-intent.md](docs/product-ui-intent.md) | Pointer |
| [docs/unified-audit-tool-architecture.md](docs/unified-audit-tool-architecture.md) | Historical research |
| [docs/scan-roadmap.md](docs/scan-roadmap.md) | Historical scan expansion |
| [docs/journey-review-architecture.md](docs/journey-review-architecture.md) | Historical journey MVP notes |
| [docs/business-model.md](docs/business-model.md) | Compatibility commercial notes |
| [docs/year-1-operating-plan.md](docs/year-1-operating-plan.md) | Retired operating numbers |
| [docs/gtm-launch-strategy.md](docs/gtm-launch-strategy.md) | Pointer |
| [docs/launch-kit.md](docs/launch-kit.md) | Pointer; do not publish old kit |
| [knowledge/finish-plan.md](knowledge/finish-plan.md) | Legacy ranking/compat |
| [knowledge/report-contract.md](knowledge/report-contract.md) | Legacy report routes only |
| [docs/brand-positioning.md](docs/brand-positioning.md) | Target brand; wording defers to voice-and-copy |
| [docs/knowledge-base-ia.md](docs/knowledge-base-ia.md) | Help/Docs/FAQ surfaces; report topics until Wave J |
| `content/docs/*` | Shipped public docs; still report-shaped until masterplan Wave J |

Older session plans and research can explain history. They cannot lock a report layout, a Shopify-only launch, or obsolete positioning into future work. When a rule conflicts, replace it in active guidance; keep factual compatibility constraints where code still depends on them.

Conflict order for the new product: [vision](knowledge/vision.md) on purpose; [product-architecture](docs/product-architecture.md) on customer objects and navigation; [voice-and-copy](docs/voice-and-copy.md) on public words; [evidence-rules](knowledge/evidence-rules.md) on certainty and recovery; [product-masterplan](docs/product-masterplan.md) on sequence; [PRODUCT.md](PRODUCT.md) on what the code does today. Public copy may only claim shipped behavior.
