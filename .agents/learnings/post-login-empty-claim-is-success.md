# Post-login empty claim is success (2026-08-27)

- Date: 2026-08-27
- Scope: `/post-login` claim gate; plain login without anonymous teaser cookie
- Confidence: High

## Evidence

- Prod symptom: signed-in user stuck on “Your account is ready, but we could not save your report yet” with “Try saving again” that re-ran the same empty claim.
- `POST /api/me/claim` returns `{ claimedCount: 0 }` when `ff_anon_report_ids` is absent (normal plain login).
- Commit `e5880860` (2026-08-26) added `if (claimedCount === 0) return false` in `runPostLoginClaimFlow` and a `claimEmpty` UI branch that treated that success as failure.

## Discovery

Empty claim (HTTP 200, zero attachments) was conflated with claim failure (`null`). Plain login always hits post-login and usually has nothing to claim, so every ordinary sign-in could trap on the save-error screen.

## Why it matters

Blocks account access on production for users who only want to sign in. Retry cannot help when there is no cookie to claim.

## Correct approach

1. Treat any non-null claim result (including `claimedCount: 0`) as success and continue to passkey enroll / `navigateAfterAuth`.
2. Show recovery only when `claimAnonymous` returns `null` (HTTP/client failure).
3. Keep a Continue escape on recovery so real failures cannot trap the user.

## Where prevention was encoded

- `hooks/post-login-claim-flow.ts`
- `hooks/__tests__/post-login-claim-flow.test.ts` (zero reports → navigate)
- `app/(auth)/post-login/page.tsx`
- `lib/marketing/copy/auth.ts` (`postLogin.continueCta`)
- `PRODUCT.md` (empty claim continues; failed claim recovers)
