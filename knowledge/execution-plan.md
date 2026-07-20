# Execution Plan

## Strategic Wedge

Do not launch as: "AI website auditing with 150 checks."

Launch as: **"Before you share the app, run it through FixFlags."**

The first job is extremely specific:

> "I built this with Lovable, Cursor, Bolt, or Replit. Tell me whether a real user will get stuck, give my AI the fix, and check it again."

The user should receive value without knowing anything about QA, testing frameworks, source files, or CI.

## Vision

> FixFlags turns an AI-built app into a product you can confidently put in front of users.

The mechanism: it understands what the app is meant to do, tries the critical journeys, identifies what could stop users, gives the builder or agent a precise repair contract, and verifies the outcome.

## Core Product Loop

Paste link -> test the important journey -> show the top three risks -> copy the fix into the builder -> publish -> re-check

One product. Progressive depth.

## Next Priorities (5 Foundations)

### 1. Product Contract

Infer and confirm who the product serves, its first-value journey, and its essential outcomes. See `product-architecture.md` for the full intent layer design.

### 2. Flag Quality Benchmark

Build a human-validated evaluation set before expanding checks or traffic. See `product-architecture.md` for benchmark structure.

### 3. Progressive User Experience

Plain-language Launch Check for Lovable users, with technical depth revealed for developers. See `product-architecture.md` for the two-product split.

### 4. Repair Outcome Learning

Record copied fixes, dismissals, intentional behavior, code/deployment changes, and re-check results. See `product-architecture.md` for dismissal taxonomy.

### 5. Authenticated-Testing Architecture

Design safe credentials, test personas, action limits, and data handling before promising full app coverage. See `product-architecture.md` for the staged model.

## Six-Month Execution Plan

### Month 1: Prove the result is valuable

Do not chase traffic yet. Recruit ~100 active builders, weighted toward Lovable, Bolt, Replit, and Cursor users close to launching.

Ship only the essential loop:
- URL submission
- Product-intent confirmation
- Browser-based journey testing
- 3-5 prioritized Flags
- Strong evidence
- Tool-specific Fix Specifications
- One re-check
- Verified result

**Internal targets:**
- 60%+ open at least one Flag
- 30%+ copy or send a fix
- 20%+ initiate a re-check
- 50%+ of re-checks verify at least one repair

If fix-copying and re-checking are weak, the product is not ready for growth.

**Revenue target:** $2,000-$5,000 MRR (signal, not scale).

### Month 2: Launch the builder product

**Positioning:** "Your AI says it's done. Check the product."

**Free tier:** One app, one full check, selected Fix Specifications, one re-check.

**Builder $49/mo:** Multiple projects, deeper checks, full fix plans, history, recurring re-checks, Lovable/Cursor/Claude Code/Bolt/Replit formats.

Do not sell "150 checks." Sell: "Know what to fix before users find it."

**Month-end targets:**
- 2,000-3,000 registered users
- 150-200 paying Builders
- $8,000-$12,000 MRR

### Month 3: Build the studio offer

Sell studios/agencies a business outcome: "Catch it before the client does."

Price at $299-$499/mo, not $99.

**Founder-led sales targets:**
- AI website agencies
- Lovable experts and freelancers
- No-code studios
- Webflow and Framer agencies adopting AI
- Productized MVP agencies
- Development teams selling rapid prototypes

**White-glove onboarding:**
1. Import current projects
2. Configure common journeys
3. Run FixFlags on one upcoming client delivery
4. Produce before-and-after report
5. Quantify issues caught and review time saved

**Month-end targets:**
- 300 Builders
- 20-30 Studios
- $23,000-$30,000 MRR

### Month 4: Make usage recurring

Ship automatic checks for:
- Vercel preview deployments
- GitHub pull requests
- Scheduled production checks
- Critical user journeys
- Previously verified Flags

**Message expands:** "Check before launch. Keep checking as the product changes."

Use focused verification: what changed, which verified journeys may be affected, whether old Flags returned, whether the main path still works.

**Month-end targets:**
- 400 Builders
- 50 Studios
- 5-10 Teams
- $40,000-$48,000 MRR

### Month 5: Build distribution partnerships

Direct acquisition alone is unlikely to reach the target fast enough.

**Priority partnerships:**

AI-builder educators:
- Affiliate and partner plans for Lovable/Bolt/Replit/Cursor creators
- Persistent revenue share
- Co-branded report examples
- Audience audit credits
- "FixFlags launch checklist" lesson
- Public case studies using their builds

Agencies and experts:
- FixFlags Verified Delivery program (actual report completion, not security/quality guarantee)

Platform relationships:
- Vercel, GitHub, Lovable, Replit marketplace listings
- AI coding tool integrations through MCP
- Startup launch platforms

**Month-end targets:**
- 500 Builders
- 75 Studios
- 15-20 Teams
- $60,000-$68,000 MRR

### Month 6: Close the gap with teams and annual contracts

Do not rely on another burst of low-ticket subscriptions.

**Target mix:**
- 100 Studios at ~$399
- 30 Teams at ~$499
- 600 Builders at ~$49

The six-month target is less about exactly 730 customers and more about achieving the right blended revenue.

## What Must Be True

1. **Product quality:** Top Flags must be remarkably good. The product fails if users see generic SEO warnings, subjective copy criticism, dozens of low-value findings, incorrect root-cause guesses, or fix prompts that merely restate the issue. Every serious Flag must connect: evidence -> user consequence -> expected outcome -> agent task -> verification.
2. **Fast first value:** First meaningful result within minutes. First screen should not feel like a traditional scan waiting room. Show what FixFlags thinks the product does, the journey currently being tested, meaningful findings as they are confirmed.
3. **Simple language:** Basic Lovable user should understand everything without knowing DOM, hydration, ARIA, or CI. Technical evidence sits underneath.
4. **Strong unit economics:** Deterministic checks before AI. Focused re-checks. Cached evidence. Low-cost models for classification.
5. **Founder-led distribution:** Six months is too short for SEO to mature. Personally recruit studios, create teardown content, build educator relationships, audit real products publicly, speak in builder communities.

## What Not to Build (Next 6 Months)

Defer anything that does not improve activation, repeat usage, studio revenue, or distribution:

- Huge enterprise administration
- Elaborate public scoring standard
- Broad native mobile-app support
- Dozens of integrations
- Complex autonomous code-writing
- Generic testing platform
- Public reports by default
- Extensive programmatic SEO before report quality is trusted
- Hundreds of additional checks for marketing purposes

## Weekly Operating Dashboard

Track only the funnel that leads to recurring revenue:

1. Qualified URL submitted
2. Meaningful Flag viewed
3. Fix Specification copied or sent
4. Re-check initiated
5. Fix verified
6. Second deployment or project checked
7. Paid conversion
8. Four-week retained usage
9. Studio projects checked
10. MRR and gross margin

**Most important leading metric:** Percentage of activated projects that return for another deployment or project within 30 days. That reveals whether FixFlags is becoming a habit.

## Probability Assessment

Reaching $1M ARR in six months is a stretch outcome, not a dependable forecast.

Six months requires three wins at once:
- Exceptional product value
- Agency-priced recurring revenue
- A distribution channel that compounds quickly

**Highest-probability strategy:** Use basic Lovable and AI builders to create volume and cultural relevance. Use studios and agencies to create revenue. Use deployment integrations to create retention.
