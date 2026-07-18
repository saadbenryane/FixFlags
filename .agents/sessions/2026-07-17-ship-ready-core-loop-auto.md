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

## Stop condition

Core journey is coherent: anon sees real triage value → clear account CTA for prompts → claim/AI pending wiring → re-check owner path clear. Remaining items are deploy/measurement polish.
