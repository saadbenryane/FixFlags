# FixFlags Audience Segments

Use when choosing headline angle, ad copy, FAQ answers, or upgrade moment tone.

## Segment A: AI shipper (primary today)

**JTBD:** When I'm about to share a link I just built, help me catch embarrassing gaps before anyone sees it.

**Who:** Solo builders and small teams shipping with Cursor, Claude Code, Lovable, Bolt, v0.

**Situation:** Just built or about to share a landing page, demo, or MVP link.

**Trigger moments:**
- First deploy to production URL
- Demo day / launch thread / Product Hunt
- "Shipped in a weekend" velocity guilt
- Agent loop: audit → fix prompt → re-check

**Top pains (their words):**
- "I shipped fast but I'm scared to share the link"
- "Lighthouse says 90 but the hero still feels wrong on mobile"
- "Link preview is blank on Slack/X"
- "I don't know what to fix first"

**What they buy:** Fix prompts in their editor, re-check loop, MCP automation.

**Proof that works:** Sample findings card, terminal MCP workflow, before/after re-check.

**Objections:**
| Objection | Honest answer |
|-----------|---------------|
| Lighthouse is free | Lighthouse misses conversion, trust, content; no fix prompts or re-check loop |
| I'll eyeball it | Mobile and preview bugs hide until someone shares the link |
| Too expensive | Free first audit; Builder when you're actively shipping |

**Disqualifiers:** Enterprise QA teams, manual test suite workflows, no public URL.

**Channels:** AI builder communities, MCP docs, Cursor/Claude integrations, "ship" vocabulary.

---

## Segment B: Existing site owner (expansion)

**JTBD:** When my live site gets traffic but weak conversion, help me see what's costing signups and what to fix first.

**Who:** Founders, marketers, freelancers, and small agencies with a **live** site that should be converting better.

**Situation:** Site has been up for weeks or years. Traffic exists (or ads run) but outcomes are flat.

**Trigger moments:**
- Paid ads live but conversion weak
- Redesign or rebrand just shipped, "did we break something?"
- Client/agency needs a prioritized fix list before a call
- SEO or social previews look wrong in the wild
- Quarterly "website health" review without budget for a full agency audit

**Top pains (their words):**
- "We get traffic but not enough signups"
- "Our homepage looks fine to us but something's off"
- "I can't tell if the last redesign helped"
- "I need a list I can hand to a dev or freelancer"
- "Agency audit quotes are $5k and take weeks"

**What they buy:** Evidence-backed priority list, conversion/trust/mobile grades, re-check to prove fixes worked, shareable report (Team).

**Proof that works:** Audit on a recognizable domain (Stripe sample), graded areas with launch impact, hidden findings upsell.

**Copy angles (test one at a time):**
- "Your site is live. See what's still costing you signups."
- "Paste your homepage. Get a prioritized fix list in 60 seconds."
- "Not another Lighthouse score, conversion and trust, with fix prompts."
- "Prove the redesign worked, re-check before/after."

**Mechanism emphasis:** Web UI first (paste URL). Fix prompts work in any AI editor or handoff to dev. MCP optional.

**Objections:**
| Objection | Honest answer |
|-----------|---------------|
| We already ran Lighthouse | Scores performance/SEO/a11y, not whether the page converts or looks trustworthy |
| We have an agency | FixFlags is a fast first pass, prioritized evidence before you pay for hours |
| Our site is custom/WordPress/Webflow | Any public URL; prompts describe fixes, not stack-specific patches |
| Staging only | Public URLs only today, use production or a public preview URL |

**Disqualifiers:** No public URL, password-protected staging only, need legal/compliance certification, want fully managed implementation.

**Channels:** SEO (conversion audit, homepage review), LinkedIn/founder communities, agency "client prep" workflow, Team plan for share links.

---

## Segment C: Studio / freelancer (secondary, Team plan)

**Who:** Small shops running pre-call audits for clients.

**Situation:** Need read-only report link before a client meeting.

**Trigger:** `share_blocked` upgrade moment, Team plan.

**Copy angle:** "Send a graded report link before the call."

**Disqualifiers:** Large enterprises needing SSO/compliance first.

---

## Segment priority by page

| Page | Primary | Secondary |
|------|---------|-----------|
| Home hero | A or B (pick one experiment) | Other segment in workflow/examples only |
| Samples | Both (proof for all) |, |
| Pricing | A (ship cadence) | B (ROI / re-check proof) |
| MCP docs | A |, |
| FAQ "Who is it for?" | Name both with boundaries | Disqualify enterprise QA |

---

## Headline swap matrix (same product, different job)

| Element | AI shipper | Existing site owner |
|---------|------------|---------------------|
| Headline | Check your site before you ship | See what's still broken on your live site |
| Subhead | Paste a URL. Graded report + fix prompts for your AI editor. | Paste your homepage. Prioritized grades on conversion, trust, and mobile. |
| Trust line | Free check. See what's broken before you share the link. | Same one-liner (no privacy/claim stack) |
| Primary CTA | Review my site | Review my site (keep verb-first) |
| Secondary CTA | See sample report | See sample report |
| Problem section | Fast to ship. Easy to miss the details. | Traffic isn't the problem. The page still isn't converting. |
| Social proof frame | Even strong sites fail these checks | Even polished sites miss conversion and trust gaps |

Do not combine both headlines in one hero. Use pills, workflow steps, or a lower section to acknowledge the second segment.
