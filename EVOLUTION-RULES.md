---
status: canonical
authority: operations
reviewed_at: 2026-10-09
supersedes: []
---

# Evolution rules

## Authority and versioning

The owner's latest explicit direction wins. The accepted product vision is [knowledge/vision.md](knowledge/vision.md), revised September 21. Customer objects and navigation belong to [docs/product-architecture.md](docs/product-architecture.md); public vocabulary to [docs/voice-and-copy.md](docs/voice-and-copy.md); evidence truth to [knowledge/evidence-rules.md](knowledge/evidence-rules.md); sequence to [docs/product-masterplan.md](docs/product-masterplan.md).

The report, three-rubric presentation, Finish Plan, AI-builder-only positioning, website-care wording, and Shopify-only company bet are not permanent invariants. Preserve their useful implementation evidence only where current code or migration work still depends on it.

Git already preserves earlier versions. Do not append an override above pages of contradictory active guidance. Replace superseded guidance, update the authority map and necessary consumers, and retain historical or compatibility facts with explicit scope.

## Change procedure

1. Find the concept's home in [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md).
2. Classify the change as VISION, NEXT, or proven SHIPPED.
3. Update that home and only the consumers that would otherwise become false.
4. Prefer a pointer over a parallel specification.
5. Record a durable decision and migration when data, access, public behavior, or compatibility changes.
6. Validate links, context routes, and documentation consistency. Application changes also need proportional tests and real-path evidence.
7. Create a session or handoff only when the work meets the retention rules in [.agents/README.md](.agents/README.md).

Metadata and retrieval behavior follow [docs/document-status-policy.md](docs/document-status-policy.md).

## Preserve foundations, replace experience

The Site/Outcome experience is authorized direction. Preserve brand identity, security, billing records, ownership, independent verification, and useful evidence infrastructure. These require planned adapters; they do not require retaining the report interface.

Current APIs, stored identifiers, rubrics, quotas, and tests may remain temporarily for compatibility. Scope them to the old implementation and change them only with deliberate migration and regression evidence. A partial UI rename is not completion of the vision.

## Claims and examples

Examples do not establish current counts, cadence, integrations, prices, guarantees, or capabilities. Public language must match released behavior. The complete product may remain VISION while a slice advances from NEXT to SHIPPED.

Do not invent revenue loss, causal attribution, alert success, verified recovery, or health. Evidence and coverage govern those claims.
