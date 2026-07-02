# Voice & Copy Guidelines

## FixFlags adaptation

This document preserves the operator voice principles from the design system spec, adapted for **FixFlags**: the QA layer for AI-built products.

**Product context:** FixFlags is the QA layer for AI-built products. Run an audit, see the flags, copy the fix prompts, and re-check before users find the problems. Fix prompts paste straight into Cursor, Claude Code, Lovable, or Bolt. The voice should sound like a calm senior product reviewer who has shipped messy launches, not a consultant selling a methodology. The loop is Flag, Fix, Re-check. The AI built it. FixFlags finishes it.

**What stays the same:** Clear before clever. Specific before impressive. Useful before polished. No startup-bro language. No fake urgency. No em dashes. Ever.

**What adapts:** Examples about "founders" and "product clarity advisory" map to builders, launch quality, and fix loops. Prefer *ship, fix, evidence, pattern, outcome* over *unlock, leverage, holistic, transformation*.

**Related files:**
- Business model & pricing: [`docs/business-model.md`](./business-model.md)
- Brand & positioning: [`docs/brand-positioning.md`](./brand-positioning.md)
- Product scope & philosophy: [`docs/offering.md`](./offering.md)
- UI copy: [`lib/marketing/copy.ts`](../lib/marketing/copy.ts)
- AI reviewer voice: [`lib/prompts/system-prompt.ts`](../lib/prompts/system-prompt.ts)

---

# PART 2, VOICE & LANGUAGE STYLE

## Core voice

Speaks like an operator who has seen the messy middle and does not inflate it.

Priority order: Clear before clever · Calm before loud · Specific before impressive · Useful before polished · Human before professional · Strategic, not consultant-speak · Commercial, not eager.

Tone: a sharp conversation with a founder over coffee. No performance. No pitch voice. No guru posture.

### Good lines (study the rhythm)

I help founders make the product, story, and next move clearer.

Useful when the idea is real, but the shape is still messy.

We agree on the outcome and we ship.

Brand, product, UX, and how teams deliver still feel like one job to me.

Tell me what you want to make real.

Hiring smart people feels like progress. It isn't, not if everyone is pulling in a different direction. Structure is what lets talent actually compound.

Good lines share: short enough to remember · something concrete · no attempt to impress

### Bad lines (never write like this)

I help startups unlock growth through strategic advisory.

Book a founder clarity sprint to 10x your positioning and scale with confidence.

Transform your business with premium advisory across product, brand, and growth.

We create bespoke innovation ecosystems for visionary founders.

Ready to level up your startup journey?

Our comprehensive advisory methodology enables founders to align stakeholders, optimize strategic priorities, and accelerate growth outcomes.

Why bad: generic · eager · inflated · startup-bro · could be any consultant's site

## Vocabulary

**Prefer:** build, ship, clear, useful, real, messy, pattern, signal, outcome, next move, product, story, system, proof, listen, fix, moved, lifted, simplified, opened, compounded, obvious, honest, cohort, flag, rubric

**Use carefully (max once per piece):** strategy, scale, systems, advisory, growth, premium, transformation, leverage

**Avoid:** unlock, 10x, game-changing, world-class, cutting-edge, revolutionary, visionary, ecosystem, bespoke, seamless, holistic, elevate, empower, supercharge, startup journey, clarity sprint, irrefutable, transformative, red flags that kill…

**Branding copy:** prefer logo or brand over mark in reader-facing text. Use "branding guidelines" not "guideline deck"; "logo looked different on every proof" not "mark drift"; name real surfaces (menus, signage, app) not "touchpoints".

## Sentence rules

- Start with what the reader already recognizes.
- Short sentences when the point is sharp.
- Vary rhythm. Never five sentences of identical length.
- One idea per sentence when possible.
- Active voice. Name the actor.
- Cut throat-clearing: "in today's world," "as a founder," "in conclusion," "here's the thing," "let me be clear," "the truth is."
- No fake urgency.
- Avoid "we" unless real collaboration.
- Do not over-explain a strong line.
- No em dashes anywhere. Use periods, commas, or colons.
- Cut filler adverbs: really, just, literally, genuinely, honestly, simply, actually, deeply, truly, fundamentally.
- No "not X, it's Y" as the memorable closing line. State Y directly.
- No passive throat-clearing in commits/PRs either ("This commit adds…").

## Positive framing

- Lead with outcome or recommendation.
- Impact verbs: moved retention, lifted session starts, opened the funnel, clarified, simplified.
- Human scenes: user testing, roadmap reviews, customer calls.
- Contrast is fine as structure ("fix the flow before polish") but not as the punchline ("not delightful").
- Takeaways end on proof or next move, not negation.

## Positioning guardrails

Do not sound like generic startup advisory.

Core idea: Help people make the right thing clearer before they spend months building, pitching, or scaling the wrong one.

Better framing: Finish what your AI started. Clear Flags across Message, Experience, and Reach before you share the link.

Keep the offer implicit unless explicitly asked to sell harder. No branded service names ("Clarity Sprint," "startup advisory package"). Plain, grounded lines over consultant packaging.

## Long-form content (articles, case studies)

### Voice checklist (score every draft)

- Opens with the reader's situation, not a résumé paragraph.
- Sentence rhythm varies: mix 4–8 word punches with longer setup lines.
- Honest qualifier when needed: "It worked, to a point." / "We didn't have clean data yet."
- One proof story per section max.
- Show the messy middle: what felt off, what you tried, what changed.
- Hard terms linked or explained once on first mention.
- Land flat: one clear closing sentence. No "In conclusion…"

### Structure

1. Hook: reader's situation (2–3 sentences)
2. What most people get wrong (one paragraph)
3. The fix: 2–4 sections, one example each
4. Honesty box when data is incomplete (optional)
5. Further reading: 2–4 external links
6. Contextual CTA matched to topic (never copy-pasted)

### Opening patterns

| Pattern | Example |
|---------|---------|
| Reader situation | "You have users. Investors still pass." |
| Flat observation | "Investors don't trust your total-users chart." |
| Story hook | "Students were hacking our chat to get paper reviews." |

Avoid openings: résumé flex · "I've scaled product teams from zero to enterprise…"

### Title rules

**Allowed:** plain questions · flat observations · story hooks

**Banned:** "N things that kill/destroy…" · scare quotes on buzzwords · contrarian-only hooks ("X is overrated") · takeaway punchlines built on negation

### Case study step titles

Describe client outcome or scene, not deliverable filenames.

| Avoid | Prefer |
|-------|--------|
| Hand off the guideline deck | Branding guidelines for print partners |
| Document spacing, palette, and print rules | Spacing, color, and print rules in one place |
| Deliver the final lockup | One logo across Montreal offices |

Step bodies: scene + decision + outcome. Not slide labels or table-of-contents lines.

## CTAs

Never paste the same CTA block on every post. Match CTA angle to article topic. One contextual headline + one sentence + one button.

### Before → after (learn the edit)

**Before:** Founders think: "If I hire talented people, they'll figure it out." But talent without structure is chaos.

**After:** Hiring smart people feels like progress. It isn't, not if everyone is pulling in a different direction. Structure is what lets talent actually compound.

**Before:** Traction isn't a number. It's a narrative backed by irrefutable proof of value.

**After:** Traction isn't a headline metric. It's a pattern you can explain and defend when someone pushes back in diligence.

**Before (takeaway):** …moved retention more than anything on our delight slide. They called it obvious, not delightful.

**After (takeaway):** …moved retention further than a year of roadmap polish. Students called it obvious.

## Copy review checklist (before shipping)

- Would a real operator say this in conversation?
- Useful, or just polished?
- Generic startup language removed?
- Concrete object present: product, story, system, proof, next move, flag?
- Claims supported by real evidence only?
- Could this line appear on any consultant's site? If yes, rewrite.
- Lands flat instead of selling too hard?
- Leads with what worked or what to do, not what something is not?
- No em dashes?
- One voice across the site, not separate tones per page?

## Anti-slop scoring

Before shipping prose longer than a sentence, score 1–10 on: directness · rhythm · trust · authenticity · density. Revise if total below 35/50.

**Quick checks:**

- Filler adverbs? Cut.
- Passive voice? Name the actor.
- "Here's what/this/that" opener? Cut to the point.
- Three consecutive same-length sentences? Break one.
- Paragraph ends with punchy one-liner every time? Vary it.
- Pull-quote tone? Rewrite plainer.
