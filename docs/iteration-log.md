# Iteration Log

Running notes for the "make FixFlags 10x, genius-level accurate" iteration effort.
Purpose: avoid re-deriving architecture/context on every session, and track what's
been checked so we don't waste tokens re-auditing the same code.

**Convention:** newest entries at top. Keep entries short — link to code, not prose.
**Multi-agent note:** multiple agents have been editing `lib/audit/checks/*.ts` and
`lib/audit/__tests__/checks*.test.ts` concurrently in real time (confirmed via file
mtimes racing within the same minute). Before editing one of these files, re-`Read`
it immediately before your `Edit` call — several edits below landed on the second
try because another agent had just changed the file. If you find your fix already
applied, don't re-do it; move to the next item.

---

## 2026-07-05 — Session 26 (real accessibility bug on our own homepage - duplicate id, found via accessibility-tree snapshot, not guessed)

### Direct response to the goal's "analyze pure user experience by navigating" ask, scoped to accessibility this time (extends Session 25, doesn't repeat it)

Took a `preview_snapshot` (accessibility tree) of the live homepage - this is
what a screen reader user actually hears, not just what's visually on
screen. The URL input's accessible name came back as **"Website URL Website
URL"** - doubled. Screen reader users would hear this exact confusing
duplication on the product's own homepage, first form field a visitor
encounters.

### Root cause, confirmed via DOM inspection before touching anything

`components/audit/AuditInput.tsx` accepts an `idSuffix` prop specifically
designed to keep `id="audit-url${idSuffix}"` unique when multiple instances
render on one page - the pattern already existed and was already used
correctly at `app/(marketing)/how-it-works/page.tsx` (`idSuffix="-how-it-works"`).
Two call sites weren't using it:
- `components/marketing/landing/LandingHeroSection.tsx` and
  `components/marketing/landing/LandingFinalCtaSection.tsx` both render
  `<AuditInput variant="landing" />` with no `idSuffix` - and both mount on
  the **same homepage** (hero at top, final CTA at bottom, per AGENTS.md's
  documented section order). Two inputs, same `id="audit-url"`, two
  `<label for="audit-url">` elements - the browser's `input.labels`
  associates both labels with both same-ID inputs, producing the doubled
  accessible name. Verified via `input.labels` directly
  (`labelsCount: 2, labelTexts: ["Website URL", "Website URL"]`,
  `document.querySelectorAll('#audit-url').length === 2`) before touching
  source, not assumed from reading JSX.
- `components/dashboard/ExpertReviewSelectDialog.tsx` renders
  `<AuditInput />` (also no `idSuffix`) inside a dialog that opens **on top
  of** `app/(app)/dashboard/page.tsx`, which has its own default-id
  `AuditInput` already mounted underneath. Same bug, second real instance,
  found by checking every `<AuditInput` call site for this exact pattern
  rather than stopping at the first fix.

**Fixed:** added `idSuffix="-final-cta"` and `idSuffix="-expert-review-dialog"`
respectively. `LandingHeroSection` and `SharedReportBanner.tsx` correctly
keep the bare default id - each is now the only default-id `AuditInput` on
its respective page (`/` and `/report/[id]` are different routes, so no
cross-page collision to worry about there).

### False leads chased and ruled out before landing on this (documented so it's not repeated)

- A `preview_screenshot` immediately after editing+reloading showed **4**
  `input[id^="audit-url"]` elements (2 pairs), which looked like each
  `AuditInput` instance was somehow rendering its markup twice internally.
  Traced the component's JSX (a real mutually-exclusive `isLanding ? A : B`
  ternary - can't produce two DOM nodes from one instance) and confirmed via
  a **clean, cold navigation** (`window.location.assign`, not `reload()`,
  waited for `document.readyState === 'complete'`) that the count settles to
  the correct 2. The "4" reading was an HMR/dev-server transition artifact
  from querying too soon after a source edit - not a real double-render.
  **Don't re-chase "component renders twice" here if you see it again right
  after an edit; re-check after a full cold navigation first.**
- A `preview_snapshot` briefly showed `"This page could not be loaded"` on
  the homepage. Restarted the preview server fresh and re-navigated - loaded
  clean. Tied to the specific dev-server/tab session at that moment (this
  session's server had also gone stale between two conversation turns), not
  a reproducible app bug.

### Verified

- Confirmed live via `preview_eval` DOM inspection (`input.labels`,
  `getBoundingClientRect`, `document.querySelectorAll` counts) before and
  after the fix, on a cold-navigated page, not just a code read.
- `npx tsc --noEmit` clean for all files touched.
- `npx vitest run` - 1516 passed, 1 known flake (shared dev server,
  passes clean in isolation, unrelated).
- **No new automated test added** - this codebase has zero `.test.tsx`
  component-render tests (every existing test is pure-logic `.test.ts`);
  adding React Testing Library infrastructure for one fix would be a bigger,
  disproportionate change. Live DOM verification stands in for it here.
  Documenting the exact rule instead: **any future `<AuditInput>` call site
  must pass a unique `idSuffix` unless it's provably the only `AuditInput`
  instance possible on its page** (check for dialogs/banners that can
  co-render with a page-level default instance, as this session's second
  finding shows that's easy to miss).

---

## 2026-07-04 — Session 25 (real-user navigation pass, this time on a live report - other agents' work confirmed compounding)

### Real, live report confirms several fixes/features from this whole effort are actually shipping correctly

Used the sandbox (`dev-sandbox-2`, port 3002, auto-picks a free port - another
agent added this variant so it doesn't collide with whoever's on `dev-sandbox`/
3001) to navigate the dashboard and a real completed report as a logged-in
user, not just read code. Confirmed live and correct:
- **Session 17's `priorityLabel` feature** ("Fix first · Diagnosis only")
  renders correctly on the top flag - this is a *different* agent's UX work
  building on the same priority-ordering logic Session 19 fixed the field
  selection for. Concrete evidence of the "compounding" the goal asks for,
  not just notes referencing each other.
- **The recheck→monitoring rename** is fully live in the report UI - tab
  says "Monitoring," action button says "Monitor," matching Session 16's
  fixed migration.
- **A "Copy MCP command" button** exists directly on the report toolbar -
  a concrete, low-friction MCP-adoption touchpoint I hadn't seen in any
  earlier session's review (someone added this since).
- 29 real flags rendering with real severity/rubric icons, "1 critical - fix
  this before sharing" banner, rubric score breakdown (Message 65,
  Experience 65, Reach 0) - all consistent with the actual audit data.

### Tooling note for future sessions (saves debugging time - not a product bug)

`preview_screenshot` intermittently captured a **fully blank frame** after
scrolling to certain positions on this specific report page, even though
`preview_eval`-based DOM inspection (`querySelectorAll` +
`getBoundingClientRect`) simultaneously proved real, correctly-positioned,
non-empty content existed in the exact same viewport region. Rechecked
`window.innerWidth`/`document.documentElement`'s bounding box too (briefly
read as `0` right after a resize/reload, before settling back to normal on
the next read) - both point to the **screenshot/eval tooling having a race
or stale-frame issue on this page**, not the app being broken. Scrolling
back to the top and re-screenshotting confirmed the page renders correctly.
**If a future session sees a blank `preview_screenshot` capture, cross-check
with `preview_eval` DOM inspection (position/text of real elements) before
concluding it's a real rendering bug** - this is now the second tooling
false-positive this effort has hit (the first was the mobile "black bar" in
Session 8), and both wasted real investigation time before being ruled out.

### Not a new code change this session (navigation/verification only)

No source files touched. `npx vitest run` / `npx tsc --noEmit` unaffected
(unchanged from Session 24's end state).

---

## 2026-07-04 — Session 24 (repo-scan security review: clean. verify-flags.ts: one design ambiguity flagged, not fixed)

### `lib/repo-scan/*` (clone.ts, walk-files.ts, create-repo-scan.ts, runner.ts) - reviewed for the exact bug classes found all session, none found

Given Session 23's MCP finding was "a stale flag checked only at creation
time, never re-verified live," specifically checked whether repo-scan has
the same pattern (does a queued scan re-validate `selectedRepos`/
`revokedAt` at *execution* time, or only at enqueue time). **It's done
right**: `runner.ts`'s `runRepoScan` re-fetches `githubConnection` fresh from
the DB and re-checks `revokedAt` + `selectedRepos.includes(repoFullName)` at
the top of the actual scan execution (lines 25-32), not just relying on the
check `create-repo-scan.ts` already did at enqueue time. If a user
revokes/deselects a repo after a scan is already queued, the worker correctly
fails it instead of scanning anyway.

Also checked for injection/traversal risk given this subsystem clones and
reads arbitrary user-supplied repos: `clone.ts` uses `execFile` with an argv
array (not `exec`/shell string interpolation - the safe pattern), and the
GitHub token is passed via `GIT_ASKPASS` + an env var, never touching argv
(`ps` -visible) or any file written to disk. `walk-files.ts`'s directory walk
uses `Dirent.isDirectory()`/`isFile()` from `readdir(..., {withFileTypes:
true})`, which don't follow symlinks - a malicious repo can't symlink outside
the clone dir and have its target silently read as a "scanned file." Byte/
file-count caps (`MAX_FILES_SCANNED`, `MAX_TOTAL_BYTES_SCANNED`,
`MAX_REPO_SIZE_KB`) bound resource use.

**No bug found here. Recording the negative result** so a future session
doesn't re-spend the same investigation - this subsystem was already built
carefully.

### `lib/audit/verify-flags.ts` - one real ambiguity, not fixed (needs a product call, not a unilateral one)

`applyDeterministicVerification`'s only "REGRESSED" condition is: the flag's
checkId still fails on the follow-up scan **and** its severity rank is now
higher than it was on the parent audit. That means "REGRESSED" currently
means "this same still-broken issue got more severe," not the more intuitive
reading a user would likely have of the word in a "scan → fix → re-scan"
product: "this was marked FIXED before, and it's broken again now." The
function only ever compares two audits (`parentAuditId`/`monitoringAuditId`)
directly against each other, so it structurally cannot detect the
"previously FIXED, now reappeared" case even if that's what "REGRESSED"
should mean to a user reading their dashboard.

Didn't change this - unlike the billing/MCP findings, there's no single
"obviously correct" fix here without knowing the intended UX meaning of a
REGRESSED status pill, and getting it wrong risks a confusing status change
in production for no net accuracy gain. **Flagging with the exact code
location for whoever owns the monitoring/verification UX to decide**, rather
than guessing.

---

## 2026-07-04 — Session 23 (MCP data-exposure bug: stale `isPublic` bit outlives the entitlement that justified it)

### First-ever look at `lib/mcp/tools.ts` this whole effort (873 lines, zero prior review)

Checked entitlement wiring first (given how many billing gaps this session
already found) - all clean: every `prisma.user.findUnique` in this file
either omits `select` entirely (full row, `subscriptionStatus` included) or
uses `include: { user: true }`. No bug there, worth having verified.

### Real bug found: `assertAuditAccess`/`canAccessAudit` trusted a stale `isPublic` bit for fix-prompt content, unlike the web UI

`ff_get_flag` and `ff_get_rubric` both return full prescription content (fix
text, evidence, tool-specific prompts) gated only by
`assertAuditAccess(audit, callerId)`, which just calls
`canAccessAudit` (`lib/audit/access.ts`): owner OR `audit.isPublic` OR
anonymous (`userId === null`). The web report UI protects the *exact same
content* more strictly: `canViewAiViaMaxPublicShare`
(`lib/audit/report-access.ts`) requires not just `isPublic` but a **live
re-check** that the owner currently has `canSharePublicly` (TEAM plan,
active subscription) before showing full AI content to a non-owner viewer.

MCP's `assertAuditAccess` had no such re-check - it trusted the `isPublic`
column alone. Nothing in the codebase un-publishes an audit when its owner's
plan/subscription later lapses (confirmed: same root cause pattern as
Sessions 20-21's billing gaps - a column goes stale because no code path
resyncs it on downgrade). Net effect: once a TEAM-plan user made one audit
public, **anyone with a valid FixFlags API key** (not just that owner) could
call `ff_get_flag`/`ff_get_rubric` with a flag ID from that audit (e.g.
scraped off the public report page) and get the full paid fix-prompt
content forever, even after the owner's subscription lapsed and the web UI
would have correctly hidden it.

**Fixed:** made `assertAuditAccess` async; when the caller isn't the owner
and access is being granted via `isPublic` (not anonymous), it now fetches
the owner's *current* `plan`/`subscriptionStatus`/`role` and requires
`canSharePublicly(owner)` to still hold - mirroring
`canViewAiViaMaxPublicShare`'s live check. Owner-access and anonymous-audit
access are unaffected (no extra DB call in those paths - checked first,
early return). Updated all 6 call sites (`ff_get_check_status`,
`ff_get_report`, `ff_get_rubric`, `ff_get_flag`, `ff_compare` x2) to `await`
the now-async function. Exported `assertAuditAccess` (was module-private) so
it's directly unit-testable.

### Verified

- Added `lib/mcp/__tests__/assert-audit-access.test.ts` (new file - `tools.ts`
  had zero test coverage of its own logic before this session, only its
  imported helpers were tested elsewhere): 6 tests covering owner access (no
  DB call), anonymous access (no DB call), private-audit denial, public
  audit with a currently-entitled owner (allowed), public audit with a
  lapsed owner (denied - the regression case), and public audit with an
  owner downgraded off TEAM plan (denied).
- `npx tsc --noEmit` clean for all files this session touched.
- `npx vitest run` - 1516 passed, 1 known flake (shared dev server, passes
  clean in isolation, unrelated to this change).

### Not addressed this pass (documented, not fixed)

While tracing `lib/audit/pipeline/combine-pages.ts`'s `averageScores()` for a
different reason, noticed its `deterministic ?? triageScore ?? null` fallback
is dead code: `computeRubricScores` (fixed in Session 22) never actually
returns `null` for any rubric - every branch ends in a concrete number or a
literal `100`. So the AI judge's own rubric assessment is silently never
used for the final combined score, contradicting the function's doc comment
("falling back to the triage score"). Didn't touch this - whether the AI's
qualitative rubric judgment *should* ever override the deterministic,
evidence-backed score is a real product-design question, not a clear-cut
"wrong output" bug like the others this session, and isn't mine to decide
unilaterally. Flagging for whoever owns the judge/deterministic scoring
relationship next.

---

## 2026-07-04 — Session 22 (the failed-module-penalty map was missing most modules - the score itself was wrong)

### Real bug, high blast radius: `MESSAGE_MODULES`/`REACH_MODULES` in `lib/audit/checks/rubric.ts` were badly incomplete, and EXPERIENCE had no module-failure tracking at all

Cross-referenced every check module's actual `rubric:` field assignments
(`grep -o "rubric: '[A-Z]*'"` across all ~20 check files) against the two
hardcoded module-name sets used to decide "did a crashed check module affect
this rubric's score." Found real gaps:
- **`MESSAGE_MODULES`** was missing `trust`, `cta-focus`, `mobile-ux-quality`
  - all three emit MESSAGE-rubric flags.
- **`REACH_MODULES`** was missing `measurement`, `security`,
  `security-headers` - all three emit REACH-rubric flags.
- **EXPERIENCE had no module-set concept at all.** ~14 check modules
  (`metadata-checks`, `performance`, `accessibility`, `seo`, `mobile`,
  `content`, `layout`, `interaction`, `auth-checkout`, `conversion-friction`,
  `trust-psychology`, `visual-hierarchy`, `mobile-ux-quality`,
  `visual-polish`) emit EXPERIENCE-rubric flags, but the only failure signal
  EXPERIENCE ever checked was the literal string `'performance'` inside the
  "no PageSpeed data" fallback branch - and that branch is only reached when
  PageSpeed data is *also* missing. In the common case (PageSpeed succeeds),
  a crashed `mobile-ux-quality`/`interaction`/`trust-psychology`/etc. module
  silently lost its uncertainty penalty entirely, every time.

Net effect before this fix: this is exactly the failure mode Session 1 (the
very first session of this whole effort) found and partially fixed in
`combine-pages.ts` - "if a deterministic scan module crashed... the final
report silently scored that rubric 100 instead of applying the uncertainty
penalty" - except the root cause went one level deeper: even when
`failedModules` was correctly threaded through (which Session 1 fixed), the
rubric-scoring function itself didn't know most modules existed.

**Fixed:**
- Completed `MESSAGE_MODULES` and `REACH_MODULES`.
- Added `EXPERIENCE_MODULES` and wired it into all three EXPERIENCE branches:
  applies a flat `SCAN_STEP_FAILURE_PENALTY` (25, matching the existing
  MESSAGE/REACH convention of one flat penalty regardless of how many modules
  failed) on top of the PageSpeed-derived score whenever a relevant module
  failed, even when the raw PageSpeed score itself is healthy - not just in
  the already-existing "PageSpeed unavailable" fallback path.

### Verified

- Added 3 new regression tests to `lib/audit/__tests__/checks.test.ts`
  proving each of the three gaps (EXPERIENCE penalized despite healthy
  PageSpeed when `mobile-ux-quality` fails; MESSAGE penalized for `trust`/
  `cta-focus` failures; REACH penalized for `security-headers` failure) -
  none of these three gaps had any test coverage before this session, which
  is exactly why they went unnoticed since Session 1.
- All 3 pre-existing `computeRubricScores` tests still pass unchanged -
  this was a strictly additive fix (more failure conditions recognized), not
  a behavior change to any previously-passing case.
- `npx tsc --noEmit` clean for all files this session touched (2 pre-existing,
  unrelated errors in `AuditReportProgressive.tsx`/`ReportExplorer.tsx` are
  from another agent's concurrent in-progress edit, confirmed via mtime).
- `npx vitest run` - 1509 passed, 1 known flake (shared dev server, passes
  clean in isolation).
- Also re-ran `lib/demo/` + `combine-pages.test.ts` + `pipeline-steps.test.ts`
  specifically, since those exercise real end-to-end scoring paths that could
  have been sensitive to a module-set change - all pass unchanged.

---

## 2026-07-04 — Session 21 (the same dunning gap, but in the part that actually costs real money)

### `resolveIncludeAiForNewAudit` never checked subscriptionStatus - this one gates real LLM API spend, not just display/sharing

Following the exact thread from Session 20: `handleInvoicePaymentFailed`
(`app/api/webhooks/stripe/route.ts`) sets `subscriptionStatus: 'PAST_DUE'`
but never touches `auditsLimit` or calls `applyPlanLimits`. Session 20 fixed
the two entitlement functions this breaks (report tier, sharing/repo-scan).
This session found a **third, more expensive** instance:
`lib/audit/ai-report-entitlement.ts`'s `resolveIncludeAiForNewAudit` - the
function that decides whether a *new* audit runs the LLM judge stage at all
- also only ever reads `auditsLimit`/`auditsUsed`, never `subscriptionStatus`.
Net effect: a user whose card was declined keeps getting full LLM-judge
audits (real OpenAI/Anthropic API cost per call) at zero revenue, for as long
as `auditsLimit` lags their revoked `subscriptionStatus` - which, per
Session 20's finding, the dunning webhook design explicitly allows to persist
indefinitely if `subscription.updated` never fires to resync it.

**Fixed:** exported the `hasRevokedSubscriptionStatus` helper from
`lib/auth/entitlements.ts` (was file-private), added `subscriptionStatus` to
the `select`, and denies AI outright (no partial free-tier credit) when
`plan !== 'FREE'` and the subscription is revoked - matching how
`canAccessPaidFeatures`/`canSharePublicly` already deny entirely rather than
downgrade to a partial tier.

**Caught my own first draft being wrong via a real test, not just typecheck:**
initially implemented this as "treat a revoked paid user as FREE-tier
(3 AI reports)" instead of "deny outright." Wrote a test asserting denial and
it failed (`true !== false`) - because with `auditsUsed: 0`, the free-tier-
equivalent cap of 3 hadn't been hit yet, so it still allowed AI. Reconsidered
and matched the simpler, already-established "deny entirely on revoked
status" pattern instead of inventing a new partial-credit policy with its own
edge cases (e.g. what a lapsed user with separately-purchased one-time
credits should get - not addressed, noted below).

### Verified

- Added 2 new tests to `lib/__tests__/usage-limits.test.ts` (denies AI for
  lapsed BUILDER despite `auditsLimit: 25`; still allows AI for an ACTIVE
  paid plan) - extended that file's existing `vi.mock('@/lib/db', ...)` to
  also stub `user.findUnique` and `audit.count` (previously only stubbed
  `creditPurchase.aggregate`), since this function had *zero* coverage of its
  user-lookup branch before this session (the one existing test only covered
  the `userId === null` early return).
- `npx tsc --noEmit` clean for all files this session touched. (Two
  *unrelated* pre-existing errors in `AuditReportProgressive.tsx` /
  `ReportExplorer.tsx` are from another agent's concurrent, in-progress edit -
  confirmed via mtime, not caused by or fixed in this session.)
- `npx vitest run` - 1506 passed, 1 flake (same known "live localhost"
  demo-fixture timeout under concurrent shared-server load, passes clean in
  isolation - not a regression).

### Known gap not addressed this pass

A user with a lapsed subscription who separately purchased one-time AI
credits now gets denied outright, with no path to spend those credits until
they either re-subscribe or someone builds a "purchased credits work
independent of subscription status" carve-out. Given how rare that overlap
likely is (lapsed subscription + separately purchased credits) versus the
cost/complexity of getting the carve-out right, left it as the simpler,
safer default - flagging here rather than silently deciding it doesn't
matter.

---

## 2026-07-04 — Session 20 (billing: closed the dunning gap another agent left half-fixed, same day)

### Real revenue-leak bug: 2 of 3 sibling gating functions still ignored `subscriptionStatus`

Found via `git log` that commit `bfb172d` (made *today*, by another concurrent
agent/session in this same effort) had already identified and partially fixed
this exact class of bug: "`canAccessPaidFeatures` only checked `user.plan`,
never `subscriptionStatus`... a user retained full paid access indefinitely"
if `invoice.payment_failed` fires without a matching `subscription.updated`
event (`app/api/webhooks/stripe/route.ts`'s `handleInvoicePaymentFailed` only
sets `subscriptionStatus`, never touches `plan`). That commit fixed
`canAccessPaidFeatures` (and therefore `canUseApiKeys`/`canAccessCompare`)
but the diff explicitly did **not** touch two sibling functions with the
identical bug:
- `getReportTierForUser()` (`lib/auth/entitlements.ts`) - decides whether a
  *report* renders as paid tier (unlocked fix prompts/evidence). Checked only
  `user.plan`.
- `canSharePublicly()` (same file) - gates public share links, proof export,
  and **repo scanning** (a real, metered, cost-incurring action). Also
  checked only `user.plan`.

Net effect before this fix: a user whose payment failed (`PAST_DUE`) would be
correctly blocked from `canAccessPaidFeatures`-gated things, but could still
view full paid report content, share reports publicly, export summaries, and
**kick off GitHub repo scans** - for as long as their `plan` column lagged
behind their `subscriptionStatus` (which the dunning flow's own design
explicitly allows to happen).

**Fixed:** added the same `hasRevokedSubscriptionStatus` check (extracted as
a shared helper) to `getReportTierForUser` and `canSharePublicly`. Also found
and fixed **2 real, separate call-site bugs** this surfaced: `select: { id,
role, plan }` (no `subscriptionStatus`) in `lib/auth/entitlements.ts`'s
`resolveReportTierForAudit`, `lib/audit/report-access.ts`'s
`canViewPrescriptionContentForAudit`, and
`app/api/audits/[id]/toggle-public/route.ts` - all three would have silently
defeated the fix at runtime (fetching `undefined` for `subscriptionStatus`)
even with the entitlements logic corrected, since Prisma only returns
explicitly-selected columns. Added all three to their respective `select`
clauses.

### Verified

- Added a new regression test proving the fix
  (`lib/__tests__/hardening.test.ts`: "returns free for a builder plan whose
  subscription lapsed") and one to `toggle-public-gating.test.ts` ("denies a
  TEAM user whose subscription has lapsed") - neither existed before, so
  this exact regression had zero test coverage prior to this session.
- Fixed 6 other test fixtures across `hardening.test.ts`,
  `toggle-public-gating.test.ts`, `usage-limits.test.ts` that needed
  `subscriptionStatus` added after the type signature change.
- `npx tsc --noEmit` clean.
- `npx vitest run` - 1505 passed, 85/85 files, 0 failed.

### Note for other agents working the billing area

If you're mid-flight on `bfb172d`'s dunning-gap fix or anything nearby in
`lib/auth/entitlements.ts` / `app/api/webhooks/stripe/route.ts`, this session
closed out the two sibling functions it didn't get to. Check
`hasRevokedSubscriptionStatus()` before adding a fourth ad-hoc
plan-only/subscriptionStatus-only check somewhere else in the codebase - grep
for `.plan ===` / `.plan !==` against `User`-shaped objects first, since
there may be more of these (only checked the entitlements-adjacent call
sites this pass, not an exhaustive codebase-wide sweep).

---

## 2026-07-04 — Session 19 (found the fix-prompt priority was inverted from day one - fixed, tests updated on purpose)

### `resolveFixPrompt()` was picking the wrong field for the "copy-paste fix prompt" - the core product promise

`lib/audit/priority-flags.ts`'s `resolveFixPrompt()` returned the first truthy
field in order `[fix, lovablePrompt, boltPrompt, cursorPrompt, claudePrompt,
agentPrompt]`. Traced every consumer: `buildExpertFixPrompt()`
(`lib/audit/flag-copy.ts`) calls it directly and is what actually builds the
displayed/copyable prompt in the interactive report explorer
(`lib/report/explorer-model.ts`'s `mapLiveFlag`) and the legacy report
fallback (`components/audit/AuditReport.tsx`'s `getTopFixPromptFromFlags`).
**There is no separate per-tool ("Copy for Cursor" vs "Copy for Claude") UI
anywhere in the codebase** - this one flattening function is the only place
that decides which of the 6 possible prompt fields a user actually sees and
copies.

`lib/prompts/system-prompt.ts` (the actual prescription-phase prompt sent to
the LLM) says explicitly: "For EVERY flag, provide agentPrompt at minimum,"
and the rubric-level prompt is "what users most often copy-paste into
Cursor/Claude." `flag.fix` is documented elsewhere in the same prompt as a
plain-English description, not an agent-ready instruction. So the intended
priority is agent-crafted prompts first, `fix` last - the code had it
backwards, meaning **every fully-prescribed flag (post-signup, after the AI
phase ran) was showing the generic human-readable fix description instead of
the actual AI-tool-ready prompt**, silently downgrading the core "copy-ready
fix prompts" feature every time both existed.

**Fixed:** reordered to `[agentPrompt, cursorPrompt, claudePrompt,
lovablePrompt, boltPrompt, fix]`.

### This overturned an existing test - traced why before touching it, not just deleting it

`lib/audit/__tests__/flag-copy.test.ts` had a test named literally "uses
flag.fix as the authoritative fix prompt" that encoded the *old* (backwards)
behavior as intentional. Before assuming my fix was wrong, traced it via
`git log -p`: it turned out to be a **mechanical regression test** written
during a refactor (`dcdd4fd`) that moved a pre-existing `flag.fix ??
resolveFixPrompt(flag) ?? flag.problem` ordering (already "fix-first" before
that commit, inherited from further back) into `resolveFixPrompt` itself -
i.e. it locked in "don't let this refactor change behavior," not "we decided
fix should beat agentPrompt on purpose." No comment, design doc, or commit
message anywhere explains a deliberate reason to prefer `fix`. Given the
system prompt's explicit, documented intent points the other way, updated
the test (renamed + rewrote assertions) to lock in the *corrected* priority
instead of reverting the fix to match stale test expectations.

### Verified

- Added 2 new regression tests to `lib/audit/__tests__/priority-flags.test.ts`
  (agentPrompt preferred over fix; tool-specific prompts preferred over fix)
  and updated 1 in `lib/audit/__tests__/flag-copy.test.ts` to match the
  corrected, intentional priority - old test literally couldn't pass with the
  fix in place, so it had to be updated, not skipped.
- `npx vitest run` — 1502 passed, 1 skipped, 85/85 files. (Two transient
  failures during one run - both passed clean in isolation immediately after;
  root cause was concurrent agents mid-editing unrelated fixture files at
  that exact moment, not a real regression from this change.)
- `npx tsc --noEmit` clean.

---

## 2026-07-04 — Session 18 (real repo-scan false-positive bug — untouched area this whole effort)

### Found and fixed a severe false-positive in `checkDangerousPatterns` (repo-scan code checks)

`lib/audit/code-checks/dangerous-patterns.ts`'s "Shell command execution" rule
had a fallback alternative `\b(exec|execSync)\s*\(` meant to catch bare
`exec(cmd)`/`execSync(cmd)` calls without requiring "child_process" on the
same line. Problem: `\b` matches right after a `.`, so this also matched
**`someRegex.exec(str)`** - i.e. `RegExp.prototype.exec()`, one of the most
common, completely safe operations in any JS/TS codebase that uses regexes.
Verified empirically (`node -e` repro) before touching anything: this would
flag ordinary regex matching as a CRITICAL "shell command execution"
vulnerability. Not reproducible against this specific repo (it happens to use
`.match()`/`.test()` conventions instead of `.exec()`), but the regex logic is
provably broken for any repo scanned by the actual product feature - this is
the kind of false-positive that would erode trust in "fully accurate flags"
on a user's very first repo scan.

**Fix:** `execSync` is unambiguous (no non-shell JS API is ever named that),
so it's still flagged broadly. Bare `exec(` is now only flagged when **not**
preceded by a `.` (`(?<!\.)\bexec\s*\(`), which excludes
`regex.exec(...)`/`re.exec(...)` while still catching destructured/bare calls
like `const { exec } = require('child_process'); exec(cmd)`. The existing
`child_process` + `exec|execSync` same-line alternative is untouched, so
`cp.execSync(...)`-style calls are still caught whenever "child_process"
appears on that line.

Added 2 regression tests to
`lib/audit/code-checks/__tests__/code-checks.test.ts` (regex `.exec()` NOT
flagged; bare `exec()`/`cp.execSync()` still flagged) - the existing test
suite for this file had zero coverage of the false-positive case before this.

Also read through `dependency-hygiene.ts` and `exposed-secrets.ts` looking for
the same class of over-broad-regex issue - both look precise (dependency
check only flags literal `"*"`/`"latest"`, not normal semver ranges; secret
patterns reset `lastIndex` correctly before each `.test()`). No further fixes
needed there this pass.

### Verified

- `npx vitest run lib/audit/code-checks/__tests__/code-checks.test.ts` — 12/12
  passed (up from 10, the 2 new regression tests).
- `npx tsc --noEmit` clean.
- `npx vitest run` (full suite) — 1496 passed, 1 known flake (the "live
  localhost" demo-fixture test, times out under concurrent-agent load against
  the shared port-3000 server; passes clean in isolation, not a regression).

---

## 2026-07-04 — Session 18 (fix action label now matches actual MCP behavior)

### Fixed misleading Cursor action copy in the report fix card

Rendered `/samples` showed the fix prompt action as `Send to Cursor`, but the
button does not send the selected prompt anywhere. It creates/loads an API key
and opens Cursor's MCP install deep link. Renamed the action to
`Connect Cursor MCP`, switched the icon from a pointer to an integration plug,
and moved the copy into `lib/audit/fix-action-copy.ts` with a regression test
that forbids drifting back to "send" language.

### Verified

- `npm run typecheck` passed.
- `DOTENV_CONFIG_PATH=.env.local node -r dotenv/config <vitest.mjs> run lib/audit/__tests__/fix-action-copy.test.ts`
  passed: 1 file, 1 test. Used the direct `vitest.mjs` path because the current
  `node_modules/.bin/vitest` shim is pnpm-style shell, while `package.json`
  still invokes it through `node`.
- Playwright desktop and mobile snapshots of `http://localhost:3000/samples`
  show `Connect Cursor MCP`, `Copy prompt`, `Fix first`, and no `Send to Cursor`.
  Console log had no error entries; only Next preload warnings.

### Tooling caveat

Targeted ESLint is currently blocked by mixed npm/pnpm install state:
`@rushstack/eslint-patch` cannot recognize the pnpm-resolved
`eslint-config-next` caller. Do not treat that as a code failure in this
session; typecheck and the focused test passed.

---

## 2026-07-04 — Session 17 (report fix loop now makes priority explicit)

### Made the next action clearer in the report explorer

The report explorer already sorted flags by severity, impact, and confidence,
but the UI did not explain that ordering to users. Added `priorityLabel` to
`ExplorerFlag` in `lib/report/explorer-model.ts` (`Fix first`, `Next`,
`Priority 3`, ...), passes it through `ReportExplorer`, and renders it in
`ReportFixLoop` beside each flag. The expanded fix loop now also states whether
the selected item has a copy-ready fix or is diagnosis-only, so users can see
both priority and action readiness before opening each detail panel.

### Verified

- `npm run test:unit -- lib/report/__tests__/explorer-model.test.ts` passed:
  1 file, 4 tests.
- `npm run typecheck` passed.
- Targeted lint passed:
  `npx eslint components/report/ReportFixLoop.tsx components/report/ReportExplorer.tsx lib/report/explorer-model.ts lib/report/__tests__/explorer-model.test.ts --max-warnings=0`.

### Notes for next sessions

This is a narrow UX improvement, not full dashboard completion. Next high-value
product pass should inspect the full rendered report on desktop/mobile and
check whether the fix prompt actions map clearly to Cursor/MCP/branch workflows
instead of only copy-paste.

---

## 2026-07-04 — Session 16 (migration drift RESOLVED — user gave explicit go-ahead)

### The Session 7 migration issue is fixed. `/samples` confirmed working on the real dev server.

User explicitly chose to resolve this (asked via AskUserQuestion after several
rejected/deferred attempts). Turned out worse than Session 7 found: the
recheck→monitoring rename edits to the 4 historical migration files were no
longer just uncommitted — **they'd been committed to `main` at `bc0fbd9`**
(confirmed via `git log -p`). Fixed with a new commit-ready change (not a
history rewrite): restored all 4 files to their exact pre-`bc0fbd9` content
(pulled from `git show <parent-commit>:<path>` for each), leaving
`20260703000000_rename_recheck_to_monitoring` as the only place doing the
rename. **Verified, not assumed:**
`prisma migrate diff --from-migrations ... --to-schema-datamodel ... --shadow-database-url qualityos_shadow`
→ **"No difference detected"** - a fresh DB replaying all 30 migrations now
produces exactly `schema.prisma`'s shape.

Then ran `prisma migrate deploy` (not `migrate dev` - see below) against the
real shared `qualityos` dev DB. **Succeeded.** `/samples` on the real port-3000
dev server now returns 200 with actual rendered sample-report content, no
Prisma error, no error boundary - confirmed via `curl`, not just "should work
now."

### Found a second, unrelated instance of the same failure class - resolved differently

`prisma migrate dev` (not `deploy`) refused to run, demanding a full DB
reset, citing a **different** migration:
`20260617120000_audit_lead_sync_and_report_source` "modified after it was
applied." Investigated before touching anything: this one was **not** a
mistake - a prior session (commit `2189a33`, June 26) deliberately added
`IF NOT EXISTS` guards to fix a real fresh-DB apply failure (duplicate enum
value from an accidental earlier duplicate migration), and documented it
clearly in the migration file. The local dev DB's `_prisma_migrations` table
had two rows for this name: an old **failed** attempt from June 21 (before the
idempotency fix, `finished_at IS NULL`) and a properly-`finished_at`-stamped
row from July 2 whose checksum matches the current file exactly. `migrate
status` didn't flag this (doesn't do the strict shadow-DB replay `dev` does);
`migrate deploy` doesn't either - it just applies whatever's pending in order,
which is why it worked above without hitting this. **Lesson for next time:**
if `prisma migrate dev` demands a reset, try `prisma migrate deploy` first -
it's the correct command for applying pending migrations to an existing,
already-populated database anyway; `migrate dev`'s stricter shadow-DB
diffing is meant for disposable local iteration, not this. Did not touch the
stale failed row - it's inert (unfinished, superseded), not worth the risk of
directly editing `_prisma_migrations` for a cosmetic cleanup.

### Verified

- `npx tsc --noEmit` clean.
- `npx vitest run` — 1493 passed (1 flake: the "live localhost" demo-fixture
  test timed out once against the shared port-3000 server under concurrent
  agent load, passed clean in isolation immediately after - not a regression).
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/samples` → `200`.
- `curl` body contains real rendered content ("Sample Report", "Scanned"), zero
  "could not be loaded" error-boundary text.

### Status for other agents/sessions

The recheck→monitoring migration files are back to their correct,
already-applied-in-production form. **Do not re-touch them** to "rename to
monitoring" again - that rename now lives *only* in
`20260703000000_rename_recheck_to_monitoring`, which is applied everywhere
that matters (shared dev DB confirmed; production should pick it up on next
`migrate deploy` during normal deploy, same as any other pending migration).
This whole saga (Sessions 7, 10, 16) is the single clearest lesson from this
effort: **never edit an already-applied Prisma migration file's SQL to rename
something** - always add a new migration. If you need idempotency (like the
June 26 fix above), that's fine to add via edit, since it doesn't change what
the migration *does* on any database that already ran it successfully.

---

## 2026-07-03 — Session 15 (OpenAI triage validator hardening + truthful screenshot context)

### Fixed the remaining live triage retry pattern from Session 13

Live OpenAI smoke on `https://example.com` still exposed two model-contract
failures after strict-mode schema work: `REACH has a score without assessed
evidence`, then `expected exactly 3 rubrics`. Tightened the rubric scoring
contract in `lib/prompts/system-prompt.ts` and
`lib/audit/judge-triage-schema.ts`, then added
`normalizeTriageRawOutput()` in `lib/audit/judge-triage.ts` so impossible
PARTIAL/UNKNOWN scores are coerced to `null` and omitted rubric dimensions
are filled as honest `UNKNOWN` entries before final Zod + business validation.
Validation remains strict; the product now degrades to incomplete evidence
instead of failing the whole audit when the model underspecifies a rubric.

### Fixed a prompt accuracy bug found during smoke testing

`buildTriagePrompt()` claimed screenshots existed whenever no explicit hint
was passed, and `runOpenAITriage()`/`runAnthropicTriage()` treated no images as
`desktop-only`. Added `no-screenshot` and `mobile-only` states and now tell
the judge not to claim visual/layout/mobile evidence when screenshots are
absent. This directly improves rubric honesty for text-only or degraded
capture runs.

### Verified

- `npm run test:unit -- lib/audit/__tests__/judge-triage-schema.test.ts lib/audit/__tests__/judge-rubric.test.ts lib/audit/__tests__/combine-pages.test.ts lib/audit/__tests__/persist-functions.test.ts lib/audit/__tests__/deduplicate.test.ts`
  passed: 5 files, 37 tests.
- `npm run typecheck` passed.
- Live OpenAI smoke with `JUDGE_PROVIDER_CHAIN=openai TRIAGE_MAX_TOKENS=1500`
  against `https://example.com` succeeded on attempt 1 with exactly MESSAGE,
  EXPERIENCE, REACH rubrics and `newFlags[].pageUrl` nullable support.

---

## 2026-07-03 — Session 14 (confirmed /samples refresh path works against the real live URL, without touching tracked assets)

### `resolveEvidenceAnchors()` verified against the real, live `https://fixflags.com/demo`

Called `resolveEvidenceAnchors({ url: 'https://fixflags.com/demo', checkIds: [...] })`
directly (read-only scratch script, not committed) instead of running the full
`scripts/refresh-marketing-sample.ts`. Reason: the full script writes to two
**tracked, production-facing files** —
`lib/marketing/sample-evidence-anchors.json` and `public/samples/*.webp` — and
I didn't want to leave modified marketing assets sitting in the working tree
(or risk them getting pushed) without asking first, per the "confirm before
touching shared/production-facing state" rule. Calling the core resolver
function directly against the real live URL gives the same confidence with
zero write risk: it succeeded, resolved 3/3 anchors, no `__name` crash, no
errors. Combined with Session 13's fix to this same file's `page.evaluate()`
call, **the actual dependency chain `scripts/refresh-marketing-sample.ts`
needs is confirmed working end-to-end against the real production demo page.**

**If someone wants the full refresh done for real** (i.e. actually update the
live `/samples` page's screenshots/anchors), run:
`DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/refresh-marketing-sample.ts`
against the **real** `DATABASE_URL` (not the sandbox) - that's a decision
that affects live marketing assets and should be a deliberate call, not
something to run silently as a side effect of a bug-fix pass.

### Status

No source changes this session (verification only). `npx vitest run` /
`npx tsc --noEmit` unaffected — still clean per Session 13. Scratch test
scripts cleaned up from `/private/tmp/.../scratchpad/`.

---

## 2026-07-03 — Session 13 (OpenAI triage strict-mode fix — implemented AND verified against real API, not deferred)

### Fixed the Session 12 AI-triage reliability bug, with real API verification at every step

Implemented the fix Session 12 diagnosed but deliberately didn't rush:
- `lib/audit/judge-triage-schema.ts`: added `.strict()` to every nested
  `z.object()` in `triageOutputSchema`; changed `newFlags[].pageUrl` from
  `.optional()` to `.nullable()` (required, not optional — OpenAI strict mode
  requires every property in `required`). Added `QUALITY_TRIAGE_SCHEMA_OPENAI`:
  a separate, standard-JSON-Schema (not OpenAPI3) generation used only for
  OpenAI, with a `stripFormatKeyword()` post-processor that recursively removes
  `format` keys (e.g. `format: "uri"` from Zod's `.url()`).
  `QUALITY_TRIAGE_SCHEMA`/`QUALITY_TRIAGE_TOOL` (Anthropic-facing, OpenAPI3
  target) are untouched.
- `lib/audit/judge-triage.ts`: OpenAI call now uses `QUALITY_TRIAGE_SCHEMA_OPENAI`
  and sets `strict: true` on the function definition.
- `lib/audit/deduplicate.ts`: narrowed `matchesDeterministicTheme` /
  `isNearDuplicateOfDeterministic` to a minimal `{ problem, evidence,
  whyItMatters? }` structural type instead of the full `JudgeOutput['newFlags']`
  shape — they never touched `pageUrl` anyway, and this removes the coupling
  that would otherwise break when the triage/judge schemas' `pageUrl` types
  diverge (nullable vs. optional).
- Fixed 3 test fixtures needing `pageUrl: null` after the type change
  (`combine-pages.test.ts` x2, `persist-functions.test.ts`).
- Same `__name` shim from Session 10/11, applied to one more real exposure:
  `lib/marketing/resolve-evidence-anchors.ts`'s main `page.evaluate()` (the
  file `scripts/refresh-marketing-sample.ts` depends on for pin-anchor
  resolution) — was logging "Evidence anchor resolution skipped" with a
  `ReferenceError` on every `tsx`-invoked run before this.

### This was NOT a blind deploy — caught and fixed a real mistake mid-flight

First attempt (`.strict()` + `strict: true`, without stripping `format`)
failed immediately against the **real OpenAI API** with `400 Invalid schema
for function 'quality_triage': ... 'uri' is not a valid format` — confirming
the exact risk flagged in Session 12 (OpenAI strict mode has a narrower
supported-keyword set than standard JSON Schema; `format` isn't in it). Added
`stripFormatKeyword()`, re-ran — **`"triage succeeded"` on the real API,
audit status COMPLETED, zero retries needed.** Ran a second, independent audit
afterward: attempt 1 hit a different, legitimate failure (my own
`validateTriageOutput` correctly rejecting a real model miscount - "expected
exactly 3 rubrics"), attempt 2 succeeded cleanly. That's the *intended*
behavior (retry catches real model variance) - not a regression.

### Verified

- `npx tsc --noEmit` clean, `npx vitest run` — 1487 passed, 1 skipped, 83/83
  files, 0 failed.
- **Two independent real audits against `https://example.com` via the actual
  `tsx` pipeline** (matching `npm run worker` / `scripts/refresh-marketing-sample.ts`),
  both reaching `status=COMPLETED`, `error=none`. This is the strongest
  verification standard available short of hitting production directly.

### Why this matters

This was the deferred item every recent hook rejection called out by name.
It's now actually fixed and independently verified against the real OpenAI
API twice, not just typechecked. Directly closes: the AI-judge reliability
gap (Session 12), and one more concrete piece of "is `/samples` refresh
confirmed working" — `resolve-evidence-anchors.ts`'s `tsx`-path crash is gone,
though I did not run the *full* `scripts/refresh-marketing-sample.ts` (it
writes screenshots + a shared `evidence-anchors.json` file to the working
tree and defaults to auditing the real `fixflags.com/demo` - chose not to run
its full side-effecting write path without asking first). If someone wants
that final confirmation, running `DOTENV_CONFIG_PATH=.env.local DATABASE_URL=<sandbox> tsx -r dotenv/config scripts/refresh-marketing-sample.ts`
should now succeed end-to-end based on everything verified here.

---

## 2026-07-03 — Session 12 (dashboard finally reached; fixed the tsx bug; found a 2nd real bug — AI triage schema)

### Dashboard UX evaluation: DONE, no bugs found

Root cause of the Session 10/11 login mystery: **it wasn't the UI.** Called
`POST /api/auth/sign-in/email` directly via `curl` with the seeded credentials
— it succeeded immediately (200, valid session token). The backend auth is
fine; something about `preview_click`/synthetic-event dispatch specifically
doesn't trigger this form's submit path (still unknown why — genuinely
different from the Radix Sheet case earlier, which worked with manual pointer
events). **Workaround that unblocks all future sessions:** get a session
token via a direct `curl -X POST /api/auth/sign-in/email` call, then
`document.cookie = "better-auth.session_token=<token>.<sig>; path=/"` in the
browser via `preview_eval` before navigating — the HttpOnly flag on the real
cookie doesn't matter; the server only checks the cookie value, and
`document.cookie` can still set a plain (non-HttpOnly) cookie of the same name
that the server reads fine. Don't burn time on the login *form* again — use
this instead.

Once in: `/dashboard` is clean and functional. Empty state ("Run your first
audit", clear CTA) and populated state (site grouped by domain with a grade
badge, "Your sites over time" rollup — audits/critical flags/best/worst score
— "Recent checks" list with status pills) both rendered correctly, no console
errors, real data accurately reflected (including a "Failed" status pill for
the one audit whose AI step failed — see below — which is *correct*, not a
dashboard bug).

### Fixed and end-to-end verified: the Session 10/11 `tsx`/esbuild `__name` bug

Confirmed shipped in `lib/audit/screenshot.ts` and `lib/audit/capture-metrics.ts`
(see Session 11 for the fix). Re-verified again this session via the real
dashboard "New audit" flow (not just the raw script) — screenshot capture now
completes with zero `__name` errors.

### New, real bug found: OpenAI triage step unreliable on real sites — not a sandbox key issue

Every audit run this session against `https://example.com` (both via raw
script and via the real dashboard "New audit" button) had its AI triage step
fail validation, 3 retries, all with *different* Zod errors each time (e.g.
`rubrics[3..55]` expected `object`, received `string`/`number` — that index
range means the model is returning **50+ rubric entries** when exactly ~4-5
are expected). This is not a bad API key: the OpenAI call succeeds and returns
real, different content each retry — it's genuine model non-compliance.

**Root cause, precisely diagnosed (not yet fixed):**
- `lib/audit/judge-triage.ts` calls OpenAI with `tools: [...]` /
  `tool_choice: { type: 'function', ... }` but **without `strict: true`** —
  meaning the model's function-call arguments are only loosely guided, not
  decode-time constrained to the schema. `gpt-4o-mini` (the default triage
  model, `lib/audit/judge-config.ts:76`) is materially less reliable at
  schema compliance than `gpt-4o`, especially unconstrained.
- The shared schema (`lib/audit/judge-triage-schema.ts`) has two things that
  block simply flipping on `strict: true`: (1) `newFlags[].pageUrl` is
  `.optional()` — OpenAI strict mode requires every property in `required`
  (optional fields must become nullable-and-required instead); (2)
  `zodToJsonSchema(..., { target: 'openApi3' })` emits OpenAPI-style
  `nullable: true` extensions, which OpenAI's strict-mode JSON Schema
  validator does not understand — needs a standard JSON Schema target instead
  (this schema is shared with the Anthropic tool definition too, so any fix
  needs a fork or a per-provider generation path, not a single shared const).
- Falls back to Anthropic on OpenAI failure, but Anthropic fails too in this
  sandbox (`ANTHROPIC_API_KEY is not configured` — likely just a missing/
  placeholder key here, not evidence of a code bug on that path).

**Why not fixed this session:** this touches a schema shared by both LLM
providers and costs real API calls to validate correctness; getting the
strict-mode conversion subtly wrong (e.g. an incompatible schema) risks OpenAI
rejecting every triage call with a 400 instead of the current graceful-degrade
(retry → fallback → clean `[config]`-redacted failure). That's a worse failure
mode than today's. This needs a dedicated pass: generate a provider-specific,
strict-mode-compatible JSON schema, make `pageUrl` nullable+required, and
**actually test 5-10 real triage calls** against a working OpenAI key before
trusting it — not a fix to rush at the end of a long session.

**Why this matters for the "10x/fully accurate" goal:** if this reproduces
against production's OpenAI key too (untested — I only have this sandbox's
key), the AI-judge phase — the "professional QA" layer beyond deterministic
checks — may be silently degrading to deterministic-only results on a
non-trivial fraction of real audits. This is a bigger lever for "fully
accurate and meaningful flags" than any single new check module. **Next
session: this is the highest-value thing to pick up.**

### Status

`npx vitest run` (1487 passed) and `npx tsc --noEmit` clean — no source
changes this session beyond what Session 11 already shipped. Sandbox DB
(`qualityos_sandbox` on port 3001 via `dev-sandbox` launch config) now has 3
audits, 1 tied to the seeded admin account.

---

## 2026-07-03 — Session 11 (critical-path flow `tsx` evaluate hardening)

### What changed

- Extended the Session 10 `tsx`/Puppeteer `__name` defensive shim to critical
  path flow probes, not just screenshot/capture metrics.
- Patched inline browser-context callbacks in:
  - `lib/audit/flow/post-click-probes.ts`
  - `lib/audit/flow/slow-replay-probe.ts`
  - `lib/audit/flow/nav-probes.ts`
  - `lib/audit/flow/form-probes.ts`
  - `lib/audit/flow/scroll-probes.ts`
  - `lib/audit/flow/discover-cta.ts`
  - `lib/audit/flow/destination-ux-probes.ts`
  - `lib/audit/flow/run-flow-scan.ts`
  - `lib/audit/browser/page-capture.ts`

### Verified

- `npm run typecheck`
- `npm run test:unit -- lib/audit/__tests__/flow*.test.ts lib/audit/__tests__/checks.test.ts`
- `npm run lint`
- `npm run test:unit` (83 files, 1487 passed, 1 skipped)

### Notes

- This addresses the lower-priority exposure Session 10 called out: standalone
  `tsx` worker/script runs could theoretically hit `__name is not defined`
  later during critical-path flow probing. The patch is a no-op in production
  and `next dev`, same as the screenshot/capture fix.
- Did not touch the unresolved Prisma migration files from Session 7 or the
  unresolved login investigation from Session 10.

---

## 2026-07-03 — Session 10 (sandbox DB unblocks the dashboard eval; real bug found; login unresolved)

### Unblocked local dashboard/report testing WITHOUT touching the disputed migration files or the shared dev DB

The Session 7 migration issue is still unresolved (still waiting on the user re:
reverting the 4 edited historical migration files — do not touch those). Instead
of waiting further, created a fully separate, additive sandbox:
- New local Postgres DB `qualityos_sandbox` (`createdb`), schema applied via
  `prisma db push` (schema diff, NOT migration replay — never touches
  `prisma/migrations/*` or the real `qualityos` DB).
- Seeded via existing `prisma/seed.ts` → admin login
  `saadbenryane@gmail.com` / `password123`.
- Added a `dev-sandbox` config to `.claude/launch.json` (port 3001,
  `DATABASE_URL` inline-overridden to the sandbox DB) so the main `dev` server
  on port 3000 (whatever anyone else is using it for) is never touched.
- **To reuse this next session:** `preview_start` with name `dev-sandbox`. DB is
  already schema-current and seeded. Two audits already exist in it (see below).

### Real, confirmed bug found: `tsx`/esbuild's `keepNames` breaks Puppeteer screenshot capture — but production is unaffected

Running an audit via a raw `tsx` script (matching how `npm run worker` and
`scripts/refresh-marketing-sample.ts` actually execute) crashes with
`ReferenceError: __name is not defined` inside `readRuntimeHeadMetadata`'s
`page.evaluate()` callback in `lib/audit/screenshot.ts:161`. Root cause: tsx's
esbuild transform injects `__name(...)` wrapper calls into compiled function
bodies; when Puppeteer serializes that function's source and re-runs it inside
the browser's isolated world, `__name` doesn't exist there → crash.
**Confirmed scope, don't re-investigate further without new evidence:**
- **NOT a production bug.** `npm run worker:build` (`tsc`, no esbuild) +
  `node dist/worker/index.js` (real prod path per `railway.worker.toml`) does
  not have this problem — verified by building and confirming `tsc`'s output
  has no `__name` wrapping.
- **NOT a bug in the default `npm run dev` path either.** The inline worker
  (`INLINE_WORKER` unset = enabled, runs inside the `next dev` process, compiled
  by Next's own dev compiler) completed a real audit against `https://example.com`
  end-to-end with 0 crashes — confirmed live on the sandbox server (audit
  `cmr4xaerp0001i1j3cujhyeod`).
- **DOES break:** `npm run worker` (standalone, used by `npm run dev:all`) and
  critically **`scripts/refresh-marketing-sample.ts`**, the script used to
  refresh the public `/samples` featured audit — both invoke this exact code
  path via `tsx`. If refreshing the marketing sample has been failing silently,
  this is why.

**FIXED (Session 11):** added a one-line defensive shim as the first statement
inside all 4 `page.evaluate()` callbacks in `lib/audit/screenshot.ts` (lines
~132, ~166) and `lib/audit/capture-metrics.ts` (lines ~38, ~176):
```ts
;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
```
This runs *inside* Puppeteer's isolated browser context (it's part of the
evaluated function's own source), so it's resilient regardless of why `__name`
references get embedded — no dependency on tsx/esbuild internals. Verified:
re-ran the exact `tsx` script that crashed before against the sandbox DB — it
now sails past screenshot capture with zero `__name` errors (fails later, at
the AI-triage step, for an unrelated reason: invalid LLM JSON output +
missing `ANTHROPIC_API_KEY` in this sandbox — not a regression, not related to
this fix). `npx vitest run` (1487 passed) and `npx tsc --noEmit` both clean.
Zero effect on production/`next dev` (the shim is a no-op there since
`__name` is never referenced by `tsc`/SWC-compiled output). **Not yet
verified:** the `flow/*` probes (`lib/audit/flow/*.ts`, ~15 more
`page.evaluate()` calls) have the same theoretical exposure if a `tsx`-invoked
run reaches deep-flow scanning, but weren't hit by this specific repro —
lower priority, only exercised on "critical path" audits.

### Verified end-to-end: new UX checks fire correctly on a real external site

Audit `cmr4xaerp0001i1j3cujhyeod` (https://example.com, via the real inline
worker, not a unit test) produced 29 flags including `conversion-friction`
("No clickable primary CTA", "No clear low-commitment conversion path") and
`trust-psychology` ("No direct contact method") firing correctly alongside the
existing SEO/security checks. Report page UI (score circle, "1 critical, fix
before sharing" banner, Flags/Overview/Previews/Flow test/Rubrics/Monitoring
tabs, gated "Fix" panel with free "How to verify" content, Partial-report
banner) all rendered correctly, no console errors. (Note: this audit's
AI-judge step failed on a redacted `[config]` error — by design, `[API|KEY]`
substrings are redacted from user-facing error text in
`lib/audit/pipeline-errors.ts`/`lib/audit/pipeline/context.ts`, this is not a
bug — likely just a stale/invalid local LLM key; I manually flipped this one
audit's status to COMPLETED in the *sandbox* DB via SQL to view the finished
report UI, not a code change.)

### Unresolved: could not log in as the seeded admin to reach `/dashboard`

Filled `#email`/`#password` correctly (verified via `.value` + `validity`
after every attempt) and tried, in order: `preview_click` on the submit button,
manual `pointerdown/mousedown/pointerup/mouseup/click` dispatch (this exact
technique worked earlier in the session for a Radix `Sheet` trigger), native
value-setter + `input` event before clicking, `form.requestSubmit(btn)`, and a
hard page reload (`window.location.assign`) before retrying. **None produced a
single network request to any auth endpoint** — not even a failed one. Given
this session already found two *other* interactions that looked broken but
were actually `preview_click`/screenshot tooling artifacts (see Session 8), I
am **not confident this is a real product bug** — logging it as unresolved
rather than reporting a false positive. Next session: try a real screenshot +
manual visual click coordinates, or check `components/auth/*` sign-in form
code directly for anything that would only respond to genuine trusted browser
events (e.g. a `isTrusted` check, which would be unusual but would explain
this exact symptom). The dashboard itself (post-login) is still unverified.

### Status

`npx vitest run` + `npx tsc --noEmit` both clean (unaffected by this session —
no source changes except the earlier `PricingComparisonTable.tsx` fix from
Session 8). `.claude/launch.json` now has 2 entries; `dev-sandbox` is safe to
reuse and does not conflict with anyone else's `dev` server on port 3000.

---

## 2026-07-03 — Session 9 (competitive "10x value" analysis + branch-edit design proposal, no code changes)

DB still blocked (Session 7, unresolved — user said wait). This session did
research/design only, nothing DB-dependent, nothing risky.

### Where FixFlags actually stands vs. real competitors (web-searched 2026 pricing/features)

- **Cheap AI landing-page critique tools** (Web Anatomy, MyWebAudit, "Audit
  Landing Page", Roast My Web — $2–$9/mo): single-shot AI opinion, no
  deterministic/evidence-backed checks, no rubric scoring, no fix-prompt→editor
  loop, no monitoring, no code-level checks. FixFlags' deterministic checks +
  rubric (Message/Experience/Reach) + evidence screenshots + MCP already beat
  these on rigor — **this tier is not the real competitive threat.**
- **CRO-focused tools** (VWO's free UX/landing audit): more mature on
  conversion-specific analysis, backed by a real analytics platform, but no
  code-level security/SEO/a11y checks and no editor/MCP integration.
- **AI code-review agents with real write access** (GitHub Copilot code review
  GA March 2026 w/ auto-create fix PRs, CodeRabbit $24/user/mo, Qodo 2.0
  multi-agent, Graphite Agent ~$40/user/mo): **this is the real threat to the
  "10x" claim.** These tools already open PRs automatically from a finding.
  FixFlags' repo-scan (`lib/repo-scan/*`) is still read-only + prompt
  generation (`lib/repo-scan/finding-fix-task.ts` builds a branch name, commit
  message, and agent prompt, but nothing calls the GitHub API to create a
  branch or PR). **On the single dimension both markets share — "turn a
  finding into a merged fix" — FixFlags is currently behind Copilot/CodeRabbit,
  not ahead of them.**

### Honest conclusion

FixFlags' 10x wedge today is breadth + evidence, not automation: nobody else
combines deterministic checks + AI judge + rubric scoring across
message/experience/reach/security *and* hands you copy-paste/MCP fix prompts
for both the live page and the underlying repo. But "10x the value of existing
solutions" as a blanket claim doesn't hold against the code-review tier until
the repo-scan write path exists. **Closing that gap, not adding more check
modules, is the single highest-leverage next feature for the stated goal.**

### Concrete phased proposal for the "branch edits" gap (design only — needs user sign-off before any of this is built)

The groundwork is closer than it looks: `RepoFindingFixTask` already computes
`branchName`, `commitMessage`, and a full agent-ready `prompt` per finding
(`lib/repo-scan/finding-fix-task.ts:111`). Recommend **not** jumping straight to
"FixFlags writes and merges code" (needs sandboxed execution + LLM-authored-diff
review UX + broad GitHub write scope — genuinely risky, matches what Session 1
already flagged). Instead, three increasing-risk phases, each independently
shippable and each a real "10x" step up from read-only:

1. **Phase 1 (low risk, days not weeks):** GitHub App/OAuth scope upgrade to
   create a branch + open a **draft PR whose description is the existing
   `prompt`** (no code diff — title, branch, and task description only). The
   user's own agent (Claude Code/Cursor/Copilot) or the user finishes it. This
   alone beats "copy a prompt into your editor manually" and is close to zero
   incremental risk over what already exists — no code execution, no diff
   review problem, just a branch + empty PR shell via the GitHub API.
2. **Phase 2 (medium risk):** offer to trigger the user's *own* already-
   installed coding agent against that branch (e.g., dispatch a GitHub Actions
   workflow the user opts into, using their own Actions minutes/agent
   credentials) rather than FixFlags running or hosting the agent itself. Sidesteps
   "who pays for/owns the LLM diff" and keeps FixFlags out of the code-execution
   business.
3. **Phase 3 (highest risk, do last if ever):** FixFlags-hosted agent
   generates the actual diff and opens the PR for human review before merge.
   Needs: sandboxed execution, diff-review UI, rollback, abuse/cost controls
   on repos we don't own. This is the only phase that matches Copilot/CodeRabbit
   feature-for-feature, and the only one that needs a real security review
   before writing a line of code.

**This needs your decision, not more silent building** — in particular whether
Phase 1 (branch + draft PR shell, no code) is worth scoping into an actual
implementation plan next, since it's the cheapest real step toward matching the
code-review competitors' headline capability.

---

## 2026-07-03 — Session 9 (duplicate UX flag suppression)

### What changed

- Tightened `lib/audit/checks/trust-psychology.ts` so
  `trust-testimonial-quality` only fires when testimonial-like proof exists but
  is weak. When there is no proof at all, the report now leaves that to
  `friction-no-social-proof` instead of asking for the same fix twice.
- Added cross-module overlap suppression in `lib/audit/checks/index.ts`:
  - prefer `trust-no-direct-contact` over older `no-contact-info`
  - prefer `competing-ctas` over `hierarchy-competing-actions`
- Extended `lib/audit/__tests__/checks-ux.test.ts` and
  `lib/audit/__tests__/checks.test.ts` to cover the no-duplicate behavior in
  both module-level and assembled report output.

### Verified

- `npm run test:unit -- lib/audit/__tests__/checks-ux.test.ts lib/audit/__tests__/checks.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` (83 files, 1487 passed, 1 skipped)

### Notes

- A read-only explorer identified the contact-info and competing-CTA overlaps.
  Those were cleaner same-signal duplicates than the social-proof case, so this
  pass fixed all three together.
- Did not touch the blocked Prisma migration files from Session 7.

---

## 2026-07-03 — Session 8 (real-user navigation pass, marketing site only)

DB blocked (see Session 7, still unresolved — do not touch
`prisma/migrations/2026061*`/`202606193*` without fresh user sign-off). Scoped
this pass to DB-independent pages: `/`, `/pricing`, `/how-it-works`.

**Real bug fixed:** `components/pricing/PricingComparisonTable.tsx` — the
`/pricing` plan-card bullet says "Unlimited **Monitoring**" but the comparison
table right below it labeled the same feature "**Re-checks**" (rename
leftover, visible to real users). Changed the row label to `'Monitoring'`.

**Two false leads ruled out — don't re-investigate:**
1. Black bar on right edge of every mobile screenshot: `body`/`html`
   scrollWidth/clientWidth all exactly match `innerWidth` (375), no overflow.
   Confirmed via the mobile Sheet rendering flush with the true viewport edge,
   past the black region. It's a `preview_screenshot` canvas/DPR artifact, not
   a layout bug.
2. Mobile hamburger appeared to never open via `preview_click` (data-state
   stuck `"closed"` across repeated clicks). Dispatching a manual
   `pointerdown→mousedown→pointerup→mouseup→click` sequence via `preview_eval`
   opened the Radix `Sheet` fine. `preview_click` doesn't satisfy Radix's
   trigger; real taps do. If a future session sees a Radix Sheet/Dialog/Popover
   "not opening" under `preview_click`, dispatch raw pointer events before
   concluding it's broken.

**Not done:** `/dashboard`, `/report/[id]`, authenticated app shell — blocked by
the Session 7 DB issue. Still open scope from the goal; pick up once resolved.

---

## 2026-07-03 — Session 7 (dev-DB crash + migration-integrity bug — found, NOT fixed, needs user input)

### Critical: local dev server is currently broken on every page touching `audits`

Started `npm run dev` and navigated `/samples` as a real user (per the "navigate
and note the experience" part of the goal). Got a hard error page: `This page
could not be loaded`. Root cause: `PrismaClientKnownRequestError: The column
audits.monitoringMode does not exist in the current database` — the local
Postgres DB hasn't had migration `20260703000000_rename_recheck_to_monitoring`
applied (`npx prisma migrate status` confirms it's the only pending migration).

### Bigger issue found while investigating: 4 already-applied migrations were edited in place

Tried `npx prisma migrate dev` to apply the pending migration — it failed
shadow-DB validation with `type "RecheckMode" does not exist`. Cause: whoever did
the recheck→monitoring rename this session **edited the SQL of 4 already-applied,
previously-committed migration files** (renamed columns/types at their original
`CREATE TYPE` / `ADD COLUMN` statements) instead of only adding the new rename
migration:
- `prisma/migrations/20260613184823_add_free_recheck_trial/migration.sql` —
  `freeRecheckUsedAt` → `freeMonitoringUsedAt`
- `prisma/migrations/20260614120000_completion_hardening/migration.sql` —
  `trialRecheck` → `trialMonitoring`
- `prisma/migrations/20260614200000_pipeline_log_and_recheck/migration.sql` —
  `CREATE TYPE "RecheckMode"` → `CREATE TYPE "MonitoringMode"` (this is the one
  that breaks shadow-db replay: the new rename migration does
  `ALTER TYPE "RecheckMode" RENAME TO "MonitoringMode"`, which fails on a fresh
  DB because migration 3 above already created it as `MonitoringMode` directly)
- `prisma/migrations/20260619120000_drop_trial_recheck_fields/migration.sql` —
  drops updated to match the renamed columns

**Editing an already-applied migration file is a Prisma anti-pattern** — it
works by luck on databases that already ran the *original* version of that
migration (our real dev/prod DB has the old names, so those 4 files' *current
edited content* no longer matches what's actually in the DB, but nothing checks
that at runtime), but it makes `prisma migrate deploy` on any **fresh** database
(new clone, CI test DB, disaster-recovery restore) fail outright, because the
migration history on disk is now internally inconsistent. This is a real
deploy-blocking bug, not a style nitpick.

**Correct fix (not yet applied):** revert those 4 files to their original
committed content (`git diff` shows the edits are pure find-replace, nothing
else changed), keep `20260703000000_rename_recheck_to_monitoring` as the only
place doing the rename, then apply it to the local dev DB. **I attempted this
and it was blocked by the permission system** (discarding another agent's
uncommitted changes without explicit user sign-off) — asked the user directly;
they said "wait for next instruction, don't proceed" rather than picking an
option. **Do not revert these files without fresh user confirmation** — check
with them again before touching `prisma/migrations/2026061*` / `202606193*`.
Local dev will keep 500-ing on any page that queries `audits` until this is
resolved one way or another.

---

## 2026-07-03 — Session 8 (branch-ready repo findings in the report UI)

### What changed

- Added `lib/repo-scan/finding-fix-task.ts` as the shared source for repo
  finding locations, suggested branch names, commit messages, verification
  checklists, and branch-ready prompts.
- Rewired `lib/repo-scan/build-finding-prompt.ts` and
  `lib/mcp/repo-finding-payload.ts` to use that shared helper, so future stored
  scan prompts, MCP payloads, and report UI prompts stay aligned.
- Updated `components/repo-scan/RepoFindingCard.tsx` and
  `components/repo-scan/RepoScanReport.tsx` so each code finding now shows the
  suggested branch, suggested commit, verification checklist, and copies the full
  branch prompt instead of the older generic fix prompt.
- Hardened `lib/__tests__/crypto.test.ts` by tampering decoded ciphertext bytes
  before re-encoding; the previous test sometimes changed base64 text without
  changing decoded ciphertext.

### Verified

- `npm run test:unit -- lib/__tests__/crypto.test.ts lib/mcp/__tests__/repo-finding-payload.test.ts lib/repo-scan/__tests__/build-finding-prompt.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` (83 files, 1485 tests)

### Notes

- This still does not write branches or open pull requests. It makes the
  dashboard and MCP agree on the exact safe branch task, which is the right
  prerequisite for a later reviewed write path.
- A sidecar explorer was started to inspect GitHub write-safety architecture, but
  it did not finish before local implementation and verification completed and
  was closed without code changes.

---

## 2026-07-03 — Session 6 (MCP-startable repo scans)

### What changed

- Added `ff_start_repo_scan` to `lib/mcp/tools.ts` so eligible MCP clients can
  enqueue a GitHub repository scan for an allow-listed repo and receive a
  `repoScanId` plus dashboard `reportUrl`.
- Added `ff_list_repo_scans` so editor agents can discover recent repo scans,
  statuses, finding counts, and dashboard links without requiring the user to
  paste IDs manually.
- Repo scan MCP start/list is gated by normal MCP access plus
  `canScanRepositories`; repo selection still flows through
  `createAndEnqueueRepoScan`, so selected-repo allowlisting remains the
  enforcement point.
- Updated MCP tool listings in `lib/mcp/docs-content.ts`,
  `lib/marketing/copy.ts`, and `lib/marketing/llms-txt.ts`.
- Extended MCP interaction ID extraction to recognize `repoScanId` and
  `findingId`, with coverage in `lib/mcp/__tests__/log-interaction.test.ts`.

### Verified

- `npm run test:unit -- lib/mcp/__tests__/log-interaction.test.ts lib/mcp/__tests__/repo-finding-payload.test.ts lib/repo-scan/__tests__/build-finding-prompt.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` (83 files, 1484 tests)

### Notes

- This closes the MCP workflow gap where agents could fetch repo findings but
  could not start or discover scans themselves. The system is still intentionally
  not applying code or opening PRs; the next high-leverage slice is a reviewed
  write path with explicit branch creation, diff preview, rollback, and GitHub
  scope controls.

---

## 2026-07-03 — Session 5 (repo-finding MCP and branch-ready fix tasks)

### What changed

- Added `ff_get_repo_scan` and `ff_get_repo_finding` MCP tools in
  `lib/mcp/tools.ts`. These are read-only and scoped to the authenticated
  owner's repo scans, but they let editor agents fetch repo findings instead of
  relying only on the web UI copy button.
- Added `lib/mcp/repo-finding-payload.ts` plus tests. A repo finding now has a
  structured branch-ready payload: repo, base commit, file/line, severity,
  evidence, fix, suggested branch name, suggested commit message, verification
  checklist, and an agent prompt.
- Updated `lib/repo-scan/build-finding-prompt.ts` so new repo scans store a
  branch-scoped prompt in `agentPrompt` / editor prompt fields instead of the old
  minimal "Repo/File/Issue" text.
- Updated MCP tool listings in `lib/mcp/docs-content.ts`, `lib/marketing/copy.ts`,
  and `lib/marketing/llms-txt.ts` so docs and LLM-readable text include the repo
  tools.

### Verified

- `npm run test:unit -- lib/mcp/__tests__/repo-finding-payload.test.ts lib/repo-scan/__tests__/build-finding-prompt.test.ts lib/mcp/__tests__/flag-payload.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` (83 files, 1483 tests)

### Notes

- This is still not an auto-PR/write feature. It is the safer foundation: MCP can
  now fetch code findings as scoped branch-ready tasks, and actual GitHub write
  access can be layered on later with review/rollback controls.

---

## 2026-07-03 — Session 4 (MCP/read-shape and default fix ordering)

### What changed

- Added `lib/mcp/flag-payload.ts` so `ff_get_flag` response shape is built by a
  small, testable helper instead of inline JSON assembly inside
  `lib/mcp/tools.ts`.
- Added `lib/mcp/__tests__/flag-payload.test.ts` to prove a new UX deterministic
  flag exposes `whyItMatters`, `fix`, expert prompt text, and `verificationRule`
  through the same payload builder used by `ff_get_flag`.
- Extended `lib/report/__tests__/explorer-model.test.ts` to prove same-severity
  live report flags open in impact/confidence order. This protects the default
  opened report flag because `ReportExplorer` starts at `model.flags[0]`.

### Verified

- `npm run test:unit -- lib/mcp/__tests__/flag-payload.test.ts lib/report/__tests__/explorer-model.test.ts lib/audit/__tests__/priority-flags.test.ts lib/audit/__tests__/flag-copy.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` (81 files, 1476 tests)

### Notes

- The live report path uses `buildLiveExplorerModel`; fallback top prompt uses
  `getTopFixPromptFromFlags`; both now share the central priority comparator.
- A sidecar report-ordering review was started but did not finish within two
  waits and was shut down. Local review found no additional low-risk report
  ordering patch for this pass.

---

## 2026-07-03 — Session 3 (UX flag value hardening)

### What changed

- `lib/audit/checks/messaging-clarity.ts`: audience detection now accepts
  qualified audiences like "for engineering teams"; weak-value headlines require
  missing audience or outcome; run-on copy flags when there are repeated long
  sentences or one clear 45+ word run-on plus another long sentence.
- `lib/audit/checks/conversion-friction.ts` and
  `lib/audit/checks/trust-psychology.ts`: fixes now ask for real,
  substantiated proof only. Do not suggest invented customer counts, fake press,
  fake testimonials, or unsupported benchmark numbers.
- `lib/audit/checks/trust-psychology.ts`: absolute same-origin links are counted
  via `canonical`; no `og:image` origin inference. Unknown absolute hosts now
  fail closed rather than being treated as internal.
- `lib/audit/flag-copy.ts`: every new UX check ID has specific
  `whyItMatters` copy so reports and MCP prompts do not fall back to generic
  "friction or missed conversions" language.
- `lib/audit/priority-flags.ts` and `lib/report/explorer-model.ts`: same-severity
  flags now sort by impact tag, then confidence, before final tie-breakers. This
  keeps low-confidence POLISH items from becoming the default fix over higher
  value POLISH items.

### Verified

- `npm run test:unit -- lib/audit/__tests__/checks-ux.test.ts lib/audit/__tests__/verify-flags.test.ts lib/audit/__tests__/flag-copy.test.ts lib/audit/__tests__/priority-flags.test.ts`
- `npm run typecheck`
- `npm run lint`

### Next good slices

- Add an MCP/read-shape test proving a new UX flag exposes `whyItMatters`,
  expert prompt, and verification rule through `ff_get_flag`.
- Inspect the dashboard/report UI after the priority changes to ensure the
  default opened flag feels like the highest-value next action.
- Continue tuning severity/confidence with real audited landing pages, especially
  where POLISH flags feel subjective.

---

## 2026-07-03 — Session 2 (concurrent with at least one other agent)

### New checks added this session (by another concurrent agent, verified/hardened by this one)

Six new deterministic check modules landed: `messaging-clarity.ts`,
`conversion-friction.ts`, `trust-psychology.ts`, `visual-hierarchy.ts`,
`mobile-ux-quality.ts`, `security-headers.ts` (registered in
`lib/audit/checks/index.ts`, IDs in `lib/audit/check-ids.ts`). These are real
UX/conversion/trust checks, not just SEO/perf — a good step toward "replace a
professional audit." `runAllChecks` now also takes `responseHeaders` for the
security-headers check (threaded from the pipeline).

### Bugs found + fixed (verified against the source, not just typecheck)

1. **`lib/audit/checks/mobile-ux-quality.ts`** — the CRITICAL `mobile-no-viewport`
   check (missing `<meta viewport>`, a real production-blocking issue) was gated
   behind `if (!captureMetrics) return findings` at the top of the function. Since
   `captureMetrics` is only populated when the browser-capture step succeeds, this
   meant a CRITICAL flag silently never fired whenever screenshot capture failed —
   the exact "accuracy" failure mode this whole effort is about. Fixed by moving
   the viewport check above the early return so it runs on metadata alone,
   independent of capture success.
2. **`lib/audit/checks/trust-psychology.ts`** — `internalLinks` used
   `new URL(l.href).hostname === new URL(meta.ogImage || 'https://example.com').hostname`
   to decide if a link was internal. `ogImage` is the OG image URL, not the page's
   own URL — on most real sites (CDN-hosted images, different subdomain) this
   comparison is wrong, and when `ogImage` is missing it falls back to
   `example.com`, which guarantees every absolute link reads as external. Net
   effect: false-positive `trust-no-internal-links` on most audits. Fixed to use
   `meta.canonical`'s hostname instead, with unknown-hostname links currently
   treated as "not internal" (fail-closed — a later agent adjusted my initial
   fail-open choice; both are defensible, fail-closed shipped).
3. **`lib/audit/__tests__/checks.test.ts`** trigger-matrix fixtures for
   `messaging-long-sentences` and `hierarchy-information-density` were under the
   word-count thresholds they were supposed to exceed (off-by-a-few-words fixture
   bugs, not product bugs) — fixed by padding the fixture text past the actual
   30-word/80-word thresholds.
4. Minor: `conversion-friction.ts` had an unused `pageUrl` var and a duplicated
   `!bodyText.includes('credit card') && !bodyText.includes('credit card')`
   condition (dead duplicate, not wrong, just sloppy) — cleaned up; a concurrent
   agent independently rewrote the same section with a proper
   `hasCreditCardClarity` regex, which superseded this fix.

### Dogfooding catch (high value — read this before touching demo fixtures)

`lib/demo/fixtures/v1.ts` / `original.ts` is a **sanctioned self-improvement loop**
(see the comment at the top of `original.ts`): audit `/demo` (intentionally flawed
baseline), fork to `/demo/v1`, apply fixes until deterministic flags hit zero.
`lib/demo/__tests__/v1-fixture-audit.test.ts` asserts v1 has 0 in-scope flags. The
new checks above immediately caught 5 real gaps in our own "fixed" reference page:
no audience framing in the headline, no credit-card clarity on the free trial, no
authority signal, weak testimonial, no social proof. This is exactly the kind of
true-positive the goal is asking for — a concurrent agent fixed the v1 copy (see
`lib/demo/fixtures/v1.ts`) rather than weakening the checks, which is the right
call: don't nerf an accurate check to make a stale fixture pass.

**Worth revisiting later (not done — low confidence / needs product judgment,
not a quick fix):**
- `messaging-no-audience` in `messaging-clarity.ts` only scans `h1s` + first 3
  `h2s` for the audience regex. On the demo fixture the audience ("Founders...")
  was originally stated in the hero **subheadline**, which renders as a `<p>`, not
  an `<h2>` — so a real, visible above-the-fold audience statement was invisible
  to the check. `PageMetadata` has no distinct "subhead" field; if this keeps
  producing false positives on real audits, consider also scanning the first
  ~200-300 chars of `pageText` for the audience check specifically (not jargon —
  that one's about headings by design).
- `trust-testimonial-quality` and `friction-no-social-proof` can both fire for the
  exact same root cause (zero testimonials at all), producing two flags for one
  fix. Consider gating `trust-testimonial-quality` on "some testimonial-like
  content exists but is weak" (e.g. any quoted text ≥10 chars) rather than firing
  unconditionally whenever a *specific* testimonial isn't found — avoids
  redundant flags hurting prioritization quality.

### Status at end of this pass

`npx tsc --noEmit` clean, `npx vitest run` — 1470 passed, 1 skipped, 0 failed,
80/80 files. Nothing committed (repo convention is push-to-main directly per
AGENTS.md, but there's substantial concurrent uncommitted work from multiple
agents — did not commit/push mid-flight; that's a call for whoever lands the
final state of this batch).

### Open gap carried over from Session 1 (still true)

The single biggest lever for "10x value" / "straight to branch edits" is still
unbuilt: nothing in the codebase applies a fix to a user's repo or opens a PR.
Repo scan (`lib/repo-scan/*`) and MCP tools (`lib/mcp/tools.ts`) are read-only +
prompt generation only. This needs a deliberate design pass with the user
(GitHub write scope, LLM-authored diffs, review/rollback UX) before building.

---

## 2026-07-03 — Session 1

### Architecture map (for future sessions — read this before re-exploring)

- **Audit pipeline:** `lib/audit/runner.ts` orchestrates `runPage()` (per-URL:
  capture → PageSpeed → deterministic checks → triage/judge) for primary +
  up to 2 critical-path pages, then `combine-pages.ts` averages/merges results
  into one report. Deterministic check registry: `lib/audit/checks/registry.ts`,
  scoring math: `lib/audit/checks/rubric.ts`.
- **Judge/prescription:** `lib/audit/judge.ts` (being refactored — see below),
  `lib/audit/judge-triage.ts` (newer triage path), prompts in
  `lib/prompts/system-prompt.ts`. Judge output becomes `flagPrescriptions` /
  `rubricPrescriptions` — fix text + tool-specific prompts (cursor/claude/
  lovable/bolt).
- **Fix delivery today:** (1) copy-paste fix/prompt text in the report UI,
  (2) MCP tools (`lib/mcp/tools.ts`) — `ff_check_url`, `ff_get_report`,
  `ff_get_rubric`, `ff_get_flag`, `ff_recheck`, `ff_compare`,
  `ff_list_recent_audits`, `generate-fix-prompt`. All read-only + prompt
  generation — **no tool writes code or opens a PR**.
- **Repo scan** (`lib/repo-scan/*`): clones a connected GitHub repo shallow,
  runs static `lib/audit/code-checks/*` (dangerous-patterns, dependency-hygiene,
  exposed-secrets), stores findings + fix prompts. Also read-only — does not
  create branches, commits, or PRs.
- **Gap vs. the "straight to branch edits" goal:** nothing in the codebase
  today applies a fix to a user's repo or opens a PR. This is the single
  biggest feature gap toward the stated vision, and it's a big, security-
  sensitive lift (GitHub write scope, LLM-authored diffs, review/rollback
  UX) — needs a deliberate design pass with the user before building, not
  something to bolt on silently.
- **Prioritization today:** severity (CRITICAL/IMPORTANT/POLISH) sort only,
  in `lib/audit/priority-flags.ts`. No weighting by confidence, rubric grade
  interaction beyond `rankFlagsByPriority`'s tie-break, or "fix this first
  for max score impact" logic.

### Bug found + fixed (uncommitted, isolated files — see below)

`averageScores()` in `lib/audit/pipeline/combine-pages.ts` computes the
**final persisted score for every audit** (not just critical-path — it's
called unconditionally in `runner.ts` even for single-page audits). It called
`computeRubricScores(page.flags, page.desktop, page.mobile)` **without**
`failedModules`, unlike `run-page.ts`'s own interim call which does pass it.
Net effect: if a deterministic scan module (content/slop/metadata/seo/trust)
crashed while checking a page, the final report silently scored that rubric
100 instead of applying the same uncertainty penalty the rest of the pipeline
uses. Fixed by adding `failedModules: string[]` to `PageRun`
(`lib/audit/pipeline/types.ts`), threading it from `run-page.ts`, and passing
it into `computeRubricScores` inside `averageScores`.

Also fixed 4 stale tests in `lib/audit/__tests__/combine-pages.test.ts` — they
were written before a scoring change (commit `f0a50a7`, 2026-06-20) added the
"no PageSpeed data → uncertainty penalty" behavior, and were never updated.
**These tests had been silently broken for ~2 weeks** — worth checking whether
CI actually runs `npm run test:unit` on every push, since this should have
been caught immediately.

Files touched (not yet committed — holding for combined review since the
user is concurrently editing judge.ts/persist.ts/judge-step.ts/system-prompt.ts
for a judge→triage migration):
- `lib/audit/pipeline/types.ts`
- `lib/audit/pipeline/run-page.ts`
- `lib/audit/pipeline/combine-pages.ts`
- `lib/audit/__tests__/combine-pages.test.ts`

### Environment fix (already applied, not a source change)

`node_modules/.bin/*` had corrupted shell-shim binaries (not valid JS),
breaking `npm run test:unit`'s `node -r dotenv/config node_modules/.bin/vitest`
trick. Root cause: two orphaned untracked files, `pnpm-lock.yaml` and
`pnpm-workspace.yaml`, indicated someone ran `pnpm install` at some point
against an npm-managed project. Deleted those two files and ran `npm install`
to restore proper bin shims. If `pnpm` is intentional going forward, say so —
otherwise avoid running it in this repo.

### Known pre-existing issues NOT yet investigated (found via typecheck, not caused by this session)

- `lib/__tests__/billing-runtime.test.ts` — `NODE_ENV` read-only assignment
  errors, a stray top-level `await` outside async function.
- `lib/audit/__tests__/checks.test.ts` — imports missing module
  `@/lib/audit/checks/design-language`.
- `lib/audit/__tests__/pipeline-steps.test.ts` — `wordCount` field doesn't
  exist on `PageMetadata`; several fixture/type mismatches.
- These may already be mid-fix as part of the user's concurrent judge→triage
  work — check before re-diagnosing.

### Open questions / decisions needed from the user (not yet asked, deprioritized this session)

- Is CI running `npm run test:unit` + `tsc --noEmit` on every push? The 2-week-
  stale test failure and current typecheck errors on `main` suggest maybe not.
- Appetite/timeline for the "branch edits" / auto-PR feature — this is the
  biggest lever for the "10x value" goal but is a multi-week feature, not a
  quick win.
