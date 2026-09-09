# FixFlags messaging

**Canonical customer-facing language. Status: NEXT for public surfaces; this document is the source of truth for new copy. Runtime strings still live in `lib/marketing/copy.ts` until the relevant waves in [product-masterplan.md](product-masterplan.md) land.**

The [vision](../knowledge/vision.md) owns product direction. [SOUL.md](../SOUL.md) owns personality. [Evidence rules](../knowledge/evidence-rules.md) own certainty, coverage, and recovery. This file owns how FixFlags speaks: positioning, vocabulary, voice, and rules for future copy.

Where the vision narrative uses older phrases such as “Check my website” or “Find → Understand → Fix → Verify,” this canon is authoritative for public language. Do not invent a second messaging system in marketing modules, help articles, or skills.

## Customer

FixFlags is for people whose website, shop, app, landing pages, funnels, ads, forms, tracking, or other online experiences contribute to making money.

Typical readers are technically literate: developers, technical founders, ecommerce operators, growth teams, agencies, and operators of businesses that depend on an online product. Do not dumb the product down. Technical words are useful when they carry meaning.

## Problem

Their business is constantly changing. Products change. Code gets deployed. Copy changes. Landing pages change. Ads start and stop. Traffic shifts. Integrations change. Forms change. Tracking breaks. Teammates ship things. Customer journeys evolve.

Every change creates risk. A broken checkout can cost revenue. A broken form can lose leads. A slow landing page can waste paid traffic. Broken tracking can hide what is happening. A bad deployment can damage an important customer journey.

The customer should not have to continuously check all of this themselves.

## Positioning

FixFlags is continuous monitoring for businesses that depend on their website.

The first analysis is the acquisition experience. Continuous monitoring is the product.

The product should feel like something you turn on and trust to keep watch. The customer keeps building. FixFlags monitors the live experience. When something important happens, FixFlags raises a Flag.

We sell risk reduction and awareness. We do not make legal or absolute guarantees. Use concrete risk to create urgency, then return to reassurance. Do not fear-monger. Do not hide consequences.

## Emotional promise

The brand line remains:

**Your website, looked after.**

The emotional positioning lives between:

**Keep building. FixFlags keeps watch.**

and:

**Know when something breaks without looking for it.**

Calm assurance, not dashboard guilt. The primary value is not “come check your dashboard every day.” It is “FixFlags is keeping watch.” Interrupt the customer only when something warrants their attention.

## Product truth

FixFlags does more than apply a generic checklist to URLs. It learns what the website appears to be trying to do. It uses the live website like a visitor and can reason about the key flows the business depends on. That understanding gives weight to its Flags.

A useful underlying idea is “monitoring that understands your website.” Do not automatically use that exact sentence. Express the idea succinctly. Do not explain the implementation in long paragraphs.

The customer still has a dashboard and can inspect everything. That is available depth, not the job to be done.

## Governing principle

**Analyze broadly. Flag what matters.**

This is a durable rule for language and product behavior.

**Analyze broadly** means FixFlags may inspect many technical, experiential, search, performance, security, tracking, accessibility, commerce, and Journey signals. Breadth is how FixFlags understands the website. It is not a promise that every signal becomes customer work.

**Flag what matters** means only findings important enough to warrant customer attention become Flags.

Do not use “analyze everything” as an absolute public claim. Broad analysis gives depth. Flags give attention. Recommendations give optional improvement.

A customer with 0 Flags may still have detailed analysis and Recommendations available. This principle exists to prevent FixFlags from becoming a noisy audit tool.

The dashboard can be deep. Notifications stay quiet. The product feeling is: I connected my website. FixFlags understands what matters, keeps monitoring it, and tells me when I should care. Not: I bought a website auditing dashboard and now I have another list to manage.

## Voice

Desired voice: concise, technical, confident, calm, precise, useful, benefit-led, minimal, credible.

Think sophisticated SaaS language with Apple-like restraint.

Do:

- One important idea, expressed once, exceptionally well
- Familiar words, concrete behavior, active sentences
- Lead with the human effect, then offer technical evidence
- Use technical words when they carry meaning: monitoring, automated tests, browser journeys, performance, SEO, security, tracking, integrations, MCP
- Name real failures plainly when evidence warrants them: broken, unavailable, failing

Do not:

- Bloated SaaS copy, consultant language, vague claims
- Excessive explanation or unnecessary terminology
- Patronizing reassurance, fake urgency, fear about AI tools
- Unsubstantiated loss claims, invented coverage, testimonials, or member counts
- Em dashes in newly authored customer copy
- Filler such as comprehensive, seamless, robust, game-changing, revolutionary, unlock, leverage

## Tone by moment

| Moment | Tone |
| --- | --- |
| Acquisition | Calm confidence. URL in. Analyze. |
| Risk | Concrete consequence, then reassurance that FixFlags is watching |
| Healthy | Quiet. 0 Flags. Coverage remains visible. |
| Flag | Direct, specific, ready to act. No drama. |
| Fix | Useful. The customer, a teammate, an agency, or an AI coding tool does the work. |
| Verify | Matter-of-fact. FixFlags returns to the live experience. |
| Notification | Sparse. Only when a Flag warrants interruption. |
| Privacy | Present and true. Never a homepage manifesto. |

## Canonical vocabulary

Use this vocabulary consistently unless a genuine product reason requires revision. Internal code may keep scan, audit, check, re-check, Outcome, and rubric identifiers.

| Term | Meaning | Customer-facing? |
| --- | --- | --- |
| Analyze | The initial website analysis. Primary acquisition CTA. | Yes |
| Monitor / monitoring | What FixFlags does continuously. Canonical product category. | Yes |
| Watch | Emotional brand verb. Prefer in lines such as “FixFlags keeps watch.” Not the product category. | Brand copy |
| Automated tests | The 100+ tests FixFlags runs. Prefer over “checks” in customer copy. | Yes |
| Journey | An important sequence a real visitor or customer attempts to complete. Purchase, Signup, Contact, Book, Donate. | Yes |
| Flag | A problem FixFlags believes is important enough to act on. Not every imperfection. | Yes |
| Recommendation | Something that could improve the site but does not currently warrant a Flag. | Yes, when the object exists |
| Fix | The action taken after a Flag. Not normally performed by FixFlags in the customer's repository. | Yes |
| Verify | FixFlags returns to the live experience and proves the result. | Yes |
| 0 Flags | Currently nothing important enough to act on. | Yes |
| Site | The persistent customer object being looked after. Not the first dashboard card. | Yes, as the product object |
| Pages | The explored pages of the Site. Preferred name for the first dashboard card. | Yes, as the card |
| Outcome | Internal/product-model name for an inferred business result. Customer copy should usually say Journey. | Internal unless confirmation UI needs it |
| Check | Internal execution of an automated test. Not a customer attention object. | Internal |
| Coverage | What was actually evidenced, when, and with what limits. Required near health claims. | Quiet, when health is claimed |
| Connection / integration | Authorized context that makes monitoring smarter. | Yes, as Integrations |

Do not accumulate parallel taxonomies such as checks, findings, issues, warnings, problems, alerts, and recommendations when fewer concepts communicate the same thing. The customer-facing set is Flag, Recommendation, and the states around them.

Retired as primary customer language: Check my website, Check, Site check, Needs attention, Checks passed, Fresh check passed, assessment, controlled example, Work with your AI, Copy prompt as the lead AI story.

## Analyze

Primary acquisition CTA: **Analyze**.

The URL input should be able to stand as:

`yourwebsite.com` `[ Analyze ]`

Do not make the CTA verbose. Possible supporting concept, not the button: “Get your website health.”

The first analysis can lead directly into the dashboard. Authentication may be requested when the visitor tries to continue interacting with the result.

Analyze is acquisition. It is not the branded loop. After Analyze, the product is monitoring.

Analyze is broad by design. The first result should not dump every finding as a Flag. Show what FixFlags understood, then Flag what matters.

## Monitor

Preferred category language: “FixFlags monitors your website.”

“Watch” may be used in emotional brand copy. Monitoring is the canonical product concept.

Do not frame FixFlags as another system the customer must constantly operate.

The feeling:

1. Add the website.
2. FixFlags understands it.
3. FixFlags monitors it.
4. FixFlags lets you know when something important happens.
5. Open the Flag when you need the details.

Public cadence claims must match released entitlements. “24/7 monitoring” is allowed only with an honest frequency. Do not imply omniscience or an SLA.

## Automated tests and journeys

Preferred language: **100+ automated tests**.

Pair with real browser journeys where useful:

**100+ automated tests. Real browser journeys.**

The number is credibility, not the product. Do not reduce FixFlags to a generic SEO or site-audit checklist. FixFlags chooses tests that fit what the website appears to be trying to do.

As of the 2026-09-09 audit, `lib/audit/check-ids.ts` registers 201 deterministic check IDs. “100+” is substantiated. Recheck the count before raising the advertised number.

## Journey

A Journey is an important sequence a real visitor or customer attempts to complete.

Examples: Purchase, Signup, Contact, Book, Donate.

The product model may still infer Outcomes. Customer-facing copy should usually name the Journey, not the implementation. Confirmation UI such as “Looks right · Edit” can remain when the product asks the customer to confirm understanding.

## Flag

A Flag is a problem FixFlags believes is important enough to act on.

Business importance and context determine a Flag. Internal severity is a signal, not the customer taxonomy.

Do not assume POLISH = Recommendation. Do not assume CRITICAL = Flag. A technically minor failure may deserve a Flag if it affects a critical Journey. A technically significant optimization may remain a Recommendation if nothing meaningful is currently impaired.

Examples of Flags:

- Checkout cannot complete
- Contact form cannot complete
- An active paid landing page returns 404
- A critical purchase event disappears
- A small regression on a high-volume conversion page, when magnitude and Journey importance warrant it
- An important page unavailable
- Significant performance degradation affecting an important experience

Likely Recommendations, not Flags:

- Missing optional metadata
- An SEO improvement opportunity that is not currently breaking an important experience
- A minor visual imperfection
- Performance change that is measurable but does not impair a Journey

Severity, category, confidence, Journey importance, traffic context, commerce context, and other evidence may contribute. Customer-facing alerts may be configured around those properties. Do not expose internal backend taxonomy merely because it exists.

A Flag should answer what happened, where, why it matters, what proves it, and what to do next. Every Flag should feel ready to fix rather than like a vague diagnostic.

Today every stored finding is a Flag row, including POLISH. Attention/Finish Plan already excludes POLISH and low-confidence items, but the Site board still counts every open Flag. Until a business-importance projector exists, do not claim that Flags are only what matters. See [product-masterplan.md](product-masterplan.md) FF-B1.

## Recommendation

A Recommendation is something FixFlags found that could improve the site but does not currently warrant a Flag.

Recommendations and detailed analysis may exist when the Site shows 0 Flags. They live in the dashboard for inspection. They do not interrupt.

They are not a second product, not a daily digest, and not a reason to notify.

Until the product can distinguish attention-worthy Flags from quieter findings using business importance, do not market Recommendations as a shipped taxonomy. Do not create extra words such as issues, warnings, findings, or checks to fill the gap.

## Fix

FixFlags itself does not normally edit the customer's repository.

The Fix may be performed by the customer, a teammate, an agency, or an AI coding tool.

Preferred customer actions:

- Fix this, when the next step is simply to act
- Send a Flag to your AI, when the customer wants to hand the Flag to an AI coding tool
- Share, when another person should receive the Flag

Copying a prompt records handoff, not implementation. External sending requires the customer's action.

## Verify

After the change is made, FixFlags returns to the live experience and verifies the result.

Verification belongs to FixFlags. Absence from a later scan is not verification. “Done” is not verification.

Avoid language such as “Fresh check passed” when a simpler product state communicates the result. Prefer: verified, still open, inconclusive, couldn't verify.

## 0 Flags

**0 Flags** is the canonical healthy attention state.

It means: there is currently nothing important enough to act on.

It does not mean every possible optimization has been completed. Recommendations and detailed analysis may still exist.

It does not mean untested behavior is healthy. Coverage, scope, and freshness still qualify the claim. If required areas were never evidenced, say that. Do not translate incomplete coverage into 0 Flags as a green all-clear.

Required customer states, without extra taxonomy:

| Situation | Customer presentation |
| --- | --- |
| Required areas evidenced, nothing important enough to act on | 0 Flags, plus useful metrics |
| Analysis still running | Learning / Checking. Not 0 Flags. |
| Required area never evidenced | Coverage incomplete / not verified yet. Not 0 Flags. |
| Browser run failed or blocked | Couldn't verify that area. Not 0 Flags. |
| Results are stale | Last known, distinguished from current. Not a fresh all-clear. |
| Monitoring not scheduled | First analysis only. Do not say you're covered. |
| Integration disconnected | Existing answer remains; missing context explicit |
| Recommendations exist with 0 Flags | 0 Flags on the face. Recommendations in card depth. |

## Flag. Fix. Verify.

Replace the four-step conceptual model Check → Flag → Fix → Verify, and the earlier Find → Understand → Fix → Verify, with the customer-facing loop:

**Flag. Fix. Verify.**

Conceptually, monitoring continues around it:

Monitor → Flag → Fix → Verify → Monitor

The customer-facing expression should usually remain **Flag. Fix. Verify.**

Responsibility:

| Step | Who |
| --- | --- |
| Flag | FixFlags finds what matters and raises a Flag |
| Fix | The customer, team, agency, or AI coding tool |
| Verify | FixFlags returns to the live experience |

Do not mechanically repeat the loop on every surface. Use it where it teaches the product: homepage, onboarding, Flag detail, notifications, documentation, and AI workflows.

## Dashboard language

The dashboard should communicate primarily through:

- category
- status as Flag count
- one useful metric
- Flags, when they exist

Avoid redundant prose.

Direction:

| Category | Flags | Metric |
| --- | --- | --- |
| Performance | 3 Flags | 3.1s |
| Search | 0 Flags | 12 pages |
| Security | 0 Flags | Protected |

The useful metric makes a healthy card informative. Clicking a card reveals the detailed analysis.

The first dashboard card is currently named Site. Prefer **Pages**. It represents the pages FixFlags discovered and explored, and it is the object the customer inspects in that card's detail. Keep Site as the persistent product being monitored, and as navigation for coverage, connections, and configuration.

Avoid:

- “Security: Checks passed”
- “Search: Checks passed”
- “Site: Checks passed”
- “Needs attention”
- “Fresh check passed”
- “Looking good” as a substitute for 0 Flags plus a metric

## Notifications

FixFlags performs broad analysis. Flags identify what matters. The dashboard can expose detailed results and Recommendations. Notifications are different.

Notify when a new Flag warrants it according to the customer's notification settings.

Target modes, to be named when settings exist:

- Flags (interrupt when a Flag warrants it)
- Flags and Recommendations, only if a quieter digest is truly needed
- Custom

Do not ship a customer label called “Everything” if it trains people to expect noise. Finding something and interrupting somebody are different decisions. Translate internal taxonomy into the simplest useful customer language.

A strong notification should feel like:

**1 Flag**
Contact form stopped confirming messages.

The product should feel quiet when nothing important is happening. Finding something and interrupting somebody are different decisions.

These modes are the target language. General Site notification settings are not shipped. Do not describe them as current product behavior.

## Integrations

Integrations strengthen the intelligence. The more relevant context FixFlags can connect, the better it can understand what deserves attention.

Examples of the idea:

- Shopify can add commerce context
- Meta can add paid-traffic context
- Analytics and tracking can add visitor behavior context
- Deployment or change information can connect a new problem to something that changed

If an active ad is sending meaningful traffic to a landing page and performance deteriorates, FixFlags can give that area greater attention.

Do not overpromise. Separate current product truth from future messaging. Shopify is a real connection and native install path. Meta, Analytics, Search Console, and deployment context are planned increments, not current homepage proof.

Integrations make FixFlags smarter. They are not a marketplace and not a second product.

## AI and MCP

AI is an important secondary capability, not the primary positioning of FixFlags. The core product must remain valuable if the customer never uses an AI coding tool. Do not erase MCP from the strategy because it is not homepage-ready.

### Customer concept

**Send a Flag to your AI.**

FixFlags can provide the context required to work on the Flag: the Flag itself, evidence, URL or session reference, reproduction, expected result, recommended fix, and verification criteria. Journey and Site context belong in that handoff when they exist.

Do not lead a general customer with “Connect FixFlags through MCP.” Lead with the outcome.

### Available implementation today

The shipped customer path is copying a ready-to-fix prompt that contains Flag context. Flag actions expose Fix this, Copy prompt, Share, and Verify fix. Anonymous visitors see evidence; fix prompt bodies stay gated until claim. FixFlags does not edit the customer's repository.

### Deeper / future integration

MCP is strategically important as a standard way for AI tools to access product context. The HTTP MCP surface, CLI, and API keys exist in the repository and are **parked** from production discovery (`proxy.ts`). Do not present MCP as generally available until the experience is customer-ready.

Surface MCP when it is real:

- developer documentation
- integrations or settings, for people who ask how
- Flag handoff, as a progressive option beside copy
- future AI connection setup
- homepage only once the experience is useful without a paragraph of instructions

The monitoring product stays primary. Richer MCP workflows are a secondary path, not a repositioning.

## Two AIs

Do not collapse these into one “AI” feature.

### FixFlags Agent

The intended in-product assistant is a persistent control, typically bottom-right, available throughout the Site. Its job is to help the customer understand and operate FixFlags. It is grounded in Site, Pages, Journeys, Flags, Recommendations, monitoring, and connections. It can explain, navigate, gather context, help the customer fix, send a Flag to their coding AI, and escalate to human support with that context preserved.

This is **not** the current legacy report Agent pane. Do not market the FAB until it exists. Do not build a competing Agent destination beside Home and Flags. Until it ships, Help and live support remain the human path.

Allowed later: explain, navigate, gather context, confirmed Verify or Watch changes, support escalation. Not by default: silent repo writes, pausing ads, deploying, placing orders, or fabricating evidence.

### Customer's coding AI

External tools that implement a Fix. Customer concept: **Send a Flag to your AI.** Mechanism today: copy a prompt. Later: richer payload and optional MCP. FixFlags does not edit the customer's repository.

If a sentence could mean either assistant, rewrite it until the job is obvious.

## Privacy

FixFlags does not sell customer data. Customer data is not the business model. Minimize collection of unnecessary data where practical.

Find the right place and level of emphasis on the marketing site and supporting documentation. Do not turn the homepage into a privacy manifesto.

Preferred homes: Privacy page, a short FAQ answer, and a quiet line in account or help copy. If a marketing line is needed, keep it one sentence and true.

## Homepage direction

Retain:

**Your website,**
**looked after.**

Supporting message should combine monitoring, 100+ automated tests, real browser journeys, and flagging what matters. Do not force every capability into one sentence. Distribute across headline, one short supporting sentence, CTA, and small proof points.

Primary CTA: Analyze. The interaction begins with a URL.

Introduce concrete business risk where useful, then return to reassurance.

Dashboard preview: Flag counts, useful metrics, no “Controlled example, not a live assessment.” If a demo designation is required, use a subtle Sample treatment. Add a natural CTA after the preview.

How FixFlags works: Flag. Fix. Verify. Responsibility must be obvious almost instantly.

Coverage section: Analyze broadly. Flag what matters. 100+ automated tests, real browser journeys, and understanding of what the business depends on. Do not present FixFlags as a generic checklist.

Integrations: make FixFlags smarter. Do not promise unsupported integrations.

AI: one strong secondary story around Send a Flag to your AI. Do not explain copying prompts several times.

## Examples

Good:

- Keep building. FixFlags keeps watch.
- Analyze broadly. Flag what matters.
- yourwebsite.com / Analyze
- 100+ automated tests. Real browser journeys.
- 1 Flag. Contact form stopped confirming messages.
- 0 Flags
- Performance · 3 Flags · 3.1s
- Send a Flag to your AI.
- A broken checkout can cost sales before anyone notices.
- Paid traffic should never be landing on a broken page.
- We do not sell your data.

Acceptable brand color, not product category:

- You keep building. FixFlags keeps watch.

## Anti-examples

- Check my website
- Check → Flag → Fix → Verify as the public loop
- Find → Understand → Fix → Verify as the public loop
- Needs attention
- Checks passed
- Fresh check passed
- Controlled example, not a live assessment
- Work with your AI as the lead AI story
- Copy prompt as the homepage AI headline
- Connect FixFlags through MCP as a general-customer lead
- MCP presented as generally available while it is parked
- POLISH treated as a synonym for Recommendation
- Every stored finding counted as a Flag on the board
- Analyze everything, as an absolute claim
- Site as the first dashboard card name when the card is the page inventory
- You're covered, before monitoring is actually scheduled
- Zero Flags presented as omniscience
- A giant score as the product
- Deployments, paid traffic, or real-visitor failures claimed as shipped coverage
- Hourly monitoring claimed while Watch maxes at daily
- Fear-mongering revenue-loss estimates without evidence

## Rules for future copy

1. One source of truth: this file for language; `lib/marketing/copy.ts` for rendered strings.
2. Change public claims only with corresponding behavior. Roadmap capabilities are not shipped.
3. Prefer centralized customer-facing labels over prose scattered through components.
4. Separate internal machine states from customer-facing labels. `healthy`, `attention`, and `problem` are not copy.
5. If a sentence needs a disclaimer to be true, the claim is wrong. Tighten the claim.
6. If a concept needs a paragraph of taxonomy to explain, the concept is wrong. Use Flag, Recommendation, or stay quiet.
7. Risk creates urgency. Monitoring creates calm. End on calm.
8. Do not add a synonym for Flag. Do not call a Flag an issue, warning, finding, or check in customer UI.
9. Do not ask the customer to operate FixFlags. Ask them to keep building.
10. Analyze broadly. Flag what matters. If a copy change would turn FixFlags into a checklist the customer must operate, it is wrong.
11. When in doubt, cut.

## Sentence rules

Use familiar words, concrete behavior, and active sentences. Lead with the human effect, then offer technical evidence. No em dashes in newly authored customer copy.

Short copy must still communicate uncertainty and scope. Do not ban useful factual words such as “broken” when a real failure warrants them.

Confirmed, Likely, Couldn't verify, and Healthy follow the [evidence rules](../knowledge/evidence-rules.md). A live server is not a healthy purchase flow. “Resolved” needs fresh independent verification of the relevant behavior. A deployment-time correlation must not become an asserted cause.

## Marketing transition

“Finish what your AI started”, report-first promotion, Shopify-only company positioning, and separate website/funnel product language remain retired.

Shopify can have a tailored native entry and page as “FixFlags for Shopify,” serving the same product.

The homepage, how-it-works, pricing, navigation, metadata, social previews, samples, public docs/help, emails, notifications, and Shopify listing must be reconciled as their corresponding behavior ships. The brand line cannot imply monitoring is active before it exists. Use real Site and Flag evidence for proof.

Implementation order: [product-masterplan.md](product-masterplan.md). Information architecture: [product-architecture.md](product-architecture.md).
