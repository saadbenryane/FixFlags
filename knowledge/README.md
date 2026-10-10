---
status: supporting
authority: operations
reviewed_at: 2026-10-09
supersedes: []
---

# FixFlags knowledge index

The sole active product vision is the owner's September 21 revision: **FixFlags is the independent monitor for software that acts. Your software runs. FixFlags watches.** Earlier report-first, Shopify-only, and website-care directions are historical where they conflict.

This page is a question index and vocabulary guide, not another complete vision. [CANONICAL-SOURCES.md](../CANONICAL-SOURCES.md) is the authority map.

## Read by question

| Question | Source |
| --- | --- |
| What are we building and why? | [Vision](vision.md) |
| How is it structured for customers? | [Product architecture](../docs/product-architecture.md) |
| What should happen in what order? | [Masterplan](../docs/product-masterplan.md), [roadmap](../ROADMAP.md) |
| What must the target behavior do? | [PRD](../docs/product-prd.md), [workspace interface](../docs/workspace-interface.md) |
| How should FixFlags speak? | [Voice and copy](../docs/voice-and-copy.md) |
| What exists in code today? | [PRODUCT.md](../PRODUCT.md), [CODEMAP.md](../CODEMAP.md) |
| What is reused or migrated? | [Site migration](../docs/site-v2-migration.md) |
| What makes a result trustworthy? | [Evidence rules](evidence-rules.md) |
| What are the model and engine? | [Product Intelligence](product-intelligence.md), [Integrity Engine](integrity-engine.md) |
| What do plans buy? | [Strategy](strategy.md); code owns current enforcement |
| What may FixFlags collect? | [Privacy](privacy.md), [security](../SECURITY.md) |
| How should it look and feel? | [SOUL.md](../SOUL.md), [DESIGN.md](../DESIGN.md) |
| What supports old report routes? | [Report contract](report-contract.md), for compatibility only |
| Where does a fact belong? | [Canonical sources](../CANONICAL-SOURCES.md), [evolution rules](../EVOLUTION-RULES.md) |

## Vocabulary

The customer hierarchy is **Site/Product → Outcomes → execution methods → Clear or Flag → evidence, history, and diagnostics**. A Journey is one human-browser execution method, not the umbrella for API or MCP behavior. Coverage keeps Clear honest. Audit and Check remain internal machinery. The customer loop is **Flag → Fix → Verify**, continued by monitoring.

Primary Site chrome remains Home and Flags plus settings. Home leads with watched Outcomes and attention; broader domain detail sits below. The FixFlags Agent is an assistant, not a destination. A coding agent is a separate actor and can request independent verification through launch-scope MCP.

`Project`, `Audit`, `Improvement`, report, update review, and old rubrics remain valid in runtime or compatibility documentation where accurate. Project backs the customer Site, Audit is the physical run ledger, and Improvement backs stable Flag identity. Do not mass-rename stored identifiers to match customer vocabulary.

## Status discipline

- **VISION** is the full ambition.
- **NEXT** is phased work with acceptance criteria.
- **SHIPPED** requires code and real behavior or release evidence.

A saved vision, changed headline, historical receipt, session, or handoff is not evidence that the new product shipped. Document status follows the [metadata policy](../docs/document-status-policy.md).
