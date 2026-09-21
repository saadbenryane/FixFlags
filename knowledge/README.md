# FixFlags knowledge

The sole active product vision is the owner's September 21 revision: **FixFlags is the independent monitor for software that acts. Your software runs. FixFlags watches.** The working Site product is the foundation. Earlier report-first, Shopify-only, and narrower website-care directions are superseded where they conflict. Git preserves history; old plans cannot override this direction.

## Read by question

| Question                                     | Canonical source                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| What are we building and why?                | [Complete vision](vision.md)                                                             |
| How is the product structured for customers? | [Product architecture](../docs/product-architecture.md)                                  |
| What should we build, in what order?         | [Implementation masterplan](../docs/product-masterplan.md)                               |
| What is the delivery milestone?              | [Roadmap](../ROADMAP.md), [implementation masterplan](../docs/product-masterplan.md)     |
| How should FixFlags speak?                   | [Messaging](../docs/voice-and-copy.md)                                                   |
| What must the new experience do?             | [PRD](../docs/product-prd.md), [workspace interface](../docs/workspace-interface.md)     |
| What exists in the code today?               | [PRODUCT.md](../PRODUCT.md)                                                              |
| What is reused or migrated?                  | [Migration design](../docs/site-v2-migration.md)                                         |
| What does evidence establish?                | [Evidence rules](evidence-rules.md)                                                      |
| What is the model and engine?                | [Product Intelligence](product-intelligence.md), [Integrity Engine](integrity-engine.md) |
| What do plans buy?                           | [Strategy](strategy.md); current entitlements remain code-backed                         |
| What may we collect?                         | [Privacy](privacy.md), [SECURITY.md](../SECURITY.md)                                     |
| How do we look?                              | [SOUL.md](../SOUL.md), [DESIGN.md](../DESIGN.md)                                         |
| What is historical compatibility?            | [Report contract](report-contract.md); current report routes only                        |
| Where does a new fact belong?                | [Canonical sources](../CANONICAL-SOURCES.md), [evolution rules](../EVOLUTION-RULES.md)   |

The former [messaging-migration](../docs/messaging-migration.md) file is a stub. Public language still needing to change is sequenced in the masterplan, not claimed as already shipped.

## Vocabulary

Customer hierarchy is Site/Product → Outcomes that matter → Clear or Flag, with evidence, history, diagnostics, execution methods, Recommendations, Connections, and the FixFlags Agent underneath. A Journey is one human browser execution method; it is not the umbrella for API or MCP behavior. Coverage keeps Clear honest. Audit and Check remain internal machinery. The customer loop is Flag → Fix → Verify, kept running by monitoring.

Primary Site chrome remains Home · Flags plus settings. Home leads with watched Outcomes and attention; broader Pages, Security, Search, Performance, Tracking, Uptime, Accessibility, commerce, and Journey detail stay below. The FixFlags Agent is an assistant, not a destination. The coding agent is a separate actor and can request independent verification through launch-scope MCP.

`Project`, `Audit`, `Improvement`, report, update review, and old rubrics remain in runtime/compatibility documentation where accurate. Project backs the customer Site; Audit is the physical run ledger; Improvement backs stable Flag identity. They do not impose customer language. Do not mass-rename stored identifiers.

## Status discipline

VISION is the full ambition. NEXT is phased work with acceptance criteria. SHIPPED needs code and real behavior/release evidence. A saved vision or changed homepage headline is not a completed new product. Keep research, historical receipts and current instructions visibly separate.
