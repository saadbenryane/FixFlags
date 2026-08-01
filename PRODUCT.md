# Product

*Verified facts about what FixFlags ships today. Not vision. Not strategy.*

**Canonical sources:**
- Product vision and strategy: `knowledge/product.md`, `knowledge/strategy.md`
- Target product requirements and shipped-vs-target gaps: `docs/product-prd.md` § shipped vs target
- Three products: `knowledge/product-system.md`
- Pricing tiers and philosophy: `knowledge/strategy.md` → Pricing
- Core loop (philosophy): `knowledge/vision.md` → Core loop
- Rubrics (philosophy): `knowledge/product.md` → Report Hierarchy
- North star (aspirational): `knowledge/vision.md`

## One-liner

FixFlags is the independent Product Intelligence System for AI-built software. Finish what your AI started.

**Core loop:** Check → Fix → Verify → Watch.

This file is **shipped truth only**.

## Users and their context

- **AI-first founders and small teams** — shipping with Cursor, Claude Code, Lovable, Bolt. They move fast and discover issues after launch. Want a quick check before sharing a link.
- **Agencies and studios** — building AI-assisted sites for clients. Need shareable reports and repo scanning.
- **Later:** Product teams using AI coding internally (once team accounts, continuous verification, and CI/CD land).

### Acquisition user: The AI builder preparing to share something real

They built with Lovable, Cursor, Replit, Bolt, Claude Code, Codex, Windsurf, v0 or a combination of tools. They may be a solo founder, product manager building an MVP, designer who now ships code, developer building a side product, or freelancer preparing a client handoff.

Their thought: "It works for me. What did I miss?"

They arrive through Product Hunt, social media, search, builder communities or a shared FixFlags result.

### One-time buyer: The builder approaching a launch, handoff or campaign

They are about to launch on Product Hunt, share publicly, start outreach, spend on acquisition, deliver work to a client, or invite the first real users.

They buy a Finish Check.

### Primary recurring buyer: The freelancer or small agency shipping repeatedly

Their money problem: manual review reduces margins, handoff problems damage trust, client-reported bugs create unplanned work, each project is built slightly differently, they need consistent evidence across projects.

They buy Studio.

### Secondary recurring buyer: The small product team shipping weekly

They need to know whether a deployment broke signup, checkout, onboarding, the core action, or an important client workflow.

They buy Watch through Pro or Team plans.

### Not the initial customer

FixFlags will not initially serve: enterprise QA departments, native mobile applications, complete test-suite replacement, regulated compliance certification, deep penetration testing, large internal enterprise systems, products requiring real-money transactions in tests, teams expecting guaranteed conversion improvement.

## Problem

AI makes a product look finished before it has been properly checked. The builder can see that the screen exists and that the happy path worked once. They do not know:

- Whether the important path still works on mobile
- Whether links and actions lead where they promise
- Whether the product explains what to do next
- Whether authentication, forms and recovery states work
- Whether a recent change reopened an old problem
- Whether a fix actually landed in production
- Which issue matters most before showing the product to people

The economic pain is not abstract "quality." It is:

- Wasted launch attention
- Paid traffic sent into a blocked experience
- Client complaints after handoff
- Unpaid rework
- Delayed launches caused by uncertainty
- Regressions introduced by rapid AI changes
- Time spent manually rechecking the same paths

FixFlags reduces that uncertainty with observable evidence.

## Promise

Paste your live URL. FixFlags tests the paths that matter, shows exactly where they fail, and gives your AI the fix. Re-check after you ship. Watch after every deploy.

## Core loop

**Core loop:** Check → Fix → Verify → Watch.

**Vision loop:** Understand → Improve → Verify → Remember ([knowledge/vision.md](./knowledge/vision.md)).

**The unit of value is a verified fix.**

1. User pastes a URL.
2. Quick Check runs: deterministic checks + AI review on the page.
3. User sees real evidence: "The signup button gives no visible response on mobile."
4. User creates an account to save all Flags and fix prompts.
5. User pastes fix prompts into their AI editor.
6. User ships fixes.
7. User runs an update review on the same URL (metered; uses a product review credit).
8. User sees before/after comparison and cleared Flags.
9. User upgrades to Pro or Studio for more reviews, compare, and MCP.
10. User enables product watch (Pro/Studio) for deployment-triggered regression detection.

Steps 4-10 are the differentiator. Update review plus compare is the habit loop.

## What we ship

### Subscription plans (shipped)

| Plan | Price | Product reviews | Deep reviews |
|------|-------|-----------------|--------------|
| **Free** | $0 | 3 lifetime | 1 teaser (lifetime) |
| **Pro** (`BUILDER`) | $69/mo | 25/month | 4/month |
| **Studio** (`TEAM`) | $199/mo | 80/month | 10/month |

Update reviews use the same product review credit pool as new URLs. Internal route `/re-check` remains for API compatibility.

Detail: `docs/business-model.md`, `lib/marketing/copy/terminology.ts`.

### First check and account claim
- A homepage URL submission immediately opens the progressive report canvas. New anonymous scans place a required sign-up or sign-in dialog over an inert report until ownership is confirmed.
- The dialog returns to the same report after email, OAuth, passkey, or two-factor authentication. Abandoning the flow returns home.
- Anonymous API responses remain redacted for access safety. They never expose gated prompts, and access control never persists gate copy into Flag evidence or fix fields.
- A successful claim saves the report and makes every eligible fix prompt available, including when the claim happens before triage completes.
- URLs captured on `Audit` and `Lead` for outbound (`/admin/leads`)

### Free (forever)
- 3 product reviews lifetime (claimed teaser counts as 1; full report with fix prompts)
- 1 deep review teaser (lifetime)
- CTA flow test (automated click-through with before/after screenshots)
- Preview cards (Google snippet + social link preview)
- Fix prompts tuned for Cursor, Claude Code, Lovable, Bolt
- Update reviews metered (same product review credits)

### Pro ($69/mo) — `BUILDER` in schema
- 25 product reviews and 4 deep reviews per month
- Before-and-after compare
- MCP in supported builders
- CLI and MCP
- Product watch with regression email (weekly/daily on Studio)

### Studio ($199/mo) — `TEAM` in schema
- 80 product reviews and 10 deep reviews per month
- Everything in Pro
- Up to 5 projects
- GitHub repository scans
- Share links for client reports

## Rubrics

Three dimensions, no more:

- **Message:** Headline clarity, audience fit, benefit hierarchy, CTA specificity, social proof, pricing confidence
- **Experience:** Layout, mobile usability, accessibility basics, Core Web Vitals, broken interactions
- **Reach:** SEO metadata, share previews, privacy/contact links, analytics setup

Each rubric: Pass / Needs Attention / Blocked, flags with fix prompts.

**Journey outcomes and evidence lead. Scores are secondary or removed until validated against real outcomes.**

## Evidence classes

- **Confirmed:** A reproducible, observable condition (broken link, failed request, form does not submit, journey assertion fails)
- **Observed:** A measurable interaction issue (repeated attempts required, empty state without guidance, no immediate feedback)
- **Suggested:** A judgment-based recommendation (headline may be too broad, trust evidence may appear too late)

## Severity levels

- **Blocker:** Must be confirmed and must prevent an agreed goal
- **High:** Must be confirmed or strongly observed and directly affect an important path
- **Medium:** Affects clarity, effort, trust or discoverability without blocking the task
- **Polish:** A lower-impact suggestion

**Rule:** An LLM-only opinion can never receive Blocker severity.

Full evidence rules: `knowledge/evidence-rules.md`.

## Current capabilities (verified)

- Pipeline v2.4.0, 180s deadline per audit
- Deterministic check capabilities are generated by `npm run audit:capabilities`.
- Unit tests: run `npm run test:unit` (count measured per run; do not hardcode).
- Stuck-audit recovery (15 min timeout window, self-hosted scheduler)
- Knowledge graph Phase 1 in production (growth graph; separate from customer Product Intelligence)
- Evidence-backed Made with profiles across reports, re-check diffs, API/CLI/MCP summaries, and access-safe `/madewith/[hostname]` pages
- Sample size gate (`MIN_SAMPLE_SIZE` in `lib/graph/queries.ts`; target 20, temporarily 3 while seeding)
- MCP integration for Cursor, Claude Code, Windsurf, Lovable, and Bolt; public tool names live in `lib/mcp/tool-manifest.ts`, register through modular handlers, and are checked by `npm run mcp:quality-gate`.
- Public documentation at `/docs` covers the product loop, Finish Plans, editor setup, CLI, MCP, generated tool reference, and troubleshooting. The code-backed editor catalog is the source for homepage, footer, docs, preferences, setup, and API-key attribution. Production-smoke claims remain limited to verified integrations.
- Project-scoped Product Intelligence persistence
- Canonical `/report/[id]` workspace with identity, readiness, re-check results, and the complete ranked Flag explorer, governed by `knowledge/report-contract.md`
- Fix list with every unresolved Flag and contract-aware ranking from one shared service across web, export, MCP, CLI, re-check, and sample
- Remember strip on report when Project has verified learnings; Contract edits merge without wiping memory
- Project product watch (Pro/Studio): weekly/daily FULL re-check + regression email
- Free tools: meta preview, placeholder copy detector
- **Live progressive report:** URL submission immediately replaces the homepage with report geometry, then history-replaces the URL with `/report/{id}`. Desktop and mobile captures resolve independently, and the final Fix list layout appends Flags as they arrive. Contract and timeline evidence stay behind "How FixFlags is checking".
- Dedicated audit worker runtime: web requests stay isolated from Playwright capture; unfinished reports use a lightweight access/status read before completed-report assembly
- **Scoped Studio sharing:** token routes render directly without making the report public; password grants are signed, HttpOnly, revocable, expiring, and metadata-safe

## Evaluation system

FixFlags must evaluate itself more rigorously than it evaluates customers.

- Seeded benchmark with at least 100 controlled web products containing known problems
- Measures: detection recall, precision, severity accuracy, goal-completion accuracy, reproduction success, fix usefulness, re-check accuracy, cost per useful Flag, cost per verified fix
- Critical Flag policy: failure must reproduce, success assertion must be explicit, evidence must be saved, finding must survive deterministic review, run must not contain known infrastructure failure
- Human calibration: regularly sample confirmed/dismissed Flags, suggestions, failed journeys
- No composite score at launch: do not lead with a 0-100 score until stable, interpretable and correlated with validated outcomes

## Limitations and technical debt

- Regression suite covers HTML plus frozen PageSpeed, network, overlay, slow-replay, and dead-end-flow outputs; screenshot pixel rendering is not yet frozen
- Route contract tests cover the critical path (checks create, api-keys, projects, scan-access, railway webhook, report status poll, re-check); remaining API routes still lack handler-level tests
- Touch-tier component tests cover progressive chrome, failure panel, empty states; full report-state matrix still expanding
- No localhost or private network checks (preview tunnels and HTTP basic auth supported on Studio projects)
- No team workspaces or white-label reports
- Deployed Lovable/Bolt connector smoke, release credential proof, and production dogfood remain open; local MCP setup and API-key auth for those builders are shipped
- The `fixflags` npm package is claimed. CLI `0.2.0-beta.1`, device authorization, credential-store login, editor init, and the public customer skill remain unshipped until the trusted-publishing release verifies the package in the registry
- Full `npm run verify` / `verify:release` still require a quiet tree plus designated RELEASE_* / R2 / smoke resources (see `.agents/handoffs/current-product-completion.md`)

## Launch gates

Do not launch broadly until:
- The public check regularly produces a useful result
- The first evidence appears quickly
- Critical findings are highly precise
- One journey can be replayed reliably
- The fix prompt is specific enough to apply
- The re-check can prove a real before-and-after change
- The report is visually shareable
- Privacy and scope are obvious
- The paid Finish Check can be purchased without a sales call
- At least ten people have already paid

Five concrete checks from report evidence. Fix before shipping:

1. Headline names audience + outcome.
2. Primary CTA visible above fold on 375px.
3. Social preview shows branded image.
4. Privacy policy link is present.
5. Console has no errors.

## Support

- **Help Center** at `/help` — billing, account, privacy, failed checks, plan questions, and human support. Product usage and technical integration guides live under `/docs`.
- **Live chat** on all non-admin pages — first-party widget; team replies in `/admin/feedback`. Typical reply within a few hours.
- **FAQ** at `/faq` — short Q&A; links into Help for deeper guides.
- **Email** `hello@fixflags.com` — privacy, terms, high-volume pricing. Not a ticket system.
- Do **not** market priority or dedicated support. High-volume is custom pricing via email only.

## Unresolved questions

- Does Studio Fix PR creation close enough sales, or do buyers still want white-label share branding?
- Will free users convert to Pro before exhausting their 3 lifetime AI reports?
- What re-check cadence builds the strongest Check → Fix → Verify → Watch habit?
- Does the $49 Finish Check price point optimize for conversion against $29 and $79 variants?
- Will 20% of Finish Check customers activate Watch for ongoing monitoring?

## Constraints

- **Core loop above all.** Every feature must serve Check → Fix → Verify → Watch.
- **Every feature must serve the core loop.** If it does not fit Check → Fix → Verify → Watch, it does not ship.
- **Update reviews are metered** like new product reviews. Product watch-triggered runs do not consume the manual credit pool.
- **Localhost and private networks are not supported.** Studio projects may store encrypted preview scan access (HTTP basic auth, cookies, headers) for public preview URLs.
- **CI/CD:** Railway deployment webhook (`/api/webhooks/railway?apiKey=...&url=...`) enqueues Launch Checks after deploy. See `docs/railway-deploy-check.md`.
