# Legal and trust launch checklist

This checklist covers the current Site product. Retired founder discounts, Product Review quotas, Shopify-only terms, and old plan prices are not launch requirements.

## Public surfaces

- [ ] Terms describe one URL-first Site product, Free and paid relationships, renewal/cancellation, acceptable use, verification limits, and third-party connections without promising an SLA.
- [ ] Privacy describes submitted URLs, browser captures, screenshots, account and billing data, connection tokens, analytics, support messages, subprocessors, retention, deletion, and customer rights.
- [ ] Pricing, FAQ, Help, auth, waitlist, billing, and lifecycle email copy agree on Free weekly, Pro $49 per website monthly with daily verification, Studio quoted per website, and paid checkout closed.
- [ ] Public report compatibility is described accurately: evidence links may be public, while private Site, connection, history, and support data remain tenant-scoped.
- [ ] Cookie and analytics disclosure matches the trackers actually loaded in production and the consent behavior in each applicable region.
- [ ] Support and privacy contact addresses are valid, monitored, and identical across legal and Help surfaces.

## Provider and billing trust

- [ ] Shopify permissions, data use, uninstall cleanup, and support paths match the installed app behavior.
- [ ] Optional connections explain authorization, revocation, stored data, failure behavior, and deletion without making the base Site depend on the provider.
- [ ] Stripe test-mode checkout, webhook, invoice, failed-payment, cancellation, and portal evidence passes before any live key or paid switch is enabled.
- [ ] Studio has an explicit per-website quote and contract before a customer can be charged.

## Security and operations

- [ ] Tenant isolation, anonymous claim, public evidence, share, auth recovery, and administrative access tests pass.
- [ ] Production readiness reports database, Redis, migrations, worker, storage, browser, AI, and email truthfully on the exact deployed revision.
- [ ] Data retention and deletion operations are executable, with an owner and response procedure.
- [ ] Incident response, rollback, and customer notification ownership are recorded and exercised.
- [ ] No secret, environment-specific error, internal route, parked power tool, or provider configuration detail is exposed publicly.

## Sign-off evidence

Legal and trust sign-off is recorded against L3, L4, and L6 in [the product masterplan](product-masterplan.md), with test and release evidence in the active session record. A checked box requires observed behavior or reviewed text, not an assumption based on old documentation.
