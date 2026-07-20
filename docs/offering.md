# Offering & Product Scope

Finish what your AI started. FixFlags is the QA layer for AI-built products: the calm reviewer that catches what speed skipped. Run an audit, see the flags, copy the fix prompts, and re-check before users find the problems.

## What We Ship

- **Full report on each new URL check** (within plan quota): deterministic scans plus AI review across Message, Experience, and Reach. Rubric scores, flags, and fix prompts.
- **CTA flow test** (on every check): automated click-through on the primary CTA with before/after screenshots and flow flags.
- **Preview cards** (on every check): live Google snippet and social link preview rendered in the report.
- **Fix prompts** (with account): prompts tuned for Cursor, Claude Code, Lovable, and Bolt. Each includes specific evidence from your page.
- **Re-check loop** (free, unlimited on owned reports): re-run the same URL and diff flags. This is the core habit.
- **Before/after compare** (Pro+): side-by-side proof after re-checks.
- **MCP integration** (Pro+): MCP tools for Cursor and Claude Code (count in `AGENTS.md` Project facts). Lovable/Bolt paste fix prompts today.
- **Share links and proof export** (Agency+): public report links and client-ready summaries.
- **Credit packs** (paid plans): +10 / +25 / +50 new URL checks for overflow without changing tier.
- **Help Center + live chat:** searchable guides at `/help`, first-party chat on every non-admin page, FAQ at `/faq`, email for legal/high-volume. Not Intercom; not priority SLA by plan.
- **Repository-connected scanning** (Agency+): connect GitHub, allow-list specific repos, and scan the codebase for exposed secrets, dependency hygiene, and dangerous patterns — separate from URL audits. Shipped at `/settings/integrations` with OAuth, repo allow-listing, scan history, and `/report/repo/[id]`. Findings can open a Fix PR (branch + pull request) when the finding is auto-patchable.

## What We Do Not Ship (Current)

- Staging / password-protected site support.
- Localhost or private network checks.
- CI/CD integration (GitHub Actions, Vercel deploy hooks). Not yet.
- Custom rubric creation.
- Team workspaces / seat management (multi-seat, multiple logins per account).
- API for batch scanning.
- White-label reports — **except** the scoped agency exception below.

These are not planned until 100 paying users validate demand.

### Agency exception: white-labeled share links

Agencies are a Year 1 sales target (see `docs/year-1-operating-plan.md`) and repeatedly audit client sites, but they typically won't close without branding control over what they hand a client — full team seats aren't the blocker, the FixFlags logo on a client-facing report is. This is a narrow, deliberate carve-out from the freeze above, scoped to exactly one thing:

- **In scope:** on an existing Agency-plan public share link (`ShareAuditButton` / `/report/[id]`), let the owner swap the FixFlags name/logo shown in the report header (`BRAND.name` usage in `components/audit/AuditPageClient.tsx`) for their own agency name/logo. Backed by two new nullable `User` fields (e.g. `agencyBrandName`, `agencyBrandLogoUrl`) and a small settings control, both additive and gated to `TEAM`/Agency plan.
- **Out of scope:** multi-seat access, custom domains, removing FixFlags attribution from non-agency accounts, white-labeling anything beyond the public report view. Team workspaces stay frozen.
- **Status:** scoped and documented here; not yet built. Needs a live dev environment (DB migration + UI + report-rendering change) to implement and verify safely — flagged as the next concrete step for whoever picks up the agency motion.

## Scans

Full catalog by rubric: [scan-catalog.md](./scan-catalog.md). Phased build plan: [scan-roadmap.md](./scan-roadmap.md).

## Feature Philosophy

- **Every feature must serve the core loop:** Flag, Fix, Re-check. If it does not fit that loop, it does not ship.
- **Re-checks are the habit.** Never gate them. A user who re-checks is a user who sees value. A user who hits a paywall on re-check is a user who churns.
- **Build for quality, not feature count.** Ship fewer things better, not more things worse.

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
