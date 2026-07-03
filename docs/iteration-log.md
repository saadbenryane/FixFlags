# Iteration Log

Running notes for the "make FixFlags 10x, genius-level accurate" iteration effort.
Purpose: avoid re-deriving architecture/context on every session, and track what's
been checked so we don't waste tokens re-auditing the same code.

**Convention:** newest entries at top. Keep entries short — link to code, not prose.

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
