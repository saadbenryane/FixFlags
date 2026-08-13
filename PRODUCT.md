# Product

FixFlags is the independent Product Intelligence System for AI-built software. A user submits a URL and receives a Fix list across Message, Experience, and Reach, with fix prompts for their AI editor.

**Critical system architecture principle:** 
1. PiWeb (/Users/saadbenryane/Code/pi-web) is the **interface layer** used to manage agent sessions and development workflows. It is maintained via FirstMate for interface-related concerns.
2. FixFlags (/Users/saadbenryane/Code/fixflags) is the **actual product** being developed and maintained.
3. When working in PiWeb:
   - Interface/session management issues → Route through FirstMate
   - Product development work → Focus on FixFlags repository
4. All agent activity in PiWeb serves FixFlags development - there is no separate "FixedFlex" entity.

> **Note on PiWeb vs product work**: PiWeb is solely the interface layer used to manage agent sessions and is maintained by FirstMate. It is not part of the product suite. When working on PiWeb interface issues, route through FirstMate. All agent development ultimately serves the FixFlags product.

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

**Core loop:** Product Review → Fix → Verify → Watch.

This file is **shipped truth only**.

## Users and their context

- **AI-first founders and small teams** — shipping with Cursor, Claude Code, Lovable, Bolt. They move fast and discover issues after launch. Want a Product Review before sharing a link.
- **Agencies and studios** — building AI-assisted sites for clients. Need shareable reports and repo scanning.
- **Later:** Product teams using AI coding internally (once team accounts, continuous verification, and CI/CD land).

### Acquisition user: The AI builder preparing to share something real

They built with Lovable, Cursor, Replit, Bolt, Claude Code, Codex, Windsurf, v0 or a combination of tools. They may be a solo founder, product manager building an MVP, designer who now ships code, developer building a side product, or freelancer preparing a client handoff.

Their thought: "It works for me. What did I miss?"

They arrive through Product Hunt, social media, search, builder communities or a shared FixFlags result.

### One-time buyer: The builder approaching a launch, handoff or campaign

They are about to launch on Product Hunt, share publicly, start outreach, spend on acquisition, deliver work to a client, or invite the first real users.

They buy paid Deep Reviews for stronger journey coverage.

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

**Core loop:** Product Review → Fix → Verify → Watch.

**Canonical loop:** Observe → Understand → Judge → Improve → Verify → Learn ([knowledge/vision.md](./knowledge/vision.md)). A review is an observation of the Product at a moment in time; the Product is the long-term object.

**The unit of value is a verified fix.**

1. User pastes a URL.
2. Product Review runs: deterministic checks + AI review on the page.
3. User sees real evidence: "The signup button gives no visible response on mobile."
4. User creates an account to save all Flags and fix prompts.
5. User pastes fix prompts into their AI editor.
6. User ships fixes.
7. User runs an update review on the same URL (metered; uses a product review credit).
8. User sees before/after comparison and cleared Flags.
9. User upgrades to Pro or Studio for more reviews, compare, and MCP.
10. User enables product watch (Pro/Studio) for deployment-triggered regression detection.

Steps 4-10 are the differentiator. Update review plus compare is the habit loop.

### Durable Improvement cycle

- Claimed Products lazily turn the worthwhile zero-to-three Finish Plan items into durable Product-scoped Improvements.
- Equivalent Flags across Reviews link to the same Improvement by a stable Product-local fingerprint.
- An Improvement records judgment, expected benefit, recommended change, protected scope, success condition, priority, lifecycle, occurrences, and builder attempts.
- Copying an owned Flag prompt or calling `ff_mark_fix_attempted` records an Improvement Attempt instead of declaring the Flag fixed.
- Only a fresh child Update Review can record `IMPROVED`, `UNCHANGED`, `REGRESSED`, or `INCONCLUSIVE`.
- Verified Product Memory is written only from an `IMPROVED` attempt with Review and evidence provenance.
- The Product dashboard leads with Attention now and allows the honest result that nothing important requires action.
- MCP Product context and Finish Plan responses include Product Improvements; MCP and CLI update-review responses include independent verification receipts.

### Minimal Product Signals

- A Product with a completed Review can create an origin-bound browser Signal key.
- `/fixflags.js` automatically observes route transitions, uncaught error types, and Core Web Vitals.
- `FixFlags.goal(name)`, `FixFlags.outcome(name, status)`, and `FixFlags.release(version)` provide explicit named context.
- `/api/products/[id]/signals` accepts strict replay-safe batches containing only allowed signal fields.
- Routes are stored as pathnames without queries or fragments; anonymous session identifiers are hashed; input values, DOM text, identity, request bodies, and replay are not accepted.
- Raw Product Signals expire after 30 days while derived Improvements and verified learning remain.
- Product Signals remain `OBSERVED` evidence and never become Flags or confirmed causal claims automatically.

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
- A homepage URL submission immediately opens the Agent-led progressive report workspace.
- Anonymous visitors receive deterministic FixFlags Agent updates, the progressive and completed Report, all confirmed Flags, screenshots, and public-safe evidence without a blocking authentication overlay.
- Interactive Agent chat, fix prompts, Timeline playback, private history, Product Memory, update reviews, Canvas, export, and restricted sharing remain server-gated.
- Timeline stays discoverable as an inline sign-in state, and its event, URL, screenshot, and playback payload is absent from anonymous responses.
- Authentication returns through `/post-login`, verifies the signed anonymous claim, claims the review, and only then restores the same workspace.
- Anonymous API responses never expose gated prompts, and access control never persists gate copy into Flag evidence or fix fields.
- A successful claim saves the report and makes every eligible fix prompt available, including when the claim happens before triage completes.
- URLs captured on `Audit` and `Lead` for outbound (`/admin/leads`)

### Free (forever)
- 3 product reviews lifetime (claimed teaser counts as 1; full report with fix prompts)
- 1 deep review teaser (lifetime)
- Interactive report Agent with 25,000 input-plus-output tokens per calendar month
- Saved review history and authenticated Timeline playback
- CTA flow test (automated click-through with before/after screenshots)
- Preview cards (Google snippet + social link preview)
- Fix prompts tuned for Cursor, Claude Code, Lovable, Bolt
- Update reviews metered (same product review credits)

### Pro ($69/mo) — `BUILDER` in schema
- 25 product reviews and 4 deep reviews per month
- 500,000 Agent chat tokens per calendar month
- Private evidence-grounded visual Canvases with immutable versions
- Before-and-after compare
- MCP in supported builders
- CLI and MCP
- Product watch with regression email (weekly/daily on Studio)

### Studio ($199/mo) — `TEAM` in schema
- 80 product reviews and 10 deep reviews per month
- 2,000,000 Agent chat tokens per calendar month across Studio projects
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
- Public documentation at `/docs` covers the product loop, Finish List, editor setup, CLI, MCP, generated tool reference, and troubleshooting. The code-backed editor catalog is the source for homepage, footer, docs, preferences, setup, and API-key attribution. Production-smoke claims remain limited to verified integrations.
- Project-scoped Product Intelligence persistence
- Canonical `/report/[id]` workspace with identity, readiness, re-check results, and the complete ranked Flag explorer, governed by `knowledge/report-contract.md`
- Fix list with every unresolved Flag and contract-aware ranking from one shared service across web, export, MCP, CLI, re-check, and sample
- Remember strip on report when Project has verified learnings; Contract edits merge without wiping memory
- Project product watch (Pro/Studio): weekly/daily FULL re-check + regression email
- Free tools: meta preview, placeholder copy detector
- **Agent-led report workspace:** URL submission immediately opens `/report/{id}` with a title-free Agent panel and progressive Report. Persisted scan facts project into free deterministic Agent messages, confirmed Flags append once, and completion preserves the same transcript contract. Timeline is authenticated and Canvas is private to paid owners.
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
- The public `fixflags` package is available through npm trusted publishing; registry `latest` is `1.0.4`. The corrected bounded Finish Plan and explicit `--all` behavior are prepared locally as `1.0.5` and remain unshipped until the tagged trusted-publisher release and production dogfood pass
- Full `npm run verify` / `verify:release` still require a quiet tree plus designated RELEASE_* / R2 / smoke resources (see `.agents/handoffs/current-product-completion.md`)

## Launch gates

Do not launch broadly until:
- The public Product Review regularly produces a useful result
- The first evidence appears quickly
- Critical findings are highly precise
- One journey can be replayed reliably
- The fix prompt is specific enough to apply
- The re-check can prove a real before-and-after change
- The report is visually shareable
- Privacy and scope are obvious
- Paid Deep Reviews can be purchased without a sales call
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
- What re-check cadence builds the strongest Product Review → Fix → Verify → Watch habit?
- Does current Deep Review pricing optimize for conversion against alternate price points?
- Will 20% of paid Deep Review customers activate Watch for ongoing monitoring?

## Constraints

- **Core loop above all.** Every feature must serve Product Review → Fix → Verify → Watch.
- **Every feature must serve the core loop.** If it does not fit Product Review → Fix → Verify → Watch, it does not ship.
- **Update reviews are metered** like new product reviews. Product watch-triggered runs do not consume the manual credit pool.
- **Localhost and private networks are not supported.** Studio projects may store encrypted preview scan access (HTTP basic auth, cookies, headers) for public preview URLs.
- **CI/CD:** Railway deployment webhook (`/api/webhooks/railway?apiKey=...&url=...`) enqueues Product Reviews after deploy. See `docs/railway-deploy-check.md`.
