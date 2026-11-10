---
status: supporting
authority: product
reviewed_at: 2026-11-10
supersedes: []
---

# FixFlags master plan: from checked to fixed

Written November 10, 2026 at the owner's request. It brings together the [website design plan](website-design-plan.md), the [Elu product research and competitive plan](elu-product-research-and-competitive-plan.md), a firsthand audit of fixflags.com and elu.dev, one live check of fixflags.com, a review of the codebase and its documents, and competitor research. Those two plans remain the detailed references for the signature demo and the repair architecture. This document sets the order, the bets, and the bar.

This is a proposal. It changes direction in several canonical places (positioning in [the vision](../../knowledge/vision.md), the hero contract in [DESIGN.md](../../DESIGN.md), packaging in [strategy](../../knowledge/strategy.md), and the "marketing and branding remain outside this work" line in the [completion plan](../product-masterplan.md)). Each needs an owner decision, listed in [Decisions needed now](#decisions-needed-now). Public copy may still only claim shipped behavior.

## Status, November 10

On November 10 the owner asked to finish the rest of the plan. The recommended options for decisions 1, 2, 3 and 5 below (customer, differentiation, headline, hero contract) were adopted as defaults in the website and remain reversible. Everything listed as built is committed in the repository; it is live only after deploy.

**Built**

- Phase 0: homepage JavaScript reduced (homepage-only code 53 KB gzip, shared shell 165 KB) with a budget enforced in full validation; one action label and one term for fix instructions; "coming soon" collapsed; `/connect-ai` leads with what works; changelog updated; weekly scoreboard with verified fixes as the North Star; `analyze_started` records first checks.
- Phase 1: new hero with the Check, Flag, Fix, Verify sequence on the product stage; homepage sections in storyboard order; interactive sample moved to the Product page; navigation (Product, For AI builders, Pricing, Docs, Changelog); For AI builders hub and pages for Lovable, Bolt, v0, Replit, Cursor and Claude Code; comparison guide against Lighthouse; DESIGN.md hero contract and voice guide updated.
- Phase 2: "Fix this first" card; visitor actions ranked above speed metrics; Verified receipt with time to fix; "Where did you build this site?" question; builder-aware handoff hint; live "what we're trying" status; outcome-led summary email subjects; Integrations folded into Settings; finding-quality review tool (`npm run quality:review`); anonymous key-page depth behind `ANONYMOUS_REVIEW_DEPTH` (off until cost is measured).
- Phase 3: generic deploy hook (`/api/webhooks/deploy`) for any host or CI, with docs; read-only keys can no longer start deployment runs; "Open in Cursor" through its documented local deeplink.
- Phase 4: free broken link checker; guides for a checkout broken by a deploy and an AI-built site launch.
- Phase 5: measured cost per check and per active Site on admin analytics.

**Owner decisions, November 10 (evening)**

- Operating model: no eight-week tracks or capacity split. Do the work now.
- Concierge repair pilot: not now. The priority is an app where every advertised feature, and every feature needed to compete, works.
- Signup gate: anyone can enter a URL and start a check without an account; seeing the results requires signing in or signing up. This replaces the fix gate experiment. Free accounts get every feature.
- Pricing: paid plans stay "Coming soon". Free is the lead engine. Uptime probes run every ten minutes instead of five to bound load, and rechecks stay unlimited.

**Needs the owner or real people**

- MCP discovery after actual-client acceptance (decision 6).
- Customer conversations, design partners, usability sessions, the weekly finding-quality labeling, the Lovable and Vercel marketplace applications, launch week, community presence and founding-member payments.
- Turning on `ANONYMOUS_REVIEW_DEPTH=2` after reviewing measured cost; lowering the JavaScript budget after the shell is slimmed.
- Phase 6 hosted repair starts from concierge data, by this plan's own order. Phase 7 is 2027.

### Completeness audit, November 10

A second pass compared every public and in-product surface against the adopted vocabulary and the shipped code.

**Fixed in this pass**

- One loop everywhere. `PRODUCT_STORY.loop` (Check, Flag, Fix, Verify) now names the steps on the homepage sequence, the Product page and For AI builders. The duplicate three-step list (with "Find" in place of Flag) left the homepage.
- Pricing stopped understating shipped work. Checks after every deploy are marked included, and the FAQ links to the deploy hook docs. "Look after your website" is gone.
- In-product words. Status, progress and timeline labels say Check, Checking, Prioritizing Flags and Recheck instead of Analysis, Analyzing, AI review, Funnel review and Update review. The legacy report pages, emails, plan-limit notices and public docs use the same words. The copy guard no longer bans "recheck", which the voice guide adopts.
- The sample page uses the board's customer headline ("The main button is off-screen on phones") and states the change once, inside the fix instructions.
- Removed 16 unused components and 11 unused copy exports. Three analytics events were satisfied only by an unmounted tracker, so they are now marked retired.

**Completed after the audit**

1. `/report` is retired from new paths. The checks API, re-check API, MCP outcomes and CLI return `siteUrl` only, and the CLI says recheck. `/report` sends any owner, including a signed-out owner with a provisional Site, to the Site board. Repair briefs and Site emails link the source check to the Site timeline. The progressive report workspace, chat panel, explorer and repo-scan UI were reachable only from each other and are removed.
2. The eleven redirect-only page folders are gone. Their public addresses redirect from `next.config.ts`, and `/partners` now redirects to For agencies.
3. Inferred Outcomes can be confirmed. Owners get the confirm control on the Outcome detail page. The Safe Form fixture editor was superseded by automatic account checks and is removed; fixture APIs keep their contracts.
4. "Coming soon" appears once per surface on Integrations, the connect pages, `/connect-ai`, the provider guides, docs and help. Pricing and the homepage belong to the redesign session.
5. The fix-check action is Recheck everywhere. Outcome verification keeps "Check now" because it checks an Outcome, not a fix. The voice guide itself keeps Monitoring as the name for scheduled execution and defines a Flag as a problem, so that wording stays.
6. `/compare` (Elu, Lighthouse and PageSpeed Insights, uptime monitors, Checkly, each sourced and checked November 10), `/for-agencies` (what works today, with the one-website beta limit stated once) and `/tools` are live in the sitemap, llms.txt and the footer.
7. Fix instructions lead with the change where the check records the problem itself (positive tabindex, tap targets, titles, missing analytics, overlong opening headings). Contextual observations keep their conditional inspection on purpose: `prescription-policy` requires it because a recorded position or phrase does not establish a failure, and leading with a change would claim one.

8. Terms and Privacy match the product. They said a URL could be analyzed without an account; they now say anyone can start a check without one, and seeing results, saving the Site, rechecking and watching require signing in. "Analyze" became "check", both pages show November 2026, and no obligations changed. Have counsel read the two changed sentences before the next legal review.
9. Every advertised feature was audited against its code path and tests. Checkout entry, Recheck, scheduled watch, ten-minute uptime, regression and recovery emails, the deploy hook, GitHub, per-tool fix instructions and the free tools are backed. MCP, the CLI and the planned integrations are gated and say so. Four gaps were closed:
   - Signup monitoring had no customer path after the fixture editor was removed, because automatic account checks are off in production. The editor is back in Site Settings and the Outcome confirm control offers Signup with an authorized fixture.
   - Automatic account checks were presented as current. They are now labelled coming soon on the homepage, the coverage list and the docs.
   - Docs and the FAQ implied anonymous results were visible. They now match the results gate, and the first free check is described as the homepage.
   - The deploy hook needs an API key, but nothing in the app linked to API keys. Site Settings now does.

**Still needs the owner**

The first-check walk on real infrastructure. On November 10 the local walk reached the provisional Site board and the signup gate: the check was created (201) and the board showed progress and the gate. The worker then failed because the local database lacks nine migrations (`audits.prescriptionHandoffRetryAt`, `email_provider_events.discardedAt` and `uptime_incidents.tlsFailureOrigin` are missing). The agent's permission check blocks `npm run db:deploy`. Run it, start `npm run worker`, then walk sign-up → board → Flag → fix instructions → Recheck on desktop and phone. Production configuration (Resend, storage, PageSpeed keys) is outside the code and was not verified.

## The short version

1. **We are not losing to Elu's product. We are losing on conviction and distribution.** Elu ships a confident story, a one-command install, proof signals and a sales motion. FixFlags has a fast, real, installation-free product that almost nobody sees, explained by a website that sells gentle "website care".
2. **Our current pitch is already a commodity.** "Scan a URL, get a fix prompt, rescan" is offered by at least five small 2026 products, one from $15 a month. We must lead with what they cannot do: check that real visitor journeys (checkout, signup, add to cart) work on the live site, and give an independent, recorded verdict on every fix.
3. **Pick one customer: people shipping websites with AI builders and coding agents.** They deploy constantly, they break things they cannot see, they have no QA, and they already live in the tools our fix instructions target. Builders test the preview before publish; nobody watches production after. Elu targets product teams with traffic and a demo budget. We do not need to fight on its ground.
4. **Pick one promise: find what's broken, hand your AI the fix, prove it worked.** Every page, screen and email tells that story with real evidence.
5. **Rebuild the brand and website around the product itself,** with one signature animated story (Check, Flag, Fix, Verify) and a homepage fast enough to pass our own check. Today it fails it.
6. **Put the fix loop inside developer tools now** (MCP and CLI for Claude Code and Cursor, checks after every deploy, a Lovable integration), and **prove hosted repair by hand** with design partners before building the sandbox.
7. **Launch loudly, price for indie builders, charge sooner, and measure one number:** verified fixes per week.
8. **Change how we work.** Keep the evidence rigor for product truth. Stop letting it gate the story, the design and the conversations with customers.

## The honest diagnosis

### What is genuinely strong

I ran a real check on fixflags.com from the homepage while signed out. The board appeared instantly, the first Flags arrived in about 25 seconds, and the check finished in about 60 seconds, with a screenshot, detected tools (Next.js, Cloudflare, Railway, Google Analytics), six Flags and copy actions. No install, no tag, no traffic needed, no signup until the fix instructions. That time to first value is a weapon. Elu needs a CLI install, a tracking tag in production, real users to fail, and in practice a demo call.

The foundations underneath are also real: persistent Sites, evidence-bound Flags, a single repair brief shared by copy, email and MCP, independent rechecks with Verified, Still open, Regressed and Couldn't verify, scheduled monitoring and uptime, and an MCP server and CLI that already exist.

### What is holding us back

| Problem | Evidence observed November 10 | Why it matters |
| --- | --- | --- |
| Almost nobody sees the product | 45 GA users, 48 sessions and 5 search clicks across September 15 to October 12 ([metrics baseline](metrics.md)). Meanwhile 268 commits in the last 30 days, 1,029 in total. | Effort is going into proof of correctness, not into people using it. |
| The company runs on process, not momentum | About 160 internal documents (roughly 317,000 words), 647 acceptance obligations in the completion ledger, 65 copy files. Changelog last updated October 11. | Every change pays a heavy tax. The public sees a product that looks quiet. |
| The identity is split | Vision: "The independent monitor for software that acts." Homepage: "Your website is live. Is everything working?" Pricing: "Look after your website." Final CTA: "Give your website a little care." Connect page: "Your AI fixes. FixFlags checks." | Five promises means no promise. Visitors cannot repeat what we do. |
| The website sells the wrong thing to the wrong person | The hero reads like an uptime monitor for small business owners. Half the hero is a glass F render that says nothing about the product. The real edge (AI fix handoff and independent verification) appears in section four. | Developers and AI builders bounce before the part made for them. |
| Our homepage fails our own check | FixFlags flagged its own homepage: mobile Largest Contentful Paint 6.74s against a 2.5s target. The homepage loads about 1.3 MB of JavaScript (about 440 KB compressed) across 44 script requests, and the interactive sample dashboard is most of the homepage's own share. Blank boxes seen in our own audit screenshots were lazy-loaded images that had not loaded yet when the screenshot ran; real visitors see them. | A website-quality product with a slow homepage undercuts every claim. |
| Too much "coming soon" | 9 of 10 integrations are planned, both paid plans are waitlist-only, MCP is built but hidden while `/connect-ai` leads with "coming soon". | It reads as unfinished. Elu shows a full integration wall and a "Book a demo" button. |
| In-product language hedges at the moment of truth | "Expected: PageSpeed Insights mobile LCP should be under 2.5s." Explanations ending in "visitor understanding was not measured." The same action is called "fix instructions" and "fix prompt". Public terms drift between Flag, Finding, Outcome, Check, Review, Analyze and Audit. | Honesty belongs in the details. The headline of a Flag must be plain, specific and confident. |
| Findings skew generic | On fixflags.com, 5 of 6 Flags were performance metrics and only 1 page was checked. | Generic performance Flags feel like a Lighthouse wrapper, and they are exactly what the $15 clones also produce. The Flags that sell are broken journeys: a cart that does not add, a pricing page that 404s, a signup that errors, a button hidden on mobile. |
| Our strongest capability is invisible | Checkout and Safe Signup execution exist locally, but the homepage leads with uptime and load times. | Real journey checks are the clearest gap in the market (see below). |
| Duplicate and leftover surfaces | `/report/[id]` beside `/sites/[id]`, about 14 redirect or 404 routes, unused homepage copy blocks, two demo surfaces plus the sample page. | Confuses visitors, search engines and every future contributor. |

The pattern is clear. The team has built a careful product and then hidden it behind caution: caution in copy, caution in launch, caution in pricing, caution in what the website dares to show. The next phase is about turning that care into visible confidence without giving up honesty.

## Where we win

### The competitive map

Research on November 10, 2026. Prices and claims change. Re-verify any line before it enters public copy. Lines marked *unverified* rest on self-reported or conflicting sources.

**The uncomfortable finding: "scan a URL, get a fix prompt, rescan" is already table stakes.** At least five small products launched in 2026 with almost the same pitch, several cheaper than our planned prices. None shows meaningful traction yet. Elu is the loudest competitor, but the clones set the price anchor and the incumbents set the ceiling.

| Group | Players | What they do | Price signal | Threat to us |
| --- | --- | --- | --- | --- |
| Direct clones | [DevScan AI](https://devscanai.com/pricing), [Vibe App Scanner](https://www.vibeappscanner.com/), [uberqa](https://uberqa.pages.dev/), [PageLens AI](https://pagelensai.com), [Outbound Autonomy](https://dev.to/webperfdev/we-just-shipped-ai-ready-fix-prompts-paste-our-audit-results-into-cursor-claude-or-bolt-kc) | URL scan of links, security, speed, accessibility; fix prompts for Cursor, Claude Code, Lovable; rescan; some monitoring; some MCP | DevScan Starter $15/mo (3 sites, daily), Pro $39. VAS $29 to $49. uberqa $99 to $499 with human review. PageLens $9 one-time. | High on price and message. Low on traction so far (PageLens had 1 Product Hunt upvote). |
| Behavior intelligence that opens PRs | [Elu](https://elu.dev/), [PostHog self-driving](https://posthog.com/blog/session-replays-opening-pull-requests), [LogRocket Galileo](https://logrocket.com/products/ai-issues) | Watch real sessions, raise issues, draft PRs or dispatch coding agents | Elu demo-led, no public prices; claims $329K ARR in 12 weeks and 800+ companies ([self-reported](https://www.arr.club/elu/elu-hit-329k-arr-12-weeks-a16z-speedrun), unverified). PostHog available to everyone since July 2026. | Medium. Needs install and traffic, targets product teams. PostHog is the incumbent version of Elu's idea. |
| Bug-fix agents | [Sentry Seer](https://docs.sentry.io/product/ai-in-sentry/seer.md), [Cursor Bugbot](https://cursor.com/bugbot), Claude Code with [Chrome](https://code.claude.com/docs/en/chrome) | Root cause and PRs from errors; PR review; agents that test their own change in a local browser | Seer $40 per contributor/mo; Bugbot about $1 to $1.50 per review | Medium. Coding agents can now check their own work locally, so "we recheck" alone is weak. |
| AI QA agents | [QA Wolf](https://www.qawolf.com/pricing), [Momentic](https://momentic.ai/pricing), [Checksum](https://checksum.ai/), [Meticulous](https://www.meticulous.ai/), [Spur](https://www.spurtest.com/), [BugBug](https://bugbug.io/pricing/) | Generate and maintain end-to-end tests; mostly sales-led | QA Wolf about $1,083/mo for 50 daily tests; Momentic Scale $500/mo | Low for our ICP. They own tests, not live-site fixes. Octomind [shut down](https://bug0.com/knowledge-base/octomind-pricing) in May 2026. |
| Synthetic monitoring | [Checkly](https://www.checklyhq.com/), [Better Stack](https://betterstack.com/pricing), [UptimeRobot](https://uptimerobot.com/pricing/), Datadog | Uptime and scripted browser checks; Checkly and Better Stack add MCP and AI root cause | UptimeRobot Solo $10/mo; Checkly Starter $24/mo | Medium as the "uptime" price anchor. They do not find unknown problems or write fixes. |
| Site audit | [Ahrefs Webmaster Tools](https://ahrefs.com/webmaster-tools/), [Screaming Frog](https://www.screamingfrog.co.uk/seo-spider/pricing/) | Large crawls, SEO issues with fix instructions | Ahrefs free for verified sites; Screaming Frog £199/yr | Low to medium for search Flags. Free and deep. Do not compete as an SEO tool. |
| AI builders themselves | [Lovable](https://lovable.dev/blog/how-lovable-protects-your-apps-automatically), [Replit](https://docs.replit.com/features/agent/app-testing), v0, Bolt | Security scan on publish (Lovable), agent browser testing against the preview (Lovable, Replit) | Bundled | Medium and rising. But they test the preview before publish. [Lovable's browser testing](https://docs.lovable.dev/features/browser-testing) runs against the preview, not the published site, and nobody in this group watches production afterwards. |

**White space that survives scrutiny:**

1. **Real visitor journeys on the live site, with no tests to write.** None of the clones checks that checkout, signup or add to cart actually work. The tools that do (QA Wolf, Momentic) are sales-led and cost hundreds a month. FixFlags already has Checkout and Safe Signup execution locally. "Your signup broke last night and we caught it" is the strongest story available.
2. **Independent, production, recorded verification.** Everyone stops at a draft PR or a rescan, and coding agents now check their own change locally. The defensible version is a third-party verdict against the live production site, with before and after evidence, a timestamp and history. That is a receipt, not a rescan.
3. **Watching production after launch for AI-built sites.** Builders check the preview at publish time. Nobody watches what happens after, across deploys, and reopens a Flag when a regression ships.
4. **Agent-native, but as a given, not a headline.** MCP is now expected (VAS, uberqa, Checkly, Momentic and BugBug have it). We need it to qualify, not to differentiate.

**Patterns from the best developer websites:** the product is the hero (Linear's issue mockup with an agent action, Cursor's simulated interactive UI); an animated terminal story of the core loop ([Checkly](https://www.checklyhq.com/): Claude Code writes a check, runs it, deploys it); try before signup ([Vercel](https://vercel.com) temporary deploys); agent-readable sites ([Resend](https://resend.com) llms index, Vercel's agent onboarding); a visible changelog cadence; a proof library of real catches (Spur's "Bug Book"); and transparent self-serve pricing, which wins indie buyers while demo-only pages signal enterprise.

### Our position

**Elu watches your users struggle, then helps you fix it. The scanners hand you a list. FixFlags tries your site like a real visitor, catches what's broken before your users do, hands your AI the fix, and proves it worked on the live site.**

| | Elu and session tools | URL scanners ($9 to $49) | Coding agent checking itself | FixFlags |
| --- | --- | --- | --- | --- |
| Starts with | CLI install, tracking tag, real traffic, often a demo | A URL | Your repo and a local browser | A URL. About a minute. No install. |
| Finds | Behavioral friction from real sessions | Page-level issues: links, headers, speed, accessibility | Whatever it thinks to test, before deploy | Page issues plus real journeys (add to cart, checkout entry, signup, navigation, mobile layout) on the live site |
| Works on launch day | No (needs users first) | Yes | Yes, locally | Yes, in production |
| Fix | Proposed PRs | Fix prompts | Writes the code | Fix instructions for any AI tool today, MCP and CLI next, prepared PRs after |
| Proof | Its own system judges | "Not detected anymore" | Marks its own homework | Independent recheck of the same page and action on the live site, recorded with before and after |
| After launch | Watches sessions | Some schedule rescans | Nothing | Scheduled checks, uptime, checks after deploy, Flags reopen on regression |

The defensible combination is **real visitor journeys checked on the live site, with no tests to write, plus an independent, recorded verdict on every fix.** A coding agent should never mark its own homework, and "not detected anymore" is not proof. That idea is simple enough to put on a billboard and true enough to survive scrutiny. Fix prompts, rescans and MCP are table stakes we must match, not the story.

### Who we serve first

| Segment | Why now | What they need from us |
| --- | --- | --- |
| **Primary: people shipping with AI builders and coding agents** (Lovable, Bolt, v0, Replit, Cursor, Claude Code, Windsurf, Codex) | Huge and growing, deploy many times a day, no QA function, already think in prompts | A check in a minute, fix instructions shaped for their tool, a check after every deploy, proof it's fixed |
| **Secondary: small agencies and freelancers maintaining client sites** | Many sites each, client reporting is painful, pay for tools that make them look good | Multi-site board, client-ready reports, alerts before the client notices |
| **Later: product teams with traffic** | Elu's home turf | Impact ranking from analytics connections, outcome monitoring for checkout and signup |

Shopify owners remain reachable through the same Site experience. They are not a separate brand or homepage.

### The promise and the words

Recommended product line: **Find what's broken. Hand your AI the fix. Prove it worked.**

Homepage headline options (exact wording is the owner's call):

1. **Your AI built it. FixFlags makes sure it works.** (recommended: names the customer, the moment, and the job)
2. Ship fast. We'll catch what broke.
3. Know your site works. Before your visitors find out.

Supporting line draft: "Paste your URL. FixFlags tries your pages, buttons and checkout like a real visitor, gives you the exact fix for Cursor, Claude Code or Lovable, and proves it worked on your live site." The journey claim must match what ships by default (Phase 2), and any "about a minute" claim needs a measured median first.

Message pillars, in this order everywhere:

1. **Tries your site like a real visitor.** Add to cart, sign up, open the menu on a phone. No tests to write, no install.
2. **Real evidence.** A real browser, the actual page, the actual response. Not opinions.
3. **Ready for your AI.** Fix instructions shaped for the tool you build with.
4. **Proof, not promises.** We recheck the same page and action on your live site and keep the before and after.
5. **Every deploy, watched.** Scheduled checks, uptime, and checks after you ship. A regression reopens the Flag.

The long-term company thesis ("the independent monitor for software that acts") stays as the vision. It is not homepage copy.

## The plan at a glance

Weeks are targets for sequencing, not promises. Phases overlap on purpose.

| Phase | Weeks | Goal | Exit signal |
| --- | --- | --- | --- |
| 0. Reset | 1 to 2 | Decide, stop the leaks, measure, start talking to customers | Decisions recorded, funnel baseline live, homepage passes our own check, 20 conversations booked |
| 1. Brand and website | 1 to 6 | A website that makes a developer say "I get it" in five seconds | New homepage and signature demo live, core pages rebuilt, mobile LCP under 2.0s |
| 2. First run and app | 2 to 8 | The first check feels like magic and leads to a fix | Meaningful-Flag rate and signup rate above baseline, first verified fixes by real users |
| 3. Fix loop in developer tools | 3 to 10 | Our evidence lives where the code changes | MCP and CLI live for Claude Code and Cursor, checks after deploy, 10 concierge repairs done |
| 4. Launch and distribution | 6 to 12 | Get seen, repeatedly | Launch week shipped, three repeatable channels producing checks every week |
| 5. Revenue | 8 to 14 | Prove people pay | First paying customers and measured cost per Site |
| 6. Hosted repair | 10 to 24 | FixFlags prepares the PR, then verifies it live | Prepared repair for one or two failure families with measured success and cost |
| 7. Moat | 2027 | Make the loop hard to copy | Deploy-native, agent-native, data-informed, trusted |

## Phase 0: Reset (weeks 1 to 2)

**Goal:** make the decisions that unblock everything, fix the embarrassing things, and start measuring and listening.

### Operating model

Run two tracks with different review bars.

| Track | Covers | Bar |
| --- | --- | --- |
| **Truth** | Detection, evidence, verification, security, billing, tenant access | Keep the current rigor. [SECURITY.md](../../SECURITY.md), the evidence rules and focused checks still apply. |
| **Story and growth** | Brand, website, copy, onboarding presentation, content, launch, pricing experiments | Ship weekly. One review question: does it claim only what [PRODUCT.md](../../PRODUCT.md) says is shipped? Plus accessibility basics, performance budget and no fabricated proof. No acceptance ledger entries. |

Rules for the next eight weeks:

- Roughly half of build capacity goes to Phases 1 to 4. Truth work focuses on the detection quality and MCP acceptance those phases depend on.
- No new governance or planning documents unless they replace an existing one. This plan should let several others be marked historical.
- A weekly public changelog entry, every week, even when small.
- The founder spends at least five hours a week with users or prospects.

### Stop the leaks (all small, all this week)

1. Make the homepage pass our own check: render the sample dashboard statically and hydrate only on interaction, move the hero render off the critical path, and set a homepage JavaScript budget (under 200 KB compressed for the first view). Target mobile LCP under 2.0s, CLS under 0.05.
2. Blank images and the consent banner. Checked November 10: the blank sample capture and logo plates came from the audit's own browser screenshots taken before lazy images loaded. Product captures record the viewport only, so customer captures are not affected. The consent banner was checked at 375x667 and does not cover the primary action. Done.
3. `/roast` stays as an unlinked, noindex tool and can join the free tools in Phase 4. `/demo` and `/demo/v1` are already blocked in robots.txt, and `/demo` is noindex; `/demo/v1` keeps `index` on purpose as the improved scanner fixture. Done.
4. Collapse "coming soon" integrations into one quiet line. Show only what works.
5. Stop pitching MCP on `/connect-ai` until it ships, or ship it (Phase 3).
6. Unify the primary action label ("Check your site" or the owner's pick) and the term for fix instructions everywhere.
7. Update the changelog with everything shipped since October 11.

### Measure the funnel

Instrument one server-side funnel, keyed by an anonymous journey and then the Site, separate from consented web analytics:

`url_submitted` → `first_flag_shown` (with seconds) → `check_complete` → `flag_opened` → `signup_started` → `site_claimed` → `fix_viewed` → `fix_copied` → `recheck_requested` → `verified_fixed` → `watch_active_day_7` → `returned_day_7`

Also record the builder tool a person says they use, and the referrer. Establish a two-week baseline before setting targets. Keep sample interactions separate from real product events.

### Talk to customers

Book 20 conversations in two weeks with people shipping on Lovable, Bolt, v0, Replit, Cursor and Claude Code, plus five agencies. Run a real check on their site live on the call. Learn: what broke on them recently, how they found out, what they did, what they would pay to never be surprised again, and whether they would let FixFlags open a PR. Recruit ten design partners for the concierge repair pilot (Phase 3).

**Exit:** decisions recorded, leaks fixed, baseline collecting, conversations underway.

## Phase 1: Brand and website (weeks 1 to 6)

**Goal:** in five seconds a developer knows what FixFlags does, believes it, and wants to try it on their own site.

### Brand: from "website care" to "evidence you can act on"

Keep: the folded-F mark, Flag Orange, Inter, Inter Tight and JetBrains Mono, the calm and honest character from [SOUL.md](../../SOUL.md).

Change:

- **Personality.** From a gentle caretaker to a sharp, calm engineer friend who shows you the receipt. Short sentences. Specific nouns. No cute filler ("a little care").
- **Visual language: the evidence is the art.** Real captures of real pages, cropped tight, with an orange Flag marker landing exactly where the failure is. Editor and terminal close-ups where the fix goes. Before and after side by side. No abstract renders in the hero.
- **Brand devices.**
  - *The Flag marker:* the folded F becomes a small flag that plants on the failing element.
  - *The Verified receipt:* a compact, stamp-like confirmation (page, action, before, after, time) that people want to screenshot and share.
  - *The product stage:* a deep ink surface that frames product close-ups on a light page, so the product glows without decorative effects. Tonal surfaces only, no line separators, per [DESIGN.md](../../DESIGN.md).
- **The glass F render** moves to brand moments (Open Graph images, the final call to action, social), not the hero.
- **Voice rules.** Lead with the finding, put the limits in the details. Flag titles say what a visitor cannot do ("Add to cart does nothing on mobile"), not what a metric did. Technical depth (LCP, response codes, selectors) lives one click down.
- **One vocabulary.** Site, Check, Flag, Fix instructions, Recheck, Verified, Watch. Retire Audit, Review, Analyze, Finding and Outcome from public copy. Update [voice and copy](../voice-and-copy.md) and `lib/marketing/copy/` together.

Deliverables: a one-page brand brief, an updated voice guide, a motion spec, Flag marker and Verified receipt assets, product-shot guidelines, and a DESIGN.md update for the new hero contract.

### Information architecture

Navigation: **Product**, **For AI builders**, **Pricing**, **Docs**, **Changelog**, then Sign in and the primary button.

| Page | Purpose | Replaces |
| --- | --- | --- |
| Home | The story in one scroll | Current home |
| Product | Everything it checks, the full interactive sample, how verification works | How it works, Coverage, Samples |
| For AI builders | One hub plus a page per tool (Lovable, Bolt, v0, Replit, Cursor, Claude Code) with tool-specific fix examples | Use cases (founders) |
| For agencies | Multi-site, client reports, alerts | Use cases (agencies) |
| Pricing | Clear plans, honest beta terms | Current pricing |
| Security and data | What we collect, what we never collect, repository permissions, AI processing, retention, deletion | Privacy and security |
| Compare | Honest, sourced pages: vs Elu, vs Lighthouse and PageSpeed, vs uptime monitors, vs Checkly | New |
| Changelog | Weekly proof of momentum | Current, revived |
| Docs | Getting started, fix workflows per tool, MCP and CLI when live | Current |
| Free tools | Small single-purpose checkers that feed into a full check | Meta preview, placeholder detector, new ones in Phase 4 |

### Homepage storyboard

1. **Hero.** Headline, one supporting line, the URL field, and under it: "No install. No signup to start." Beside or beneath it, the **signature sequence** on a sample store with a broken cart, about 15 seconds, on the product stage:
   - *Check:* the page loads in a browser frame, a cursor clicks Add to cart.
   - *Flag:* nothing happens. The Flag marker drops on the button. A Flag card unfolds: what happened, what should happen, the evidence.
   - *Fix:* the fix instructions slide into a Claude Code terminal or Cursor chat. Copy.
   - *Verify:* a new check runs, the cart works, the Verified receipt stamps in.
   Pausable, replayable, each scene inspectable, labeled as sample data. Reduced motion shows the four scenes as a still stepper. This follows the [website design plan](website-design-plan.md) storyboard.
2. **What it catches.** Six real Flag cards with real captures: a broken cart, a pricing page returning 404, a button hidden under a mobile banner, a signup form that errors, a missing link preview, a slow mobile load. Use our own demo sites or permissioned real sites, labeled.
3. **Built for your AI.** Tabs for Claude Code, Cursor, Lovable, Bolt and Codex showing the same Flag's fix instructions in that tool's frame. One copy button. When MCP ships: `npx fixflags` and an agent asking FixFlags to verify.
4. **Proof, not promises.** Before and after with the Verified receipt. Two sentences: the tool that made the change never certifies it, and "not detected anymore" is not proof. FixFlags gives you a receipt, not a rescan.
5. **Every deploy, watched.** Scheduled checks, uptime, email alerts, and checks after deploy once shipped. The sample email stays.
6. **How we compare.** A short honest table: not a score report, not session replay, not just uptime.
7. **Pricing preview, FAQ, final call to action** with the URL field and the glass F as the closing brand moment.

The full interactive dashboard moves to the Product page and loads lazily.

### Craft bar

Learn from the best developer sites of the last two years (see the competitive section): product as hero, real UI instead of illustration, one strong idea per section, fast pages, a visible changelog. Concretely:

- Mobile LCP under 2.0s, CLS under 0.05, INP under 200ms on the homepage. A JavaScript budget enforced in CI for marketing routes.
- One coordinated motion sequence. Supporting transitions only for state. Reduced-motion parity. Keyboard access. 44px targets. Both themes.
- Prototype the signature sequence first (weeks 1 to 2), review it on a phone and a laptop, then build the rest of the page to its standard.

**Exit:** new homepage, Product, For AI builders hub with at least three tool pages, Pricing, Security and data, and Changelog live. Homepage passes our own check. Five unprompted viewers can explain what FixFlags does after ten seconds.

## Phase 2: First run and app experience (weeks 2 to 8)

**Goal:** the first check produces at least one Flag a person cares about, and leads them to fix it and see it verified.

### The results moment

- **Lead with the one thing that matters most.** A "Top problem" card: the capture cropped to the failing element with the Flag marker, one sentence on what visitors experience, and the fix action. Then the rest, grouped.
- **One summary sentence in one place**, for example "We checked 14 pages and 3 visitor journeys. 2 things are broken and 4 could be better." Counts appear once, per [DESIGN.md](../../DESIGN.md).
- **Stream with intent.** As the check runs, show what is being tried ("Opening pricing", "Trying Add to cart on mobile"), so the minute feels like work being done for you.
- **Write Flags for people.** Title says what a visitor cannot do. Expected behavior in plain words. Metrics and selectors in details.

### Detection that sells

The website amplifies whatever the product finds. Noisy or generic Flags would now reach more people faster. So:

- **Make journeys the headline category.** This is the clearest gap in the market. Bring the locally proven Checkout and Safe Signup execution, plus add to cart, primary call to action, navigation and mobile menu checks, into the default first check as far as safety allows (no real orders, no real accounts without the owner's authorization). Name the category plainly on the board: "Visitor journeys".
- **Check more than one page by default.** Discover key pages (home, pricing, signup, cart, top navigation targets) within the existing bounded execution. The scanners we compete with check 10 or more pages on their free tier.
- **Rank journey failures above metrics.** A broken action outranks a slow image.
- **Run a weekly finding-quality review.** Sample 50 real checks, label each Flag useful, noisy or wrong, and remove or retune noisy checks. Target 90% or better precision on high-priority Flags before launch week. This builds on V3 in the [completion plan](../product-masterplan.md) and makes it customer-facing.
- **Know the tool.** Detected stack already appears (Next.js, Cloudflare, and so on). Add builder detection (Lovable, Bolt, v0, Replit, Framer, Webflow) and shape fix instructions for it.

### Signup and the fix gate

Test two versions: today's gate (sign up to see fix instructions) against "the top Flag's full fix instructions are free, the rest and monitoring need an account". Measure claim rate and verified fixes, not just signups. One-click Google and GitHub stay in place. After signup ask one question: "Where did you build this site?"

### The verify moment

When a recheck confirms a fix, make it an event: the Verified receipt, a short "fixed in 14 minutes" line, and an optional shareable link with before and after. Offer a small "Checked by FixFlags" badge for sites with no open high-priority Flags, only if it can stay truthful as the site changes. These are the product's natural word of mouth.

### The app

- Keep Overview, Pages, Timeline and Settings. Fold Integrations into Settings until there is more than one live integration. Keep Help in the account rail.
- Send new users to the Site experience only. Retire `/report` for new checks once compatibility allows.
- A weekly email: "All clear on 14 pages" or "1 new Flag", with one action.
- Run five-person usability sessions every two weeks with real tasks (find the important problem, fix it, confirm it's fixed, leave monitoring on).

**Exit:** baseline beaten on meaningful-Flag rate, URL to claim, and claim to fix copied. First verified fixes by real outside users recorded.

## Phase 3: The fix loop inside developer tools (weeks 3 to 10)

**Goal:** our evidence lives where the code changes, and FixFlags checks every deploy.

1. **Ship MCP and the CLI for Claude Code and Cursor.** The server, tools, keys, device authorization and CLI exist. The blocking gate is actual-client acceptance. Do that for these two clients now and open discovery. Product shape:
   - `npx fixflags init` connects the agent and the Site.
   - The agent can list open Flags, read the full evidence and fix instructions, record that it changed something, and request an independent recheck. It can never mark a Flag fixed.
   - Docs and a 60-second video: "Claude Code fixes it. FixFlags proves it."
2. **Check after every deploy.** Use deployment signals (GitHub deployment status, Vercel or Netlify deploy hooks) to recheck open Flags and run a quick check of key pages after each production deploy. This is the hook that turns a one-time check into a habit for people who ship ten times a day. Use a repository-selected GitHub App with narrow permissions (as the [Elu plan](elu-product-research-and-competitive-plan.md#repair-architecture) recommends), which also prepares Phase 6.
3. **Concierge repair, by hand, before building the machine.** Offer ten design partners "we'll prepare the fix PR for you". For each eligible Flag, the team runs a coding agent (for example the Claude Agent SDK or Claude Code) against the repair brief in a clean, isolated environment, opens a PR, checks the preview, and FixFlags verifies the live result after merge. Record time, owner effort, acceptance, regressions and cost for every attempt, including failures. This answers gates 1, 3 and 4 of the Elu plan with real data in weeks instead of months, and produces the first permissioned case studies.
4. **Lovable first among builders.** Prepare the Lovable integration application (Phase 4) with a working flow: a Lovable-published site is checked after each publish, and Flags come back as Lovable-ready instructions.
5. **Tool-specific handoff.** Where a tool supports deep links or prompt parameters, add "Open in" actions. Where it does not, keep copy with tool-specific formatting. Verify each tool's actual mechanism before shipping; do not assume.

**Exit:** MCP and CLI discoverable for two clients, deploy-triggered checks live for at least one host, ten concierge repairs attempted with full records.

## Phase 4: Launch and distribution (weeks 6 to 12)

**Goal:** get seen every week, not once.

### Launch week (when Phases 1 and 2 are live and MCP has shipped)

- A 60 to 90 second video of the full loop on a real site: check, Flag, fix in Claude Code, Verified.
- Show HN, X and LinkedIn in one coordinated week, plus posts in builder communities where self-promotion is allowed. Product Hunt is optional: comparable tools in this niche drew almost no response there.
- A launch data piece: **"We checked 500 AI-built websites. Here's what breaks."** Built only from public pages, reported in aggregate, with no site named without permission, following [research governance](research-governance.md).

### Repeatable channels

| Channel | What we do | Why it fits |
| --- | --- | --- |
| Builder marketplaces (highest leverage) | Apply to the [Lovable integration program](https://lovable.dev/en/partners/integration). It has about 100 connectors and already accepted a security scanner (Wiz). Pitch: Lovable checks the preview at publish, FixFlags watches the live site after. Then the [Vercel Marketplace](https://vercel.com/changelog/sentry-checkly-and-dash0-join-the-vercel-marketplace), where Checkly and Sentry sit, with checks after every deploy. | Puts us where our customer already builds and ships |
| Agent ecosystems | A FixFlags plugin in the [Claude Code plugin marketplace](https://claude.com/docs/plugins/submit) (pull open Flags, request a recheck), Cursor MCP setup, MCP directories, `npx fixflags` in READMEs and templates | Developers discover tools inside their tools. Directory listings alone drive little. |
| Free tools | Broken link checker, mobile layout checker, link preview checker (exists), "is my site down", "test my signup form", "test my checkout". Each ends with "run the full check". | High-intent search, instant value, funnels into the product |
| Builder pages and guides | "Lovable signup not working", "Stripe checkout broken after deploy", "Bolt site checklist before launch". Real, useful pages, not thin programmatic ones. Avoid the crowded "is Lovable secure" cluster; journey and conversion problems look less contested. | Matches how AI builders search when something breaks |
| Shareable proof | Verified receipts, shared reports, the badge | Every fix can become a referral |
| Communities and founder presence | Builder subreddits, Discords, Indie Hackers, X build-in-public with weekly real findings and fixes | Trust is earned in public by a person, not a logo wall |
| Agencies | Client-ready reports, a referral offer, a multi-site plan | One agency brings many sites |

Content cadence: weekly changelog, one useful post every two weeks, one data piece per quarter.

**Exit:** launch week done, three channels producing checks every week, weekly signups trending up for four consecutive weeks.

## Phase 5: Revenue (weeks 8 to 14)

**Goal:** prove people pay, and learn what they pay for.

Today's planned packaging is $49 and $99 per website per month, differentiated mainly by a monthly allowance of checks, with checkout closed. Problems: the per-site price is high for a solo builder with three side projects, "check allowance" is an internal unit, and the plans do not mention the things this ICP values (journey checks, every-deploy checks, AI tool integration, prepared fixes).

The market anchors are clear: DevScan AI $15 a month for 3 sites checked daily, Vibe App Scanner $29 to $49, Checkly Starter $24, UptimeRobot Solo $10. At $49 per site we will be compared line by line with a $15 scanner unless the plan visibly includes what they lack: journeys and verified fixes. Charge for responsibility (journeys watched, deploys checked, fixes prepared and verified), not for page scans.

Proposed packaging to validate (numbers are hypotheses, not decisions):

| Plan | For | Includes | Price to test |
| --- | --- | --- | --- |
| Free | Trying it, one side project | 1 site, weekly check, uptime, fix instructions, limited rechecks | $0, forever |
| Builder | Solo builders | 3 sites, daily and after-deploy checks, unlimited rechecks, MCP and CLI | $19 to $29 a month |
| Pro | Small teams and serious products | 10 sites, faster uptime, prepared fix PRs (a monthly number), team seats | $49 to $79 a month |
| Agency | Client work | 25 or more sites, client reports, white label | From $149 a month |

How to get there:

1. Measure real cost per Site per month on actual usage (the strategy target is about $12 per Pro Site). Include AI calls, browsers, storage and failed runs.
2. Test willingness to pay in the Phase 0 conversations and on the pricing page waitlist.
3. **Offer founding-member plans to design partners now**, through manual payment links if checkout is not ready: a discounted annual price in exchange for feedback and a case study. Ten paying design partners teach more than the 14-day projection.
4. Open self-serve checkout for one or two plans once cost and quota enforcement are proven. Keep a useful Free plan after beta, as already promised.

**Exit:** first paying customers, measured cost per Site, and a packaging decision based on real behavior.

## Phase 6: Hosted repair and progressive autonomy (weeks 10 to 24)

**Goal:** "FixFlags prepares the fix, you merge, FixFlags proves it worked," for supported cases.

The [Elu plan](elu-product-research-and-competitive-plan.md) already designs this well: bind each attempt to the original evidence and exact commit, run an existing coding-agent harness in a disposable isolated environment away from write credentials, produce a real patch, check the preview against the recorded failure, publish a reviewable PR through a narrowly scoped GitHub App, and verify the live result after the owner deploys. Keep that architecture. Change the order and the speed:

1. Choose the first one or two failure families **from the concierge data** (Phase 3), not from theory. Likely candidates: broken internal links and missing pages, mobile layout hiding a key control, a clearly defined broken interaction.
2. Automate what the team did by hand, one step at a time, keeping every attempt's record.
3. Ship "Prepare fix" as a button on eligible Flags for Pro. Show unsupported or ineligible cases plainly and fall back to fix instructions. Never open an empty PR and call it a fix.
4. Then offer standing automatic PR proposals for opted-in issue classes, with limits and noise control.
5. Automatic merge and deploy stays a separate, later decision with explicit policies.

**Exit:** a measured success rate, regression rate, owner time and cost per verified repair for the supported families, published as permissioned case studies.

## Phase 7: The moat (2027)

- **Deploy-native:** every deploy on supported hosts is checked automatically, and FixFlags becomes the "is it actually working" step of shipping.
- **Agent-native:** coding agents call FixFlags to verify their own changes before saying "done". The independent verdict becomes a standard part of agent workflows.
- **Outcome monitoring:** keep extending checkout and signup journeys with safe synthetic accounts (partly built) so we watch the results that make money.
- **Impact ranking without replay:** optional analytics connections (GA4, PostHog) to rank Flags by affected traffic, answering Elu's behavioral angle without session recording.
- **The data asset:** an ongoing, aggregate "State of AI-built websites" index from public checks, which feeds detection quality, content and press.
- **Trust:** a practical security overview now, then penetration testing and SOC 2 readiness when buyers ask, never implied before it exists.

## Metrics and the weekly scoreboard

**North Star: verified fixes per week.** A Flag found by FixFlags, changed by the owner or their AI, and confirmed by an independent recheck. It captures detection quality, usefulness, the fix handoff, and the reason to come back.

| Stage | Metric | Starting target (revisit after baseline) |
| --- | --- | --- |
| Speed | Median seconds to first Flag | 30 or less |
| Value | Checks with at least one Flag a user opens | Baseline, then up |
| Quality | Precision of high-priority Flags in the weekly review | 90% or better |
| Activation | URL submitted to Site claimed | Baseline, then up |
| Action | Claimed Sites with a fix copied within 24 hours | Baseline, then up |
| Loop | Fixes copied that get a recheck within 7 days | Baseline, then up |
| Outcome | Rechecks that end Verified | Baseline, then up |
| Habit | Sites with Watch active and a return visit on day 7 | Baseline, then up |
| Developer | Sites connected through MCP or CLI | Grows from launch |
| Revenue | Paying customers, revenue, cost per Site | First 10, then trend |

Review it every Monday in 30 minutes: the numbers, three user quotes, the one thing to change this week.

## What we will not do

- Copy session replay or make a tracking tag the first step.
- Fabricate or imply proof: no invented testimonials, live counters that are not real, compliance badges for audits we have not passed, or "customers" we do not have. When real numbers are worth showing, show them from live data.
- Build our own general coding agent. Use an existing harness and own the evidence, selection and verification.
- Show more "coming soon" than "works today".
- Add another governance document, dashboard or acceptance registry.
- Let the acceptance ledger block a page that accurately describes shipped behavior.

## Risks and how we handle them

| Risk | Mitigation |
| --- | --- |
| A better website sends more people into noisy Flags | Finding-quality review and journey-first ranking before launch week |
| Free checks become expensive at volume | Measure cost per check now, bound free depth, cache shared assets, keep the free plan useful but finite |
| AI builders add their own QA | Be the independent, cross-tool verifier and integrate with them. Their agent should not mark its own homework either. |
| Cheap scanners undercut us | Do not compete on page scans. Lead with journeys and verified fixes, price an entry plan near their range, and win on finding quality |
| Coding agents verify their own changes locally | Position the verdict as independent, on the live production site, and recorded over time. Integrate so agents call FixFlags before saying "done". |
| Elu or PostHog move to URL-first checks | Speed and proof compound: deploy hooks, MCP, verified history and the data asset are harder to copy than a scanner |
| Venture-backed AI QA can die fast (Octomind shut down in May 2026) | Stay cheap to run, charge early, keep the product useful without a sales team |
| Hosted repair is harder than expected | The concierge pilot finds this out cheaply. Fix instructions and MCP still deliver value without it. |
| Founder bandwidth | The two-track model, fewer documents, and a strict weekly scoreboard |

## Decisions needed now

1. **Primary customer:** people shipping with AI builders and coding agents (recommended), with agencies second.
2. **Differentiation:** lead with real visitor journeys on the live site and independent, recorded verification, and treat fix prompts, rescans and MCP as table stakes. This also means prioritizing journey checks in the default first check.
3. **Product line and headline:** approve "Find what's broken. Hand your AI the fix. Prove it worked." and choose a hero headline.
4. **Operating model:** the two tracks, the capacity split for eight weeks, and amending the completion plan's "marketing and branding remain outside this work".
5. **Hero contract:** retire the glass-F-led hero in DESIGN.md in favor of the product stage and signature sequence.
6. **MCP and CLI:** prioritize actual-client acceptance for Claude Code and Cursor and open discovery when it passes.
7. **Concierge repair pilot:** approve hand-prepared PRs for ten design partners, with their repository permission and a clear scope.
8. **Fix gate experiment:** allow the top Flag's fix instructions without signup as a test.
9. **Pricing:** approve testing the proposed packaging and founding-member offers before self-serve checkout opens.

## The first 14 days

1. Owner decisions above, recorded in [DECISIONS.md](../../DECISIONS.md) or this plan.
2. Homepage performance fix and the small leaks from Phase 0, shipped.
3. Funnel events live and collecting.
4. Changelog brought up to date, then weekly.
5. 20 customer conversations booked, 10 completed.
6. Signature sequence prototype (broken cart) reviewed on phone and laptop.
7. Brand brief, voice rules and homepage copy draft for review.
8. First weekly finding-quality review on 50 real checks.
9. MCP actual-client acceptance for Claude Code started.
10. Ten design partners recruited for concierge repair.
11. Cost per check measured on recent real runs.
12. "Coming soon" collapsed and terms unified.

## Evidence behind this plan

- Live audit of [fixflags.com](https://fixflags.com/), [pricing](https://fixflags.com/pricing), [how it works](https://fixflags.com/how-it-works), [connect AI](https://fixflags.com/connect-ai), [integrations](https://fixflags.com/integrations) and [changelog](https://fixflags.com/changelog) on November 10, 2026, desktop and 375px mobile.
- One anonymous check of fixflags.com on November 10, 2026: board immediately, first Flags after about 25 seconds, complete after about 60 seconds, 6 Flags (5 performance, 1 accessibility), 1 page checked, mobile LCP 6.74s. One run is an observation, not a median.
- Homepage resource measurement in the browser: 44 script requests and about 1.3 MB of decoded JavaScript. Decoded size overstates transfer size; the direction is still clear.
- [Elu homepage](https://elu.dev/) reviewed November 10, 2026. Its counters (issues found, customers, value of issues) and testimonials are vendor claims that were not independently verified.
- Repository review: [PRODUCT.md](../../PRODUCT.md), [DESIGN.md](../../DESIGN.md), [the vision](../../knowledge/vision.md), [strategy](../../knowledge/strategy.md), [completion plan](../product-masterplan.md), [metrics](metrics.md), marketing copy and routes.
- Competitor research sources are cited inline in [the competitive map](#the-competitive-map).
