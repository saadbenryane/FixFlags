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

_Verified facts about what FixFlags ships today. Not vision. Not strategy._

**Canonical sources:**

- Product vision and strategy: `knowledge/product.md`, `knowledge/strategy.md`
- Target product requirements and shipped-vs-target gaps: `docs/product-prd.md` § shipped vs target
- Product Review and supporting surfaces: `knowledge/product-system.md`
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
- **Agencies and studios** — building AI-assisted sites for clients. Need repeatable reviews and shareable evidence.
- **Later:** Product teams using AI coding internally (once team accounts, continuous verification, and CI/CD land).

### Acquisition user: The AI builder preparing to share something real

They built with Lovable, Cursor, Replit, Bolt, Claude Code, Codex, Windsurf, v0 or a combination of tools. They may be a solo founder, product manager building an MVP, designer who now ships code, developer building a side product, or freelancer preparing a client handoff.

Their thought: "It works for me. What did I miss?"

They arrive through Product Hunt, social media, search, builder communities or a shared FixFlags result.

### Upgrade buyer: The builder approaching a launch, handoff or campaign

They are about to launch on Product Hunt, share publicly, start outreach, spend on acquisition, deliver work to a client, or invite the first real users.

They upgrade when the first review-fix-verify cycle proves useful and they need more Product Reviews for the launch or the releases that follow.

### Primary recurring buyer: The freelancer or small agency shipping repeatedly

Their money problem: manual review reduces margins, handoff problems damage trust, client-reported bugs create unplanned work, each project is built slightly differently, they need consistent evidence across projects.

They buy Studio.

### Secondary recurring buyer: The small product team shipping weekly

They need to know whether a deployment broke signup, checkout, onboarding, the core action, or an important client workflow.

They use scheduled Watch and choose a plan based on monthly review volume.

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

Paste your live URL. FixFlags tests the paths that matter, shows exactly where they fail, and gives your AI the fix. Run an update review after you ship. Keep Watch on a schedule.

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
9. User upgrades to Pro or Studio when they need more monthly reviews.
10. User enables scheduled Watch for recurring regression detection.

Steps 4-10 are the differentiator. Update review plus compare is the habit loop.

### Durable Improvement cycle

- Claimed Products lazily turn the worthwhile zero-to-three Finish Plan items into durable Product-scoped Improvements.
- Equivalent Flags across Reviews link to the same Improvement by a stable Product-local fingerprint.
- An Improvement records judgment, expected benefit, recommended change, protected scope, success condition, priority, lifecycle, occurrences, and builder attempts.
- Copying an owned Flag prompt records one idempotent `HANDOFF_COPIED` event and never declares the Flag fixed or verified.
- Marking an owned Improvement ready or calling `ff_mark_fix_attempted` records an Improvement Attempt.
- Only a fresh child Update Review can record `IMPROVED`, `UNCHANGED`, `REGRESSED`, or `INCONCLUSIVE`.
- Verified Product Memory is written only from an `IMPROVED` attempt with Review and evidence provenance.
- Raw absence is presented as “No longer observed in this review.”
- Partial or degraded child Reviews never create verified Product Memory.
- The Product workspace leads with a circular current score, chronological Review history, and `Your priorities`, while allowing the honest result that nothing important requires action.

### Minimal Product Signals

- A Product with a completed Review can create an origin-bound browser Signal key.
- `/fixflags.js` automatically observes route transitions, uncaught error types, and Core Web Vitals.
- `FixFlags.goal(name)`, `FixFlags.outcome(name, status)`, and `FixFlags.release(version)` provide explicit named context.
- `/api/products/[id]/signals` accepts strict replay-safe batches containing only allowed signal fields.
- Routes are stored as pathnames without queries or fragments; anonymous session identifiers are hashed; input values, DOM text, identity, request bodies, and replay are not accepted.
- Raw Product Signals expire after 30 days while derived Improvements and verified learning remain.
- Product Signals remain `OBSERVED` evidence and never become Flags or confirmed causal claims automatically.

## What we ship

### Plan contract

Free is available now.
Pro and Studio remain waitlist-gated while checkout stays in test mode.

| Plan                | Price  | Product reviews | Products  | Added value                                                          |
| ------------------- | ------ | --------------- | --------- | -------------------------------------------------------------------- |
| **Free**            | $0     | 3/month         | 1         | Flags, evidence, fix prompts, review changes, public report link     |
| **Pro** (`BUILDER`) | $29/mo | 30/month        | Up to 5   | Product history across releases and release comparison               |
| **Studio** (`TEAM`) | $79/mo | 90/month        | Unlimited | Scheduled reviews, shared product history, and workspace invitations |

New URLs, update reviews, and completed scheduled Watch reviews use the same monthly product review allowance.
Unused allowance does not roll over.
Internal route `/re-check` remains for API compatibility.

Detail: `docs/business-model.md`, `lib/marketing/copy/terminology.ts`.

### First check and account claim

- A homepage URL submission immediately paints the Agent-led progressive report workspace, then replaces history with `/report/[id]` once the review exists.
- If that URL already has a public scan from the last hour, the unsigned visitor sees that report instead of starting a new job. The existing scan is not attached to their anonymous cookie, and Agent conversations stay with the owner.
- Anonymous visitors receive deterministic FixFlags Agent updates, the progressive and completed Report, all confirmed Flags, screenshots, and public-safe evidence without a blocking authentication overlay.
- The live report uses the same product chrome as a signed-in completed review: brand Sign up CTA, app rail, and Agent composer. Private destinations open create-account in place. Signing in does not grant another person’s chat.
- Live anonymous reports show the same Fix Prompt and Copy chrome as an owner report. The prompt body stays empty until claim. Copy and the Fix Prompt control open create-account and never write the clipboard.
- Interactive Agent chat, prompt bodies, Timeline playback, account history, Product Memory, update reviews, Canvas, and export remain server-gated.
- The default live report route is Agent beside Report. Timeline, Preview, and Canvas stay parked on `/report/[id]` and are not loaded there.
- Timeline playback remains a shipped capability for entitled viewers off that default route. Curated samples expose only their versioned static Timeline fixtures.
- Curated samples expose exactly one demonstrated fix prompt and no aggregate Finish Plan prompt.
- Authentication returns through `/post-login`, verifies the signed anonymous claim, claims the review, and only then restores the same workspace. A claim that attaches zero reviews stays on `/post-login` with retry.
- Anonymous API responses never expose gated prompts, and access control never persists gate copy into Flag evidence or fix fields.
- A successful claim saves the report and makes every eligible fix prompt available, including when the claim happens before triage completes.
- URLs captured on `Audit` and `Lead` for outbound (`/admin/leads`)

### Free (forever)

- 3 product reviews per month (a claimed anonymous teaser counts once)
- 1 Product
- Interactive report Agent with 25,000 input-plus-output tokens per calendar month
- Saved review history and authenticated Timeline playback
- CTA flow test (automated click-through with before/after screenshots)
- Preview cards (Google snippet + social link preview)
- Fix prompts tuned for Cursor, Claude Code, Lovable, Bolt
- Review changes, public report links, Canvas, and Product Signals

### Pro ($29/mo) — `BUILDER` in schema

- 30 product reviews per month
- Up to 5 Products
- Product history across releases and release comparison
- 500,000 Agent chat tokens per calendar month

### Studio ($79/mo) — `TEAM` in schema

- 90 product reviews per month
- Unlimited Products
- Scheduled reviews
- Watch is Studio only. Free and Pro stop at manual Update review.
- Invite people to the workspace
- Unlimited workspace seats for a limited time
- Shared Product history
- 2,000,000 Agent chat tokens per calendar month across Studio projects

Workspace invitations are part of the waitlisted Studio launch contract and must ship before Studio checkout opens.

### Parked power-user infrastructure

- Repository scanning, MCP, API-key setup, and CLI customer surfaces are not part of the current public product.
- Their public UI, documentation, discovery metadata, authorization routes, and dedicated API adapters return 404 while parked.
- The underlying libraries, worker support, persistence models, and packaged CLI source remain in the repository so the power-user layer can be rebuilt after the URL-to-report wedge converts consistently.
- GitHub authentication remains available for account sign-in and is separate from parked GitHub repository access.
- Deep Review is reserved for the future repository-connected analysis offer and is not part of current plans, quotas, or checkout promises.

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
- Evidence-backed Made with profiles on owner-only Product detail pages, including update-review diffs
- Sample size gate (`MIN_SAMPLE_SIZE` in `lib/graph/queries.ts`; target 20, temporarily 3 while seeding)
- Public documentation at `/docs` covers the Product Review loop, complete Fix list, bounded Finish Plan, update reviews, and URL/report troubleshooting.
- Project-scoped Product Intelligence persistence
- Canonical `/report/[id]` workspace with identity, update-review results, the complete ranked Flag explorer, and the bounded Finish Plan, governed by `knowledge/report-contract.md`
- Fix list with every unresolved Flag and contract-aware ranking from one shared service across web, export, update review, and sample
- Remember strip and Product Contract on the signed-in Product page when the latest completed Review has them; Contract edits merge without wiping memory
- Scheduled Product Watch: recurring full review plus regression email; completed Watch reviews consume the monthly product review allowance
- **Agent-led report workspace:** URL submission immediately opens `/report/{id}` with Agent chat on the left and the progressive Report on the right. Persisted scan facts stream into the same score, ranked priority, evidence, and per-issue prompt layout. The canonical report URL exposes public evidence while Agent chat, prompts, Product Memory, account history, and owner actions remain gated.
- Dedicated audit worker runtime: web requests stay isolated from Playwright capture; unfinished reports use a lightweight access/status read before completed-report assembly
- **Public report link:** every Review exposes evidence at its canonical `/report/{id}` URL; Copy link and Email me this report live in Export, while owner-only data stays server-gated

## Evaluation system

FixFlags must evaluate itself more rigorously than it evaluates customers.

- Seeded benchmark with at least 100 controlled web products containing known problems
- Measures: detection recall, precision, severity accuracy, goal-completion accuracy, reproduction success, fix usefulness, update-review accuracy, cost per useful Flag, cost per verified fix
- Critical Flag policy: failure must reproduce, success assertion must be explicit, evidence must be saved, finding must survive deterministic review, run must not contain known infrastructure failure
- Human calibration: regularly sample confirmed/dismissed Flags, suggestions, failed journeys
- No composite score at launch: do not lead with a 0-100 score until stable, interpretable and correlated with validated outcomes

## Limitations and technical debt

- Regression suite covers HTML plus frozen PageSpeed, network, overlay, slow-replay, and dead-end-flow outputs; screenshot pixel rendering is not yet frozen
- Route contract tests cover the critical path (checks create, api-keys, projects, scan-access, railway webhook, report status poll, re-check); remaining API routes still lack handler-level tests
- Touch-tier component tests cover progressive chrome, failure panel, empty states; full report-state matrix still expanding
- No localhost, private-network, or password-only checks in the public URL experience
- No team workspaces or white-label reports
- Repository, MCP, API-key, and CLI foundations still exist internally, but every dedicated customer entry point is parked while the URL-to-report experience is the only public wedge.
- Full `npm run verify` / `verify:release` still require a quiet tree plus designated RELEASE_* / R2 / smoke resources (see `.agents/handoffs/current-product-completion.md`)

## Launch gates

Do not launch broadly until:

- The public Product Review regularly produces a useful result
- The first evidence appears quickly
- Critical findings are highly precise
- One journey can be replayed reliably
- The fix prompt is specific enough to apply
- An update review can produce a real before-and-after result and strict verification receipt
- The report is visually shareable
- Privacy and scope are obvious
- Paid Product Review capacity can be requested from the waitlist without a sales call
- At least ten people have already paid

Five concrete checks from report evidence. Fix before shipping:

1. Headline names audience + outcome.
2. Primary CTA visible above fold on 375px.
3. Social preview shows branded image.
4. Privacy policy link is present.
5. Console has no errors.

## Support

- **Help Center** at `/help` — billing, account, privacy, failed reviews, plan questions, and human support. Product Review, report, and update-review guides live under `/docs`.
- **Live chat** on all non-admin pages — first-party widget; team replies in `/admin/feedback`. Typical reply within a few hours.
- **FAQ** at `/faq` — short Q&A; links into Help for deeper guides.
- **Email** `hello@fixflags.com` — privacy, terms, high-volume pricing. Not a ticket system.
- Do **not** market priority or dedicated support. High-volume is custom pricing via email only.

## Unresolved questions

- Which monthly review threshold most reliably converts Free users to Pro?
- What update-review cadence builds the strongest Product Review → Fix → Verify → Watch habit?
- Does current Product Review pricing optimize for conversion against alternate price points?
- Will 20% of paid Product Review customers activate Watch for ongoing review?

## Constraints

- **Core loop above all.** Every feature must serve Product Review → Fix → Verify → Watch.
- **Every feature must serve the core loop.** If it does not fit Product Review → Fix → Verify → Watch, it does not ship.
- **One review allowance.** New URLs, update reviews, and completed scheduled Watch reviews use the monthly product review allowance.
- **Localhost and private networks are not supported.** Reviews require a publicly reachable URL.
- **Scheduled Watch only.** Deployment-triggered webhooks are parked with the other power-user surfaces.
