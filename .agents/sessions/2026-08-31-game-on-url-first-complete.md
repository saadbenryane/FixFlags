# Game On URL-first completion — Attention-first judgment

**Date:** 2026-08-31  
**Board:** `game-on-url-first-complete`  
**Owner:** grok

## Where FixFlags is

Pre-revenue URL-first loop. Parked: Preview, Timeline, Canvas, CLI, MCP. Current promised journey: paste URL → evidence report → claim → copy fix → update review → Product outcomes.

## Constraint chosen

First judgment was weaker than Finish Plan. Agent named Polish hygiene as if it were Attention.

## Hypothesis

If Agent and Report open on the same worthwhile Flags Finish Plan already uses, time to first valuable judgment drops without hiding observations.

## Done this cycle

- Previous honesty pass retained: diagnostic score copy, AA brand CTA, 44px chrome, `/help/mcp` redirect, parked plumbing removed from `AuditReport`, heartbeat parser.
- Shared Attention rule in `lib/audit/attention.ts`.
- Agent names up to three Attention candidates while checking, then Finish Plan worthwhile Flags when the Review is fully complete.
- Additional-count copy only counts leftover Attention candidates. Polish stays in the Report.
- Fully completed Reviews with no worthwhile Flag say it did not find anything that deserves action yet. Partial Reviews do not.
- Report default-opens the first candidate, re-homes when a candidate streams in, and keeps an explicit URL Flag.
- Independent review required remaining-count honesty, completed/Finish Plan alignment, progressive selection, and copy changes. Those landed.
- Curated DemoSite sample still names the mobile CTA and does not name the Polish canonical Flag.

## Verification

- `npx tsc --noEmit --incremental false` clean
- Focused vitest: attention, scan-agent-messages, finish-plan, explorer-filters, sample-provenance, homepage-message, ScoreRing, ReportOutcomeBar, ReportExplorer, AuditReportProgressive
- `node --test scripts/agent-heartbeat.test.mjs` 24 passed
- `git diff --check` clean
- Live browser journey not run this cycle (no server on :3000; Playwright webServer is a full standalone build)

## Not done

- Operator SHA / Watch / Update-review receipts
- Accuracy corpus expansion
- `npm run verify` from a quiet tree
- Overlay pixel assertions (parked Preview)

## Accuracy hill (this cycle)

Gold HTML gate remains 0 CRITICAL/IMPORTANT. The wreck-the-product risk was not extra Polish Flags. It was a true Flag with a harmful prescription: `buttons-no-text` told builders to add visible text to icon chrome.

- HTML fallback and axe `button-name` / `link-name` / `label` fixes now keep the visual and add an accessible name.
- Named aria-label icon buttons still count as named.
- `npm run accuracy:eval` 0 failures. 350 focused audit tests passed.

## Next constraint (if this holds)

Whether the first worthwhile Flag is *true* on a rendered page, and whether remaining IMPORTANT Flags (`trust-unsupported-claims`, `form-missing-validation`, `h1-missing`) have equally safe prescriptions. Live axe confirmation still owns IMPORTANT name findings.
