# Market & Distribution

## Market Context

- AI coding is mainstream (2025 DORA research: near-universal in developer workflows)
- Gap exists between adoption of AI coding and adoption of AI testing tools
- FixFlags targets the trust gap in AI-generated output
- Market is moving fast: Lovable reportedly surpassed $500M ARR (June 2026), Cursor reportedly passed $2B annualized revenue (early 2026)
- AI-building workflows have reached a large, paying market

## Category Status

The category is still forming. Users clearly feel the problem but the language is not "QA" or "auditing."

User language is highly consistent:
- "I'm afraid I launch and it breaks."
- "It says everything is fixed."
- "I need someone to try to break it."
- "It mostly works."
- "How do I know it's safe?"
- "Testing is taking most of the work."

**Entry point must remain extremely literal:**

> Check the app before you launch it.

**Strongest emotional promise:**

> Know what will break before real users find it.

The category can become more sophisticated later. Avoid leading with QA, auditing, or release readiness.

## Competitive Landscape

### Direct competitors

| Competitor | What they do | Implication |
|-----------|-------------|-------------|
| Scout QA | AI quality companion for vibe-coded products. Traffic-light reports, fix prompts, regression tracking, Lovable-specific workflows. | URL-first QA is already crowded. "AI QA for vibe-coded apps" is not a moat. |
| Signo | URL-first proposition: paste deployed app, agent navigates on desktop/mobile, launch-readiness score, screenshots, Claude Code prompts. | Validates the market. Confirms paste-URL is table stakes. |
| PageLens | URL-first testing in adjacent territory. | Broader autonomous-testing companies moving into the space. |

### Indirect competitors

| Tool | FixFlags Advantage |
|------|-------------------|
| Lighthouse | Finds problems. Does not tell you how to fix or give prompts. |
| PageSpeed Insights | Performance only. No message, experience, or reach. |
| Manual QA | Expensive, slow, does not scale. No fix prompts. |
| accessiBe | Accessibility only. No AI review of message or experience. |
| Momentic, Checkly, Mabl, Virtuoso, Testim, Applitools | Autonomous test generation. FixFlags should not compete on "generate test cases faster." |

### Key insight

**URL-first autonomous testing is becoming a common pattern.** The first moat cannot be "paste a URL."

The moat must be: knowing which failure matters, producing feedback precise enough to resolve it, and learning whether the proposed repair actually worked.

Research on feedback-based automated verification found that precise, constraint-level feedback produced successful iterations while broad metric feedback often caused the coding loop to stall. That directly supports FixFlags' product direction.

## Customer Segments

### Primary: AI-first builders

- Indie hackers, founders, small teams shipping with AI tools (Cursor, Claude Code, Lovable, Bolt, Replit)
- Faster than they can QA
- Low willingness to pay per individual, but high volume potential
- Characteristics:
  - Experimenting rather than operating real businesses
  - Launching short-lived projects
  - Already paying for several AI subscriptions
  - Willing to use free scans repeatedly
  - Reluctant to add another monthly tool
- Value: volume, word of mouth, product data, future upgrades, cultural relevance

### Secondary: Agencies and studios

- Building AI-assisted sites and apps for clients
- Need premium QA before handoff
- Higher willingness to pay
- Expect: authenticated flows, recurring checks, client reporting, integrations, reliability, support
- Value: revenue, retention, distribution through client work

### Later: Product teams

- Using AI coding internally
- Need repo integration and CI/CD checks
- Message: "CI for product quality"
- Value: ARR stability, long-term contracts

### Anti-target

Enterprise QA teams, manual test suites, compliance-driven orgs, anyone who says "we have a process for that."

## Fastest Agency Channel: Expert Ecosystem

Lovable already has a partner program and a directory of experts selling projects at meaningful budgets and hourly rates around $100-$130.

This is a much more precise acquisition surface than "agencies in general."

**Initial studio program targets:**
- Lovable experts
- Bolt consultants
- Replit agencies
- Productized MVP studios
- Freelancers repairing AI-built products

**Partnership proposition:**

> Use FixFlags as your delivery check. Catch issues before handoff, produce a cleaner client report, and reduce post-delivery repair work.

**Expert monetization through FixFlags:**
- Referral commission
- Human-review marketplace
- Expert escalation for Flags automation cannot resolve
- Verified delivery templates

**Two-sided strategic opportunity:**
1. FixFlags detects and specifies the problem
2. The builder's agent tries first
3. A verified expert becomes the escalation path

Basic builders become leads for expert partners when they encounter issues beyond their ability. This creates meaningful revenue without FixFlags employing a large service team.

## Five Execution Risks

### Risk 1: Problem agreement without payment

Users say "AI apps need better checking" but only pay when tied to an urgent moment:
- Launching tomorrow
- Client review imminent
- Deployment needs approval
- Checking if latest change broke something

A general audit is useful. A release decision is valuable. FixFlags must become part of a recurring workflow, not a curiosity.

### Risk 2: Interest without action

Reports with scores and flags feel impressive but do not convert if findings are generic, noisy, subjective, or already available through Lighthouse.

Quality of top 3 Flags matters more than number of checks. The user must quickly experience: FixFlags found something important I missed, gave my agent a useful repair, and proved the repair worked.

### Risk 3: Low willingness to pay in natural customer base

See "Primary: AI-first builders" above. The natural customer may not generate enough revenue alone.

### Risk 4: Episodic usage

Strongest current use case: "check before launch." Excellent entry point, weak retention model.

Founder may use FixFlags intensely for one week, launch, then disappear for three months.

**Retention requires expanding into:**
- Every preview deployment
- Recurring regression checks
- Critical-journey monitoring
- Client delivery reviews
- Release approval
- Repository and CI integrations

The wedge gets the customer. Continuous verification keeps them.

### Risk 5: Distribution is unsolved

PageSpeed has Google distribution, SEO visibility, browser credibility, and years of standardization. FixFlags starts with none of these.

## Distribution Strategy

### Compounding channels to build

- Public, shareable reports
- GitHub and Vercel integrations
- MCP or agent tool
- Reports generated by agencies for clients
- FixFlags badges or release records
- SEO around specific AI-builder problems
- Partnerships with AI development platforms
- Examples that spread because they reveal surprising failures

### Content strategy

Distribution should concentrate on where builders already show and discuss their work:
- Lovable community
- Reddit communities (vibe coding, SaaS, indie hacking, no-code)
- Product Hunt launches
- X and LinkedIn build-in-public posts
- YouTube creators teaching Lovable and Cursor
- AI-builder Discord communities
- Founder communities and launch groups

Content should use real product failures:
- "We tested 50 Lovable apps. Here are the five things that kept breaking."
- "This app looked finished. Signup stopped after the first error."
- "The agent changed the code. The original bug was still there."

Do not publish humiliating audits of people's products. Use consented or recreated examples.

### Integration sequencing

1. Copy fix for Lovable/Cursor
2. GitHub issue export
3. GitHub app or Action
4. Vercel deployment check
5. MCP tool
6. Formal marketplace listing
7. Deeper platform partnerships

Do not let MCP become the priority simply because it sounds frontier. A basic builder gains more value from one reliable "Copy for Lovable" action.

Marketplace listings (Vercel) require mature legal and operational surface: public documentation, support, privacy policy, EULA. Not merely an engineering task.

Before marketplace listings, FixFlags needs:
- Security architecture documentation
- Data-retention policy
- Screenshot and credential handling policy
- Deletion controls
- Regional processing clarity
- Support commitments
- Integration reliability
- Incident response

### Education partnerships

Create affiliate and partner plans for creators teaching Lovable, Bolt, Replit, and Cursor.

Natural lesson: "After you build the app, run this check before launching."

Give creators:
- Persistent revenue share
- Co-branded report examples
- Audience audit credits
- "FixFlags launch checklist" lesson
- Public case studies using their builds

### Agency program

FixFlags Verified Delivery program based on actual report completion, without implying a guarantee of security or quality.
