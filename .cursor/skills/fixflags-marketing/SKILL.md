---
name: fixflags-marketing
description: FixFlags go-to-market, ICP segmentation, message research, copy frameworks, and channel targeting. Use when writing or revising marketing copy, positioning, landing pages, ads, SEO, FAQs, upgrade moments, audience expansion, or GTM strategy for FixFlags. Triggers on marketing, copy, ICP, targeting, positioning, messaging audit, existing website owners, or ship-ready messaging.
---

# FixFlags Marketing

**Read [`AGENTS.md`](../../AGENTS.md) first.** Volatile facts and banned phrases live there. Do not hardcode counts.

Read before changing marketing copy, positioning, or GTM.

**Canonical sources (always check first):**
- Copy constants: `lib/marketing/copy.ts` (`UPGRADE_MOMENTS`, `MCP_DOCS`, `FAQ`)
- Product behavior (entitlements, billing, dev): `.cursor/skills/fixflags-product/SKILL.md`
- Voice rules: `docs/voice-and-copy.md`
- Upgrade moment resolver: `lib/billing/upgrade-moments.ts` (strings live in `copy.ts`)
- Design polish: `.cursor/skills/fixflags-design-system/SKILL.md`
- Evidence & problem bars: [evidence-pack.md](evidence-pack.md)

## Two audiences (do not collapse them)

FixFlags serves two distinct jobs. Write for **one primary reader per page or block**. Mixing them dilutes conversion.

| Segment | Job to be done | Trigger moment | Lead pain | Primary proof |
|---------|----------------|----------------|-----------|---------------|
| **AI shipper** | Catch launch gaps before sharing a link | Pre-launch, demo day, first deploy | Mobile breaks, blank link previews, vague hero | Sample report + fix prompts for Cursor/Lovable/Bolt |
| **Existing site owner** | Find what the live site is still costing them | Traffic but weak conversion, stale site, post-redesign doubt | Bounce, low demo rate, broken previews, trust gaps | Graded report on *their* URL + prioritized fix list |

**AI shipper** copy leads with: ship, paste URL, fix prompts, re-check loop, MCP in editor.

**Existing site owner** copy leads with: live site, lost signups, evidence-backed grades, what to fix first, no agency retainer.

See [audiences.md](audiences.md) for pains, objections, channels, and disqualifiers per segment.

## Message stack (every hero must pass)

Use this order when drafting or auditing any page:

1. **Audience**, who this is for *today* (named role + situation)
2. **Job**, what problem they have when they land
3. **Promise**, outcome in plain language (not category fluff)
4. **Proof**, sample output, grades, evidence line, or concrete finding
5. **Path**, primary CTA as a promise of what happens next

Run the **5-second test**: hide the page. Can you state audience, outcome, and mechanism? If not, fix positioning before polish.

## Jobs-to-be-Done (JTBD), pick segment first

Each segment hires FixFlags for a different job. Write the job, not the product.

| Segment | Job statement (solution-free) | Functional outcome | Emotional outcome |
|---------|------------------------------|--------------------|-------------------|
| **AI shipper** | When I'm about to share a link I just built, help me catch embarrassing gaps fast | Graded report + fix prompts in my editor | Confidence before the launch post |
| **Existing site owner** | When my live site gets traffic but weak conversion, help me see what's costing signups | Prioritized evidence I can act on or hand off | Relief from guessing; proof for stakeholders |

**Four Forces of Progress** (address in copy order):

1. **Push**, pain of the status quo (blank previews, flat conversion, client call tomorrow)
2. **Pull**, appeal of the new outcome (graded fixes, re-check proof, 60 seconds)
3. **Anxiety**, fear of switching (another tool, hype, wasted time) → reduce with free audit, sample report, boundaries
4. **Habit**, inertia ("Lighthouse is enough", "we'll fix it later") → name what habit misses

Use customer verbs, not adjectives. "See what's costing signups" beats "comprehensive audit platform."

Switch interview questions and force mapping: [jtbd-research.md](jtbd-research.md).

## Copy frameworks (pick one primary frame per section)

| Framework | Best for | FixFlags pattern |
|-----------|----------|-------------------|
| **PAS** (Problem → Agitation → Solution) | Problem sections, ads, email | Name the broken preview / mobile CTA / trust gap, show launch cost, offer graded audit |
| **BAB** (Before → After → Bridge) | Existing site owners, re-check upsell | Before: traffic, weak conversion. After: graded fixes shipped. Bridge: paste URL |
| **AIDA** | Long landing flow | Attention: headline score hook. Interest: sample findings. Desire: fix prompts. Action: audit CTA |
| **FAB** | Feature rows, comparison table | Feature → why it matters at launch → outcome (grade up, link preview fixed) |
| **Messaging stack audit** | Homepage review | Mark each line as **claim** or **proof**. Every claim needs connected proof within one scroll |

**Review priority** (fix in this order): audience clarity → primary CTA promise → proof/trust → objections → lower-commitment step (sample report).

**80/20 rule:** Most conversion lift comes from headline, lead (subhead + first proof), and primary CTA. Polish lower sections only after hero passes 5-second test.

## Voice (non-negotiable)

From `docs/voice-and-copy.md`:

- **KISS:** One idea per sentence. Cut adjectives. No "still broken" or "graded" in marketing copy.
- Operator clarity: short sentences, verb-first CTAs, name tools when relevant
- Prefer: ship, fix, evidence, report, outcome, proof, check
- Avoid: unlock, leverage, holistic, comprehensive, graded, still broken, 10x, game-changing, em dashes, **second pass**, Fix my live site (see AGENTS.md banned phrases)
- CTAs are **promises**: `HERO.primaryCta` is **"Review my site"** — verb-first, not "Get started"
- Plan labels in copy: **Pro** (BUILDER enum), **Agency** (TEAM) only — never promise unbuilt features
- One contextual CTA angle per page; never paste the same block everywhere
- **Rule of one** per block: one reader, one pain, one outcome, one action

## ICP research workflow

Before expanding copy to a new segment, run this checklist:

```
Research progress:
- [ ] Segment hypothesis named (who + situation + trigger)
- [ ] 5 real sites or users interviewed or observed (or 5 public audits as proxy)
- [ ] Top 3 pains in their words (not product language)
- [ ] Top 3 objections + honest answers
- [ ] Disqualifiers written (who we are NOT for)
- [ ] Channel fit scored (see below)
- [ ] Message draft passes 5-second test + voice checklist
- [ ] Changes land in lib/marketing/copy.ts (single source of truth)
```

**ICP scoring dimensions** (weight from real usage when available):

| Dimension | Signals for FixFlags |
|-----------|----------------------|
| Firmographic / situational | Solo builder, small team, agency, indie SaaS, portfolio site |
| Technographic | Uses Cursor/Lovable/Bolt, Webflow, WordPress, Next.js, Framer |
| Behavioral | Visited pricing, ran audit, hit hidden findings, used re-check |
| Trigger | Launch this week, redesign shipped, ad spend live, client demo scheduled |

Tier A (prioritize): trigger + technographic fit + ran free audit.
Tier B (nurture): fit but no trigger yet, sample report, SEO content.
Tier C (deprioritize): enterprise QA teams, password-protected-only workflows, no public URL.

Full research methods: [research-workflows.md](research-workflows.md).

## Channel targeting cheat sheet

| Channel | AI shipper angle | Existing site owner angle |
|---------|------------------|---------------------------|
| **Homepage hero** | Check before you ship | Live site — see what to fix first |
| **Homepage nav** | How it works / Sample / Pricing | Same three links; Sample anchors to `#sample-review` |
| **Homepage body** | Sample review (one explorer) → dimensions → fix loop → productEvidence → final CTA | Same order; exactly one report explorer in Sample review; no invented testimonials |
| **SEO** | ai website audit, lovable audit, cursor qa | homepage audit, conversion audit, fix website conversion |
| **Sample report** | What a first ship looks like | Proof that strong sites still fail checks |
| **Pricing** | Pay when you're shipping | Pay when fixes matter (re-check, MCP) |
| **Upgrade moments** | Hidden findings, re-check loop | Score flat after fixes, share report with client (Agency+) |
| **MCP docs** | HTTP `/api/mcp` + API key (Pro+) | Secondary; note Lovable/Bolt copy-paste path |

## Editing marketing copy (workflow)

1. Identify **primary segment** for this page/block
2. Read current strings in `lib/marketing/copy.ts`
3. Draft using message stack + one framework
4. Score against voice checklist in `docs/voice-and-copy.md`
5. Check visual/copy alignment with design system skill
6. Update `copy.ts` only, pages import from there
7. For FAQ/objections, add question in visitor language, answer with evidence + boundary

## Homepage contract

- **Nav links:** How it works · Sample · Pricing (`MARKETING_LINKS` in `lib/site/nav.ts`)
- **Section order:** Hero (logo cloud inside) → Sample review → Three dimensions → Fix loop → Product evidence (`ProductEvidenceSection`) → Final CTA
- **Funnel events:** see `.cursor/skills/fixflags-analytics/SKILL.md` and `.agents/handoffs/launch-funnel-p2.md` (P2 gated on ~100 scans)
- **One explorer:** the live sample report lives only in `SampleReportSection`; do not add a second explorer in hero or elsewhere
- **Sample provenance:** label as live, curated, or fixture (`SampleSource`); eligibility is completeness-based, not score floors

## Product–copy alignment

Before shipping marketing changes, verify against `fixflags-product` skill:

- Re-check: unlimited on owned reports (never gated); compare: Pro+ only
- Share links: Agency (TEAM) only
- MCP: Pro+ only, HTTP config in docs
- Prices/teaser: from `getMarketingPlans()`, not hardcoded
- Local dev: `npm run dev` runs inline worker by default

## Anti-patterns

- **Tribe badge overload**, name AI tools once per page, not every section
- **Category copy**, "comprehensive quality platform" → paste URL, get grades
- **Dual headline**, one outcome per hero
- **Proof decoration**, Stripe sample must support a claim, not fill space
- **False urgency**, no countdown fake scarcity
- **Everyone ICP**, if FAQ says "for everyone with a website," rewrite with boundaries

## Output templates

### Positioning one-liner

```
For [segment] who [situation/trigger], FixFlags [mechanism] so they [outcome].
Unlike [alternative], we [differentiator with evidence].
```

### Messaging diagnosis (after auditing a page)

```markdown
## Messaging diagnosis, [page]

**Implied audience:** …
**Should commit to:** …
**Top 3 claims (verbatim):** …
**Proof map:** claim → evidence (or gap)
**Transition break:** where trust drops
**CTA path:** what click promises vs what product delivers
**Recommended fixes (priority order):** …
```

### Segment experiment brief

```markdown
## Segment: [name]
**Trigger:** …
**Headline hypothesis:** …
**Subhead:** …
**Primary pain (3):** …
**Proof asset:** sample / audit / re-check
**Disqualifier:** …
**Success metric:** audit starts, signup, upgrade moment
```

## Additional resources

- Segment deep dive: [audiences.md](audiences.md)
- Research & competitive workflows: [research-workflows.md](research-workflows.md)
- JTBD / switch interviews: [jtbd-research.md](jtbd-research.md)
- Evidence pack (stats, problem bars): [evidence-pack.md](evidence-pack.md)
- Before/after copy examples: [copy-examples.md](copy-examples.md)
