# Offering & Product Scope

Finish what your AI started. FixFlags is the second pass that catches what speed skipped.

## What We Ship

- **Deterministic checks** (free forever, unlimited): metadata scanning, accessibility basics, performance data, SEO tags, trust signals, mobile viewport checks, content analysis, slop detection, og:image validation.
- **CTA flow test** (free): automated click-through on the primary CTA with before/after screenshots and flow flags.
- **Preview cards** (free): live Google snippet and social link preview rendered in the report.
- **Full report on every check** (free): deterministic scans plus AI review across Message, Experience, and Reach. Rubric scores, AI-generated flags, and fix prompts on every report.
- **Fix prompts** (free): copy-ready instructions tuned for Cursor, Claude Code, Lovable, and Bolt. Each prompt includes specific evidence from your page.
- **Re-check loop** (free, unlimited on owned reports): re-run the same URL and diff flags. This is the core habit.
- **Before/after compare** (Pro+): side-by-side proof after re-checks.
- **MCP integration** (Pro+): 6 MCP tools for Cursor and Claude Code. Lovable/Bolt MCP not supported yet.
- **Share links and proof export** (Agency+): public report links and client-ready summaries.

## What We Do Not Ship (Current)

- Staging / password-protected site support.
- Localhost or private network checks.
- CI/CD integration (GitHub Actions, Vercel deploy hooks). Not yet.
- Custom rubric creation.
- Team workspaces / seat management.
- API for batch scanning.
- White-label reports.

These are not planned until 100 paying users validate demand.

## Scans

Full catalog by rubric: [scan-catalog.md](./scan-catalog.md). Phased build plan: [scan-roadmap.md](./scan-roadmap.md).

Phase 1 (flow scan, slop detection, preview cards) is the validated exception to the freeze below — it directly serves the core loop for AI builders.

## Feature Philosophy

- **Zero new features until 100 paying users** — except scan depth in [scan-roadmap.md](./scan-roadmap.md) Phase 1. What is missing is distribution, not depth.
- **Every feature must serve the core loop:** check, fix, re-check, prove. If it does not fit that loop, it does not ship.
- **Re-checks are the habit.** Never gate them. A user who re-checks is a user who sees value. A user who hits a paywall on re-check is a user who churns.

## The Core Loop

1. User pastes a URL.
2. We run deterministic checks + AI review.
3. User gets Flags with evidence, impact, and fix prompts.
4. User pastes fix prompts into their AI editor.
5. User ships fixes.
6. User re-checks the same URL.
7. User sees before/after comparison and cleared Flags.
8. (Optional) User shares proof with stakeholders.

Steps 4-7 are what make FixFlags different from every other audit tool. Steps 6-7 (re-check loop) are the habit we want to build.

## Rubrics

Three dimensions, no more:

- **Message:** Headline clarity, audience fit, benefit hierarchy, CTA specificity, social proof, pricing confidence.
- **Experience:** Layout, mobile usability, accessibility basics, Core Web Vitals, broken interactions.
- **Reach:** SEO metadata, share previews, privacy/contact links, analytics setup.

Each rubric gets: Pass / Needs Attention / Blocked status, score, and flags with fix prompts.

## Launch Gates

Five concrete yes/no checks from report evidence. Fix before shipping:
1. Headline names audience + outcome.
2. Primary CTA visible above fold on 375px.
3. Social preview shows branded image.
4. Privacy policy link is present.
5. Console has no errors.

## Stuck audit recovery

Production runs a cron at `/api/cron/recover-stuck-audits` (authorized with `CRON_SECRET`). Audits in a non-terminal status with no update for 15 minutes (`STUCK_AUDIT_MINUTES`) are recovered as follows:

- **QUEUED** with a stale queue job: re-enqueue the audit.
- **Active worker job**: force-fail the job and mark the audit `FAILED` with `AUDIT_TIMEOUT`.
- **Other in-progress statuses**: mark `FAILED` with `AUDIT_TIMEOUT` so the user can retry.

Users see a human-readable timeout message and can start a new check or re-check from the report.
