# FixFlags Copy Examples

Reference when drafting or rewriting `lib/marketing/copy.ts`. All examples follow `docs/voice-and-copy.md`.

## Hero, Segment A (AI shipper) ✓ current default

```
Headline: Finish what your AI started.
Subhead: Paste your live URL. See what visitors notice. Copy fixes into Cursor, Claude, Lovable, or Bolt.
Trust (one line under URL): Free check. See what's broken before you share the link.
CTA: Review my site | See a sample review
```

Do not stack privacy/claim/legal CYA under the hero. Keep that on `/privacy` and FAQ.

## Hero, Segment B (existing site owner), test variant

```
Headline: Your site is live. See what's still costing you signups.
Subhead: Paste your homepage. See what visitors notice, ranked by impact, with fix notes you can paste or hand off.
Trust (one line): Free check. See what's broken before you share the link.
CTA: Review my site | See a sample review
```

Do not blend both headlines. A/B or rotate, don't stack.

---

## Problem section

**Segment A (current):**
> Fast to ship. Easy to miss the details.

**Segment B:**
> Traffic isn't the problem. The page still isn't converting.

**Segment B pains (card titles):**

| Bad (feature-led) | Good (job-led) |
|-------------------|----------------|
| Conversion optimization | Visitors leave without knowing what to do |
| Trust signal analysis | You look less legit than competitors at the pay step |
| Mobile responsiveness | Most of your traffic hits a broken layout first |

---

## FAQ additions for Segment B

**Q: We already have a live site. Is this only for pre-launch?**  
A: No. FixFlags audits any public page, live or new. Most live sites still fail conversion, trust, or mobile checks even when performance scores look fine.

**Q: We already ran Lighthouse. Why run this?**  
A: Lighthouse scores performance, accessibility, and SEO. FixFlags also grades conversion, trust, and content, with evidence and fix prompts for each finding.

**Q: Can I send the report to my dev or client?**  
A: Copy fix prompts from the report, or upgrade to Studio for public share links before a client call.

---

## Upgrade moments, Segment B tone

| Moment | AI shipper headline | Existing site owner headline |
|--------|---------------------|------------------------------|
| hidden_findings | +N issues your agent could fix | +N issues still costing you signups |
| compare_improved | Score improved +N | Proof the last fix worked (+N) |
| compare_flat | Still Flags after your re-check | Still gaps hurting conversion. See all Flags. |

Implementation lives in `lib/billing/upgrade-moments.ts`. Match voice, adjust nouns (agent → dev/client).

---

## SEO title/description, Segment B page (future)

```
Title: Homepage conversion audit, graded in 60 seconds
Description: Paste your live URL. See conversion, trust, and mobile grades with evidence and fix prompts. Free first audit.
```

Add to `copy.ts` → `SEO` when creating a dedicated landing route.

---

## Before → after edits (learn the pattern)

**Before:** Comprehensive quality analysis for modern web applications.  
**After:** Paste a URL. Get a grade and fix prompts.

**Before:** Unlock the full potential of your digital presence.  
**After:** See what's still broken on your live site.

**Before:** Our AI-powered platform leverages advanced auditing.  
**After:** Every Flag ships with evidence and a fix prompt you can paste into your editor.

**Before:** Get started today.  
**After:** Review my site.

**Before:** Compatibility is not endorsement. / Fix prompt ready. / Read-only review. We never modify your site.  
**After:** Paste fixes into the tools you already use. / Copy fix prompt. / (privacy stays on `/privacy`, not the hero)

---

## Ad / social hooks (short)

Segment A:
- "Shipped with Cursor? Paste the URL before you tweet it."
- "Lighthouse 92. Link preview still blank. Fix both."

Segment B:
- "Ads are live. Signups aren't. Paste the homepage."
- "Redesign shipped. Re-check before the board meeting."

One hook = one segment. Link to homepage or segment landing page.
