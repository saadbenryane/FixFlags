# Ship-ready core loop — session

- Date: 2026-07-17
- Owner: auto
- Board task: `ship-ready-core-loop`
- Status: implemented; verification via typecheck/lint limited by incomplete local `.bin` links (ran vitest + prisma generate via node)

## Goal

Close post-signup payoff and trust gaps on Flag → Fix → Re-check so the product feels finished for real users.

## Product context (compounded)

- ICP: AI-first founders / agencies. Core loop: paste → flags → fix prompts → re-check.
- Anon wedge (first-value-journey): triage visible without account; fix prompts require signup.
- Do not touch: homepage art, sample explorer, uncommitted `lib/graph/persist.ts` / `test-strategy.md`.

## Issues found → fixed

| Issue | Fix |
|-------|-----|
| Claim toast but report stays locked until manual refresh | `ClaimAnonymousAudits` calls `router.refresh()` after `claimedCount > 0` |
| Claimed anon AI pending never shows (includeAi false until job starts) | `claim-anonymous` sets `includeAi: true` before enqueue; `aiReviewPending` also true when `JUDGING` |
| Screenshot limited/partial computed but never shown | `AuditReportHero` renders Callouts from existing props + new `REPORT_COPY` strings |
| Re-check nav for users who cannot re-check | `showRecheckSection={isLoggedIn && isViewerOwner}` |
| Anon flag detail hides Fix card (`hasFixPrompt` false after strip) | `FlagDetailPanel` shows locked teaser when `aiLocked` even without `hasFixPrompt` |
| Report error sends anon to Dashboard | Secondary CTA → `/` ("Go home") |
| Pro upsell on every completed free report | Only show upgrade card when moment is not `free_default` (e.g. at limit) |
| Hero badge "Agent fix prompts" over-promises | Badge → "Fix prompts after signup" |

## Decisions

1. Keep stripping evidence for anon (existing tests/product decision); unlock conversion via per-flag locked Fix card instead of restoring evidence.
2. Prefer claim-time `includeAi: true` over inventing a new pending signal — reuses AiReviewPendingRefresh.
3. Defer always-on `report_completed` upsell; limit-based moment remains.

## Verification

- `node node_modules/vitest/vitest.mjs run` homepage-message + report-access + upgrade-moments — pass (after `prisma generate`)
- Local `npm run typecheck` / `npm run lint` blocked by incomplete `node_modules/.bin` (only tsc linked) and a googleapis d.ts parse noise — not introduced by this change

## Concurrent work note

During this session, four files were briefly reverted by concurrent local edits (ClaimAnonymousAudits, claim-anonymous, FlagDetailPanel, report error). Homepage also gained unrelated diffs (LogoCloud removal, audienceLine UI/test). Those homepage diffs are **not** owned by this task; re-applied only core-loop files.

1. Live browser walk of anon → signup → unlock still needed on deployed env.
2. If claim enqueue fails after setting includeAi, UI may show pending until poll timeout (45×2s) without prompts — rare; same class as queue failure before.
3. Dashboard first-run Projects clutter and ExportMenu analytics deferred.
4. Do not commit uncommitted graph persist / test-strategy edits from other work.

## Review close-out (claude, 2026-07-17, branch claude/app-polish-shipping-unj812)

Reviewed and verified with the full local stack (native Postgres/Redis; see
`.agents/learnings/remote-sandbox-fullstack-recipe.md`) and a Puppeteer walk of
the claim-unlock path over a seeded anonymous COMPLETED audit:

- Anon report: flags visible, fix prompts locked, per-flag locked teaser and
  claim CTA present. PASS.
- Claim CTA -> sign-up carries `next=/report/<id>&from=report`. PASS.
- Post-signup: report unlocks WITHOUT manual reload, full Fix card with Copy
  prompt + Connect Cursor MCP, "Fix prompts generating" + "Fix prompts on the
  way" pending states render, Limited screenshots callout renders. PASS.
- DB: audit claimed (userId set) and `includeAi: true` after signup. PASS.
- Full suite on the merged tree: typecheck, lint, 1759 tests (incl. the 6 new
  component-test files this environment can run), guards, production build.

**Gap found and fixed during review:** the claim only fired on `/post-login`
(OAuth) and the dashboard. EMAIL signups from the report claim CTA navigated
straight back to the report via `navigateAfterAuth`, so the claim never ran:
account created, report still locked, claim CTA gone - a dead end on the main
conversion path. Fix: email sign-in/sign-up now route through `/post-login`
(`postLoginHref` from `useAuthRedirect`), making it the single post-auth path
for claim + checkout + next navigation. Verified by the browser walk above.

Marked done on the board.
