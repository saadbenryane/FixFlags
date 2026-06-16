# FixFlags Marketing Research Workflows

Use when validating a new segment, rewriting positioning, or auditing competitor/alternative messaging.

## 1. Fast message audit (30 minutes)

Adapted from homepage messaging audit practice. No rebuild required.

**Step 1, Baseline (5 min)**  
Open `lib/marketing/copy.ts` + live page. Note primary CTA, headline, first proof block.

**Step 2, 5-second test (5 min)**  
Hide everything below hero. Answer: Who is this for? What outcome? What happens on click?  
Fail → positioning problem, not design problem.

**Step 3, Claim vs proof map (10 min)**  
For hero + first body + first CTA, tag each sentence:
- **Claim**, asserts value
- **Proof**, evidence (sample, grade, finding, number, mechanism)

Every claim needs proof within one scroll. Gap → draft bridge sentence or move proof up.

**Step 4, Audience focus (5 min)**  
Count "you/your" vs "we/our". High-converting copy is visitor-problem led.

**Step 5, CTA audit (5 min)**  
- One primary action visible?
- CTA reads as promise ("Audit my site") not label ("Submit")?
- Secondary CTA builds confidence (sample) without competing?

Output: messaging diagnosis template from main SKILL.md.

---

## 2. Switch interview sprint (JTBD)

Run 3–5 interviews with recent audit users or upgrade candidates.

Use questions in [jtbd-research.md](jtbd-research.md). Output:

1. **Trigger timeline**, what happened the day they searched
2. **Verbatim phrase bank**, 10+ customer words for headlines/FAQ
3. **Force map**, push/pull/anxiety/habit with copy placement
4. **Alternatives tried**, update competitive scan (section 4)

If interviews aren't available, use the proxy method in jtbd-research.md (5 public audits).

---

## 3. Segment discovery (existing site owners)

Run before adding Segment B copy to homepage.

**Inputs (minimum 5):**
- Public audits of live SaaS/marketing sites (competitor or ICP examples)
- Support/sales notes if available
- Search queries with intent: "homepage conversion audit", "why isn't my landing page converting"
- Communities: indie hackers, r/SaaS, agency Slack (lurking, not spam)

**Extract:**
1. Verbatim pain phrases (copy-paste, don't polish)
2. Current alternatives they mention (Lighthouse, Hotjar, agency, ChatGPT)
3. Trigger event that made them search
4. What "success" looks like (more demos, better preview, client-ready doc)

**Synthesis table:**

| Pain (their words) | FixFlags area | Proof line | Objection |
|--------------------|----------------|------------|-----------|
| … | Conversion / Trust / Mobile | … | … |

**Go/no-go:** If top pains map to graded areas + fix prompts, segment fits. If they need implementation services only, deprioritize.

---

## 4. ICP scoring rubric (lightweight)

For prioritizing content and experiments without a full CRM model.

Score each lead/account 0–100:

| Dimension | Weight | Score 0 | Score 50 | Score 100 |
|-----------|--------|---------|----------|-----------|
| Situational fit | 35% | No public site | Live marketing site | Active launch/redesign/ad spend |
| Tool fit | 25% | No AI/dev workflow | Uses web builder | Uses Cursor + MCP path |
| Trigger | 25% | browsing | researched audits | launch/demo/ad live this week |
| Engagement | 15% | none | viewed sample | completed free audit |

**Tiers:** 85+ experiment hero for that segment; 60–84 nurture (sample, email); <60 don't customize copy.

Update weights quarterly against who actually upgraded.

---

## 5. Competitive / alternative messaging scan

Compare FixFlags to what the visitor already tries.

| Alternative | They promise | Gap FixFlags fills |
|-------------|--------------|---------------------|
| Lighthouse / PageSpeed | Performance, a11y, SEO scores | Conversion, trust, content, fix prompts, re-check |
| ChatGPT "review my site" | Generic feedback | Evidence from live page, grades, structured prompts |
| Agency audit sprint | Human strategy deck | 60-second graded report, agent-ready fixes |
| Hotjar / analytics | Behavior data | Qualitative launch-readiness grades + fix loop |

**Differentiation rows** already live in `copy.ts` → `DIFFERENTIATION`. Extend only with verified claims.

---

## 6. SEO / content intent map

Target **ICP queries**, not vanity volume.

**AI shipper cluster:**
- ai website audit, lovable site check, cursor qa, pre-launch website audit

**Existing site owner cluster:**
- homepage conversion audit, fix landing page conversion, website trust signals check, og image missing fix, mobile CTA below fold

**Page intent rules:**
- One primary keyword cluster per page
- Title/description in `copy.ts` → `SEO`
- Body matches search intent in first 100 words

---

## 7. Experiment discipline

When testing Segment B on homepage:

1. **Hypothesis**, one headline + subhead change
2. **Primary metric**, audit starts (not vanity traffic)
3. **Secondary**, signup, re-check, upgrade moment views
4. **Duration**, enough for meaningful sample (product decision)
5. **Document**, segment experiment brief in SKILL.md

Don't stack multiple message changes in one experiment.

---

## 8. Pre-ship copy checklist

Before merging marketing copy changes:

- [ ] Primary segment identified
- [ ] Message stack complete (audience → path)
- [ ] Voice checklist (`docs/voice-and-copy.md`)
- [ ] No em dashes, no banned vocabulary
- [ ] Claims have proof
- [ ] FAQ adds objections in visitor language
- [ ] `copy.ts` updated; no duplicate strings in components
- [ ] SEO block updated if page title/description changed
- [ ] Design system skill consulted if layout changed
