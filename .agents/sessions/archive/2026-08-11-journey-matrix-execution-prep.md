# Journey matrix execution prep (2026-08-11)

Release gate: every row in `credentialed-journey-matrix.md` must be executable by an
operator with zero guesswork. This file lists, per journey row, the inputs that
block execution, the rows that cannot be fully specified today, and exactly what
the operator must supply. All values are those expected from
`node scripts/release-preflight.mjs`; nothing here is a local mock.

## Release prerequisites (block every row)

These must be satisfied before any Execute subsection can run.

| Input | Status | Operator must supply |
|-------|--------|----------------------|
| Docker Desktop healthy (`docker info` succeeds) | Pending | Restore the daemon (the container smoke previously failed with an internal metadata I/O error). |
| `RELEASE_FRESH_DATABASE_URL` + `RELEASE_ALLOW_DATABASE_RESET=true` | Blocked | A disposable `fixflags_release` database URL and explicit consent to reset it. Reset consent is mandatory and never skipped. |
| `RELEASE_CONTAINER_ENV_FILE` | Blocked | Path to a gitignored env file that seeds the release container with the keys below. |
| `RELEASE_SMOKE_URL` | Blocked | A deployed smoke host running the release image (web + worker). All Execute sections reference `RELEASE_SMOKE_URL`. |
| `E2E_AUDIT_URL` | Blocked | A real, publicly reachable URL to scan (used by Anonymous, Free chat, MCP, CLI rows). |
| `R2_*` capture credentials | Blocked | Object store credentials for screenshot/journey evidence. Absent means screenshot evidence cannot be asserted in the cloud. |

## Mailbox-assertion prep (Product Watch + billing admin alerts)

The Product Watch and payment-failed admin paths email via Resend and must be
asserted at a live endpoint.

| Input | Operator must supply |
|-------|----------------------|
| `RESEND_API_KEY` | Resend API key (sandbox or live) on the release host. |
| `RESEND_FROM_EMAIL` | Verified sender on Resend. |
| `ADMIN_NOTIFICATION_EMAIL` | Inbox that receives the `notifyAdminPaymentFailed` alert (Revoked entitlement row). |
| `E2E_WATCH_MAILBOX_ASSERT_URL` | A reachable endpoint that receives the regression email (idempotency key `fixflags-watch-<childId>-v1`, subject `Regression on <host>: N issue(s)`). Must return the matching message on poll. |
| `REDIS_URL` | Required by `productWatchReadiness()` for Product Watch scheduling and the worker. |

## Per-row gaps and operator-supplied inputs

### 1. Anonymous Agent workspace / anonymous claim

- **Blockers:** none beyond the release prerequisites.
- **Operator must supply:** `E2E_AUDIT_URL`; a clean/private browser profile to start truly anonymous. The anonymous quota (3 lifetime FREE reviews) must be available on the smoke account, or use a distinct smoke instance.
- **Not fully spec'd:** the anonymous landing path — confirmed as `RELEASE_SMOKE_URL` root with the Product Review input, but verify whether a `/new` path also exists on the release build before running.

### 2. Free chat + Timeline

- **Blockers:** `E2E_AUDIT_URL`; Free chat-token headroom.
- **Operator must supply:** `E2E_BILLING_FREE_EMAIL` / `E2E_BILLING_FREE_PASSWORD` with remaining monthly chat tokens (25,000 input+output / UTC month). Confirm via `/settings/billing` that the meter is not exhausted before the run.
- **Not fully spec'd:** the exact DOM selector for the chat-token meter and the Timeline tab activation path — confirm via the workspace UI before signing off.

### 3. Passkeys / 2FA / recovery

- **Blockers:** fixture credential material.
- **Operator must supply:** `E2E_2FA_EMAIL` / `E2E_2FA_PASSWORD`; one disposable `E2E_2FA_BACKUP_CODE`; and the virtual WebAuthn credential (`E2E_WEBAUTHN_CREDENTIAL_ID` / `E2E_WEBAUTHN_PRIVATE_KEY` / `E2E_WEBAUTHN_USER_HANDLE`) pre-registered against the sandbox auth. The passkey-enroll prompt only surfaces for new OAuth sign-ups, so this row is cleanest on a fresh account.
- **Not fully spec'd:** cannot be specified without the virtual WebAuthn credential fixture. Flag as **BLOCKED-PREP** until `E2E_WEBAUTHN_*` are provisioned.

### 4. Billing / webhooks (checkout + portal)

- **Blockers:** Stripe test mode must be live and wired to webhooks.
- **Operator must supply:** `E2E_BILLING_PAID_EMAIL` / `E2E_BILLING_PAID_PASSWORD`; the plan the paid account should land on (`BUILDER`/Pro vs `TEAM`/Studio) — the preflight names only one paid fixture, so the operator must confirm and state the plan before running; a live Stripe test card (4242 4242 4242 4242) and a Stripe test-dashboard event that can fire `checkout.session.completed` → `customer.subscription.created`.
- **Not fully spec'd:** the paid fixture is ambiguous between Pro and Studio (see Studio row). The operator must declare the plan. Flag plan ambiguity in sign-off notes.

### 5. Revoked entitlement

- **Blockers:** must start from an active paid subscription, then drive a revoked status.
- **Operator must supply:** reuse the paid fixture from row 4, then trigger `PAST_DUE` (leave an open invoice unpaid) or `CANCELED` from the Stripe test dashboard so `/api/webhooks/stripe` writes the revoked `subscriptionStatus` and demotes `plan` to `FREE`. `ADMIN_NOTIFICATION_EMAIL` must be set and asserted for the payment-failed admin email.
- **Not fully spec'd:** the revoked account cannot be provisioned without the active paid subscription from row 4 and a Stripe test-card schedule the operator can fire. Flag as **BLOCKED-PREP** pending rows 4 + mailbox prep.

### 6. Pro Canvas

- **Blockers:** Pro plan eligibility.
- **Operator must supply:** a `BUILDER` (Pro) sandbox account. The single `E2E_BILLING_PAID_*` fixture may be `TEAM`; if so, a separate Pro account is required for this row. This row cannot run on a Free account or a Studio-only fixture.
- **Not fully spec'd:** **BLOCKED-PREP** — depends on a dedicated Pro account existing; the preflight does not distinguish Pro from Studio.

### 7. Studio project allowance

- **Blockers:** Studio plan eligibility.
- **Operator must supply:** a `TEAM` (Studio) sandbox account (`E2E_BILLING_PAID_*` must be `TEAM`, or a dedicated Studio fixture). The operator must confirm the dashboard lists zero or fewer than 5 managed projects so creation succeeds (and that exceeding 5 returns 402).
- **Not fully spec'd:** **BLOCKED-PREP** — the preflight provides one paid fixture whose plan is not declared; Studio journeys (this row, Protected sharing, GitHub) require `TEAM` specifically.

### 8. Protected sharing

- **Blockers:** Studio plan (owner); password fixture.
- **Operator must supply:** a Studio owner account plus `E2E_SHARE_OWNER_EMAIL` / `E2E_SHARE_OWNER_PASSWORD`; `E2E_SHARE_REPORT_ID` (a completed report owned by the Studio account); `E2E_SHARE_PASSWORD` (>= 10 chars).
- **Not fully spec'd:** the share-token creation UI path — confirm the Share panel location on the release report view before signing off.

### 9. Update review (re-check / diff / Remember)

- **Blockers:** a completed report owned by the operator; re-scan-able `E2E_AUDIT_URL`.
- **Operator must supply:** `E2E_AUDIT_URL` (same URL as the Anonymous row); ownership of a completed report (the claimed report from the Anonymous row is acceptable). Re-check is not a plan gate, so any tier works.
- **Not fully spec'd:** the precise UI trigger label for manual re-check on the release report — confirm the "Re-check" action is visible to the owner before signing off.

### 10. Product Watch

- **Blockers:** managed Studio project + completed parent report; Reds + Resend + mailbox assertion.
- **Operator must supply:** a Studio account; a managed project with a `COMPLETED` parent audit; `E2E_WATCH_EMAIL` / `E2E_WATCH_PASSWORD`; `E2E_WATCH_PROJECT_ID`; `E2E_WATCH_MAILBOX_ASSERT_URL`; a Redis URL on the release host. The operator must also be able to force `watchNextRunAt` into the past (DB update or admin trigger) to fire the tick without waiting.
- **Not fully spec'd:** the forced-due mechanism — confirm whether an admin UI or a DB update is the sanctioned way to fast-forward `watchNextRunAt` before running. Flag as **BLOCKED-PREP** pending mailbox + Redis + forced-due confirmation.

### 11. GitHub Fix PR

- **Blockers:** GitHub OAuth app + sandbox account + fixable repo.
- **Operator must supply:** `E2E_GITHUB_EMAIL` / `E2E_GITHUB_PASSWORD` (a sandbox GitHub account that has authorized the FixFlags GitHub OAuth app with the `repo` scope); `E2E_GITHUB_REPOSITORY` (`owner/name`) owned by that account and containing fixable content (e.g. a missing `<title>` or placeholder copy). `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` must be configured on the release host and the OAuth app's callback must point at `RELEASE_SMOKE_URL/api/integrations/github/callback`.
- **Not fully spec'd:** the GitHub OAuth app itself — the operator must pre-authorize the sandbox account against the registered `GITHUB_CLIENT_ID`. Without that, the connect step fails at the GitHub consent screen. Flag as **BLOCKED-PREP** pending OAuth app + repository.

### 12. MCP

- **Blockers:** API key + MCP transport URL.
- **Operator must supply:** `E2E_API_KEY` (created at `/settings/api-keys` on the paid account). Configure the MCP host to point at `RELEASE_SMOKE_URL/api/mcp` with `Authorization: Bearer <E2E_API_KEY>`. For the repo-scan/compare tools, the key must belong to a `TEAM` account.
- **Not fully spec'd:** none beyond the API key; basic authenticated MCP works on any tier (compare/repo-scan tools enforce `TEAM` per tool).

### 13. CLI

- **Blockers:** published package resolvable + API key for authenticated steps.
- **Operator must supply:** confirm `npx fixflags` resolves to the release package version; set `FIXFLAGS_API_URL=RELEASE_SMOKE_URL`; either `E2E_API_KEY` in the shell or run the device-auth flow (`npx fixflags login`). The anonymous `check` step needs no credential.
- **Not fully spec'd:** the exact `npx fixflags` resolution — confirm the release npm tag (`latest` vs a beta) the operator should pin before running.

## Summary of rows that cannot be fully specified today

| Row | Gap | Must be supplied |
|-----|-----|------------------|
| Passkeys / 2FA / recovery | No virtual WebAuthn credential | `E2E_WEBAUTHN_*` + disposable backup code |
| Revoked entitlement | No revoked account; no Stripe event schedule | Active paid sub + a fireable Stripe past-due/cancel event + `ADMIN_NOTIFICATION_EMAIL` |
| Pro Canvas | No dedicated Pro account (paid fixture ambiguous) | A `BUILDER` plan sandbox account |
| Studio project allowance | Paid fixture plan not declared | A `TEAM` plan sandbox account |
| Protected sharing | No Studio owner + password fixture | Studio owner + `E2E_SHARE_*` fixtures |
| GitHub Fix PR | No sandbox GitHub account / OAuth app / repo | `E2E_GITHUB_*` + pre-authorized OAuth app + fixable `E2E_GITHUB_REPOSITORY` |
| Product Watch | No Redis; no mailbox assertion endpoint; no forced-due mechanism | `REDIS_URL`, `E2E_WATCH_MAILBOX_ASSERT_URL`, forced-due confirmation |
| Billing / webhooks | Paid fixture plan ambiguous | Declared plan + live Stripe test checkout flow |
| CLI | Package tag not confirmed | Release npm tag to pin for `npx fixflags` |

## Operator runbook order (recommended)

1. Restore Docker + prove `docker info` and `npm run agent -- verify`.
2. Run `node scripts/release-preflight.mjs` and confirm it passes (all `E2E_*` present and `RELEASE_ALLOW_DATABASE_RESET=true`).
3. Run `npm run verify:release` without skips.
4. Execute the rows in this order so fixtures chain: Anonymous claim → Free chat + Timeline → Billing/checkout → Revoked entitlement → Pro Canvas → Studio project allowance → Protected sharing → Update review → Product Watch → GitHub Fix PR → MCP → CLI → Passkeys / 2FA.
