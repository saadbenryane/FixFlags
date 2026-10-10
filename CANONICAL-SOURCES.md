---
status: canonical
authority: operations
reviewed_at: 2026-10-10
supersedes: []
---

# Canonical sources

This is the sole authority map for product and engineering documentation. The September 21 [independent-monitor vision](knowledge/vision.md) supersedes earlier report-first, Shopify-only, and website-care direction where they conflict.

Document status and metadata rules are defined in [docs/document-status-policy.md](docs/document-status-policy.md). A file's presence in the repository does not make it current.

## Product authority

| Concept | Canonical source | Boundary |
| --- | --- | --- |
| Purpose and audience | [knowledge/vision.md](knowledge/vision.md) | Accepted 2026-09-21 owner direction |
| Customer objects and navigation | [docs/product-architecture.md](docs/product-architecture.md) | Site, Outcomes, Flags, execution methods, Agent, history |
| Customer language | [docs/voice-and-copy.md](docs/voice-and-copy.md) | Durable voice, vocabulary, and claim boundaries; exact rendered strings live in `lib/marketing/copy/` |
| Evidence and health truth | [knowledge/evidence-rules.md](knowledge/evidence-rules.md) | Coverage, certainty, lifecycle, and independent recovery |
| Product sequence | [docs/product-masterplan.md](docs/product-masterplan.md) | Now/Next/Later plan, not evidence that work shipped |
| Delivery gates | [ROADMAP.md](ROADMAP.md) | Vertical slices and exit evidence |
| Behavior requirements | [docs/product-prd.md](docs/product-prd.md) | Target contracts and acceptance scenarios |
| Interface states | [docs/workspace-interface.md](docs/workspace-interface.md) | Progressive UI states and Flag detail |
| Card-board design | [docs/card-board-experience.md](docs/card-board-experience.md) | Card anatomy, library, and prototype |
| Current implementation | [PRODUCT.md](PRODUCT.md) | What code does today; never a future promise |
| Persistence migration | [docs/site-v2-migration.md](docs/site-v2-migration.md) | Tenant model, adapters, history, billing, cutover |
| Pricing direction | [knowledge/strategy.md](knowledge/strategy.md) | Strategy only; runtime limits and prices remain code-backed |

## Engineering authority

| Concept | Canonical source | Boundary |
| --- | --- | --- |
| Code location | [CODEMAP.md](CODEMAP.md) | Repository map |
| Current architecture | [ARCHITECTURE.md](ARCHITECTURE.md) | Existing system, not a UI mandate |
| Audit execution | [docs/audit-pipeline.md](docs/audit-pipeline.md) | Current checking mechanics |
| Product intelligence | [knowledge/product-intelligence.md](knowledge/product-intelligence.md) | Persistent understanding and private-learning boundary |
| Integrity engine | [knowledge/integrity-engine.md](knowledge/integrity-engine.md) | Target evidence role |
| Privacy and security | [knowledge/privacy.md](knowledge/privacy.md), [SECURITY.md](SECURITY.md) | Collection policy and enforced boundaries |
| Quality and release proof | [QUALITY.md](QUALITY.md) | Proportional checks and real-path evidence |
| Visual system | [DESIGN.md](DESIGN.md) | Principles; code owns exact token values |
| Brand identity | [SOUL.md](SOUL.md) | Personality and enduring promise |
| Durable decisions | [DECISIONS.md](DECISIONS.md) | Active decisions and explicitly scoped historical records |
| Agent operations | [AGENTS.md](AGENTS.md), [.agents/README.md](.agents/README.md) | Stable entrypoint and coordination contract |

## Compatibility and supporting sources

- [knowledge/report-contract.md](knowledge/report-contract.md) governs existing report routes only. It does not define the target experience.
- [docs/business-model.md](docs/business-model.md) summarizes current packaging; strategy and code remain authoritative for intent and enforcement.
- [docs/knowledge-base-ia.md](docs/knowledge-base-ia.md) covers Help, Docs, and FAQ surfaces while public content remains partly report-shaped.
- `content/docs/*` describes shipped public behavior and may lag the target until its scheduled migration.
- [knowledge/README.md](knowledge/README.md) is a compact question index and vocabulary guide, not another product specification.

## Historical or retired sources

These files can explain previous work but cannot override current direction:

- [NOW.md](NOW.md) and [GOAL_BRIEF.md](GOAL_BRIEF.md): retained snapshots and migration pointers.
- `.agents/sessions/*`, `.agents/handoffs/*`, `.agents/learnings/*`: evidence with local scope, never default instructions.
- [docs/experience-review.md](docs/experience-review.md) and [.agents/handoffs/homepage-experience.md](.agents/handoffs/homepage-experience.md): dated product-experience evidence, not active implementation instructions.
- [docs/messaging-migration.md](docs/messaging-migration.md), [docs/product-ui-intent.md](docs/product-ui-intent.md), [docs/gtm-launch-strategy.md](docs/gtm-launch-strategy.md), and [docs/launch-kit.md](docs/launch-kit.md): pointers or retired plans.
- [knowledge/site-intelligence.md](knowledge/site-intelligence.md), [docs/live-review-and-product-intelligence-prd.md](docs/live-review-and-product-intelligence-prd.md), and [docs/offering.md](docs/offering.md): superseded drafts or stubs.
- [docs/unified-audit-tool-architecture.md](docs/unified-audit-tool-architecture.md), [docs/scan-roadmap.md](docs/scan-roadmap.md), and [docs/journey-review-architecture.md](docs/journey-review-architecture.md): historical research.
- [docs/year-1-operating-plan.md](docs/year-1-operating-plan.md) and [knowledge/finish-plan.md](knowledge/finish-plan.md): retired operating assumptions and legacy compatibility.

## Conflict order

For product conflicts, use this order:

1. Explicit current user direction for the task.
2. [knowledge/vision.md](knowledge/vision.md) for purpose and audience.
3. [docs/product-architecture.md](docs/product-architecture.md) for customer objects and navigation.
4. [docs/voice-and-copy.md](docs/voice-and-copy.md) for public words.
5. [knowledge/evidence-rules.md](knowledge/evidence-rules.md) for certainty and recovery.
6. [docs/product-masterplan.md](docs/product-masterplan.md) and [ROADMAP.md](ROADMAP.md) for sequence.
7. [PRODUCT.md](PRODUCT.md) and code for what is shipped now.

When two sources at the same level disagree, stop treating either disputed claim as authoritative. Resolve the conflict in the canonical home, record a consequential decision when needed, and update pointers rather than creating another specification. Public copy may claim only shipped behavior.
