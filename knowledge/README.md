# FixFlags knowledge

The sole active product vision is the owner's [September 8 revision](vision.md): **Your website, looked after.** Earlier Product Review and Shopify-only directions are superseded. Git preserves previous versions; historical implementation documents cannot override this direction.

## Read by question

| Question | Canonical source |
| --- | --- |
| What are we building and why? | [Complete vision](vision.md) |
| How is the product structured for customers? | [Product architecture](../docs/product-architecture.md) |
| What should we build, in what order? | [Implementation masterplan](../docs/product-masterplan.md) |
| What is the Site engineering phase? | [Roadmap](../ROADMAP.md), [execution](execution.md) |
| How should FixFlags speak? | [Messaging](../docs/voice-and-copy.md) |
| What must the new experience do? | [PRD](../docs/product-prd.md), [workspace interface](../docs/workspace-interface.md) |
| What exists in the code today? | [PRODUCT.md](../PRODUCT.md) |
| What is reused or migrated? | [Migration design](../docs/site-v2-migration.md) |
| What does evidence establish? | [Evidence rules](evidence-rules.md) |
| What is the model and engine? | [Product Intelligence](product-intelligence.md), [Integrity Engine](integrity-engine.md) |
| What do plans buy? | [Strategy](strategy.md); current entitlements remain code-backed |
| What may we collect? | [Privacy](privacy.md), [SECURITY.md](../SECURITY.md) |
| How do we look? | [SOUL.md](../SOUL.md), [DESIGN.md](../DESIGN.md) |
| What is historical compatibility? | [Report contract](report-contract.md); current report routes only |
| Where does a new fact belong? | [Canonical sources](../CANONICAL-SOURCES.md), [evolution rules](../EVOLUTION-RULES.md) |

The former [messaging-migration](../docs/messaging-migration.md) file is a stub. Public language still needing to change is sequenced in the masterplan, not claimed as already shipped.

## Vocabulary

Customer objects are Site, Pages, Journey, Flag, Recommendation, Connection, and the FixFlags Agent. Coverage is how health statements stay honest. Outcome and Check remain internal model names; customer copy follows [messaging](../docs/voice-and-copy.md). The customer-facing loop is Flag. Fix. Verify., kept running by monitoring. Analyze is the acquisition CTA.

Primary Site chrome is Home · Flags, plus Site settings. Pages and Journeys are reached through cards. The FixFlags Agent is a persistent assistant, not a destination. The customer's coding AI is a separate job: Send a Flag to your AI. Checks and Verify / Observe / Connect are internal sources, not a required menu.

“Product”, “Project”, “Audit”, “Improvement”, “report”, “update review”, and the old rubrics remain in runtime and compatibility documentation where accurate. They do not impose the new interface or permanent customer taxonomy. Do not mass-rename stored identifiers.

## Status discipline

VISION is the full ambition. NEXT is phased work with acceptance criteria. SHIPPED needs code and real behavior/release evidence. A saved vision or changed homepage headline is not a completed new product. Keep research, historical receipts and current instructions visibly separate.
