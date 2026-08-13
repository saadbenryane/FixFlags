# Credentialed journey matrix

*Created: 2026-07-23. Updated: 2026-08-09. Release gate: all revenue-critical paths signed off before distribution scale.*

## Release verification

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Pass | `npm run doctor` passes locally |
| `RELEASE_FRESH_DATABASE_URL` + reset flag | Blocked | Variables are absent. Reset of a disposable `fixflags_release` database also requires explicit user consent. |
| `RELEASE_CONTAINER_ENV_FILE` | Partial | `.cache/release/container.env` written (gitignored) |
| `RELEASE_SMOKE_URL` | Blocked | Deployed smoke target still missing |
| R2 capture credentials | Blocked | Required `R2_*` variables are absent |
| Email / Product Watch credentials | Blocked | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `ADMIN_NOTIFICATION_EMAIL` are absent |
| `npm run agent -- verify` | Pass | Affected gate passed 2026-08-02 after product completion closeout (workspace architecture, copy parity, route tests) |
| `npm run verify:release` | Blocked at preflight | `npm run agent -- eval release` stopped safely because `RELEASE_FRESH_DATABASE_URL` is absent; smoke, R2, email, and reset consent also remain required |
| Credentialed Playwright suite | Implemented; sandbox run blocked | Eight executable journeys replace the former deliberate failures. `verify:release` now enables them and preflights every disposable fixture before destructive setup. Sandbox credentials remain absent locally. |
| Dedicated worker topology | Local Pass; deploy pending | Stable local startup reported web role, one worker, concurrency one, zero contexts, and no stalled or overdue jobs. The container smoke now provisions Postgres, Redis, web, and worker, submits a real check, observes worker readiness, and requires a completed report. Railway deployment and external heartbeat smoke remain required. |

Record command output here when credentials are provisioned.

## Journey matrix

| Journey | Automated proof | Status | Notes |
|---------|-----------------|--------|-------|
| Anonymous Agent workspace | Unit + route boundaries + local browser dogfood | Local Pass; deployed dogfood pending | A real anonymous `example.com` review reached `COMPLETED` in 23 seconds with 18 Flags. Deterministic Agent updates and report evidence were visible at 375, 768, and 1280 pixels. Prompts and Timeline payloads were absent. Claim flow remains part of the credentialed sandbox run. |
| Passkeys / 2FA / recovery | Unit tests + virtual WebAuthn and backup-code E2E | Implemented; sandbox run pending | Release fixture supplies the registered credential material and one disposable backup code. |
| Billing / webhooks | Unit/handler tests + checkout/portal E2E | Implemented; sandbox run pending | Uses separate free and paid Stripe test users. Signed webhook lifecycle still relies on the existing handler tests plus operator Stripe dogfood. |
| Re-check / diff / Remember | Unit + claim/re-check E2E | Implemented; sandbox run pending | Claims the anonymous report through `/post-login`, unlocks the Fix List, performs a fresh FULL re-check, and asserts diff and Remember UI. |
| Protected sharing | Handler tests + credentialed E2E | Implemented; sandbox run pending | Creates a password/expiry/max-view link, verifies one scoped view, revokes it, and asserts denial in a clean context. |
| Product Watch | Unit/handler tests + scheduler/mailbox E2E | Implemented; sandbox run pending | Requires a due disposable project and a mail-sandbox assertion endpoint; asserts exactly one matching message. |
| GitHub Fix PR | Integration tests + dedicated-repository E2E | Implemented; sandbox run pending | Starts a real repo scan, selects a permitted fixable finding, and requires an open GitHub PR URL. |
| MCP | Contract / tool / quality gate + release E2E | Implemented; sandbox run pending | Authenticates, checks, polls, reads the complete Fix List, and starts a re-check. |
| CLI | Unit tests + packaged release E2E | Implemented; sandbox run pending | Runs the packaged CLI against the release app for check, Fix List, and re-check. |

## Manual smoke (QUALITY §86–96)

Run on **one anonymous** and **one signed-in** journey before distribution:

- [ ] `/report/[id]` hierarchy: identity → diff → complete ranked Fix List → Contract/Memory → Journey/Flow/Timeline → previews/gates/actions → re-check
- [x] Anonymous: deterministic Agent transcript, report scores, every confirmed Flag, screenshots, and textual evidence visible without a blocking modal
- [x] Anonymous: fix prompts and Timeline payloads absent server-side; contextual sign-in actions preserve the report
- [x] Production brand restored (`fix-live-images` / Phase 0)
- [x] Unknown report and share tokens render explicit not-found/unavailable states (`e2e/public-journeys.spec.ts`)
- [x] Progressive route: lightweight status UI renders immediately and advances through the canonical stages without loading the completed-report graph
- [x] `/samples` and loading shell never empty (public E2E)
- [ ] Password share: generic metadata, authorize, no view inflation, revoke
- [x] Progressive and completed Agent workspace has no horizontal overflow at 375 / 768 / 1280px; mobile Agent ↔ Report navigation preserves the current review
- [x] Keyboard submission, reduced motion, 200% text, touch targets, theme switching, and responsive reflow pass in the isolated production E2E; deployed release smoke remains required

## Browser / pipeline truth (2026-07-23)

- Slow 3G replay wired in `lib/audit/pipeline/run-page.ts` (production path)
- Mobile + desktop `networkFailures` merged in `captureScreenshots`
- Primary flow capture uses `journeySafe` for engagement POST probe
- AXI/chrome-devtools-axi rejected for audit capture; AXI applies to CLI/MCP agent tooling
- Recovery evaluation loads its required environment and fails rather than silently skipping. Stale unstarted QUEUED jobs may requeue; a lost job after CAPTURING fails explicitly instead of silently restarting the report.

## Accuracy adjudication backlog

| Site | Status | Action / evidence |
|------|--------|-------------------|
| linear.app | Structural frozen | Fixture `lib/audit/__tests__/fixtures/sites/linear-app.html` (`captured=2026-07-23`). Corpus tier `structural` with expectedPresent `no-structured-data`, `cookie-consent-absent`. Full Playwright dogfood blocked on R2; do not elevate to gold until live pipeline adjudicates SSR a11y FPs. |
| replit.com | Structural curated | Fixture `replit-com.html` frozen with provenance. Live probe historically 403 (bot block). Keep curated fixture; do not invent gold. expectedPresent: `canonical-missing`, `h1-multiple`. |
| v0.dev | Structural frozen | Fixture `v0-dev.html` frozen with provenance (`captured=2026-07-23`). Docs that said “no frozen fixture” are stale. expectedPresent: `no-structured-data`, `measurement-ga-gtm-posthog-missing`. Elevate to gold only after FP/FN adjudication with frozen evidence. |

`npm run accuracy:eval`: Pass (2026-07-26) — 11 HTML gate fixtures, 2 gold, 0 failures.

## Journey execution procedures (operator signed)

> Substitute `RELEASE_SMOKE_URL` throughout with the provisioned deployed smoke target (e.g. `https://staging.fixflags.com`). All fixture values (`E2E_*`) are those printed by `node scripts/release-preflight.mjs`. Operator initials (____) and per-journey sign-off are recorded inline. Screenshots are saved to `evidence/credentialed-<journey>-<operator>.png`. Each row maps to a matrix row above; rows flagged `BLOCKED-PREP` cannot be fully specified until the listed operator-supplied input arrives.

### Execute: Anonymous Agent workspace / anonymous claim

- **Starting point:** `RELEASE_SMOKE_URL/new` (anonymous landing) → paste `E2E_AUDIT_URL` into the Product Review input.
- **Fixture prep:** none (anonymous). Ensure `RELEASE_SMOKE_URL` exposes no auth wall for a fresh review and that the queue is empty before starting.
- **Steps:**
  1. Open an incognito/private window. Navigate to `RELEASE_SMOKE_URL`.
  2. Submit a product review for `E2E_AUDIT_URL`. Observe the Progressive Agent workspace render immediately, then advance through `CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED`.
  3. Copy the anonymous report ID from the URL: `/report/<ANON_REPORT_ID>`.
  4. Open `/post-login?next=/report/<ANON_REPORT_ID>` and sign in with the Free fixture (`E2E_BILLING_FREE_EMAIL` / `E2E_BILLING_FREE_PASSWORD`).
  5. Observe the claim toast ("unlocking") and that the same report URL now renders inside the authenticated Agent workspace with the Fix List unlocked.
- **Expected outcome:** the anonymous report is claimed by the Free account; `claimedCount` is recorded; no duplicate report is created; the report is now listed in `/dashboard` history.
- **Evidence to capture:** anonymous report ID `<ANON_REPORT_ID>`; `completedAt` timestamp from the report header; screenshot `evidence/credentialed-anon-claim-<operator>.png` (progressive → completed → unlocked Fix List in dashboard); signed-in dashboard listing the same report ID; operator initials ____ — Pass/Fail — Notes ____.

### Execute: Free chat + Timeline

- **Starting point:** `RELEASE_SMOKE_URL/sign-in` → sign in as the Free fixture, then open `/report/<REPORT_ID>` (use the claimed report from the Anonymous row or start `E2E_AUDIT_URL` fresh if credits remain).
- **Fixture prep:** the Free account must have remaining monthly chat tokens (25,000 input+output / UTC month). Confirm via `/settings/billing` or the workspace meter.
- **Steps:**
  1. Sign in as the Free fixture. Open a completed report.
  2. In the Agent workspace chat, send one metered message (e.g. "Why is the CTA flagged?"). Wait for the model reply.
  3. Switch to the Timeline tab/panel (JourneyReview timeline). Confirm the chat turn and a `product-review` observation appear.
  4. Reload and confirm the Timeline persists across reloads.
- **Expected outcome:** chat token meter decrements; the Timeline shows at least the `product-review` observation entry; the message persists after reload. Prompts and private Product data remain absent for anonymous views.
- **Evidence to capture:** report ID `<REPORT_ID>`; chat token meter before/after (read from workspace footer); Timeline entry list screenshot `evidence/credentialed-freechat-timeline-<operator>.png`; operator initials ____ — Pass/Fail — Notes ____.

### Execute: Passkeys / 2FA / recovery

- **Starting point:** `RELEASE_SMOKE_URL/sign-up?plan=BUILDER` (new account) then `/settings/security` (passkey enroll) and `/settings/two-factor` (2FA).
- **Fixture prep:** the release fixture supplies `E2E_2FA_EMAIL`, `E2E_2FA_PASSWORD`, and one disposable `E2E_2FA_BACKUP_CODE`. A virtual WebAuthn credential is registered as `E2E_WEBAUTHN_CREDENTIAL_ID` / `E2E_WEBAUTHN_PRIVATE_KEY` / `E2E_WEBAUTHN_USER_HANDLE` (see `app/(auth)/two-factor/page.tsx`). The passkey enroll prompt surfaces only for new OAuth users (`app/(auth)/post-login/page.tsx`).
- **Steps:**
  1. (Optional, for a brand-new account) Sign up as `E2E_2FA_EMAIL`, then observe the PasskeyEnrollPrompt surface at `/post-login`; complete registration with the virtual WebAuthn credential.
  2. Navigate to `/settings/two-factor` and enroll 2FA. Confirm the backup-code set is generated.
  3. Sign out, then sign back in: confirm the 2FA challenge renders.
  4. Complete 2FA using one of the backup codes (`E2E_2FA_BACKUP_CODE`).
- **Expected outcome:** 2FA is required on subsequent sign-ins; the consumed backup code is invalidated; a passkey is listed under security credentials.
- **Evidence to capture:** user email; 2FA enabled timestamp; screenshot `evidence/credentialed-2fa-<operator>.png` (enrolled methods + successful sign-in with backup code); operator initials ____ — Pass/Fail — Notes ____.

### Execute: Billing / webhooks (checkout + portal)

- **Starting point:** `RELEASE_SMOKE_URL/pricing` → "Start Pro" button (POST `/api/stripe/checkout {plan:"BUILDER"}`).
- **Fixture prep:** `E2E_BILLING_PAID_EMAIL` / `E2E_BILLING_PAID_PASSWORD` is a Stripe test customer with a registered card. Stripe test-mode Webhooks (`/api/webhooks/stripe`) must be receiving events. `ADMIN_NOTIFICATION_EMAIL` must be set for the admin payment-failed alert path.
- **Steps:**
  1. Sign in as the paid fixture (Pro or Studio — note the plan under `/settings/billing`).
  2. From `/pricing` or `/billing`, start a Pro checkout. Complete the Stripe test checkout with a real test card (4242...).
  3. Confirm redirect to `/dashboard?upgraded=1&plan=BUILDER` and the dashboard reflects the new plan badge.
  4. Open the Stripe test dashboard; confirm the `checkout.session.completed` → `customer.subscription.created` webhook chain landed and the user's `subscriptionStatus` is `ACTIVE`.
  5. From `/billing`, click "Manage subscription" (POST `/api/stripe/portal`); confirm redirect to the Stripe portal and back to `/billing`.
- **Expected outcome:** Pro entitlement is active (`canAccessPaidFeatures=true`, `reportTier='paid'`); the portal opens and returns; no 500s on webhook processing.
- **Evidence to capture:** paid account email + plan label; Stripe checkout session ID; `subscriptionStatus` from `/api/me` (or DB); screenshot `evidence/credentialed-billing-<operator>.png` (plan badge + portal return); operator initials ____ — Pass/Fail — Notes ____.

### Execute: Revoked entitlement

- **Starting point:** `/dashboard` and `/report/<REPORT_ID>` for the paid fixture whose subscription the operator drives into a revoked state.
- **Fixture prep:** the paid account must be on an active Pro/Studio subscription first (see Billing row). The operator must be able to trigger a revoked status via the Stripe test dashboard (cancel / invoice `payment_failed` for `past_due` / `unpaid`) so the `/api/webhooks/stripe` handler writes `subscriptionStatus` = `CANCELED`/`PAST_DUE`/`UNPAID` and demotes `plan` to `FREE` via `applyPlanLimits`. `ADMIN_NOTIFICATION_EMAIL` must be set so the `payment_failed` admin alert path is exercised.
- **Steps:**
  1. Starting from the active paid subscription (Billing row), drive the subscription into `PAST_DUE` by leaving an open invoice unpaid (or cancel it) in the Stripe test dashboard.
  2. Allow the webhook to process. Refresh `/api/me` and `/billing`.
  3. Observe paywalled surfaces: the Dashboard shows the paywall; Canvas, protected-sharing creation, and GitHub repo scanning are gated (402/302), while the report itself and re-check remain available to the owner.
  4. Confirm the `notifyAdminPaymentFailed` admin email was sent to `ADMIN_NOTIFICATION_EMAIL` (mailbox assertion prep, below).
- **Expected outcome:** `getReportTierForUser` returns `free`; `canAccessPaidFeatures` returns `false`; paid-only surfaces are denied with `UPGRADE_REQUIRED`; the report owner can still view their existing report.
- **Evidence to capture:** user email; `subscriptionStatus` before/after; screenshot `evidence/credentialed-revoked-<operator>.png` (paywall + denied 402 responses); the admin payment-failed email record; operator initials ____ — Pass/Fail — Notes ____.
- **BLOCKED-PREP:** depends on a Stripe test-card schedule the operator can fire and on `ADMIN_NOTIFICATION_EMAIL` being provisioned.

### Execute: Pro Canvas

- **Starting point:** `RELEASE_SMOKE_URL/sign-in` → sign in as the Pro fixture (`E2E_BILLING_PAID_EMAIL` on the `BUILDER` plan; if the paid fixture is `TEAM`, use a distinct Pro account) → open `/report/<REPORT_ID>` → switch the workspace view to **Canvas**.
- **Fixture prep:** the signed-in user must be on the Pro plan (`BUILDER`) or Studio (`TEAM`); Canvas is gated by `canAccessPaidFeatures`. The report must be `COMPLETED` and owned by the user.
- **Steps:**
  1. Sign in as the Pro fixture. Open one of the account's completed reports.
  2. In the workspace, open the view toggle and select **Canvas**. Confirm the empty-state prompt (`REPORT_COPY.workspace.canvas.start`).
  3. Create a Canvas entry bound to one confirmed Flag (evidence-grounded, schema-driven). Confirm the provider-reported model usage is recorded.
  4. Edit the same Canvas entry; confirm a new immutable version is created (no in-place mutation of the prior version).
- **Expected outcome:** Canvas is available to Pro (not Free); each save produces a new version; model usage is persisted.
- **Evidence to capture:** report ID `<REPORT_ID>`; user plan label `Pro`; screenshot `evidence/credentialed-canvas-<operator>.png` (Canvas panel with version header); Canvas version numbers before/after edit; operator initials ____ — Pass/Fail — Notes ____.
- **BLOCKED-PREP:** the paid fixture must be `BUILDER` (Pro). If only one paid fixture exists and it is `TEAM`, this row cannot run without a separate Pro account.

### Execute: Studio project allowance

- **Starting point:** `RELEASE_SMOKE_URL/sign-in` → sign in as the Studio fixture → `/dashboard` → New Project.
- **Fixture prep:** the signed-in user must be on the Studio plan (`TEAM`); `projectLimitForPlan('TEAM') = 5`. This is the only tier that creates managed projects enabling daily Product Watch and GitHub repo scanning.
- **Steps:**
  1. Sign in as the Studio fixture. Open `/dashboard` → click **New Project**.
  2. POST `/api/projects` with `{ name: "Staging Site", url: E2E_AUDIT_URL }`; confirm a project row appears with `isManaged: true`.
  3. Open `/dashboard` and confirm the project list reflects the new project; if 5 projects already exist, creating an additional one returns 402 (`Projects require the Studio plan`).
- **Expected outcome:** Studio users may create up to 5 managed projects; Free/Pro users are denied project creation.
- **Evidence to capture:** Studio account email + plan label; project ID (`<PROJECT_ID>`); screenshot `evidence/credentialed-studio-projects-<operator>.png` (project row in dashboard); operator initials ____ — Pass/Fail — Notes ____.
- **BLOCKED-PREP:** requires a `TEAM` (Studio) sandbox account. The single `E2E_BILLING_PAID_*` fixture is ambiguous between Pro and Studio; a dedicated Studio fixture is needed unless the paid account is `TEAM`.

### Execute: Protected sharing

- **Starting point:** `RELEASE_SMOKE_URL/sign-in` → sign in as the Studio fixture → open a completed report → **Share** action → POST `/api/reports/<REPORT_ID>/share-links`.
- **Fixture prep:** the report owner must be on the Studio plan (`canSharePublicly` requires `TEAM`); `E2E_SHARE_PASSWORD` (>= 10 chars), and the report owner's email/password (`E2E_SHARE_OWNER_EMAIL` / `E2E_SHAREG_OWNER_PASSWORD`). `E2E_SHARE_REPORT_ID` is the report to share.
- **Steps:**
  1. As the Studio owner, open `/report/<REPORT_ID>` → open the Share panel → create a share link with a password (`E2E_SHARE_PASSWORD`) and an expiry/max-views cap (e.g. `maxViews: 1`).
  2. Copy the `<SHARE_TOKEN>` from `/share/<SHARE_TOKEN>`.
  3. In a clean browser/profile, request `RELEASE_SMOKE_URL/api/share/<SHARE_TOKEN>` (GET) with no cookie → confirm `401 Incorrect password` (`SHARE_PASSWORD_INCORRECT`).
  4. Submit the password (POST `/api/share/<SHARE_TOKEN>` body `{password}`) → confirm a `ff_share_grant` cookie is set and the redirect to `/share/<SHARE_TOKEN>` renders the report.
  5. View once (maxViews honored → second view returns `SHARE_EXHAUSTED`). Then revoke from the owner panel (DELETE `/api/reports/<REPORT_ID>/share-links?shareId=<SHARE_ID>`).
  6. In the clean profile, request the revoked share → confirm `410 Share link revoked` (`SHARE_REVOKED`) and no view inflation is recorded.
- **Expected outcome:** the share is gated by password; view count does not inflate before authorization; max-views and revoke are enforced with explicit statuses; revoked links return 410.
- **Evidence to capture:** report ID + share token; screenshot `evidence/credentialed-share-<operator>.png` (password prompt + authorized view + revoked 410); owner email; operator initials ____ — Pass/Fail — Notes ____.
- **BLOCKED-PREP:** requires a Studio owner account and a provisioned `E2E_SHARE_PASSWORD`.

### Execute: Update review (re-check / diff / Remember)

- **Starting point:** `RELEASE_SMOKE_URL/sign-in` → open the owned completed report → **Re-check** action (POST `/api/reports/<REPORT_ID>/re-check`).
- **Fixture prep:** the report owner (any tier). The original `E2E_AUDIT_URL` must be re-scannable from the release worker. `E2E_AUDIT_URL` is the same URL reviewed in the Anonymous row.
- **Steps:**
  1. As the owner, open `/report/<REPORT_ID>` and trigger a manual re-check (fresh full capture against the parent report).
  2. Poll until the child report reaches `COMPLETED`.
  3. Observe the diff strip (fixed / remaining / new / regressed counts) and the new ranked Fix List (`nextFinishPlan`).
  4. Confirm the child report carries `recheckTrigger` set (e.g. `MANUAL`) and a `parentId` pointing at `<REPORT_ID>`; it is labeled as an update review in the workspace.
- **Expected outcome:** a child report is created with a parent/child diff; regressed/new issues are surfaced; the Finish Plan reflects only the currently unresolved Flags.
- **Evidence to capture:** parent report ID `<REPORT_ID>`; child report ID `<CHILD_ID>`; diff counts; `completedAt` of the child; screenshot `evidence/credentialed-update-review-<operator>.png` (diff strip + new Fix List); operator initials ____ — Pass/Fail — Notes ____.

### Execute: Product Watch

- **Starting point:** `RELEASE_SMOKE_URL/sign-in` → sign in as the Studio fixture → open `/dashboard` → the Studio project created in the Studio row → enable **Product Watch** (PUT `/api/projects/<PROJECT_ID>/watch {interval:"weekly"}`).
- **Fixture prep:** a managed Studio project with a `COMPLETED` parent audit (required by `processDueProjectWatches`); `productWatchReadiness()` must return `available: true` (Redis + Resend configured). `E2E_WATCH_EMAIL`/`E2E_WATCH_PASSWORD` = Studio account email/password; `E2E_WATCH_PROJECT_ID` = the managed project; `E2E_WATCH_MAILBOX_ASSERT_URL` = a reachable Resend sandbox assertion endpoint.
- **Mailbox-assertion prep:** set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; configure Resend sandbox delivery so the regression email (idempotency key `fixflags-watch-<childId>-v1`) lands at `E2E_WATCH_MAILBOX_ASSERT_URL`; confirm the endpoint returns the expected subject line `Regression on <host>: N issue(s)`. Trigger a `processDueProjectWatches` tick (via the `cron/nurture` worker or an admin manual trigger) and poll the assertion endpoint for exactly one matching message.
- **Steps:**
  1. Enable weekly Product Watch on the managed project. Confirm `watchNextRunAt` is populated and `readiness.available === true`.
  2. Advance the project's `watchNextRunAt` to the past (operator DB update) to force a due tick, or wait for the next scheduled run.
  3. Confirm a WATCH-triggered child audit is enqueued (`recheckTrigger: 'WATCH'`) and completes as an update review.
  4. (Regression path) If the child introduces regressed/new issues, confirm an email is sent to the Studio account via Resend and asserted at `E2E_WATCH_MAILBOX_ASSERT_URL`; confirm `watchNotificationStatus: 'SENT'`.
- **Expected outcome:** watch schedules and fires; the WATCH child report is a completed update review with a parent diff; exactly one regression email is delivered and asserted; non-regressing runs set `watchNotificationStatus: 'NOT_APPLICABLE'`.
- **Evidence to capture:** project ID `<PROJECT_ID>`; parent report ID + WATCH child report ID; `watchNotificationStatus`; mailbox assertion result (matching message count + subject); screenshot `evidence/credentialed-watch-<operator>.png` (watch settings + child report); operator initials ____ — Pass/Fail — Notes ____.
- **BLOCKED-PREP:** requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `REDIS_URL`, and a live `E2E_WATCH_MAILBOX_ASSERT_URL` assertion endpoint.

### Execute: GitHub Fix PR

- **Starting point:** `RELEASE_SMOKE_URL/sign-in` → sign in as the Studio fixture → `/settings/integrations` → **Connect GitHub**.
- **Fixture prep (GitHub fixture):** a sandbox GitHub account (`E2E_GITHUB_EMAIL`/`E2E_GITHUB_PASSWORD`) that has pre-authorized the FixFlags GitHub OAuth app (`GITHUB_CLIENT_ID` registered with the `repo` scope); a real repository `E2E_GITHUB_REPOSITORY` (e.g. `owner/scan-target`) owned by that account containing fixable content (a rendered HTML page missing `<title>`/meta or placeholder copy). GitHub App/secret variables (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) must be configured on the release host.
- **Steps:**
  1. As the Studio user, open `/settings/integrations` and click **Connect GitHub** (GET `/api/integrations/github/connect` → redirects to `github.com/login/oauth/authorize`). Sign in as `E2E_GITHUB_*` and authorize the app.
  2. Confirm redirect back to `/settings/integrations?connected=1`. Then GET `/api/integrations/github/repos` → confirm the repo list, with `E2E_GITHUB_REPOSITORY` present.
  3. POST `/api/integrations/github/select` with `{repos:["E2E_GITHUB_REPOSITORY"]}`.
  4. POST `/api/repo-scans` with `{repoFullName:"E2E_GITHUB_REPOSITORY"}` → record `repoScanId`; poll the scan to completion.
  5. Identify one permitted, fixable finding from the scan. POST `/api/repo-scans/<SCAN_ID>/findings/<FINDING_ID>/fix-pr` → record `repoFixPrId`.
  6. Poll GET on the same fix-pr route until `status` is `OPEN` and `prUrl` is present. Open the PR URL on GitHub and confirm the diff.
- **Expected outcome:** a real GitHub repository scan completes; a fix PR is opened against the target repo with a concrete patch for the selected finding.
- **Evidence to capture:** GitHub username; `repoScanId`; `repoFixPrId` + `prUrl`; `status: OPEN`; screenshot `evidence/credentiated-github-pr-<operator>.png` (the open PR diff on github.com); operator initials ____ — Pass/Fail — Notes ____.
- **BLOCKED-PREP:** requires a sandbox GitHub account, a pre-authorized OAuth app, and a live `E2E_GITHUB_REPOSITORY` with fixable content.

### Execute: MCP

- **Starting point:** an MCP host client (Cursor / Claude Code / Claude Desktop) configured with the SSE transport `RELEASE_SMOKE_URL/api/mcp`.
- **Fixture prep:** an API key created by the paid fixture at `/settings/api-keys` (`E2E_API_KEY` from preflight). The key must be scoped to a plan that can access paid MCP features (compare/repo-scan tools require `TEAM`). For the basic authenticated journey, any authenticated key suffices.
- **Steps:**
  1. In the MCP client, configure the `fixflags` server with `Authorization: Bearer <E2E_API_KEY>` (or `x-api-key`).
  2. Call `ff_check_and_plan` with `url: E2E_AUDIT_URL, waitForCompletion: true, mode: "single"`. Confirm a `reportId` + `reportUrl` is returned and the report reaches `COMPLETED`.
  3. Call `ff_get_check_status {reportId}` → confirm `status: COMPLETED`.
  4. Call `ff_get_report {reportId}` → read the complete Fix List.
  5. Call `ff_recheck_and_compare {parentReportId: <reportId>, waitForCompletion: true}` → confirm a child report + diff (fixed/remaining/new/regressed).
  6. Call `ff_mark_fix_attempted` with a flag ID and a `prompt` to record the attempt.
- **Expected outcome:** authenticated MCP returns a completed check, full Fix List, a re-check diff, and persists a fix-attempt marker; no 401/403 on tool access for the key's tier.
- **Evidence to capture:** API key label; `reportId` for the new check; child `reportId` for the recheck; `ff_mark_fix_attempted` confirmation; screenshot `evidence/credentialed-mcp-<operator>.png` (MCP tool results / host transcript); operator initials ____ — Pass/Fail — Notes ____.

### Execute: CLI

- **Starting point:** a fresh shell on the operator workstation with `npx fixflags` resolvable from the release npm package.
- **Fixture prep:** `E2E_API_KEY` set in the shell (or run `npx fixflags login` which performs the device-auth flow against `RELEASE_SMOKE_URL/api/cli/auth/device` → verify at `RELEASE_SMOKE_URL/cli/authorize?user_code=<userCode>`). `FIXFLAGS_API_URL` must point at `RELEASE_SMOKE_URL` (defaults to `https://fixflags.com`).
- **Steps (anonymous):**
  1. `npx fixflags check <E2E_AUDIT_URL> --wait --plan` → confirm a Finish Plan + `reportUrl` prints and `--exit-code` is non-zero only if a critical Flag exists.
- **Steps (authenticated):**
  1. `npx fixflags login --with-token` (paste `E2E_API_KEY`) or `npx fixflags login` (device flow). Confirm `Authenticated as <email>`.
  2. `npx fixflags whoami` → confirm email + plan.
  3. `npx fixflags check <E2E_AUDIT_URL> --wait --all --json` → capture `reportId`.
  4. `npx fixflags recheck <reportId> --wait --diff --json` → confirm fixed/remaining/new/regressed.
  5. `npx fixflags status <reportId>` → confirm `COMPLETED`.
  6. `npx fixflags logout`.
- **Expected outcome:** the packaged CLI (`npx fixflags`) authenticates, runs an anonymous and an authenticated check, reads the Fix List, performs a re-check with diff, and reports status; credential storage uses the OS keychain.
- **Evidence to capture:** `stdout` of `whoami`; `reportId` from `--json`; screenshot `evidence/credentialed-cli-<operator>.png` (terminal output of check + recheck + status); operator initials ____ — Pass/Fail — Notes ____.
