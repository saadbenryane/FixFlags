# Wave 1 goal-probe safety

**Owner:** `codex-01a0f153`

**Status:** locally implemented and verified; not deployed or customer-validated

**Scope:** follow-up to `.agents/sessions/2026-09-30-wave1-goal-probe-independent-review.md`

## Customer outcome

FixFlags no longer offers or executes protected browser Outcomes that it cannot safely and independently verify. Checkout and page availability remain confirmable. Signup, Login and Password reset remain discoverable but require tenant-scoped test access and an authorized reversible fixture before they can become watched promises.

## Implementation

- `browserJourneyConfigSchema` rejects fill/click steps outside the bounded Checkout runner.
- `validateBindingForOutcome` blocks Signup, Login and Password reset regardless of caller-supplied JSON, including forged fixture claims and wait-only configs whose goal already matches.
- Action-dependent bindings declare `goalAfterStep`; the runner does not inspect the goal before that step.
- Outcome confirmation and Settings choices derive from the same validator used by execution.
- The execution boundary records protected persisted bindings as BLOCKED before calling Playwright. A future fixture path must perform a tenant-owned database lookup and cleanup contract rather than trust `authorized` or `fixtureId` fields in JSON.
- Generic browser success now records `goal_reached`, while Checkout keeps `checkout_reached`.
- The Outcome route derives its accepted enum from `CONFIRMABLE_OUTCOME_KINDS`, eliminating its stale three-kind copy.
- Added the missing additive PostgreSQL enum migration for `LOGIN` and `PASSWORD_RESET`; local deploy, status and drift checks pass.
- Updated `PRODUCT.md` and `ROADMAP.md` to distinguish generic/safe-form foundations from shipped watchability.
- Updated the existing dependency override from `brace-expansion` 5.0.9 to 5.0.12 after the full gate exposed the new high-severity denial-of-service advisory. The separate uncommitted JEV script remained intact.

## Evidence

- Focused suite after independent review repairs: 6 files, 50 tests passed. It includes forged fixture metadata and wait-only protected bindings.
- Scoped TypeScript and ESLint passed.
- Disposable real-browser fixture: `{ health: 'GREEN', confirmed: true, reason: 'goal_reached', posts: 1, stepCount: 5 }`. The goal text existed on initial load, but the runner waited until after wait, fill and click. The only POST went to the authorized localhost fixture. Generated integrity artifacts were deleted.
- `npm run db:deploy`, `npm run db:check`, and `npm run db:drift` passed; 99 migrations are applied and no drift remains.
- `npm audit --audit-level=moderate` reports zero vulnerabilities; `npm ls brace-expansion --all` resolves every path to 5.0.12.
- Final post-review `npm run agent -- verify` passed all 30 commands, including unit/coverage/accuracy checks, Next build, worker build and `docker build -t fixflags:verify .`. Container receipt: `.agent-runs/2026-09-30T09-06-23-450Z-container-build.log`.
- Post-document guards passed: product contract, knowledge duplication, copy drift, skill validation and `git diff --check`.

## Limits and next action

Independent review initially found that caller-supplied fixture fields and wait-only configs could bypass the first validator. Those findings were repaired before the final verification: protected kinds are now categorically blocked by the execution boundary. This is local evidence only. No branch was pushed and no production release occurred. Protected Outcomes should remain unavailable until a separate owner implements tenant-scoped credentials, fixture authorization, cleanup/reversal and delivery proof. Production canary and credentialed MCP proof remain open launch gates.
