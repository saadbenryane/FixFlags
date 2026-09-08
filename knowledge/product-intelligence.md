# Site understanding and memory

**TARGET.** The [vision](vision.md) defines the enduring model. The [PRD](../docs/product-prd.md) defines the objects and behavior; the [migration design](../docs/site-v2-migration.md) owns physical persistence choices.

FixFlags builds private understanding of a customer's Site: purpose, pages/actions, important Outcomes, technology dependencies, normal behavior, coverage gaps, context and change history. Preserve inferred facts with provenance and confidence; customer corrections must survive new analyses.

The useful asset is accumulated understanding that makes attention and recovery decisions better. A score history, chat transcript or collection of scans alone is insufficient.

## Reusable implementation

Project.productIntelligence and existing private project history are starting points. Project can remain the internal backing name while the customer sees Site. Existing Audit snapshots, Flag occurrences, Improvements, fix attempts and verification receipts can supply historical evidence. Do not equate a stored occurrence with the new durable customer Flag until identity and recurrence are tested.

The existing Prisma Site and Page belong to the separate global growth graph. They must not hold private customer understanding. Customer learning remains isolated from public graph aggregates; do not learn across tenants by accidentally sharing a hostname record.

## Memory quality

Only supported observations and explicit corrections enter factual memory. Inference retains its source and uncertainty. Verification strengthens the record only when fresh relevant behavior passes. Contradictory later evidence updates current understanding without erasing historical provenance.

Context from Shopify, analytics, search, advertising or deployments enriches existing Site objects. Revocation or stale context becomes a coverage limitation. It does not erase independent browser evidence or create a separate product.
