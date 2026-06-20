# FixFlags Evidence Pack

Curated facts and problem-bar lines for landing page copy. Pull from here; do not hardcode stats in components.

## Usage rules

- Max **one** stat or research line visible per section
- Never lead the hero with stats
- Pair every fact with FixFlags mechanism: paste URL → evidence → fix prompt → re-check
- Tier A facts can support section headers; Tier B works in problem bars and dimension cards

## Problem bar lines (ready to use)

1. **OG / shipper:** Slack never runs your JavaScript. If og:image is not in the first HTML response, your launch post shows a blank card.
2. **AI iteration:** Three prompt tweaks can multiply accessibility issues while the demo still looks fine in your browser.
3. **First impression:** Visitors decide in milliseconds whether you look credible. Nearly half of trust judgments start with design, not your headline.
4. **Lighthouse gap:** A page can score 95 in Lighthouse and still fail what real visitors see on mobile.
5. **10-second test:** You have about 10 seconds to communicate your value. If the hero fails, traffic leaks before the form.

## Tier A (primary research / major publication)

| Fact | Source |
|------|--------|
| First 10 seconds critical for stay/leave; communicate value proposition within 10 seconds | [NN/g: How Long Do Users Stay on Web Pages?](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/) |
| Visual appeal assessed in 50 ms | Lindgaard et al., Behaviour & Information Technology (2006) |
| 46.1% of credibility comments cite design look | [Stanford Web Credibility Project](https://credibility.stanford.edu/pdf/How_Do_People_Evaluate_a_Web_Site%27s_Credibility_v37.pdf) |
| 0.1s mobile speed improvement → 8.4% retail conversion lift | [Google/Deloitte: Milliseconds Make Millions](https://web.dev/case-studies/milliseconds-make-millions) |
| Lab Lighthouse scores ≠ field CrUX; ranking uses field data | Google Search Central / CrUX documentation |

## Tier B (industry benchmarks, technically authoritative)

| Fact | Source |
|------|--------|
| Social crawlers do not execute JavaScript; OG tags must be in first HTML response | ShareScan, DEV, Prerender.io |
| 18.05% of product pages missing og:image (647 domains, Q1 2026) | ShareScan benchmark |
| Accessibility violations increased 11→29 on Bolt after 3 UI changes | OverlayQA controlled audit |
| Lab scores optimize diagnosis; field data optimizes conversion | Product Philosophy analysis |

## Tier C (resonant forum language)

- "Scared to share the link"
- "Lighthouse says 90 but the hero still feels wrong on mobile"
- "Spiritually crushing" blank link preview
- "Looks finished but launch basics are still thin"

Use Tier C in problem sections and FAQ, not as attributed quotes unless verified.

## What not to say

- Comprehensive audit platform
- Join N+ builders (unless verifiable)
- Synthetic before/after scores not tied to a real audit
- Attack Lighthouse as ignorant; acknowledge it as one signal
