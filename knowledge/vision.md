# Vision

**Canonical home for the FixFlags product vision.** Do not restate this narrative elsewhere. Link here.

## North star

**MAKE EVERY PRODUCT CONTINUOUSLY IMPROVE ITSELF.**

## Customer-facing wedge

**FINISH WHAT YOUR AI STARTED.**

## One-sentence definition

FixFlags is the independent Product Intelligence System that helps humans and AI continuously understand, improve, verify, and evolve a product without losing what makes it valuable.

## The long-term idea

AI makes software creation effectively unlimited. Product judgment does not scale at the same rate. FixFlags exists to close that gap.

FixFlags should continuously observe products, listen to users, understand what matters, identify problems and opportunities, coordinate improvements, verify whether they actually worked, remember the outcome, and make the next cycle smarter.

The company should ultimately automate product sense at scale.

This is not a request to immediately build every part of the long-term vision. Preserve the sharp zero-setup product we already have and evolve the architecture, language, data model, UX, and roadmap so everything we build compounds toward this future.

## The problem

AI made software implementation abundant. Products become fragmented, unfinished, inconsistent, and disconnected from their original purpose. Every prompt changes part of the product. Different agents optimize local tasks. Nobody continuously protects the product as a whole.

The scarce resource is product judgment.

## Core insight

Every evolving product needs an independent intelligence that continuously understands what the product is, why it exists, who it serves, how it should behave, what currently exists, what changed, where it is drifting, what should improve next, and whether a change actually made it better.

This intelligence must persist across models, agents, IDEs, repositories, deployments, contributors, and years of evolution.

## Core object

**The Product** — not the repository, website, code, prompt, deployment, or documentation. Those are signals. Everything in the system should ultimately improve the Product.

A review, scan, or report is an observation of the Product at a moment in time. The Product is the persistent long-term object.

## Product identity

Every product has an intended identity and an actual current state. The distance between them creates unfinished work, drift, inconsistency, debt, UX failures, weak positioning, and broken journeys. FixFlags continuously reduces that distance.

## The Flag: atomic object of FixFlags

A Flag means:

> Something about this product is broken, confusing, missing, risky, underperforming, inconsistent, or could materially be better.

A Flag may eventually originate from:

- FixFlags using the product itself
- deterministic checks
- AI product judgment
- a customer support conversation
- direct user feedback
- session/replay behavior
- analytics
- an error or network failure
- a deployment/regression
- an employee
- another agent
- another connected system

All of these are signals. FixFlags turns signals into product understanding and action.

Shipped Flag anatomy, evidence classes, and severity discipline: [evidence-rules.md](./evidence-rules.md).

## Canonical improvement loop

**SIGNAL → UNDERSTAND → PRIORITIZE → FIX → VERIFY → LEARN**

The loop never really ends. Every completed cycle should improve both the product and FixFlags' understanding of that product.

The customer-facing wedge loop remains **Product Review → Fix → Verify → Watch** ([PRODUCT.md](../PRODUCT.md)): paste a URL, see real evidence, fix, update review, watch after every deploy. The canonical loop is the internal model that the wedge experience already implements in miniature and that the long-term system expands to every signal source.

## Product philosophy

FixFlags is not fundamentally a QA tool, accessibility scanner, SEO tool, testing framework, chatbot, customer-support product, analytics product, bug tracker, or coding agent.

Those can all provide capabilities or signals. FixFlags' job is to understand the PRODUCT as a whole and help it continuously get better.

The key question is no longer only "Does it work?" FixFlags should eventually understand:

- Is it clear? Is it useful? Is it coherent? Is it usable?
- Is it trustworthy? Is it accessible? Can people find it?
- Are important journeys working? Are users struggling?
- What changed? What got worse?
- What should improve next? Did the improvement actually work?
- What should never regress? Is the product becoming better?

**Preserve deterministic truth wherever deterministic evidence is possible.** LLMs provide judgment and synthesis. They never replace deterministic product, billing, access, security, or verification truth.

## Human purpose

AI is making it possible to generate enormous amounts of mediocre software at machine speed. FixFlags should help ensure humans are not forgotten from the experience.

The deeper purpose: **machine-scale creation needs machine-scale product judgment.** FixFlags gives AI the feedback loop required to build products that remain useful, understandable, and worth using by humans.

Do not turn this into anti-AI messaging. FixFlags exists to make AI-created products better.

## Experience: a living product workspace

The signed-in FixFlags experience should increasingly feel like a living product workspace rather than a collection of static audit reports.

- **LEFT:** conversation + continuous product timeline
- **RIGHT:** the actual product + live browser + evidence + screenshots + journeys + mobile/desktop states + before/after

The user should be able to talk naturally with FixFlags:

- "What should I fix first?"
- "Why does this matter?"
- "Show me what happened."
- "Did my deployment make this worse?"
- "Is signup actually fixed?"
- "What are users struggling with?"
- "What changed this week?"
- "Make this better."

The chat is not a generic assistant layered on top of a report. It is grounded in the actual Product Intelligence available to FixFlags.

The timeline becomes the memory of the product:

review → flag discovered → evidence → decision → fix → deployment → verification → outcome → regression → learning

Traditional reports can continue to exist for public examples, sharing, SEO, clients, and snapshots, but the authenticated product should move toward one continuous relationship with each Product.

Current interface direction: [docs/workspace-interface.md](../docs/workspace-interface.md).

## Product Memory

A Report should not become the most important long-term object. **The PRODUCT should.**

For every claimed product, FixFlags should gradually build persistent Product Memory containing things such as:

- what the product is
- who it serves
- intended outcomes
- important pages
- important journeys
- product principles
- expected behavior
- current state
- known Flags
- evidence
- releases
- screenshots and visual history
- previous fixes
- accepted/rejected recommendations
- regressions
- user signals
- decisions
- relevant metrics
- what "good" means for this specific product

A scan/review is an observation of the Product at a moment in time.

Design current data structures and future migrations so we can evolve toward this without destroying the working review system. Do not prematurely create an over-engineered graph database if the existing relational model can represent this cleanly.

Shipped seed: `Project.productIntelligence` — the Product Contract is the MVP seed of Product Memory. Detail: [product-intelligence.md](./product-intelligence.md).

## Product Graph

The long-term intelligence object is a Product Graph:

Product → users/audiences → pages → features → journeys → messages → conversions → UI states → releases → signals → Flags → evidence → decisions → fixes → outcomes → expectations

This does not need to be implemented literally as a graph today. It is the conceptual model FixFlags should increasingly be capable of representing and querying.

Humans interact with this intelligence through FixFlags. Agents eventually consume it through APIs, MCP, CLI, and other machine interfaces.

This is distinct from FixFlags' internal growth graph (`graph_*`), which is cross-tenant SEO/market intelligence and never merges with customer Product Memory. See [product-intelligence.md](./product-intelligence.md).

## Fixing

FixFlags must remain independent from whichever coding agent created the product. Do not make unsolicited prompts appear inside users' Cursor, Claude Code, Lovable, or other AI tools. Users control how fixes happen.

Support three paths over time:

1. **Show me how / give me the fix context.**
2. **Let me use my preferred agent.**
3. **Fix it for me.**

For "Fix it for me", the preferred trust model is GitHub-native:

Flag → FixFlags prepares a change → isolated branch / PR → preview deployment if available → independent FixFlags verification → before/after evidence → human reviews/merges

**The system that creates a change should not be allowed to simply declare its own work correct. Verification must be a fresh independent evaluation.**

FixFlags should not become an IDE or compete primarily on code generation. Generation will commoditize. The strategic asset is the feedback loop that makes generated products converge toward good outcomes.

## Product packaging

Do not force one interface onto every customer. Architect around one intelligence system with multiple surfaces.

### FixFlags for Builders

Target: Lovable, Replit, Bolt, v0 and non-technical/AI-native builders.

Experience: paste URL → live review → conversational guidance → top priorities → evidence → easy fixes → re-check → optional GitHub connection → Fix it for me.

Should feel simple enough for a consumer.

### FixFlags for Developers

Target: Cursor, Claude Code, Codex, Windsurf, GitHub-heavy developers.

Experience: GitHub, CLI, MCP/API, preview environments, PR/deployment checks, machine-readable Flags, evidence, verification.

They choose whether they fix something themselves, use their preferred coding agent, or ask FixFlags to prepare the change.

### FixFlags for Companies

Target: companies with many engineers, repositories, and increasingly many software-building agents.

FixFlags becomes continuous product intelligence across their software:

- what changed
- what got worse
- what customer journeys are at risk
- where quality debt is accumulating
- which releases introduced regressions
- what users are struggling with
- what deserves attention
- whether product principles and standards remain intact

Same underlying Product Intelligence. Different surface. Do not build three disconnected products.

## Customer support and user signals

Customer support fits the vision, but do NOT turn FixFlags into another Zendesk. Support is another way the product speaks to FixFlags.

Eventually a support interaction such as "I paid but I still cannot access Pro" should be capable of becoming:

customer signal → Flag → account/session/product context → reproduce → detect affected users → prioritize → prepare or coordinate fix → verify → notify affected customer(s) → learn

The opportunity is not "AI chatbot support". The opportunity is closing the loop between what customers experience and what the product becomes.

Architect for support conversations, user feedback, and voice to become future signal sources. Do not build the full support stack now unless it directly advances the current core loop.

## Signal intelligence

Over time FixFlags should be able to combine:

browser observation · deterministic checks · customer feedback · support · session behavior · analytics · errors · network traces · deployments · repositories · agent activity

The difficult problem is not collecting infinite signals. The valuable problem is knowing **WHAT ACTUALLY MATTERS?**

FixFlags should become exceptionally good at prioritization. A great product person absorbs messy information and decides which thing deserves attention. That product judgment is what we are ultimately trying to scale.

## Global intelligence

Maintain a strict boundary between private Product Memory and generalized system learning.

- **Private:** everything FixFlags knows about one customer's product.
- **Global:** anonymized/generalized patterns learned across products where legally and ethically permitted.

The long-term learning loop may eventually understand relationships such as:

product context + stack + experience pattern + change + Flag + fix + verification + outcome

This can make future reviews and recommendations much better. Do not claim proprietary global intelligence before we have it. Design so validated outcomes can become useful training/evaluation data later.

## Long-term company

Do not optimize FixFlags toward becoming "a better Lovable". Generation itself is not the moat. The long-term advantage is the system's ability to make products **CONVERGE ON GOOD**.

Eventually:

human provides intent → agents create → real product runs → FixFlags experiences it → FixFlags raises and prioritizes Flags → humans/agents improve it → FixFlags verifies → system learns → loop repeats autonomously

Only after FixFlags becomes exceptionally good at this feedback loop does full product creation become strategically interesting. At that point, almost any capable generation system could sit underneath FixFlags. The product factory is valuable because it can converge toward quality, not merely because it can generate.

## Big-tech north star

The long-term ambition is larger than one customer's product.

GitHub understands code. Sentry understands errors. Analytics systems understand behavior. FixFlags should increasingly understand the PRODUCT.

If FixFlags succeeds across enough products, releases, journeys, Flags, and outcomes, it may eventually build deep intelligence about how software products behave and improve. That could one day power:

product improvement · product creation · agent context · software evaluation · software discovery · software recommendations · procurement · benchmarks · competitive intelligence · autonomous software operation

The long-term destination can be expressed simply as:

**FIXFLAGS UNDERSTANDS SOFTWARE.**

Do not use this abstract vision as the primary near-term sales pitch. Earn it through the wedge.

## Brand hierarchy

| Level | Expression |
|-------|------------|
| Immediate customer promise | FINISH WHAT YOUR AI STARTED |
| Company north star | MAKE EVERY PRODUCT CONTINUOUSLY IMPROVE ITSELF |
| Vision expression | SOFTWARE THAT GETS BETTER BY ITSELF |
| Core mechanism | FixFlags closes the product feedback loop |
| Strategic capability | Product sense at scale |

Avoid making "release readiness layer", "acceptance layer", "AI QA", "website auditor", or "coding agent" the permanent category definition. They are too narrow for the company we are building.

## Near-term product

Do not throw away what already works. The current URL review is the perfect wedge because it gives value before integrations:

paste URL → FixFlags experiences the real product → important Flags → evidence → conversation → fix → re-check

Then progressively:

claim product → persistent history → product memory → GitHub → deployments → continuous Watch → user signals → deeper integrations

The first activation should remain extremely low friction.

## Current rubrics

Message / Experience / Reach remain useful lenses. Do not make them the philosophical boundary of the system. They are currently useful ways to organize product judgment. Future signal types and capabilities may extend beyond them.

Preserve the current evidence hierarchy and severity discipline:

**Confirmed / Observed / Suggested** · **Blocker / High / Medium / Polish**

LLM-only opinion must never create deterministic certainty. Evidence first. Detail: [evidence-rules.md](./evidence-rules.md).

The Integrity Engine evaluates across five dimensions (Product, Experience, Design, Implementation, Agent); user-facing report rubrics remain Message / Experience / Reach until the thesis is validated. Mapping: [integrity-engine.md](./integrity-engine.md).

## Product Intelligence vs Integrity Engine

| Layer | Owner | Role |
|-------|-------|------|
| **Product Intelligence** | Customer | Persistent, customer-specific understanding of one Product |
| **Integrity Engine** | FixFlags | General reasoning and evaluation across products |

Detail: [product-intelligence.md](./product-intelligence.md), [integrity-engine.md](./integrity-engine.md).

Founding privacy principle: **FixFlags never learns your product. It learns how to understand products.** See [privacy.md](./privacy.md).

## Fix List

The main output answers: **What should we improve next?** Prioritized, scoped, evidence-backed, actionable, verifiable, continuously updated. See [finish-plan.md](./finish-plan.md).

## Business model direction

Current Free / Pro / Studio plans may remain during the wedge stage. Ensure the underlying entitlement model can eventually support different value models:

individual builders · professional developers · studios/agencies · continuous product monitoring · GitHub/repository usage · deployment volume · team/company usage · agent/API usage · enterprise governance

Do not prematurely redesign pricing without usage evidence. Detail: [strategy.md](./strategy.md); shipped pricing: [PRODUCT.md](../PRODUCT.md).

## System layers (target)

1. **Local runtime** — Inspect repo, portable PI files, CLI, hooks, CI; standalone value without full upload.
2. **Product Intelligence Protocol** — Vendor-neutral read/contribute API for humans, agents, and tools.
3. **FixFlags Intelligence Network** — Cloud compounding intelligence, prioritization, verification depth, collaboration.

Shipped today is primarily the cloud observer (browser scanner) plus MCP. Architecture target: [ARCHITECTURE.md](../ARCHITECTURE.md). Technical architecture spec: [technical-architecture-spec.md](./technical-architecture-spec.md).

## Interfaces

Web, browser observer, GitHub, CLI, MCP/agent integrations, and a lightweight agent skill all connect to the same Product Intelligence. Depth varies by user (basic AI builder vs advanced team).

Detail: [technical-architecture-spec.md](./technical-architecture-spec.md).

## Product principles

1. **The Product is the core object** — repos, URLs, code, and reports are signals; the Product is the long-term object.
2. **User value matters more than code output.**
3. **Understanding precedes action.**
4. **Verification precedes confidence.**
5. **Evidence precedes recommendations.**
6. **Prioritization guides action without hiding verified issues.**
7. **Product Intelligence must remain portable.**
8. **Privacy must be understandable.**
9. **The system must remain vendor-neutral.**
10. **Basic users receive simple outcomes; advanced users receive deep control.**
11. **The open layer creates adoption; the intelligence layer creates compounding value.**
12. **Every session should leave the Product easier to evolve.**
13. **Avoid complexity without proven user value.**
14. **Improve products; do not merely produce reports.**
15. **Show what happened** — every important conclusion must point to an observable moment.
16. **Test a job, not a fictional persona** — the task matters more than an invented identity.
17. **Never hide uncertainty** — say "Could not verify" when it cannot prove success or failure.
18. **Critical means confirmed** — a finding cannot be critical because a language model dislikes something.
19. **Outside-in first** — test the product that customers can actually access.
20. **Fix and verify in the same loop** — a recommendation without a re-check is incomplete.
21. **Earn the right to run continuously** — do not ask for GitHub, deployment, or credential access before demonstrating value on a public URL.
22. **Make scope visible** — the user must know exactly what was and was not checked.
23. **Preserve deterministic truth** — LLMs provide judgment and synthesis; they never replace deterministic product, billing, access, security, or verification truth.
24. **Independence from coding agents** — no unsolicited prompts inside users' tools; users control how fixes happen.
25. **Never self-certify** — the system that creates a change cannot declare its own work correct; verification is a fresh independent evaluation.
26. **Strict learning boundary** — private Product Memory and generalized learning never merge; never claim global intelligence we do not have.
27. **Prioritization is the product** — the valuable problem is knowing what actually matters, not collecting infinite signals.
28. **Evidence first** — LLM-only opinion must never create deterministic certainty.

Detail on evidence: [evidence-rules.md](./evidence-rules.md).

## Decision filter

For every major feature, ask:

- Does this make FixFlags better at **understanding** a product?
- OR does this make FixFlags' understanding more **useful in improving** the product?

If neither is true, question why we are building it. Do not chase adjacent SaaS categories for their own sake. Build the feedback loop.

## Success criteria

Near-term success is NOT how many checks we have. It is whether the loop works:

builder changes product → FixFlags finds something meaningful → builder acts → FixFlags verifies → builder returns after another change

Measure things such as:

- meaningful Flags discovered
- high-impact Flags acted upon
- Flag resolution rate
- verification/re-check rate
- repeat product reviews
- time from Flag to verified improvement
- products connected for ongoing monitoring
- users returning after deployment

Long-term success is: FixFlags understands enough about a product to continuously identify and drive the improvements that matter.

## SHIPPED / NEXT / VISION

Separate clearly:

- **SHIPPED** — what FixFlags actually does today.
- **NEXT** — what we are deliberately building toward.
- **VISION** — where the company can go if the loop works.

The public product must never claim capabilities that are not shipped. Shipped truth: [PRODUCT.md](../PRODUCT.md). Roadmap: [ROADMAP.md](../ROADMAP.md).

## Non-goals

Not a general coding agent, IDE, chatbot, PM tool, backlog generator, static docs generator, one-time website audit, code linter with product branding, autonomous product executive, or a system that requires surrendering ownership of product knowledge.

Not an AI website audit, autonomous QA agent, synthetic user platform, test-generation tool, or customer-support platform (another Zendesk). The independent system between the AI builder and the live product.

Full product creation is not a near-term goal; it becomes strategically interesting only after the feedback loop is exceptionally good (see [Long-term company](#long-term-company)).

## Moat

Not a prompt, model, scanner, MCP integration, or Markdown files alone.

### Near-term moat
Strong brand, better report design, higher finding precision, evidence-first trust, fast fix and verify loop, cross-builder independence, excellent distribution through free checks, agency workflow.

### Medium-term moat
Persistent product and journey memory, saved success assertions, verified history across deployments, change-to-journey mapping, builder and deployment integrations, evaluation benchmark, customer-specific standards.

### Long-term moat: the verified outcome graph
Product pattern → journey → observed problem → accepted fix → deployed change → verified result.

The compounding asset is the system's ability to make products **converge on good** — the feedback loop between abundant generation and scarce judgment.

Detail: [growth.md](./growth.md#defensibility).

## Final principle

Generation becomes abundant. Judgment becomes scarce.

FixFlags should own the feedback loop between the two.

Today: Finish what your AI started.
Tomorrow: Software that gets better by itself.
North star: Make every product continuously improve itself.

## Related

- Principles: [foundations.md](./foundations.md)
- Three products: [product-system.md](./product-system.md)
- User journey: [user-journey.md](./user-journey.md)
- Evidence rules: [evidence-rules.md](./evidence-rules.md)
- Growth: [growth.md](./growth.md)
- Shipped truth: [PRODUCT.md](../PRODUCT.md)
- Near-term work: [execution.md](./execution.md)
- Business direction: [strategy.md](./strategy.md)
- Open source: [open-source.md](./open-source.md)
