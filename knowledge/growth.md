# Growth

**Canonical home for the FixFlags growth system and distribution strategy.** Market context: [market.md](./market.md). Execution: [execution.md](./execution.md).

## Growth engine

### A. Free URL tool

Quick Check is the primary acquisition engine. The first result must be useful enough to share and specific enough to trust.

### B. Before-and-after sharing

The strongest share object is not a low score. It is:

> Fixed with FixFlags
> Signup was blocked on mobile. It now passes.

The share card includes: product name, journey checked, previous status, current status, verification date, tested scope.

### C. Product Hunt launch

Product Hunt's own guidance emphasizes community participation, early-user feedback and interactive product demonstrations. The launch should show the product completing a real task.

**Product Hunt headline:** FixFlags tests your AI-built product before users do.

**Demo story:**
1. Paste URL
2. FixFlags attempts signup
3. Signup fails
4. Exact evidence appears
5. Prompt goes to the builder
6. FixFlags verifies the repair

**Launch offer:** Every Product Hunt maker receives one free Finish Check during launch week, subject to capacity and safety limits. Offer to makers with a live product, not anyone collecting ideas.

### D. Social advertising

Do not advertise an abstract dashboard. Use ten-to-fifteen-second proof creatives.

**Creative format:**
> We gave this AI-built app one job. Create an account. It got stuck here.

Show the replay. Then: Finish what your AI started. Check your product free.

### E. Intent landing pages

Create dedicated pages for: Lovable app testing, Replit app testing, Cursor app review, Vibe-coded app QA, Product Hunt launch check, Pre-launch website check, AI-built SaaS testing, Client website handoff checklist.

Each page uses the same product with language matched to the buyer's moment.

### F. Studio acquisition

Offer agencies: "We will run one client handoff through FixFlags." Then ask them to run the next three projects through a paid Studio pilot. The goal is repeat usage across projects, not a compliment on one report.

### G. Verified badge

Offer an optional badge: "Important paths checked by FixFlags." The badge must link to: date checked, journeys checked, environment, devices, result. Do not call it a certification.

## Harness strategy

A customer can build Playwright tests in their own repository. FixFlags should embrace that rather than pretending otherwise.

### Open edge

Open-source or freely distribute:
- `fixflags.yml` goal format
- Local deterministic runner
- Journey recorder
- GitHub Action
- Basic CLI
- Success assertion schema
- MCP tool definitions

Example:
```yaml
product:
  name: Acme
  purpose: Help freelancers create invoices

journeys:
  - name: Create an account
    start: /
    viewport: mobile
    success:
      url_contains: /dashboard
    forbidden:
      - real_payment
      - invite_external_user
```

### Hosted intelligence

Customers pay FixFlags for:
- Independent remote execution
- Managed browsers and devices
- Secure test credentials
- Persistent product memory
- Route and journey history
- Replay and evidence storage
- Change-aware selection
- Judgment and prioritization
- Builder-ready fixes
- Before-and-after verification
- Client and team collaboration
- Benchmarks from verified outcomes
- Connectors to real product signals

The CLI is distribution. The persistent verification system is the product.

## Defensibility

### Near-term moat
- Strong brand
- Better report design
- Higher finding precision
- Evidence-first trust
- Fast fix and verify loop
- Cross-builder independence
- Excellent distribution through free checks
- Studio workflow

### Medium-term moat
- Persistent product and journey memory
- Saved success assertions
- Verified history across deployments
- Change-to-journey mapping
- Builder and deployment integrations
- Evaluation benchmark
- Customer-specific standards

### Long-term moat: The verified outcome graph

> Product pattern → journey → observed problem → accepted fix → deployed change → verified result

This can eventually answer:
- Which issues most often block a given journey?
- Which AI builders produce which recurring failure patterns?
- Which fixes resolve those problems?
- Which recommendations customers reject?
- Which changes commonly reopen old Flags?
- Which interface patterns remain stable across deployments?

The data must be anonymized, permissioned and grounded in verified outcomes.

## Metrics

### Acquisition metrics
- Landing-page visitor to URL submission
- URL submission to completed Quick Check
- Completed Quick Check to evidence viewed
- Evidence viewed to free account
- Free account to fix action
- Free account to re-check
- Quick Check to Finish Check purchase

### Retention metrics
- Products with saved journeys
- Deployments checked
- Journeys rerun
- Regressions found
- Regressions fixed
- Products checked in consecutive months
- Studio products checked per account

### Initial funnel targets (hypotheses)
- 20% of qualified landing visitors start a check
- 80% of started checks complete
- 30% of completed users create an account
- 25% of accounts take a fix action
- 20% of accounts run a re-check
- 5% of completed Quick Checks buy a Finish Check
- 20% of Finish Check customers activate Watch
- Studio customers check at least three products monthly
