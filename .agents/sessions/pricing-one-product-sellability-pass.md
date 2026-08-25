# One-product pricing sellability pass

Date: 2026-08-25

Status: locally implemented and focused verification passed.

## Outcome

FixFlags now sells one current customer product: the URL-first Product Review.
Every Review produces prioritized Flags, evidence, and fix prompts.
The plans now form a capacity and workflow ladder instead of relying on inheritance shorthand.
Manual Update Reviews and completed Watch reviews use that same allowance.
Deep Review is reserved for the future repository-connected analysis offer and is not a current plan feature, quota, or waitlist promise.

Stripe remains in test configuration and paid plans remain waitlist-gated.

## Commercial architecture

- Free is positioned for one Product before launch and includes three monthly Reviews, enough for an initial Review and two Reviews after changes.
- Pro supports up to five Products and includes 30 monthly Reviews at $29 per month, Product history across releases, and release comparison.
- Studio supports unlimited Products and includes 90 monthly Reviews at $79 per month, scheduled Reviews, workspace invitations, and shared Product history.
- Studio workspace seats are unlimited for a limited time.
- High-volume pricing starts when Studio capacity is insufficient.
- The paid-plan waitlist keeps the existing first-500 and next-500 launch discount tiers.

## Product and billing behavior

- Product creation is enforced across every Product hostname: Free allows one, Pro allows five, and Studio is unlimited.
- Scheduled Reviews are Studio-only at the shared entitlement, route, service, and worker boundaries.
- Completed scheduled Reviews consume Studio's 90-Review monthly allowance.
- Signed-in Product Reviews always include the existing browser-path review work where available.
- Legacy `deepReviews*` database fields remain for migration and historical-price compatibility but are unmetered and absent from the customer account payload.
- Separate deep-review admission and completion metering were removed.
- The canonical pricing guard now compares the single Product Review allowance with marketing copy.

## Customer surfaces reconciled

- Pricing cards, comparison table, FAQ, signup, usage gates, upgrade moments, waitlist details, and Help.
- Shipped truth, pricing strategy, product-system boundaries, roadmap, PRD, architecture, design language, and durable decisions.
- Public documentation no longer lists Deep Review in navigation; the retained direct content defines it only as a planned repository-connected offer.

## Proof

- Focused pricing, billing, auth, Product-capacity, scheduled-review, waitlist, and workspace tests: 409 passed.
- Focused 3/30/90 allowance regression suite: 316 passed.
- Focused ESLint: passed.
- Skill validation: passed.
- Completeness audit: passed.
- Affected-file agent verification, including TypeScript, lint, billing, marketing, UI guards, image guards, and SEO guard: passed.
- Doctor, database, and migration readiness: passed.
- `git diff --check`: passed.
- Browser pricing proof at desktop and 375px: zero console errors and no horizontal overflow.
- Pro and Studio pricing CTAs opened `/waitlist/pro` and `/waitlist/studio`; checkout was not entered.

Artifacts:

- `output/playwright/pricing-final-desktop.png`
- `output/playwright/pricing-final-mobile.png`

## Final safeguards

- Stripe secret and publishable keys are both configured for test mode.
- Paid pricing actions remain routed to the Pro and Studio waitlists.
