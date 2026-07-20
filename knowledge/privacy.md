# Privacy

**Canonical home for privacy and trust principles.** Operational security controls: [SECURITY.md](../SECURITY.md). Vision: [vision.md](./vision.md).

## Founding principle

**FixFlags never learns your product. It learns how to understand products.**

Customer code and Product Intelligence belong to the customer. Private product knowledge is not used to train shared models by default.

## Principles

1. Customer owns Product Intelligence; it should be exportable and portable.
2. Sensitive repository analysis should happen locally where possible (direction; cloud MCP/repo scan exists for Agency today with encrypted tokens).
3. Cloud transmission should be minimized, explicit, encrypted, and understandable.
4. Telemetry limited, transparent, configurable.
5. Cross-product learning uses anonymous, aggregated, or abstracted patterns only.
6. Customers should understand what leaves their environment.
7. Enterprise isolation, retention, and self-hosting only where commercially justified.

## What leaves the environment today (shipped)

| Data | Purpose |
|------|---------|
| Submitted URL + captured page HTML/text/screenshots | Audit / observer |
| Audit Flags, scores, Contract snapshot | Report |
| Lead URLs for anon teasers | Outbound / admin leads |
| GitHub tokens (Agency) | Encrypted at rest; repo scan |
| Billing / auth identity | Stripe + session |

Growth `graph_*` stores anonymized aggregates for FixFlags market pages (sample-size gated). Not a substitute for customer PI privacy.

## Product Intelligence

Project-scoped PI is customer data. Do not feed it into shared training. Do not expose it on public marketing pages.

## Related

- [product-intelligence.md](./product-intelligence.md)
- [open-source.md](./open-source.md)
- [SECURITY.md](../SECURITY.md)
