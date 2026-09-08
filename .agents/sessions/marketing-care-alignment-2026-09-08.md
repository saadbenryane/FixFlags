# Marketing care alignment — 2026-09-08

Public marketing pages now share the homepage type and URL-first Site language. JetBrains Mono is no longer used as a display face for Waitlist, eyebrows, or plan prices.

## Done

- Shared `.marketing-eyebrow` / `.section-label` are Inter, 12px, sentence case, muted.
- `PlanPrice` renders `$0` and `Waitlist` in Inter Tight. Used on pricing, comparison, plan picker, and billing plans.
- Pricing copy is a free website check plus waitlisted Pro/Studio. Shopify is a secondary connection.
- `/how-it-works` uses Check → Flag → Fix → Verify. Observe/Verify/Connect proof section removed from that page.
- FAQ, partners, help chrome, waitlist labels, and landing section headers inherit the same type.

## Verify

- Focused vitest: PlanPrice, pricing-parity, shopify-customer-ready, homepage-message, HomepageRefinement, PlanPickerDialog.
- `npm run copy-drift-check`
- Playwright font check at 375 and 1280 on `/pricing`, `/how-it-works`, `/faq`, `/partners`, `/waitlist`. Waitlist and Simple pricing render Inter Tight / Inter, not mono.

## Out of scope

- Homepage files owned by homepage-board-polish
- Waitlist join/auth flow
- Help article bodies and docs markdown
- No deploy
