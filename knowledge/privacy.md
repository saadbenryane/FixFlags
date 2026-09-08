# Privacy and Site learning

**Target policy boundaries; current enforcement lives in [SECURITY.md](../SECURITY.md).** The new Site may learn privately from its own history and authorized context. Earlier wording that FixFlags never learns the customer's product is retired.

## Collection

Prefer synthetic verification and aggregate, purpose-specific real-user signals. Collect only what improves a concrete website-health decision. No default session replay, keystroke capture, invasive visitor identity tracking, unnecessary personal data or raw event warehouse.

Define schema, sampling, retention, consent requirements, URL/query sanitization and deletion for each observer increment before collection. Do not claim consent compliance solely from data minimization. Authentication secrets, payment fields and customer content must not leak into evidence exports.

## Ownership and learning

Private Site understanding belongs to the customer context. Isolate tenants in storage, retrieval, jobs, AI inputs and external connection credentials. Inference and historic verification can improve that Site without making it model training data or public growth data. Do not assume permission to train on customer material.

Global graph aggregation has a separate governed boundary. Public report evidence from the legacy product is not permission to expose new private Site history, telemetry or connected data.

## Connections and control

Request only permissions with an explained use. Store credentials through existing secure patterns. Support disconnection, access revocation, paused observation, Site deletion and retention cleanup. Each connection must degrade to explicit missing coverage/context when access ends.

Share only deliberate sanitized Flag evidence. Never expose an entire private Site or integration payload through a public identifier. Verify privacy behavior through the same route used by the customer.
