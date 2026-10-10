# Competitive and conversion briefing

**Initial research date:** 2026-10-01. **Corrective reviews:** 2026-10-02 and 2026-10-04.
**Status:** evidence-safe working brief; the conversion baseline and MCP category claim remain open.
**Supersedes the factual content of** [`competitors.md`](competitors.md). That file's narrative described the
retired "AI-built product QA" positioning and misidentified two of its three named competitors. Its history is
preserved in git per the never-delete rule in [`README.md`](README.md). Per
[`knowledge/market.md`](../../knowledge/market.md), every external claim here needs re-verification before it
enters public copy. Do not publish a competitor claim from this file without a live source check.

**Correction made on 2026-10-02:** the initial research incorrectly marked every sampled synthetic-monitoring
vendor as having no MCP verification surface. Checkly's official June 2026 release lets agent clients inspect
monitoring and trigger deployed checks, while Datadog exposes Synthetics through its MCP server. The defensible
hypothesis is narrower: FixFlags may differentiate on tenant-owned Outcomes, a verifier that does not accept the
change actor's success claim, and a durable Flag → Fix → Verify → recurrence history. This brief does not yet
prove that combination is unique.

**Evidence convention:** a missing capability means "not found on the named primary surface on the observation
date," never "the vendor does not have it." Prices and capabilities change. Part 8 lists the dated primary
surfaces behind decision-driving claims. Other matrix entries remain working notes and must not enter public
copy or prioritization until they gain a dated primary source.

**Open work:** complete the scenario-level MCP competitor audit, deploy the locally implemented attributable
landing-to-claim cohort, register its GA4 `journey_id` event dimension, and produce a fresh GA4/GSC and
server-funnel pull. Item 15 remains blocked on the first two product-launch gates in the roadmap as well as on
that competitor audit. Re-verify every external figure immediately before publication.

---

## Part 1. What FixFlags is

Needed context for any agent reading this cold.

FixFlags is **the independent monitor for software that acts**. Tagline: **Your software runs. FixFlags watches.**

- A customer adds a live product by URL, a **Site**. Shop, SaaS, service business.
- The local product can execute important **Outcomes**: Checkout, page availability, and Safe Signup. Signup is
  available only with encrypted synthetic data, exact-origin reset and cleanup hooks, a successful dry run, and
  version-bound customer authorization. Login, Password reset, Publish, and generalized agent evaluation remain
  unavailable.
- Each Outcome reads **Clear**, **Flag**, **Couldn't verify**, or **Stale**.
- Evidence is real and preserved: Playwright capture, screenshots, network/HTTP status, journey steps,
  deterministic checks, AI judgment, with truth labels distinguishing reproduced from merely observed.
- Loop: **Flag → Fix → Verify.** FixFlags independently re-executes the live Outcome after a change to prove
  recovery. Absence from a later scan is not verification.
- **The independence boundary.** The actor that made the change, human or AI coding agent, may tell FixFlags
  what changed but can never certify that the change succeeded. FixFlags executes, captures, and concludes.
- **MCP is implemented locally, not production-proven or publicly discoverable.** Its intended loop lets Codex,
  Claude Code and Cursor request a run, receive Clear or a Flag with evidence, record a change without
  self-certifying, and request independent re-verification. Exact-client and production-canary proof remain open.
- **Watch** is scheduled monitoring. Free one site weekly, Pro $49/site/month daily. Paid is a **waitlist**;
  Stripe is closed (`STRIPE_PAID_OPEN` false).
- Shopify is a connection and distribution wedge, not a second product.

Explicitly **not intended to become**: a testing dashboard, a Lighthouse wrapper, an SEO tool, an uptime-only
monitor, a code reviewer, a conversational chat-QA agent, a one-time report, or an agent that edits and
certifies its own work.

Canonical language source: [`docs/voice-and-copy.md`](../voice-and-copy.md). That document is strong and is not
the problem. This briefing is about where the product is aimed, not how it speaks.

---

## Part 2. Competitive landscape

Seven clusters. Only claims linked in Part 8 were re-verified from a primary surface on 2026-10-02. Unlinked
prices and feature summaries are working notes, not verified facts.

### 2.1 Direct: URL-first AI app and website QA

| Product                                                                              | Owner                            | Pitch                                                                                                                                      | Pricing note                                                                                                  | Can it test authenticated flows? | Verdict                                                                                                |
| ------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Katalon Scout** (`scoutqa.ai`)                                                     | **Katalon, Inc.**                | "Vibe testing for vibe coding." Paste a URL for performance, security, SEO and accessibility analysis; explicitly shows Lovable and Replit | Free with a waitlist on the checked surface                                                                   | Not marketed                     | **Closest verified URL-first competitor in this pass.**                                                |
| **Scout** (`scoutscans.com`)                                                         | Unrelated company                | AI website monitoring, "visits your pages like a real person," page-credit model                                                           | Tiered pricing note not re-verified                                                                           | No claim found                   | Adjacent. Site returned 503 during research. **Distinct product from Katalon Scout. Do not conflate.** |
| **Checkly**                                                                          | Checkly                          | Playwright-native synthetic monitoring, Agentic Checks                                                                                     | Hobby free, USD 24 Starter, USD 64 Team when billed annually; Agentic Check unit pricing not established here | Yes, scripted                    | **Closest verified technical substitute in this pass.**                                                |
| **Momentic**                                                                         | Momentic                         | Plain-English E2E tests, hosted browsers/devices, auto-heal                                                                                | Free 2k credits, pay-as-you-go from about USD 125/month                                                       | Yes                              | Strong E2E. Dev-tool GTM.                                                                              |
| **QA.tech**                                                                          | QA.tech                          | Fleet of AI agents executing manual workflows at automation speed, PR comments                                                             | Sales-led                                                                                                     | Yes                              | Strong agent QA, enterprise motion.                                                                    |
| **Autify**                                                                           | Autify                           | Aximo autonomous tester + Nexus Playwright automation                                                                                      | Free tier + enterprise                                                                                        | Yes                              | Dev/QA tool.                                                                                           |
| **testRigor**                                                                        | testRigor                        | Plain-English automation, 90k+ companies, minimal maintenance                                                                              | Infra-based, sales-led                                                                                        | Yes, incl. 2FA                   | Enterprise.                                                                                            |
| **Playwright MCP / Chrome DevTools MCP / Browserbase / Stagehand**                   | Microsoft / Google / Browserbase | Browser control infrastructure for agents                                                                                                  | Free / usage                                                                                                  | Yes                              | **Infrastructure, not products.** See learning 4.                                                      |
| **mabl, Applitools, BrowserStack Autopilot, QA Wolf, Meticulous, Vision AI, Squish** | Various                          | Enterprise test automation                                                                                                                 | Sales-led                                                                                                     | Yes                              | Adjacent enterprise QA.                                                                                |

The 2026 entrants in this space are covered in section 2.7. That sample is directional, not exhaustive; the
scenario-level comparison remains open.

### 2.2 Synthetic monitoring and APM incumbents

This matrix is a scenario audit, not proof of absence. "Not established" means the reviewed primary surface did
not establish the exact capability. It does not mean the vendor cannot do it elsewhere.

| Vendor                | Outside-in execution      | Who defines success                          | Durable recovery model established here?                                            | Agent/MCP surface observed 2026-10-02                                                | Evidence state                            |
| --------------------- | ------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| Datadog Synthetic     | Yes                       | Customer-authored assertions                 | Test and monitor history exist; Outcome/Flag recurrence semantics not established   | **Yes.** Official MCP tools interact with Synthetics                                 | Primary MCP docs checked                  |
| Dynatrace + Davis     | Yes                       | Customer configuration and platform analysis | Not established                                                                     | **Yes.** Official MCP exists; a Synthetics run tool was not established in this pass | Primary MCP docs checked                  |
| New Relic Synthetics  | Yes                       | Customer-authored assertions                 | Not established                                                                     | Not re-verified                                                                      | Working note                              |
| Checkly               | Yes, including Playwright | Customer-authored checks                     | Check and incident history exist; FixFlags-style recovery semantics not established | **Yes.** Official MCP can inspect results and trigger deployed checks                | Primary release notes and pricing checked |
| Catchpoint            | Yes                       | Customer-authored scripts and assertions     | Not established                                                                     | Not re-verified                                                                      | Working note                              |
| Cisco ThousandEyes    | Yes                       | Customer configuration                       | Not established                                                                     | Not re-verified                                                                      | Working note                              |
| OpenObserve           | Yes                       | Customer configuration                       | Not established                                                                     | Not re-verified                                                                      | Working note                              |
| CloudWatch Synthetics | Yes, via canaries         | Customer-authored canaries                   | Not established                                                                     | AWS agent tooling exists; exact run path not re-verified                             | Working note                              |

**Corrected result:** outside-in execution, rich evidence, and coding-agent access are not unique to FixFlags.
The still-open competitive question is whether another product combines customer-level Outcome responsibility,
an independence rule that rejects the change actor's success claim, and durable Flag recovery and recurrence.
That combination needs a documented scenario test before it becomes a public moat claim.

Their structural moats are installed base, budget gravity, telemetry correlation, enterprise trust, global node
networks, and bundling. FixFlags cannot replicate those and should not try.

### 2.3 Cheap monitoring and site audit tools — the substitution threat

| Tool                          | Price                                                 | What it does                                                               | Gap or difference observed in this pass                                                               |
| ----------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **UptimeRobot**               | Free 50 monitors @5 min; paid plans from USD 144/year | HTTP, SSL, DNS, ping, keyword, status pages; agent-readable setup guidance | No browser journey was found in the verified Free-plan surface; no Outcome/recovery model established |
| **Better Stack**              | About USD 30–150/month                                | Uptime, incidents, on-call, status pages                                   | Availability, not outcomes                                                                            |
| **Pingdom**                   | About USD 10–15+/month                                | Uptime, page speed, RUM, basic transaction checks                          | Scripted, self-asserted                                                                               |
| **Hyperping**                 | About USD 24/month                                    | Uptime, status pages, on-call                                              | Availability only                                                                                     |
| **Uptime Kuma**               | Free, self-hosted                                     | HTTP, ping, port, keyword, status pages                                    | DIY maintenance, no outcome model                                                                     |
| **PageSpeed Insights**        | Free                                                  | Lab + field CWV for one URL                                                | No functional check whatsoever                                                                        |
| **Ahrefs Webmaster Tools**    | Free                                                  | Crawl, technical SEO, GSC                                                  | No journeys, no outcome verification                                                                  |
| **Semrush Site Audit**        | About USD 140+/month                                  | 130+ technical checks, health score                                        | No login/checkout execution                                                                           |
| **Screaming Frog / Sitebulb** | Pricing not re-verified                               | Deep technical crawls                                                      | Continuous live-Outcome monitoring not established                                                    |
| **GTmetrix**                  | Free, USD 15+/month                                   | Speed, CWV, waterfalls                                                     | Performance only                                                                                      |

These products set a strong price and simplicity baseline. The research supports a difference in product model,
not the claim that every one loses on Outcome truth or lacks a concept of independent execution.

### 2.4 Commerce: the Shopify wedge

| App                                               | Price                                                                    | Claim                                                                                      | Reality                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Uptime – Automated Store Tests** (Jagged Pixel) | From **USD 29/month**; automated UI tests listed on **USD 99/month Pro** | Store monitoring and automated UI tests, marketed around add-to-cart and checkout failures | **The real commerce competitor.** Already distributed in the Shopify App Store. Exact test configuration and recovery semantics require a scenario comparison. |
| Plug In SEO                                       | Freemium                                                                 | SEO, links, speed hints                                                                    | No checkout verification                                                                                                                                       |
| Broken link monitors                              | Freemium                                                                 | 404s                                                                                       | No journeys                                                                                                                                                    |
| CatchJS error tracking                            | Freemium                                                                 | Client-side JS errors                                                                      | A flow can fail cleanly with zero errors                                                                                                                       |
| StatusGator / StatusBird                          | Varies                                                                   | Shopify platform status                                                                    | Platform uptime, not your store's Outcomes                                                                                                                     |

Most apps marketed as Shopify monitoring focus on availability, links, errors or SEO. Jagged Pixel's Uptime is
a genuine commerce-wedge competitor, but the briefing must not imply its automated UI-test tier costs USD 29.

### 2.5 AI-agent production monitoring — adjacent evidence

This category is close to FixFlags' longer-term direction, but it does not validate FixFlags' product or market
by itself.

**Most products sampled here are instrumentation-first. That is useful operational evidence, not independent
proof of the user's final Outcome.**

The reviewed core surfaces for LangSmith, Langfuse, Braintrust, Arize/Phoenix, Galileo, Patronus, Maxim,
Agenta, AgentOps, HoneyHive, Confident AI/DeepEval, MLflow, Giskard, Sentry Seer and Datadog AI Monitoring are
instrumentation-first: the customer instruments the app and the vendor records traces, scores or spans. Those products may
also add evaluation or outside-in capabilities; this brief did not exhaustively test every configuration. The
useful distinction is that emitted telemetry alone cannot prove the final customer Outcome.

**Agent Status is one verified outside-in example** (`agentstatus.dev`, Carmel Labs). It probes live agent and
MCP endpoints from residential vantage points without relying only on agent-emitted telemetry. Its reports are
vendor-authored research about its own monitored fleet, not independent validation of FixFlags.

| Report                                                                                       | Scale                                                               | Findings                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [March 2026, State of AI Agent Reliability](https://agentstatus.dev/march-2026-report)       | 4,492,066 executions, 1,109,869 evaluated, 6,259 agents, 10 regions | **56.6% of agents had 100% uptime while 89.2% scored 0% on quality.** Verdicts: 0.8% UP, 62.8% DEGRADED, 36.5% DOWN. Headline framing: "62.8% of all tests returned a 200 status code with a problematic response."                              |
| [April 2026, Drift Report](https://agentstatus.dev/april-2026-report)                        | ~10M tests, 6,200+ agents, 30 days, 1.54M drift events              | **88% of agents gave worse answers at least once. 99% slowed significantly.** Median correctness drop **-93 points**. Only **~44% of drifted agents ever recovered**; typical recovery 9.6h, slowest decile 34.6h.                               |
| [September 2026, State of MCP Reliability](https://agentstatus.dev/state-of-mcp-reliability) | ~3,279 public MCP servers                                           | **24.2% UP, 59.4% DEGRADED, ~2.3% DOWN.** Only 26.5% of tools shipped an object `outputSchema`; 3.98% of clean validatable calls failed validation against their advertised schema. Reachable is not working. Transport success is not delivery. |

Three bounded consequences for FixFlags:

1. **Availability and semantic correctness can diverge.** The reports support that adjacent problem. They do not
   measure Checkout, coding-agent changes to the wrong object, or FixFlags-style post-fix verification.
2. **"Who executes?" is a useful first question, not a complete differentiator.** Also ask who defines the
   expected result, whether the change actor can certify success, and how recovery and recurrence are preserved.
3. **Agent Status is an adjacent outside-in product.** Its checked surfaces focus on AI-agent and MCP reliability.
   This pass did not establish a customer Site → Outcome → Flag → Fix → Verify loop there.

**Timing hypothesis:** the reported MCP degradation rate suggests a verification problem worth testing. It does
not establish demand for FixFlags' Site and Outcome product or unblock a public MCP launch.

### 2.6 Adjacent and newly arrived

- **Cloudflare "Agent Readiness score"** (`isitagentready.com`, Agents Week 2026). Score your site, take the
  prompts, "ask your agent to upgrade your site." Free, from the company fronting most of the web. It does not
  verify outcomes or close a fix loop, but it competes for the same top-of-funnel habit and the same
  paste-URL-gets-a-report behavior.
- **Transaction monitoring incumbents**: Dotcom-Monitor, Uptrends, Site24x7 all sell scripted real-browser
  checkout monitoring. Commodity. Confirms learning 3.

### 2.7 The coding-agent and MCP toolchain

This initial category pass informs plan item 15 but does not resolve it. It sampled doers that self-verify,
pipelines that execute customer-authored checks, browser tools, and observability products. Product surfaces
change quickly, and broad negative claims require repeatable scenario evidence.

**Code review bots** — CodeRabbit, Greptile, Cursor Bugbot, Qodo, Graphite, Sourcery, IBM watsonx Code
Assistant. The reviewed surfaces were primarily pre-merge and code-centric. This pass did not establish a
live-Outcome verification surface for those products; that is narrower than claiming none exists.

**Agentic builders** — Copilot Coding Agent, Cursor, Windsurf, Devin, Replit Agent, Bolt, Lovable, v0, Base44.
Their documented job is to make changes; sampled builder narratives also describe self-verification in their own
environments. **Devin is the closest example in this pass on the mechanics**:
Cognition documents it using its own computer to verify work, building test plans, and iterating until checks
pass, with parallel cloud execution. But Devin is the doer. It makes the change and it certifies the change,
inside one system. That illustrates why an independent boundary may matter, but it does not prove customer
demand for a separate verifier.

**Hosting and preview platforms** — Vercel, Netlify, Cloudflare, Railway, Fly.io. The initial pass found deploy
checks, browser execution and agent-access surfaces across this group. Those notes need primary-source rows
before they drive a comparison. The sampled flows generally rely on customer- or platform-configured checks
inside a deploy pipeline for a site the platform already owns. Cloudflare's sourced Agent Readiness tool is one
verified move into the same top-of-funnel territory.

**Browser and automation MCP servers** — Playwright MCP, Chrome DevTools MCP, Browserbase MCP, Puppeteer MCP,
Apify MCP. Their documented core job is driving or observing browsers. Separately, Checkly's MCP can trigger
deployed checks and Datadog exposes Synthetics tools through MCP. The open question is not whether agent-accessible
execution exists. It is whether a vendor owns the expected Outcome and refuses self-certification while keeping
recovery and recurrence history.

**AIOps platforms** — Sentry Seer, Datadog Bits AI, Dynatrace Davis, New Relic AI. These are the most capable
detect-then-fix systems in existence. Sentry Seer surfaces issues from production telemetry, writes a plan and
opens PRs; Sentry MCP connects Claude Code and Cursor to Sentry's data. Datadog Bits Code generates fixes as
PRs and gates them on multiple consecutive CI runs before merge; Datadog's BitsEvolve work does formal
verification, shadow evaluation against live production traffic, and hot-swap in their own internal Unicron
systems. Dynatrace Davis and New Relic AI run remediation workflows off platform signals.

The reviewed material did not establish the complete FixFlags target sequence for these AIOps products. That is
a research gap, not evidence of universal absence. The next comparison must run the same post-deploy Checkout
scenario through each credible substitute and record what it executes, who authored the assertion, what verdict
is returned, and how a recurrence is represented.

That distinction deserves to be stated plainly, because it is the one customers conflate most:

> **"The metric returned to normal" is not "the Outcome works."** A green dashboard after a deploy is a
> platform signal about an aggregate. The local FixFlags Checkout binding can re-exercise the supported live
> browser Outcome and preserve its own evidence. Protected credentialed journeys remain blocked until a
> tenant-scoped reversible fixture contract exists. This is the same principle as the existing rule that no
> Flags does not mean untested behavior is healthy, applied to the verification step instead of the monitoring step.

**incident.io, Rootly and FireHydrant** are incident-response and status-communication products, outside the
direct comparison unless their execution or verification surfaces expand.

**Conclusion for item 15.** The agent ecosystem remains a plausible channel, not a proven acquisition wedge.
Do not build or market the landing page until the existing Site → Outcome → Run → Flag loop passes exact-client
and production-canary gates and the scenario audit establishes a comparison FixFlags can make honestly.

---

## Part 3. Corrections to existing documents

| File                                        | Error                                                                                 | Correction                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/growth/competitors.md`                | Lists PageLens as a QA competitor                                                     | **PageLens (`pagelens.ai`) is an AI-search-visibility / GEO tool.** Tracks brand citations across ChatGPT, Perplexity, Gemini. Pricing note not re-verified. Not a QA product. |
| `docs/growth/competitors.md`                | Lists Signo, "paste deployed app, launch-readiness score"                             | **Could not be verified to exist** as described. May be renamed or defunct.                                                                                                    |
| `docs/growth/competitors.md`                | Treats Scout as an indie product                                                      | **Scout QA is `scoutqa.ai`, © Katalon, Inc.** Also explains "KaneAI" confusion: KaneAI is Katalon's, not LambdaTest's.                                                         |
| `docs/growth/competitors.md`                | "Recurring scheduling: Not shipped"                                                   | Watch exists. Free weekly, Pro daily.                                                                                                                                          |
| `docs/growth/competitors.md`                | Positioning matrix built on Message/Experience/Reach rubrics                          | Retired model. Current is Site → Outcome → Clear or Flag.                                                                                                                      |
| `docs/growth/metrics.md`                    | Signups and paid conversion listed as "Tracked" with no value                         | Genuinely uncounted in that table.                                                                                                                                             |
| This briefing's initial section 2.2         | Marked Checkly and Datadog as having no MCP surface                                   | Checkly can trigger deployed checks through MCP; Datadog exposes Synthetics MCP tools. The exhaustive claim is withdrawn.                                                      |
| This briefing's initial conversion baseline | Called 17 starts and 3 completions a current 28-day funnel                            | No committed artifact or query reproduces it. The latest committed exports are dated 2026-09-08 and cannot produce an attributable unique-run funnel.                          |
| Public homepage and `/pricing`              | Compare table pits FixFlags against **PageSpeed Insights** and **"an agent you ask"** | The current comparison omits the substitutes identified here. Verify the rendered production surfaces before acting.                                                           |

---

## Part 4. Learnings

These are the findings strong enough to change decisions after the 2026-10-02 correction.

1. **Outside-in execution is not unique.** Synthetic-monitoring incumbents already run browsers and API checks
   outside the customer's application, often with deep artifacts.
2. **Agent access is not unique.** Checkly can trigger deployed checks through MCP, and Datadog exposes
   Synthetics tools through MCP. "We have MCP" is not a category claim.
3. **The candidate differentiator is a combination, not one feature:** customer-level Outcome responsibility,
   independent verdict authority, and durable Flag recovery and recurrence. Its uniqueness is still unproven.
4. **Credentialed checkout monitoring and rich browser evidence are table stakes.** The product must win on what
   it understands and how it establishes recovery, not merely on running Playwright or storing a trace.
5. **The DIY substitute is real but unquantified.** UptimeRobot plus scheduled Playwright can reproduce a
   substantial portion of scheduled execution and evidence. The earlier "~80%" figure had no measurement.
6. **The Shopify price comparison needs tier precision.** Jagged Pixel starts at USD 29, while its App Store listing
   places automated UI tests on the USD 99 Pro tier. Do not describe USD 29 as the checkout-test price.
7. **The client registry is not the whole product funnel.** `FunnelEvent` has 49 legacy-weighted browser events,
   while `SiteLifecycleEvent` has 17 durable server events for the Site → Outcome → Flag → Verify loop. Do not
   duplicate server truth into GA merely to make the client union look current.
8. **The conversion funnel is not currently reproducible.** The document's 17-start/3-completion baseline has no
   committed source. The committed September 8 GA4 artifacts report different event counts. A local 2026-10-03
   repair can now cohort an immutable anonymous Site start to that exact check's first useful result and later
   claim, but it is not deployed and no fresh production baseline has been captured.
9. **The last reproducible search baseline is dated September 8, not October 1.** It reports seven clicks and 53
   impressions, all brand or brand-adjacent. It supports a foundation phase, not a current volume forecast.
10. **Checkout, Availability, and version-authorized Safe Signup are locally watchable today.** Login and
    Password reset remain unavailable. The MCP contract is local and undiscoverable pending exact-client and
    production-canary proof. Public positioning must preserve those limits.
11. **Agent Status provides adjacent, vendor-authored evidence** that transport availability and semantic quality
    can diverge. It does not measure FixFlags, Checkout recovery, or coding-agent changes to the wrong object.
12. **Measure, prove, then position.** A fresh production funnel and one real public recovery proof must precede
    a site-wide comparison rewrite or an MCP acquisition page.
13. **Mutable current ownership is not a cohort key.** The old admin query counted `Audit.userId IS NULL`, so a
    successful Site claim removed its original anonymous start from the denominator. Cohort membership must come
    from the immutable `analyze_started` event and only then read later result and claim state from the same audit.
14. **Consent is part of acquisition-cohort semantics.** The local bridge creates one random tab-scoped
    `journey_id` only after analytics consent, sends it to GA4 and the exact immutable Site-start event, and never
    exposes the private anonymous Site-owner cookie. Missing GA exports stay unavailable and collapsed dimension
    rows stay partial. Deployment, GA dimension registration, and a fresh production read remain open.

### Superseded or unproven initial conclusions

| Initial conclusion                                          | Corrected state                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| "Zero of eight have MCP"                                    | False. Checkly and Datadog provide counterexamples.                            |
| "The independence boundary is uncontested"                  | Hypothesis. The exact composite needs a scenario audit.                        |
| "The DIY substitute reaches 80%"                            | Unmeasured. Keep only the qualitative substitution risk.                       |
| "82% of starters abandon"                                   | Untraceable from committed artifacts. Recompute from attributable unique runs. |
| "Volume is the binding constraint"                          | Plausible but unproven until the baseline is refreshed.                        |
| "Agent Status validates the FixFlags thesis"                | Overreach. Its reports support only the adjacent semantic-reliability gap.     |
| "Every coding agent self-verifies" and "no vendor verifies" | Exhaustive negative claims were not established.                               |
| "MCP demand is real" and item 15 is unblocked               | Demand remains a hypothesis; product release gates are still open.             |
| "Real credentials" are part of current FixFlags proof       | False for protected flows; those bindings remain blocked.                      |

Third-party measurements may be cited only with attribution, observation date, methodology limits, and a link
to the primary source. Never present a vendor's fleet as FixFlags evidence or convert it into a fear-based claim.

---

## Part 5. Top 20 plan

Provisional plan, ordered by dependency rather than confidence theater. Impact labels are hypotheses until the
funnel is attributable. Stable item numbers are retained so existing handoffs do not silently change meaning.

### Measurement foundation

| #   | Action                                                                                                                                                                                                                                                                                                                                                                                       | Impact                                                             | Effort | Depends on | Lands in                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ | ---------- | ------------------------------------------------------------------------------------------ |
| 1   | **Make the shipped product loop attributable. Locally implemented 2026-10-03.** Preserve the 17 durable `SiteLifecycleEvent` stages. Cohort anonymous `analyze_started:<auditId>` events and match `first_useful_result:<auditId>` plus later claim state from that exact Audit. Raw lifecycle volumes are activity, not a sequential funnel. Deployment and a fresh production read remain open. | Very high. Nothing downstream is falsifiable without it.           | M      | —          | `lib/analytics/site-first-value-funnel.ts`, admin analytics, focused tests |
| 2   | **Close the remaining visitor-to-start attribution gap. Locally implemented 2026-10-03.** A consented homepage session receives one opaque tab-scoped `journey_id`; GA4 records it on `landing_view`, and the exact immutable `analyze_started:<auditId>` event retains it without a raw URL or private owner token. The admin joins that session through result and later claim. GA dimension registration, deployment, and a fresh export remain open. | Very high. The full acquisition funnel cannot yet be produced from production evidence. | M | 1 | journey contract, GA dimension/export, admin cohort |
| 3   | **Publish a dated funnel baseline** per stage with `fetchedAt`, replacing "Tracked" with real values. Signups and paid conversion are currently unnumbered.                                                                                                                                                                                                                                  | High. Every later claim needs a denominator.                       | S      | 1, 2       | `docs/growth/metrics.md`                                                                   |

### Repairing the leak

| #   | Action                                                                                                                                                                                                        | Impact                                           | Effort | Depends on | Lands in                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------ | ---------- | ----------------------------------------------- |
| 4   | **Diagnose start-to-result loss after the funnel is attributable.** Measure unique submissions through validation, queueing, waiting and first useful result before naming an abandonment rate.               | Very high if the refreshed baseline confirms it. | M      | 1, 2, 3    | audit input, progress, result funnel            |
| 5   | **Measure scan duration median and p90, then set honest in-product expectations.** Treat latency as one candidate driver until segmented evidence establishes it.                                             | High if correlated with loss.                    | S      | 1, 4       | `scripts/measure-scan-duration.ts`, progress UI |
| 6   | **Return the strongest scoped result available when deeper analysis fails.** Preserve an explicit Couldn't verify state for the unfinished scope; never turn partial availability into a full healthy answer. | High.                                            | M      | 4          | `lib/audit/` FINALIZING stage                   |
| 7   | **Fix the Flag overcount on the Site board** so POLISH and low-confidence rows stop presenting as things needing attention. Protects the honest-positioning claim.                                            | Medium.                                          | M      | —          | board projector, FF-B1                          |

### Putting the wedge on the front of the line

| #   | Action                                                                                                                                                                                                                                                                                                                             | Impact                                                                    | Effort | Depends on                      | Lands in                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ | ------------------------------- | ------------------------------------------------------------- |
| 8   | **Pre-register one comparison-copy experiment on one surface.** Compare FixFlags with the substitute that matches the visitor's job, using dated primary sources. Do not rewrite the whole site at once.                                                                                                                           | Potentially high, measurable only after attribution.                      | S      | 1, 2, 3, 20                     | one copy module and one rendered route                        |
| 9   | **Test the independence boundary as a public concept** using three concrete questions: who executes, who defines the expected result, and who may certify recovery? Avoid claiming outside-in execution or MCP is unique.                                                                                                          | High if comprehension and qualified starts improve.                       | M      | 8                               | experiment copy, `docs/voice-and-copy.md` only after evidence |
| 10  | **Ship a real Flag → fix → independently verified recovery walkthrough** using attributable FixFlags evidence, with the fix happening outside FixFlags and limitations visible.                                                                                                                                                    | Very high. Demonstrates the intended product instead of asserting a moat. | L      | 1, production recovery proof, 9 | marketing route, evidence exports                             |
| 11  | **Finish retiring `competitors.md`.** Partly done 2026-10-01: the file is now banner-marked superseded with its known errors listed. Remaining decision is whether to fully rewrite it from Part 2 or reduce it to a pointer to this briefing. A wrong competitive doc produces wrong copy, so it must not stay silently readable. | Medium.                                                                   | S      | —                               | `docs/growth/competitors.md`                                  |
| 12  | **Update `knowledge/market.md` and `docs/voice-and-copy.md` only after the scenario audit** to name the verified competitive set and the bounded differentiator.                                                                                                                                                                   | Medium. Keeps canonical sources truthful.                                 | S      | 11, scenario audit              | both docs                                                     |

### Owning a category instead of borrowing traffic

| #   | Action                                                                                                                                                                                                                                                                                 | Impact                                | Effort | Depends on                  | Lands in                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------ | --------------------------- | ----------------------------------------- |
| 13  | **Test candidate category language before claiming it.** Sample current SERPs for _independent verification_, _outcome monitoring_ and _AI change verification_, then check whether the searcher's job matches a shipped FixFlags surface.                                             | Unknown until measured.               | M      | 12                          | research briefing, not a route by default |
| 14  | **Validate one comparison-page opportunity.** Build a single page only if a dated SERP sample shows real intent, FixFlags can add unique evidence, and the comparison survives primary-source review. No template-driven alternatives directory.                                       | Unknown until measured.               | M      | 11, 13                      | at most one marketing route               |
| 15  | **Keep the developer/MCP landing page blocked** until the Site → Outcome → Run → Flag loop passes exact-client and production-canary gates and a scenario audit establishes an honest comparison. Then pre-register one acquisition experiment for Codex, Claude Code or Cursor users. | Potentially high, currently unproven. | M      | product launch gates, 9, 11 | marketing route only after proof          |
| 16  | **Evaluate and instrument "Website Roast."** It is an existing free lead-magnet candidate and has no `ToolUsage` measurement today. Do not call it the best until comparable use and qualified-start data exists.                                                                      | Medium.                               | S      | 1                           | `lib/marketing/copy/seo.ts`, tool routes  |

### Selling what exists

| #   | Action                                                                                                                                                                                                                                                                   | Impact                             | Effort | Depends on        | Lands in                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------ | ----------------- | -------------------------- |
| 17  | **Fix the new-customer paid waitlist path.** With Stripe closed, the waitlist is the paid acquisition path. Capture why someone joins, position the shipped value honestly, and give a real reason to act now. `waitlist_joined` is tracked but quality is not measured. | High.                              | S      | 3                 | `/pricing`, waitlist form  |
| 18  | **Compare Shopify honestly with Jagged Pixel Uptime.** Distinguish its USD 29 entry tier from the USD 99 automated-UI-test tier and compare the same customer job before writing independence or recovery claims.                                                        | Medium-high on the commerce wedge. | M      | 9, scenario audit | Shopify page, listing copy |
| 19  | **Address the DIY substitute without inventing a value percentage.** Explain what scheduled Playwright plus free uptime covers, what the operator still owns, and what FixFlags has actually proven independently.                                                       | Medium.                            | S      | 9, 17             | `/pricing`, FAQ            |

### The system that keeps this improving

| #   | Action                                                                                                                                                                                                                                                                                                                                                    | Impact                                                                                                          | Effort | Depends on | Lands in                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------- |
| 20  | **Stand up the conversion review loop and enforce claim parity.** Weekly funnel read against items 1–3, pre-registered experiments with decision rules appended to `experiments.md`, dated observations, never rewrite a baseline after seeing results. Plus a CI check that fails the build when a public claim asserts a roadmap capability as shipped. | Very high, compounding. The `experiments.md` template is rigorous and has simply never run at conversion scale. | M      | 1, 2, 3    | `docs/growth/experiments.md`, weekly review, CI |

### Dependency chains

- **Cannot optimize without:** 1 → 2 → 3 → 20
- **Cannot diagnose the leak without:** 1 → 4
- **Positioning can be evaluated only after:** 1 → 2 → 3 → 20 → 8 → 9 → 10
- **Category and discovery work is wasted if:** 13 or 14 ship before 11, 12 and a dated SERP sample
- **Item 15 stays blocked until:** exact-client proof, production-canary proof and the MCP scenario audit
- **Item 20 is the mechanism that makes later interventions self-correcting**

### Explicitly out of scope

Do not build a conversational chat QA agent. Do not compete on check count, node geography or evidence
retention. Do not build category pages for "website audit" or "SEO audit". Do not market Signup, Login or
Password reset as watched behavior. Do not scan customer repositories. Do not open Stripe before per-site
execution cost is measured against the $12 COGS envelope.

---

## Part 6. Handoff prompt: website communication and design

Paste this to a design and taste agent. It is self-contained.

---

> You are preparing one evidence-backed public comparison experiment for **FixFlags**, an independent product
> monitor for live software.
> Work in `/Users/saadbenryane/Code/FixFlags`. Read `AGENTS.md`, `DESIGN.md`, `SOUL.md`,
> `docs/voice-and-copy.md`, `docs/growth/competitive-and-conversion-briefing.md`, and `lib/marketing/copy.ts`
> plus `lib/marketing/copy/*` before writing any copy or component.
>
> **The product.** FixFlags watches whether important **Outcomes** of a live website still work: Checkout
> completes, a page stays available. Each Outcome reads **Clear**, **Flag**, **Couldn't verify**, or **Stale**.
> Evidence is real: Playwright browser capture, screenshots, network status, journey steps, with truth labels
> separating reproduced from merely observed. The target loop is **Flag. Fix. Verify.** Someone fixes it, then
> FixFlags independently re-runs the supported live Outcome and establishes recovery from fresh evidence. The
> local Checkout path implements this; exact-client and production proof remain open. Absence from a later scan is not verification.
> Free: one site verified weekly. Pro: $49 per site per month, verified daily, currently a **waitlist**.
>
> **The problem you are solving.** The current homepage and pricing page position FixFlags against
> **PageSpeed Insights** and **"an agent you ask."** Those are the two weakest reference points available and
> they make FixFlags look like a performance tool and a chatbot. The site does not mention a single real
> competitor, and it never states its actual differentiator. Competitors like Katalon Scout, Checkly,
> UptimeRobot and Cloudflare's free Agent Readiness score are all uncited.
>
> **The candidate differentiator to test.** Outside-in execution, rich browser evidence and MCP access already
> exist in the market. Checkly can trigger deployed checks through MCP, and Datadog exposes Synthetics MCP tools.
> The narrower FixFlags hypothesis is the combination of customer-level Outcome responsibility, a verifier that
> refuses the change actor's success claim, and durable Flag recovery and recurrence. Do not call that combination
> unique until the scenario audit in this briefing is complete.
>
> **Frame the experiment around three questions.** Who executes? Who defines the expected result? Who may certify
> recovery? The local FixFlags Checkout path re-executes a supported live browser Outcome and reaches its own
> bounded conclusion. Protected credentialed journeys remain blocked, and MCP is not a production-proven launch.
>
> **Adjacent evidence for the problem exists and is citable.** Agent Status measured 4,492,066 executions across
> 6,259 production agents in March 2026 and found **56.6% of agents at 100% uptime while 89.2% scored zero on
> quality.** Their April 2026 report found **88% of agents degraded within 30 days and only ~44% ever
> recovered.** Sources: `agentstatus.dev/march-2026-report` and `agentstatus.dev/april-2026-report`. Re-verify
> both against their primary sources immediately before you publish any figure, cite them with attribution and
> a date, and never present another company's data as FixFlags' own. These vendor-authored measurements support
> the gap between availability and semantic quality; they do not prove FixFlags' product, market or recovery loop.
>
> Your job is to test whether this framing helps one intended visitor understand the product and take a useful
> next step, while proving every claim with evidence rather than adjectives.
>
> **What to change.**
>
> 1. Do not start with a site-wide rewrite. Confirm the attributable baseline and pre-register one comparison
>    experiment on one surface with one primary metric and one qualified-use guardrail.
> 2. Build the real proof surface first: a Flag → fix → independently verified recovery walkthrough using
>    attributable FixFlags evidence, with the fix step visibly happening outside FixFlags and limitations shown.
> 3. Test the three-question framing in plain language. Never claim that outside-in execution, browser evidence,
>    MCP access or recovery history is absent from every competitor.
> 4. On pricing, acknowledge the DIY substitute without a made-up value percentage. Explain what scheduled
>    Playwright and free uptime cover, what the operator still owns, and what FixFlags has actually proven.
> 5. Expand to other surfaces only after the pre-registered result supports the change and claim parity passes.
>
> **Hard constraints, all non-negotiable.**
>
> - All rendered strings live in `lib/marketing/copy.ts` and `lib/marketing/copy/*`. Never hardcode marketing
>   copy in a component. `AGENTS.md` requires this.
> - `docs/voice-and-copy.md` is the canonical language source. Follow its vocabulary: Site, Outcome, Flag,
>   Recommendation, Journey, Coverage, Verify, Watch, Analyze. Do not introduce a synonym for Flag.
> - No em dashes in customer copy. No filler: comprehensive, seamless, robust, game-changing, revolutionary,
>   unlock, leverage.
> - **Claim parity.** `watchableOutcomeKinds()` permits only **Checkout**, **Safe Signup**, and **Availability**
>   today. Safe Signup claims must name the reversible fixture requirement. Login, Password reset, Publish,
>   arbitrary form completion and agent evaluation must NOT be described as monitored behavior. Do not print
>   24/7, hourly, or page counts. Do not print 3/30/90. Never say "You're covered."
>   Never say "Resolved" without independent verification. There is a claim-parity test at
>   `CareHomepage.test.tsx`; keep it passing.
> - MCP is locally implemented and intentionally undiscoverable pending exact-client and production-canary proof.
>   Do not market it as launched or build a public acquisition page before those gates close.
> - No invented testimonials, member counts, revenue savings, conversion percentages, or fake reports. Examples
>   must use real attributable samples with honest illustrative labels.
> - "100+ automated tests" is substantiated by 201 registered check IDs. Do not inflate the number.
> - Respect `DESIGN.md` tokens and the approved brand orange. Do not redesign the identity.
> - Do not build a Tests tab, a raw Runs dashboard, or an MCP control center. The information architecture is
>   **what FixFlags is watching** and **what needs attention**.
>
> **Verify before you report done.** Run `npm run agent -- verify`, then actually render the pages at mobile and
> desktop and look at them. Confirm claim parity still passes. Report what you changed, what you deliberately did
> not change, and any claim you could not make honestly.

---

## Part 7. Handoff prompt: everything else

Run this measurement foundation before the public comparison experiment. Coordinate any parallel work through
the board so analytics call sites, copy and shared verification files have one owner each.

---

> You are establishing FixFlags' conversion measurement and go-to-market foundation. Work in
> `/Users/saadbenryane/Code/FixFlags`. Read `AGENTS.md`, `docs/growth/competitive-and-conversion-briefing.md`,
> `lib/analytics/`, `docs/growth/metrics.md`, `docs/growth/experiments.md`, and
> `lib/analytics/events.ts` first.
>
> **Context.** FixFlags is an independent monitor for live software that watches whether important Outcomes
> still work and is intended to prove recovery after a fix. The local Checkout path exists; exact-client and
> production proof remain open. Free: one site weekly. Pro: $49/site/month daily, waitlist, Stripe
> closed. The current conversion baseline is **not reproducible** from committed artifacts. The last committed
> GA4/GSC exports were fetched on 2026-09-08 and do not support the 17-start/3-completion claim. Refresh the
> attributable baseline before diagnosing abandonment or evaluating conversion work.
>
> **Your ordered work.** Items 1 through 7 and 11, 12, 17, 20 of the plan in the briefing. In order:
>
> 1. **Use the attributable Site cohort already implemented locally.** Do not add the Site lifecycle to the
>    browser-only `FunnelEvent` union. `SiteLifecycleEvent` is the durable registry. The admin cohort fixes each
>    anonymous start by `analyze_started:<auditId>`, matches the exact `first_useful_result:<auditId>`, and reads
>    later claim state without removing claimers from the denominator. Deploy it and capture a dated read.
> 2. **Use the locally implemented visitor-to-start bridge.** A random `journey_id` is created only after
>    analytics consent, attached to GA4 `landing_view` and the exact immutable Site start, then joined through
>    result and later claim. Register the event-scoped GA dimension, deploy it, and capture a dated export.
>    Never substitute the private Site-owner cookie, persist raw URLs, or report missing/partial telemetry as zero.
> 3. **Publish a dated funnel baseline.** Replace "Tracked" with real values for signups and paid conversion.
>    Every later claim needs a denominator.
> 4. **Measure start-to-result loss.** Establish unique denominators, then locate loss between submit, validation,
>    waiting and the first useful result. Do not reuse the unsupported 82% figure.
> 5. **Measure scan duration median and p90.** Until measured, the hero must not claim speed. Treat latency as a
>    hypothesis until it correlates with loss.
> 6. **Return the strongest scoped result when deep analysis fails.** Keep Couldn't verify explicit for unfinished
>    scope; do not translate partial availability into healthy coverage or call quiet findings Flags.
> 7. **Fix the Flag overcount on the Site board** so POLISH and low-confidence rows stop presenting as things
>    needing attention.
> 8. **Rewrite `docs/growth/competitors.md`** from the briefing's Part 2, with sources and dates. The current
>    file has two of three named competitors misidentified and describes retired positioning. Preserve
>    superseded claims as history; never delete accumulated knowledge.
> 9. **Update `knowledge/market.md`** and `docs/voice-and-copy.md` only after the scenario audit establishes the
>    bounded competitive set and a differentiator the product has proven.
> 10. **Fix the waitlist conversion path.** With Stripe closed the waitlist is the revenue path. Capture why,
>     position as getting Checkout monitored rather than joining a beta, and give a real reason to act now.
> 11. **Stand up the conversion review loop.** Weekly funnel read against items 1–3. Pre-register every
>     intervention in `docs/growth/experiments.md` using the existing template, with a baseline, one primary
>     metric, one guardrail, an observation window, and a decision rule. Append dated observations. Never rewrite
>     a baseline after seeing results.
> 12. **Add a CI claim-parity check** that fails the build when a public claim asserts a roadmap capability as
>     shipped. Put it beside `scripts/marketing-artwork-guard.mjs`.
>
> **Constraints.**
>
> - Never claim a metric that is not measured. If it cannot be computed, instrument it or leave it out.
> - Do not present roadmap capability as shipped. Two registered SEO experiments are implemented but undeployed;
>   flag that rather than papering over it.
> - Attribution is mandatory on any link into the audit flow, per `docs/growth/growth-architecture.md`.
> - Keep acquisition and subscription lifecycle facts separate. Do not label independently sourced totals as a
>   conversion funnel.
> - Do not open Stripe. Do not invent new prices, quotas or SLAs.
> - Do not modify `lib/marketing/copy.ts` strings unless item 10 requires it; visual copy belongs to the design
>   workstream.
>
> **Verify before reporting.** Run `npm run agent -- verify`, then `npm run agent -- eval growth`. Run
> `rg "trackEvent\('" --glob '*.{ts,tsx}' -g '!node_modules'` and confirm every new event has a call site.
> Report the baseline numbers you established, the funnel stages you made measurable, and honestly state which
> diagnoses remain unresolved.

---

## Part 8. Evidence ledger

Observed 2026-10-02 unless the source itself supplies a different date. These links support only the bounded
claims described below.

| Subject                    | Primary source                                                                                                                | What it supports                                                                                                           | What it does not support                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Checkly MCP                | [Checkly June 2026 release](https://feedback.checklyhq.com/changelog?c=New)                                                   | OAuth MCP access can inspect results and trigger deployed checks on demand                                                 | That Checkly owns or lacks FixFlags-style Outcome, Flag, recovery or recurrence semantics |
| Datadog MCP                | [Datadog MCP Synthetics tools](https://docs.datadoghq.com/mcp_server/tools/)                                                  | Datadog exposes Synthetics tools through MCP                                                                               | A complete post-fix browser recovery loop or its absence                                  |
| Dynatrace MCP              | [Dynatrace MCP server](https://docs.dynatrace.com/docs/dynatrace-intelligence/dynatrace-mcp)                                  | Dynatrace provides an official MCP server for queries and investigation                                                    | A Synthetics trigger or post-fix Outcome verdict                                          |
| Checkly pricing            | [Checkly pricing](https://www.checklyhq.com/pricing/)                                                                         | Hobby, Starter and Team pricing and included browser-check runs at observation time                                        | Agentic Check unit economics not shown on that surface                                    |
| Katalon Scout              | [Scout](https://scoutqa.ai/)                                                                                                  | URL-first checks, free/waitlist status and Katalon ownership                                                               | Authenticated journeys, Product Hunt status or future pricing                             |
| UptimeRobot                | [UptimeRobot pricing](https://uptimerobot.com/pricing/)                                                                       | Free 50 monitors at five-minute intervals and current annual paid tiers                                                    | Browser-journey or recovery semantics                                                     |
| Shopify Uptime             | [Shopify App Store listing](https://apps.shopify.com/uptime)                                                                  | USD 29 entry tier, USD 99 Pro tier with automated UI tests, Jagged Pixel ownership and checkout-oriented marketing         | Exact journey configuration, independence or recovery semantics                           |
| Cloudflare Agent Readiness | [Cloudflare announcement](https://blog.cloudflare.com/agent-readiness/)                                                       | Free URL score, agent handoff prompts and its own MCP scan tool                                                            | Outcome monitoring or post-fix recovery                                                   |
| Agent Status reliability   | [March report](https://agentstatus.dev/march-2026-report) and [April drift report](https://agentstatus.dev/april-2026-report) | Vendor-reported separation of availability, semantic quality and later behavioral drift in its fleet                       | FixFlags capability, Checkout recovery, customer demand or coding-agent correctness       |
| Agent Status MCP           | [September MCP report](https://agentstatus.dev/state-of-mcp-reliability)                                                      | Vendor-reported public-fleet grades and schema-fidelity observations                                                       | Demand for FixFlags or uniqueness of its proposed MCP surface                             |
| FixFlags GA4 snapshot      | [`ga-summary.json`](metrics/ga-summary.json) and [`ga-events.json`](metrics/ga-events.json)                                   | Export fetched 2026-09-08: 468 users, 549 sessions, 1,120 views, 19 `started_audit` events and 14 `audit_completed` events | Unique audit conversion, organic attribution, or the document's earlier 17/3 funnel       |
| FixFlags GSC snapshot      | [`gsc-summary.json`](metrics/gsc-summary.json)                                                                                | Export fetched 2026-09-08: seven clicks, 53 impressions, all clicks branded                                                | Current October demand, exact rank, or conversion                                         |

### Revalidation rule

Before a competitor fact enters public copy or a roadmap decision, record the exact URL, observation date,
claim, scenario tested and known limitation. For absence claims, say what surfaces and scenarios were checked.
One counterexample invalidates an exhaustive "none" claim; it does not automatically invalidate the narrower
FixFlags product hypothesis.
