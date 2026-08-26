# Session

## Task

- **ID:** app-polish-shipping (review pass)
- **Agent:** claude (Claude Code)
- **Date:** 2026-07-17
- **Branch:** claude/app-polish-shipping-unj812

## Outcome

Reviewed the `first-value-journey` work that was sitting in **review** status on
the board (merged in `ffa6b75..84d54b8`) and closed it out as **done**. The work
is solid: anon first scan restored on the landing page, `next=` handoff through
sign-up/sign-in is sanitized correctly, the claim CTA sits right after the flags
explorer, the queue-wait callout and judge-utils extraction are clean, and the
new copy passes voice rules and all guards. Three focused gaps found in review
were fixed and verified this session.

### Shipped

1. **`AuditInput` autoStart: one-shot sessionStorage guard against duplicate
   scans.** The post-signup handoff (`/dashboard?url=...`) auto-submits once,
   then pushes to `/report/[id]`. Pressing Back remounted the dashboard with
   `?url=` intact and silently re-submitted a duplicate scan (burns quota,
   duplicate audit rows). First attempt stripped the query with
   `window.history.replaceState` before submitting; the live browser E2E proved
   that LOSES A RACE with the Next router's own hydration-time history sync
   (Back still restored `?url=` and created a third audit). Replaced with a
   per-tab `sessionStorage` marker (`ff:autostart-url`); the browser E2E now
   confirms exactly one audit per URL across signup handoff + Back navigation.
   Lesson recorded: do not trust `history.replaceState` to persist over App
   Router hydration; verify history-sensitive fixes in a real browser.

2. **`AiReviewPendingRefresh`: survive transient poll errors.** A single non-OK
   response (e.g. 502 during a deploy) permanently stopped the `aiReviewAt`
   poll, so fix prompts never appeared without a manual reload — the exact
   failure the component exists to prevent. Non-OK responses now count as a
   failed attempt and polling continues within the existing 45-attempt cap.
   (403/404 can't realistically occur here: `enabled` is computed server-side
   for viewers who can already see the report, and access rules match.)

3. **Hero CTA no longer waits on `/api/me`.** `landingDisabled = loading ||
   (isLanding && authLoading)` disabled the homepage hero input AND submit
   button until the `useMe` fetch resolved. That gate existed only to support
   the old pre-submit `router.push('/sign-up')` branch for anonymous visitors,
   which the first-value-journey work removed. It survived as dead weight:
   the product's primary CTA was blocked for the duration of an uncached
   `/api/me` roundtrip on every cold visit (and indefinitely if that request
   hung). Removed the gate and the now-unused `authLoading` wait in the
   autoStart effect; the API resolves the session server-side, and analytics
   `isLoggedIn` comes from the POST response.

4. **Funnel attribution accuracy.** `AuditLimitGate` hardcoded `from: 'report'`
   on its sign-up/sign-in links, mislabeling homepage-hero signups in the
   `signed_up` funnel. The gate now takes an optional `from` prop and
   `AuditInput` passes its real placement (`hero`/`final`); tool-page gates omit
   `from` instead of lying. Also closed the acknowledged residual from the
   first-value-journey handoff: `ExportMenu` fix-prompt copies now emit
   `fix_prompt_copied` with `kind: 'plan' | 'export'` and `audit_id` (report
   summary copy intentionally untracked — it is not a fix prompt).

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test:unit` — 1732 passed, 1 skipped
- `npm run brand:hex-guard` / `ui:drift-guard` / `seo:guard` — all pass
- `npm run build` — succeeds (run twice: before and after the ExportMenu edit)
- `npm run demo:audit:offline` — 18 accurate flags on broken fixture, 0 on the
  fixed fork, actionable prompts (pipeline behavior verified end to end offline)

## Second pass (same session): full-stack browser E2E + production validation

The sandbox turned out to be more capable than prior sessions assumed:

- **Native Postgres 16 + redis-server ARE installed** (no docker needed).
  Recipe: `initdb` as a `postgres` user under `/tmp/ff-pg`, `pg_ctl start`,
  `redis-server --daemonize yes`, create `fixflags` role + db, `npm run
  db:deploy && npm run db:seed`, then `npm run dev`. Full stack boots.
- **Outbound HTTPS works via the agent proxy for curl/node-fetch** (even
  "direct" node fetch is transparently intercepted and succeeds).
  **Chromium/Puppeteer HTTPS egress is blocked at the sandbox level**
  (ERR_CONNECTION_RESET; `--proxy-server` flags do not help — plain-HTTP
  reaches the proxy, CONNECT never does). So: local audits of external sites
  fail at screenshot capture, but localhost browsing is unrestricted and
  production can be exercised via curl.
- **`DEV_SIMULATE_BILLING=true`** enables the real billing gates under
  `npm run dev` (needed to test the anon limit gate; otherwise
  `isDevUnlimitedScans()` bypasses them).

### Verified via browser E2E (billing gates active)

Full first-value journey, all PASS: anon hero scan → report; second anon scan
→ signup gate; gate → `/sign-up?next=%2Fdashboard%3Furl%3D...&from=hero`;
email signup → post-login → dashboard autoStart → report; Back → dashboard
with NO duplicate scan (DB: exactly 1 audit per URL). Failure UX (capture
fails in sandbox) is calm; private reports correctly deny logged-out visitors.

### Additional fixes shipped in this pass

5. **Missing `<h1>` on /faq, /examples, /changelog.** `LandingSectionHeader`
   hardcoded `h2`; added an `as` prop and used `as="h1"` at the three page-top
   call sites. Every marketing route now has exactly one h1 (curl-verified
   across 15 routes). The product flags this exact issue on customers' sites.
6. **Marketing header CTA pop-in.** `MarketingHeaderAuth` returned `null`
   while `/api/me` was in flight, so "Log in / Try free" appeared ~1s late
   (and never, if the request hung). Now renders the logged-out state
   immediately (SSR HTML contains it) and swaps to the avatar when a session
   resolves.
7. **Meta Pixel CSP block (residual from handoff) fixed.** `proxy.ts` CSP now
   allows `connect.facebook.net` (script), `www.facebook.com` +
   `connect.facebook.net` (connect), `www.facebook.com` (frame). Verified live
   prod CSP was blocking fbevents.js whenever `NEXT_PUBLIC_META_PIXEL_ID` is
   set.
8. **OAuth signups now fire `signed_up` (residual from handoff) fixed.**
   better-auth's `newUserCallbackURL` (supported in installed v1.6.15, schema
   verified) routes first-time OAuth accounts to `/post-login?...&signup=1`;
   post-login fires `signed_up` (method: 'oauth') once, with a ref guard.
   Email signups keep tracking on the form. Server-side ad conversions were
   already covered by `recordSignupConversion` on user-create.

### Production validation (read-only + one intended-flow anon scan)

- `/api/health`: db ok, storage ok, `aiConfiguredProviders: ["openai"]`
  (Anthropic key not set in prod), pipeline 2.3.0, commit `28cf321` (not in
  local history; but deployed API returns `isLoggedIn` so the
  first-value-journey surface is live).
- Security headers all present; CSP confirmed missing facebook domains
  (fix #7 addresses it on next deploy).
- **Live core loop**: anon `example.com` scan via prod API → CAPTURING →
  JUDGING → COMPLETED, score 67, 24 flags, all accurate for that bare page (no
  false positives). Anon claim CTA renders. **Observation:** this run took the
  degraded-triage path (`failureCode` set, `triageAt` null) — deterministic
  flags shipped, "AI summary unavailable" callout displayed gracefully. Worth
  watching whether prod triage failures are frequent (single datapoint here).

## Cleanup

- Deleted `output/playwright/` (5.2MB of committed session QA screenshots;
  `.gitignore` already declared `/output/` untracked — these predated the rule)
  and root `screenshot.png` (an example.com debug capture, referenced nowhere).
- Left `_VBRANDING/` (7.7MB, UUID-named brand imagery) untouched: referenced by
  no code or docs, but it looks like the founder's original brand source
  assets. Candidate for removal or moving out of the repo — needs a human call.

## Remaining risks / follow-ups

- ~~Live verify on fixflags.com: anon scan → report~~ Done this session (see
  production validation). Still untested live: signup **claim on prod** and
  fix-prompt appearance without reload (validated locally via browser E2E and
  code review; needs a real prod signup to fully close).
- ~~Meta Pixel CSP block~~ / ~~OAuth GA signup tracking~~ Fixed this session
  (#7, #8). OAuth E2E untestable in sandbox (no OAuth creds): flow falls back
  to the previous behavior if `newUserCallbackURL` is ignored, so risk is low.
  Verify a real Google/GitHub signup fires `signed_up` after deploy.
- Prod triage failed on the one live scan observed (degraded path, graceful
  UX). Check triage failure rate in prod logs/admin; Anthropic fallback key is
  not configured (`aiConfiguredProviders: ["openai"]`), so an OpenAI hiccup
  has no fallback.
- Confirm in production analytics that `fix_prompt_copied.kind` distribution
  looks sane (flag vs plan vs export).

## Iteration 3 (same session): re-check walk + clear URL errors

- Browser-verified the email sign-in -> /post-login -> dashboard path (the
  earlier timeout was local Postgres dying, not the auth change; restart per
  the fullstack recipe learning note).
- Browser-verified the RE-CHECK step end to end as the claimed owner:
  action button -> POST /monitoring -> navigation to the new monitoring
  report; DB row has monitoringMode FULL and skipUsageCount true (both
  core-loop invariants hold). In-progress UI (ring, N/A rubrics, device
  skeletons) renders correctly. All three Flag -> Fix -> Re-check steps are
  now personally browser-verified this session.
- **Fix shipped:** URL-validation failures inside `createAndEnqueueAudit`
  (typo'd/unresolvable domain, SSRF block) surfaced as generic 500
  "Something went wrong" on the hero input and re-check. Added typed
  `AuditUrlError` in `lib/audit/url.ts`, handled centrally in
  `handleRouteError` as 400 INVALID_URL; DNS-failure copy is now
  "We could not find that domain. Check the URL and try again." Verified
  live via POST /api/checks (400 + message) and the re-check toast.

## Iteration 4 (same session): schema/migration drift = likely prod triage killer

`npm run verify`'s drift gate caught real drift on merged main: `schema.prisma`
has four ImpactTag variants (CLARITY, AUTHORITY, FRICTION, EMOTION, from
commit 8d50901 "flag quality iteration") and an `auditMode` default change
(SINGLE -> CRITICAL_PATH) with **no migration**. All 38 migrations applied
cleanly and the diff persisted, confirming the miss.

Impact: any migrate-deployed database (prod deploys via `db:deploy`) rejects
those enum values at persist time. The AI triage/judge schemas ACCEPT the new
tags (`judge-triage-schema.ts`, `judge-schema.ts`), so a triage response using
one would fail at flag persist. **Hypothesis:** this explains the degraded
triage observed on the live prod scan earlier this session (`triageAt` null +
`failureCode` on a COMPLETED audit). Single datapoint; confirm by checking
prod `ImpactTag` enum values or triage failure logs after deploying the fix.

Fix: migration `20260718132024_impact_tag_variants_and_critical_path_default`
(ADD VALUE IF NOT EXISTS x4 so it is safe even on databases already patched
via `db push`, plus the default change). Applied locally; `db:drift` clean;
full `npm run verify` green.

Lesson: run `npm run verify` (not just typecheck/lint/test/build) after any
merge that touches `prisma/schema.prisma`; the drift gate is the only thing
that catches schema-without-migration.
