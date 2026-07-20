# Product

*Verified facts, not assumptions.*

## One-liner

FixFlags is the QA layer for AI-built products. Finish what your AI started.

## Users and their context

- **AI-first founders and small teams** — shipping with Cursor, Claude Code, Lovable, Bolt. They move fast, skip QA, and discover issues after launch. Want a quick check before sharing a link.
- **Agencies and studios** — building AI-assisted sites for clients. Need premium QA before handoff. Will pay for shareable reports.
- **Later:** Product teams using AI coding internally (once team accounts, repo scanning, CI/CD land).

## Problem

AI coding tools ship fast. Products look done before they are actually ready. Issues on the page cost signups: broken flows, weak mobile UX, slow pages, unclear CTAs, SEO gaps, accessibility problems, trust issues, conversion friction.

Existing tools (Lighthouse, PageSpeed) find technical problems but do not tell you how to fix them or give prompts your AI can use.

## Promise

Paste your site. We review the live page, show what visitors notice, and give fix prompts your builder can use.

## Core loop

Flag → Fix → Re-check.

1. User pastes a URL.
2. Deterministic checks + AI review run on the page.
3. User gets Flags with evidence, impact, and fix prompts.
4. User pastes fix prompts into their AI editor.
5. User ships fixes.
6. User re-checks the same URL (free, unlimited).
7. User sees before/after comparison and cleared Flags.

Steps 4-7 are the differentiator. Re-check is the habit.

## What we ship

### Anonymous teaser (no account)
- 1 free teaser scan: scores, rubrics, Flags, evidence, one sample fix card
- Fix prompts and prescription require signup + claim
- URLs captured on `Audit` and `Lead` for outbound (`/admin/leads`)

### Free (forever)
- 3 new URL checks lifetime (claimed teaser counts as 1; full report with fix prompts)
- CTA flow test (automated click-through with before/after screenshots)
- Preview cards (Google snippet + social link preview)
- Fix prompts tuned for Cursor, Claude Code, Lovable, Bolt
- Re-checks (free and unlimited on owned reports)

### Pro ($29/mo) — `BUILDER` in schema
- 25 new URL checks per month
- Before/after compare
- MCP integration (Cursor + Claude Code)
- Credit packs for overflow new checks

### Agency ($99/mo) — `TEAM` in schema
- 100 new URL checks per month
- Share links and exports
- 5 projects
- GitHub repo scanning (findings-only: secrets, dependency hygiene, dangerous patterns — no auto-fix PRs)
- Credit packs for overflow new checks

### High Volume (custom)
- 500+ audits

## Rubrics

Three dimensions, no more:

- **Message:** Headline clarity, audience fit, benefit hierarchy, CTA specificity, social proof, pricing confidence
- **Experience:** Layout, mobile usability, accessibility basics, Core Web Vitals, broken interactions
- **Reach:** SEO metadata, share previews, privacy/contact links, analytics setup

Each rubric: Pass / Needs Attention / Blocked, score, flags with fix prompts.

## Current capabilities (verified)

- Pipeline v2.4.0, 180s deadline per audit
- 22 deterministic check modules live; capabilities in AGENTS.md Project facts (regenerate via `npm run audit:capabilities`).
- Unit tests: run `npm run test:unit` (count measured per run; do not hardcode).
- Stuck-audit recovery (15 min timeout window, self-hosted scheduler)
- Knowledge graph Phase 1 in production
- Technology detection engine + /madewith/[hostname] pages
- Sample size gate (20 distinct sites minimum for programmatic pages)
- MCP integration (14 tools; see `lib/mcp/tools.ts` / AGENTS.md Project facts)
- Free tools: meta preview, placeholder copy detector

## Limitations and technical debt

- Regression suite covers HTML-derivable checks only; screenshot/flow/PageSpeed modules are not yet frozen into fixtures
- Route contract tests cover the primary paid endpoints (api-keys, projects); remaining API routes still lack handler-level tests
- No component tests (Touch tier at 10%)
- No staging/password-protected site support
- No localhost or private network checks
- No team workspaces or white-label reports
- Lovable/Bolt MCP not yet supported

## Launch gates

Five concrete checks from report evidence. Fix before shipping:

1. Headline names audience + outcome.
2. Primary CTA visible above fold on 375px.
3. Social preview shows branded image.
4. Privacy policy link is present.
5. Console has no errors.

## Support

- **Help Center** at `/help` — searchable guides (getting started, checks, billing, MCP, account). Content in `lib/help/`.
- **Live chat** on all non-admin pages — first-party widget; team replies in `/admin/feedback`. Typical reply within a few hours.
- **FAQ** at `/faq` — short Q&A; links into Help for deeper guides.
- **Email** `hello@fixflags.com` — privacy, terms, high-volume pricing. Not a ticket system.
- Do **not** market priority or dedicated support. High-volume is custom pricing via email only.

## Constraints

- **Core loop above all.** Every feature must serve Flag → Fix → Re-check.
- **Every feature must serve the core loop.** If it does not fit Flag → Fix → Re-check, it does not ship.
- **Re-checks are never gated.** A user who re-checks is a user who sees value.
- **No staging, localhost, or password-protected site support.**
- **No CI/CD integration yet.**

## Unresolved questions

- Is findings-only repo scanning enough to close Agency sales?
- Will free users convert to Pro before exhausting their 3 lifetime AI reports?
- What re-check cadence builds the strongest Flag → Fix → Re-check habit?
