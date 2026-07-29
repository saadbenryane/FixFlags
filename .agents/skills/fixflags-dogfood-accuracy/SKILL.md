---
name: fixflags-dogfood-accuracy
description: Compare a completed FixFlags report with the same website rendered in Playwright, adjudicate every distinct fix, remove false positives and repeated cross-page findings, and turn discoveries into browser/offline regression gates. Use for local dogfood scans, disputed flags, duplicate report findings, CTA or viewport accuracy, AI judge hallucinations, and iterative accuracy-harness work.
---

# FixFlags dogfood accuracy

Read `AGENTS.md`, then `.agents/skills/fixflags-scan-accuracy/SKILL.md` and `.agents/skills/fixflags-browser-capture/SKILL.md`. Use Playwright Chromium on the audit path.

## Start from evidence

1. Run `git status`, `npm run agent`, and read `.agents/BOARD.md`.
2. Claim a non-overlapping accuracy scope before writes.
3. Resolve the exact audit ID from the report URL or local database.
4. View the persisted report via the web UI at `https://fixflags.com/report/<audit-id>` or use Prisma Studio for DB inspection.

## Independently inspect the target

Render every scanned URL at the production capture viewport. Do not adjudicate geometry from HTML alone.

```bash
npm run accuracy:browser
npm run accuracy:browser -- https://example.com https://example.com/pricing
```

For each distinct fix, record one verdict:

- **True positive:** evidence and severity match the rendered behavior.
- **False positive:** the claimed behavior is contradicted by rendered or metadata evidence.
- **Unsupported:** evidence is missing, partial, or owned by an unavailable source.
- **Duplicate:** the same corrective action is repeated across routes or sources.
- **Severity mismatch:** the issue exists but the user-facing consequence is overstated.

Inspect the element named in evidence. For CTA flags, verify selected element semantics, label, top position, viewport height, and whether any pixels are visible before scrolling.

## Fix the owning layer

Choose the smallest structural fix:

1. **Wrong element selected:** fix candidate semantics in `lib/audit/capture-metrics.ts` or the owning browser probe.
2. **Evidence true but title overclaims:** fix the check threshold/copy in `lib/audit/checks/`.
3. **AI restates or contradicts deterministic truth:** strengthen `lib/audit/deduplicate.ts`, pass the deterministic fact into the request-specific judge context, and clarify the stable system prompt.
4. **Same fix on several routes:** consolidate by base check ID in the Finish Plan while retaining affected page URLs and evidence.
5. **Harness blind spot:** add a hermetic case to `non-html-regression.json` and a live rendered case to `accuracy-browser-corpus.ts`.

Never add hostname-specific production logic. Do not weaken a valid check to make a fixture pass. Keep page data out of stable system prompts.

## Iterate through the real path

Run focused tests first:

```bash
npx vitest run lib/audit/__tests__/checks.test.ts lib/audit/__tests__/deduplicate.test.ts lib/audit/__tests__/finish-plan.test.ts lib/report/__tests__/explorer-model.test.ts lib/report/__tests__/explorer-filters.test.ts
npm run accuracy:eval
npm run accuracy:browser
```

Then create a fresh audit through the real product path:

```bash
# Web: https://fixflags.com → enter URL → get report
# CLI: fixflags check https://target.example --wait --full
```

Compare:

- raw rows versus `distinctFixCount`;
- top three before and after;
- `analysis.repeatedFixes`;
- AI-only findings against deterministic facts;
- report UI at mobile and desktop widths.

Repeat until the fresh production-path audit has no known false CRITICAL/IMPORTANT finding, no duplicate fix presentation, and every adjudicated regression is enforced by a test or probe.

## Close out

Run `npm run agent -- verify --dry-run`, then `npm run agent -- verify` or justify a narrower equivalent. Inspect artifacts, not only exit codes.

Record non-obvious detector lessons in `.agents/learnings/` and substantial run evidence in `.agents/sessions/`. Report the audit IDs, measured row-to-fix reduction, what passed, and anything not independently verified.
