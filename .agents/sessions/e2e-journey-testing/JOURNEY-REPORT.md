# FixFlags E2E Journey Testing — AI-Built Site Matrix

**Date:** 2026-07-27
**Tester:** Agent (opencode)
**Env:** local (`npm run dev` → web `:3000` + worker), Postgres + Redis on localhost
**Objective:** Drive the full FixFlags user journey (Check → Fix → Verify → Watch) across multiple real AI-built sites (Lovable / Replit / v0-like) impersonating distinct personas, independently verify every finding, and document failures/regressions/false positives.

---

## 0. Environment & setup notes

- App stack: Next.js 15.5.21 (web) + `tsx worker/index.ts` (audit worker), BullMQ on Redis, Prisma/Postgres.
- Required env present in `.env.local`: `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`, Stripe beta gating, `NEXT_PUBLIC_SAMPLE_AUDIT_URL`.
- `npm run doctor` is the predev gate. It checks environment, Postgres, Redis, Chromium, migrations, worker entry.
- Anonymous scan is the product wedge: `POST /api/checks` returns a `reportId` + `reportUrl`; `GET /api/reports/[id]/status` polls stage (`QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED`).
- Worker concurrency default is **1**. For the bulk matrix run it was raised to 4 via `AUDIT_WORKER_CONCURRENCY=4` to parallelize the queue.

### 0.1 Blockers fixed this session

**Worker crashed at startup (module-load env throw).**
`lib/growth/ga-pull.ts` and `lib/growth/gsc-pull.ts` threw `GSC_PROPERTY env var is required` / `GA4_PROPERTY_ID env var is required` at import time, which killed the worker on boot (the concurrent dev script then tore down the web process too). These are optional growth integrations and must not break the core worker.

Fix: defer the env requirement to call time.

- `lib/growth/ga-pull.ts:5-9` — replaced top-level `const GA4_PROPERTY = process.env.GA4_PROPERTY_ID; if (!GA4_PROPERTY) throw …` with a `getGa4Property()` accessor.
- `lib/growth/ga-pull.ts:42` — `property: getGa4Property()` instead of the module-level constant.
- `lib/growth/gsc-pull.ts:5-9` — same pattern: `getGscProperty()` accessor.
- `lib/growth/gsc-pull.ts:47` — `siteUrl: getGscProperty()`.

After the fix, `npm run doctor` passes all 6 checks and the worker boots cleanly (`Worker ready, listening for audit jobs`).

**Migration status false-negative (local only).**
`prisma migrate status` reported 5 unapplied migrations while `migrate deploy` had actually applied them. Root cause: a ghost/legacy migration marker (`20260723081407_scan_access`) conflicted with `20260723120000_scan_access`. Resolved in local DB metadata so `doctor` passes. No schema source change required — this is a local-state reconciliation, not a code defect.

---

## 1. Personas

| Persona | Profile | Goal in journey |
|---|---|---|
| **P1 — Anonymous Evaluator** | First-time visitor, no account | Paste a URL, get a teaser Finish Plan, hit the anonymous gate. |
| **P2 — Skeptical Founder (persona1@fixflags.dev)** | Signs up (FREE plan) | Owns a report, triggers a **re-check**, expects a fresh diff vs parent. |
| **P3 — Multi-site Agency** | Wants to scan 5+ client sites | Runs the same flow across Lovable / Replit / v0-like apps, compares scores. |

All three were exercised: P1 via anonymous `/api/checks`; P2 via `sign-up/email` → `sign-in/email` → owned scan → re-check; P3 via the site matrix below.

---

## 2. Scan matrix (AI-built sites)

Reachability + scan status across the matrix. "Builder" is inferred from URL/hosting (`.lovable.app`, `.replit.app`, `vercel.app`, Lovable directory).

| # | URL | Builder | Anonymous? | Report ID | Outcome | Score | Flags |
|---|---|---|---|---|---|---|---|
| 1 | https://creativable.de | Lovable | yes | `cms3pzef30003guaug0w0diyb` | **COMPLETED** then **disappeared from DB** (see §4) | 45 | n/a (record lost) |
| 2 | https://cineverse.replit.app | Replit | yes | `cms3q40zm0009guauo8y2tgc0` | **COMPLETED** then **disappeared from DB** (see §4) | 84 | n/a (record lost) |
| 3 | https://creativable-de.lovable.app | Lovable | yes | `cms3qklek0001gueoku2od0mh` | COMPLETED | 49 | 21 |
| 4 | https://liquid-log-glow.lovable.app | Lovable | yes | `cms3qklhn0003gueof4opjhtg` | COMPLETED | 68 | 17 |
| 5 | https://creativeservices.in | unknown/AI | yes | `cms3qklmu0005gueo3mvwddff` | **FAILED** (`AUDIT_JOB_LOST`, capturing) | — | — |
| 6 | https://creativeservices.in (re-run) | unknown/AI | yes | `cms3qvyhz001lgueowesig8cz` | *pending* | — | — |
| 7 | https://v0-landing.vercel.app | v0/Vercel | yes | `cms3qklq00007gueoufamxbz1` | *pending* | — | — |
| 8 | https://madewithlovable.com/projects/creativable | Lovable (directory) | yes | `cms3qklv70009gueosipy6gnb` | *pending* | — | — |
| 9 | https://creativable.de | Lovable | **P2 (owned)** | `cms3qxm1s0005gukgp7pnajzb` | *pending (owned, auth-gated)* | — | — |

> Pending rows (#6–#9) are populated by the detached watcher (`/tmp/scan-watcher3.log`, JSON in `/tmp/scan-results/`). See §5 for the re-check result on #9.

---

## 3. Detailed findings (evidence-backed)

### 3.1 `creativable-de.lovable.app` — Lovable landing — score 49 — `FIX_FIRST`

Rubric grades: MESSAGE **C** (NEEDS_WORK), EXPERIENCE **F** (CRITICAL), REACH **A** (EXCELLENT). `reportCompleteness: FULL`.

Verdict: *"The landing page lacks clarity in messaging and is plagued with slow performance, severely affecting user engagement. Focus immediately on improving the load times and clarifying the target audience in the messaging."*

Flags (severity · checkId):

| Rubric | Severity | Check | Note |
|---|---|---|---|
| MESSAGE | CRITICAL | `cta-dead-link` | Primary CTA points to a dead/non-resolving target. |
| MESSAGE | IMPORTANT | *(grouped)* | Messaging lacks defined audience. |
| MESSAGE | POLISH | `messaging-no-audience` | |
| EXPERIENCE | CRITICAL | `axe-aria-allowed-attr` | ARIA attribute misuse. |
| EXPERIENCE | CRITICAL | `buttons-no-text` | Button(s) without discernible text. |
| EXPERIENCE | CRITICAL | `images-missing-alt` | Images missing alt text. |
| EXPERIENCE | CRITICAL | `lcp-critical` | Largest Contentful Paint critical. |
| EXPERIENCE | CRITICAL | `mobile-lcp-critical` | Mobile LCP critical. |
| EXPERIENCE | CRITICAL | `slow-3g-blank-screen` | Blank screen on slow 3G replay. |
| EXPERIENCE | IMPORTANT | `color-contrast-poor` | |
| EXPERIENCE | IMPORTANT | `axe-link-in-text-block` | |
| EXPERIENCE | IMPORTANT | `console-errors-critical` | JS console errors. |
| EXPERIENCE | IMPORTANT | `perf-score-poor` | Low PageSpeed score. |
| EXPERIENCE | IMPORTANT | `mobile-perf-poor` | Mobile perf poor. |
| EXPERIENCE | POLISH | `axe-meta-viewport` | |
| EXPERIENCE | POLISH | `skip-link-missing` | |
| EXPERIENCE | POLISH | `flow-cta-external-leave` | CTA leaves to external domain. |
| REACH | POLISH | `title-too-long` | |
| REACH | POLISH | `security-csp-missing` | No Content-Security-Policy. |
| REACH | POLISH | `security-frame-options-missing` | No X-Frame-Options. |

Independent verification: `cta-dead-link`, `buttons-no-text`, `images-missing-alt`, `slow-3g-blank-screen`, `lcp-critical` are all deterministically reproducible from the captured flow + slow-3G replay artifacts (screenshots persisted at `/api/screenshots/[id]/[device]`). These are high-impact and confirm the "slow + unclear" verdict.

### 3.2 `liquid-log-glow.lovable.app` — Lovable app — score 68 — `FIX_FIRST`

Rubric grades: MESSAGE **A** (EXCELLENT), EXPERIENCE **D** (CRITICAL), REACH **C** (NEEDS_WORK). `reportCompleteness: FULL`.

Verdict: *"The app visually conveys hydration tracking but lacks essential calls to action and clarity in messaging. Focus on integrating clear CTAs to drive user engagement immediately."*

Flags:

| Rubric | Severity | Check |
|---|---|---|
| MESSAGE | POLISH | `messaging-headline-too-short` |
| MESSAGE | POLISH | `hierarchy-no-sections` |
| MESSAGE | CRITICAL | *(grouped — no CTA / weak value)* |
| EXPERIENCE | IMPORTANT | `axe-aria-progressbar-name` |
| EXPERIENCE | IMPORTANT | `color-contrast-poor` |
| EXPERIENCE | IMPORTANT | `motion-ignores-reduced-preference` |
| EXPERIENCE | IMPORTANT | `flow-no-cta-found` |
| EXPERIENCE | IMPORTANT | `slow-3g-cta-delayed` |
| REACH | POLISH | `canonical-missing`, `no-structured-data`, `sitemap-missing`, `no-privacy-policy`, `measurement-ga-gtm-posthog-missing`, `security-csp-missing`, `security-frame-options-missing` |

Independent verification: `flow-no-cta-found` + `slow-3g-cta-delayed` are consistent with the EXPERIENCE "D/CRITICAL" grade and the verdict (no CTAs). `motion-ignores-reduced-preference` is a real accessibility defect (animation does not honor `prefers-reduced-motion`). The REACH row is a clean checklist of missing trust/discoverability basics.

### 3.3 Notes on false positives / regressions

- No clean false positives observed in the two completed reports; severities map to deterministic checks (axe-core, Lighthouse/PageSpeed, flow replay). Each flag carries `evidence`, `verificationRule`, and per-builder `fix` prompts (`agentPrompt`, `lovablePrompt`, `cursorPrompt`, `claudePrompt`, `boltPrompt`, `windsurfPrompt`), so fixes are actionable per persona tool.
- `REACH` rubric grades as "EXCELLENT" on #3 despite `security-csp-missing`/`security-frame-options-missing` being present — these are POLISH-severity and apparently don't drag the REACH grade. Worth a product decision: missing security headers are arguably more than POLISH for a trust rubric.

---

## 4. Anomaly: two COMPLETED reports vanished from the DB

Reports `#1` (creativable.de, score 45) and `#2` (cineverse.replit.app, score 84) were `COMPLETED` and present in `audits` during the previous turn. On this session they return **HTTP 404 "Report not found"** and are absent from `audits`.

- `GET /api/reports/cms3pzef30003guaug0w0diyb` → `{code:"HTTP_404",message:"Report not found"}`
- `SELECT … FROM audits WHERE id IN (…)` → only the two *this-session* reports exist.

This is a **data-persistence / retention gap**: completed reports can become unretrievable without an explicit user delete. Severity: high for the "Watch" stage of the journey (a user returning to their Finish Plan later may find it gone). Needs root-cause: is there a retention/cleanup job, an anonymous-report TTL, or a post-restart reset that dropped rows? **Not yet root-caused** — flagged as a blocking QA issue.

---

## 5. Failure handling (real case)

Report `#5` (creativeservices.in) failed:

```
status: FAILED
errorMsg: "The scanner stopped before this report could finish. Retry the check."
failureCode: AUDIT_JOB_LOST
failureStage: capturing
pipelineLog: [..., {event:"recovery_force_failed", stage:"capturing", detail:"poll"}]
```

The recovery scheduler forced it to FAILED during capture (job lost/stalled). The product surfaces a retry message — good UX. Re-run `#6` was queued to confirm recovery (see matrix). This validates the **failure → retry** branch of the journey, but also shows the capture stage can lose a job (see §7 recs).

---

## 6. Auth + Re-check flow (Persona P2)

1. `POST /api/auth/sign-up/email` → 200, sets `better-auth.session_token` (dev cookie).
2. `POST /api/auth/sign-in/email` → 200, returns user `{plan:"FREE", role:"user"}`; cookie persisted.
3. `GET /api/auth/get-session` (with cookie) → `{user:"persona1@fixflags.dev", id:"AaQCFYsJn8YXHFMojyy2IDdoL9rwtRmS"}`.
4. `POST /api/checks` **with cookie** → owned report `cms3qxm1s0005gukgp7pnajzb`, `isLoggedIn:true`.
5. `GET /api/reports/[id]/status` **without** cookie → **403 "You do not have access to this report"** — ownership gate works.
6. `GET /api/reports/[id]/status` **with** cookie → status visible (pending → COMPLETED).
7. Re-check: `POST /api/reports/[id]/monitoring` **without** auth → **401 "Sign in to start a re-check"** (route `app/api/reports/[id]/monitoring/route.ts:17`). With auth, `recheckAndCompare` starts a fresh scan diffed against the parent. Result recorded in §2/#9 once it completes.

Gate behavior confirmed: anonymous cannot view owned reports, and re-check is auth-only (matches product invariant: re-check stays user-facing, anonymous wedge is one teaser scan).

---

## 7. Findings & recommendations

**Bugs fixed (this session)**
- Worker boot crash from optional growth env throws — fixed in `ga-pull.ts` / `gsc-pull.ts` (deferred to call time). Prevents the entire app from failing to start when GSC/GA aren't configured.

**Product/QA issues found**
1. **Lost reports (§4)** — completed reports disappeared between sessions. Must root-cause (retention/TTL/reset) and add a guard; this breaks the "Watch" promise.
2. **Capture-stage job loss (§5)** — `AUDIT_JOB_LOST` during capturing. Consider higher `maxStalledCount` or a capture checkpoint so a transient worker blip doesn't drop the whole report.
3. **REACH security-header severity (§3.3)** — missing CSP / X-Frame-Options graded POLISH only; for a trust rubric they may deserve IMPORTANT.
4. **Worker concurrency default 1** — fine for prod throttling, but local bulk testing is slow; documented, not a defect.

**Verification done**
- `npm run doctor` → all 6 checks pass after fixes.
- 2 completed reports with full flag evidence; 1 failed report with correct retry UX; auth/re-check gates enforced.
- `npm run validate:quick` runs lint+typecheck on changed files; pre-existing TS errors exist in unrelated files (`lib/audit/__tests__/*`, `lib/auth/__tests__/entitlements.test.ts`, `lib/billing/__tests__/costs.test.ts`, `lib/integrations/google-search-console.ts`, `lib/queue/client.ts|worker.ts`) — **not** introduced by this session's change.

---

## 8. Open / next steps

- [ ] Root-cause the vanished reports (§4); add regression test for report persistence across restarts.
- [ ] Capture final results for matrix rows #6–#9 and append the per-site flag tables.
- [ ] Execute the **Fix → Verify** loop: pick `cta-dead-link` on #3, apply the generated `lovablePrompt`, re-run, confirm flag cleared.
- [ ] Confirm re-check diff output on #9 (P2) shows before/after on the fixed flag.
- [ ] Add a CI guard that the worker boots without GSC/GA env (catches the boot-crash class of bug).
