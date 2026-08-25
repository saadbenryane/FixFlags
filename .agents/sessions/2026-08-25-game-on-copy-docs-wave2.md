# Game On copy and canonical documentation Wave 2

## Outcome

Customer-facing copy now uses “Update review” and “Update reviews.”
Internal `/re-check`, `recheck` enum, analytics, MCP tool, and compatibility CLI names remain unchanged.

The copy contract now states that every signed-in manual update review consumes one product-review credit.
Watch-triggered reviews are the only non-manual path that skips usage.
No copy or skill promises a hidden free first update review or unlimited update reviews.

Live anonymous, non-owner, and shared reports expose zero prompts, copy controls, Timeline payload, update-review actions, or lifecycle mutations.
Repository-owned curated samples expose the complete Fix list, exactly one demonstrated per-Flag prompt, their versioned static Timeline, no aggregate Finish Plan prompt, and no update-review action.

Copying an owner prompt is a handoff recorded as `HANDOFF_COPIED`, not verification.
Raw absence is “No longer observed in this review.”
Only strict receipt outcome `IMPROVED` may say an Improvement is verified or improved and write verified Product Memory.
`INCONCLUSIVE`, `UNCHANGED`, and `REGRESSED` retain coverage, evidence, and remaining risk.

The canonical report order now includes the update-review result, complete ranked Fix list, bounded “What to fix next” Finish Plan, collapsed evidence and Product context, then secondary controls and one owner update-review action.
Active desktop defaults to Preview, active mobile defaults to Agent, completed reviews default to Report, and completed Timeline remains a capability-governed sibling.

## Copy architecture

The former 1,200-plus-line `lib/marketing/copy/landing.ts` was split without consumer churn:

- `lib/marketing/copy/homepage.ts` owns homepage and marketing-page copy.
- `lib/marketing/copy/report-workspace.ts` owns `REPORT_COPY` and `MADE_WITH_COPY`.
- `lib/marketing/copy/landing.ts` remains a compatibility barrel.
- `lib/marketing/copy.ts` continues to re-export the same public names.
- `lib/marketing/copy/workspace.ts` imports directly from the report/workspace module.

`REPORT_COPY.verificationReceipts` now provides canonical heading, explanatory body, count label, strict outcome labels, raw-absence language, coverage/evidence/risk labels, and an update-review link label.
`RECHECK_DIFF_COPY` now distinguishes no-longer-observed Flags from strict verification and includes an explicit inconclusive bucket.

## Canonical sources reconciled

- `PRODUCT.md`
- `DESIGN.md`
- `docs/voice-and-copy.md`
- `docs/workspace-interface.md`
- `knowledge/report-contract.md`
- `.agents/skills/fixflags-marketing/SKILL.md`
- `.agents/skills/fixflags-design-system/SKILL.md`

The stale missing `references/marketing-playbook.md` instruction was removed from the marketing skill.
The stale `ReportPolishPass` skill reference was replaced by `ReportFinishPlan`.

## Proof

- `npm run doctor` passed environment, PostgreSQL, Redis, Chromium, migrations, and worker checks.
- Targeted ESLint passed for all copy modules and copy-contract tests.
- Focused copy tests passed: 39 tests across three files.
- `npm run skills:validate` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run completeness:audit` passed: 69 models, 19 MCP tools, 8 editor integrations, and 7 review-context sections.
- `git diff --check` passed.

`npm run agent -- verify` reached `test:scripts` and stopped on one concurrent release-lane wording mismatch.
`scripts/route-boundary-smoke.test.mjs` expects “does not match candidate,” while `scripts/deployed-release-smoke.mjs` now says “does not exactly match candidate.”
This lane did not edit either release file; the integration owner was notified.

The first completeness run failed because the concurrently replaced `ReportPolishPass.tsx` was still named in the guard.
The integration owner updated that guard, and the same audit then passed.

## Integration notes

Root owns the web verification-receipt component and final standalone report-pane proof.
The canonical copy keys required by that component are available at `REPORT_COPY.verificationReceipts`.
No homepage, report, product-loop, release, completeness-script, E2E, Board, or Goal file was edited in this lane.
