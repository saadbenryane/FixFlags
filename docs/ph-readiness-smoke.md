# Product Hunt readiness smoke checklist

Run after deploying metering + GTM changes. Operator credentials required for paid-open flip tests.

## Automated (CI)

- `npm run billing:plans-guard`
- `npm run validate:quick`
- `npm run validate:affected` (billing + report tests)
- `e2e/public-journeys.spec.ts` pricing shows $69 / $199

## `PAID_OPEN=false` (default)

1. Pro/Studio CTAs open waitlist form (signed-in).
2. Waitlist join sends confirmation email (Resend configured).
3. Admin `/admin/waitlist` export and mark-invited sends invite email.

## `PAID_OPEN=true` (staging)

1. Waitlist member gets founder promotion at checkout.
2. Non-waitlist user does not get founder promotion.
3. Webhook sets `founderOfferRedeemedAt` and waitlist `convertedAt`.

## Metering

1. Free user blocked on 4th product review (new URL).
2. Free user blocked on update review when at product review cap.
3. Free user gets exactly one deep review teaser.
4. Pro user deep review cap at 4/month (journey pipeline gated).

## Anonymous wedge

1. One teaser scan without account.
2. Claim unlocks prompts; APIs never leak gated prompts.

## Operator-blocked

- `npm run verify:release` with RELEASE_* credentials
- Live Stripe $69/$199 price IDs on Railway
- Business entity + live webhook
