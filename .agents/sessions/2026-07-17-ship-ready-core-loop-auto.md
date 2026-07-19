# Ship-ready core loop — session

- Date: 2026-07-17
- Owner: auto
- Board task: `ship-ready-core-loop`
- Status: **done** — verified locally with live anon scan of example.com

## Goal

Close post-signup payoff and trust gaps on Flag → Fix → Re-check so the product feels finished for real users.

## Iteration 2 (this continue)

| Issue | Fix |
|-------|-----|
| Anon evidence stripped (hurts triage value) | `stripDeterministicFixesFromFlags` keeps evidence + whyItMatters; only strips prompts/fix |
| Pseudo-evidence (problem labeled Evidence) | explorer-model only formats real evidence |
| Rubric summaries locked for anon | RubricCard shows summary + locked teaser for prompts |
| Claim enqueue race stuck pending | enqueue first, then set `includeAi` |
| Re-check tab scrolled past results | toolbar uses `#recheck-results` when diff exists |
| Free compare clarity | RecheckDiffStrip Pro compare hint → /pricing |
| Dashboard first-run clutter | single FirstAuditPrompt; defer MCP + Projects until audits exist |
| Copy over-promise | PRODUCT_LADDER / PRICING / FAQ / FIRST_AUDIT / UPSELLS / ANON_CLAIM aligned |
| Silent claim failure | useMe toast on claim error |

## Live verification (localhost)

- Homepage badges: "Fix prompts after signup" visible
- Anon `example.com` scan → `/report/cmrpczapp0001on983zkif1ie` COMPLETED
- Evidence + Why it matters visible without account
- Fix card shows Create free account / Sign in teaser
- PageSpeed incomplete Callout rendered
- Claim guide: "You can already see the evidence"
- No Re-check nav for anon (owner-only)
- Toolbar: Flags / Overview / Previews / Flow / Rubrics only

## Verification commands

- `npm run typecheck` — pass
- `npm run lint` — pass
- Targeted vitest (homepage-message, report-access, upgrade-moments) — 47 pass

## Residual (not blocking ship)

1. Full signup → claim → unlock walk still needs a real account (OAuth/email) — code path covered; live claim not re-run this session
2. Flag list truncation on narrow columns (polish)
3. Production deploy still required for fixflags.com
4. ExportMenu analytics, Meta Pixel CSP deferred earlier

<<<<<<< HEAD
## Stop condition

Core journey is coherent: anon sees real triage value → clear account CTA for prompts → claim/AI pending wiring → re-check owner path clear. Remaining items are deploy/measurement polish.
=======
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
>>>>>>> origin/claude/app-polish-shipping-unj812
