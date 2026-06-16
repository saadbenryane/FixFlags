# Offering & Product Scope

## What We Ship

- **Deterministic checks** (free forever, unlimited): metadata scanning, accessibility basics, performance data, SEO tags, trust signals, mobile viewport checks, content analysis.
- **AI review** (paid, 3 free trials): reads desktop + mobile screenshots, PageSpeed data, and deterministic flags. Outputs rubric scores, AI-generated flags, and fix prompts.
- **Fix prompts** (paid after 3): copy-ready instructions tuned for Cursor, Claude Code, Lovable, and Bolt. Each prompt includes specific evidence from the user's page.
- **Re-check loop** (free, unlimited on all plans): re-run the same URL, diff flags, show before/after comparison. This is the core habit.
- **MCP integration** (Pro+): 6 MCP tools for Cursor and Claude Code. Lovable/Bolt MCP not supported yet.

## What We Do Not Ship (Current)

- Staging / password-protected site support.
- Localhost or private network checks.
- CI/CD integration (GitHub Actions, Vercel deploy hooks). Not yet.
- Custom rubric creation.
- Team workspaces / seat management.
- API for batch scanning.
- White-label reports.

These are not planned until 100 paying users validate demand.

## Feature Philosophy

- **Zero new features until 100 paying users.** Enough product scope. What is missing is distribution, not depth.
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
