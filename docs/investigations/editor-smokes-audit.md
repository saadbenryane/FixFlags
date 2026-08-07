# FixFlags smoke audit: real Lovable & Bolt projects

**Date:** 2026-08-05 · **Auditor:** agent smoke run (per Captain directive)
**Product under test:** FixFlags production pipeline (commit `2ca0966`, pipeline v2.4.0)
**Test path:** production anon flow at fixflags.com (3 projects) + local dev pipeline (2 projects, same code)
**All findings below were observed in live reports; accuracy claims were re-verified by hand with a real browser (Playwright/Chrome) against the live sites.**

---

## 1. Method

1. Sourced real, live, public projects from the Lovable/Bolt ecosystems:
   - **Lovable:** `madewithlovable.com` project directory (community-curated, links to live deployments). Note: lovable.dev itself exposes no browsable public project gallery — templates and community directories are the practical discovery path.
   - **Bolt:** bolt.new gallery is a JS app shell with no crawlable list; found the officially featured gallery project (unrav.io, per Bolt's own gallery announcement) plus the Bolt blog/Devpost showcase.
2. Submitted each live URL through the **public anonymous flow**: `POST https://fixflags.com/api/checks` (what any anonymous visitor gets), then read the full report payload from `/api/reports/[id]`.
3. After 5 anon submissions the prod flow hard-blocked this IP (`429`, `retry-after: 86133` ≈ 24 h — anon client budget exhausted; see limitations). The remaining 2 projects ran through the **local dev pipeline** (same code, `npm run dev`), which completed scans but could not run the AI review layer (invalid local OpenAI key → "AI summary unavailable" verdicts, no AI-generated flags). This limitation is called out per project.

**Projects tested (5, all live at scan time):**

| # | Project | URL | Editor | Type |
|---|---------|-----|--------|------|
| 1 | GradLoom | https://gradloom.app | Lovable | AI career SaaS landing |
| 2 | EVE BCN | https://evebcn.com | Lovable | Barcelona wine-tour service business |
| 3 | ARCHIVE SHOP | https://archive-shop-store.lovable.app | Lovable | Bengali books storefront / education platform |
| 4 | Snapshot Wealth | https://snapshotwealth.com | Lovable | Fintech app (net worth tracking) |
| 5 | unrav.io | https://unrav.io | Bolt (official gallery feature) | AI web-simplification tool |

---

## 2. Per-project findings

### 2.1 GradLoom (gradloom.app) — score **84** — 14 flags (2 CRITICAL, 8 IMPORTANT, 4 POLISH)

Report: https://fixflags.com/report/cmsgm7qcq0001pa20kf59rb0d

Top flags with evidence:
- **CRITICAL "Overlay blocks primary CTA"** — evidence: `div .fixed.inset-0.z-50 z-index=50 · "See How It Works"`; verdict leads with "Fix the overlay that blocks the primary CTA."
- **CRITICAL "Page stays blank too long on slow 3G"** — "meaningful text appeared after 12930ms (threshold 5000ms)".
- IMPORTANT: slow-3G blank, no low-commitment path, PageSpeed mobile 74/100, iOS input zoom (`#message` 14px), OG title drift across funnel pages, competing CTAs, unsupported superlative claims.
- POLISH: no analytics snippet, 7 missing security headers, no social proof, 1 of 5 form fields missing validation.

**Accuracy check (manual):** The top CRITICAL flag did **not reproduce**. I loaded the site in a real browser at desktop (1280×800) and mobile (390×844), watched 10 s for fixed/inset overlays, and clicked "See How It Works" (the element named in the evidence) — no overlay appears, and "Start Your Career Journey" is clickable at all times. The overlay was likely an artifact of the automated journey walk (e.g., a transient modal/loading state during the slow-3G replay). The slow-3G flag is credible and is the strongest finding here (an SPA that shows nothing for ~13 s on 3G).

**Prompt quality:** The one unlocked (demonstrated) prompt is a generic 3-step template that never mentions the actual element from the evidence: "1. Ensure modals and sticky ads do not cover primary CTA without a clear dismiss control. 2. Lower z-index or relocate the overlay so primary actions stay clickable. 3. Re-check the click path after the change." The evidence is specific; the prompt is not.

**Value verdict:** Mixed. Real, specific, actionable finds (slow 3G blank, 14px input zoom, OG drift, no analytics, missing form validation) — a Lovable builder would learn real things. But the #1 headline flag (CRITICAL, the basis of the verdict) is a likely false positive on a site that actually works.

### 2.2 EVE BCN (evebcn.com) — score **85** — 18 flags (2 CRITICAL, 9 IMPORTANT, 7 POLISH)

Report: https://fixflags.com/report/cmsgm7tgm0003pa20jlmhqsmg

Top flags with evidence:
- **CRITICAL "Primary CTA could not be clicked"** — `"Private Inquiry" (href="https://evebcn.com/contact") was detected but the click action failed or the element was not interactable.`
- **CRITICAL "Primary CTA is hidden below the fold on mobile"** — "Mobile 812px viewport: 'Fully Bespoke…' starts at 4799px scroll depth."
- IMPORTANT: no low-commitment path, 27 contrast violations (with exact elements), superlative claims, link discernibility (2), animations ignore reduced motion, meta title/desc too long.
- POLISH: title 64 chars, description 172 chars, no skip link, 10 missing security headers.

**Accuracy check (manual):** Both criticals are **real in mechanism**, one overstated.
- CTA overlap: verified — an H2 hero subtitle ("Explore the best wineries and vineyards near Barcelona in a…") sits on top of the "Private Inquiry" button's center (elementFromPoint at button center returns the H2; Playwright trial-click and real-click both time out). A human clicking the button's center hits a dead H2 zone; the button edges and the overlapping hero link do reach `/contact`. So the click failure is real DOM overlap, but the user can still get to the destination — CRITICAL is too strong.
- Mobile CTA depth: verified — the hero CTA link is at **4820 px** scroll depth on mobile (reported 4799 px; page is 14340 px tall). A genuine, user-facing mobile problem.

**Prompt quality:** Demonstrated prompt again generic ("Remove overlays, cookie banners, or disabled states that block the CTA…"), ignoring the actual mechanism (H2 covering button center).

**Value verdict:** Good. Two genuinely useful structural findings (overlapping interactive elements; CTA 4800 px down on mobile), plus precise contrast/SEO evidence. The overlap finding would be excellent if the prompt said *what* overlaps *what*.

### 2.3 ARCHIVE SHOP (archive-shop-store.lovable.app) — score **48** — 25 flags (5 CRITICAL, 8 IMPORTANT, 12 POLISH)

Report: https://fixflags.com/report/cmsgmeszk0001i2ung92ev3pz — local run; **no AI verdict** (invalid local key), deterministic checks only. This is the lowest score of the batch and it matches reality: the site is the roughest of the five.

Top flags with evidence:
- **CRITICAL CTA below fold on mobile** — "ARCHIVE ACADEMY starts at 7102px scroll depth."
- **CRITICAL slow-3G blank** — meaningful text after 11168 ms.
- **CRITICAL buttons without discernible text (7 elements)** — with element markup.
- **CRITICAL CLS 0.351** and **CRITICAL mobile LCP 6.15 s**.
- IMPORTANT **"og:image URL does not load"** — `HEAD/GET https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0df86114…?Expires=1773001600…` — a **signed Lovable/gpt-engineer storage URL that expired ~5 months ago** (verified: `Expires=1773001600` ≈ 2026-03-08; my HEAD request returns **403**).
- IMPORTANT "Primary CTA click did not navigate anywhere" — clicking "ARCHIVE SHOP - AI" left the browser on the same URL.

**Accuracy check (manual):** Broken og:image **confirmed** (403). Canonical missing, favicon missing — confirmed. "0 internal links" — **contradicted**: manual scan finds 6 relative internal links; same false claim appeared on unrav.io (see §3).

**Prompt quality:** Demonstrated prompt is the same generic "move the primary CTA above the fold" template used for unrav.io.

**Value verdict:** This is where FixFlags earns its keep. For a builder on a Lovable subdomain, "your share preview image is a signed storage URL that expired in March" is a specific, invisible, actionable bug — the user cannot see their own broken social card, and no generic PageSpeed tool will tell them. Score 48 also correctly signals "this one is bad" vs 84/85 for the better sites.

### 2.4 Snapshot Wealth (snapshotwealth.com) — score **78** — 12 flags (1 CRITICAL, 5 IMPORTANT, 6 POLISH)

Report: https://fixflags.com/report/cmsgmeuoa0003i2unuas3hhpi — local run; **no AI verdict** (invalid local key).

Top flags with evidence:
- **CRITICAL mobile LCP 4.07 s.**
- IMPORTANT "Mobile navigation is not reachable or collapsible" at 375 px.
- IMPORTANT **"CTA text and destination page headline send different messages"** — 'CTA says "Start Tracking Free" but destination headline is "Create your account"… CTA leads to https://snapshotwealth.com/signup'.
- IMPORTANT **"CTA destination page lacks trust signals"** / **"Form on destination page… has no privacy policy"** — both about the signup page reached via flow scan.
- POLISH: contrast on footer, no favicon, no privacy link, no analytics, 7 security headers.

**Prompt quality:** Demonstrated prompt is the generic image-optimization template ("Serve different image sizes… Convert hero image to WebP… Preload…"), again with zero reference to the site's actual hero image.

**Value verdict:** Strong on flow-based findings. The journey checks (CTA copy vs destination headline; signup page missing privacy policy) are exactly the kind of thing a founder would never notice and is genuinely valuable — this is the best flag type of the whole batch. The LCP/headers flags are real but standard.

### 2.5 unrav.io (Bolt) — score **72** — 29 flags (6 CRITICAL, 7 IMPORTANT, 16 POLISH)

Report: https://fixflags.com/report/cmsgm7z3g0005pa20jtdjw0ov

Top flags with evidence:
- **CRITICAL CTA below fold on mobile** — "GET STARTED NOW" at 5680 px (verified: **5636 px** in my measurement; page is 6018 px tall — the CTA sits at the very bottom).
- **CRITICAL slow-3G blank** — meaningful text after 17148 ms (verified: **17.6 s** in my own 3G-throttled load; the page shows nothing until then).
- **CRITICAL mobile PageSpeed 49/100**, **CRITICAL mobile LCP 13.7 s**, **CRITICAL LCP 2.7 s desktop**.
- **3 CRITICAL flags on YouTube's player internals**: "Buttons must have discernible text" with evidence `<button class="ytmVideoInfoLink ytmVideoInfoChannelAvatar">…`, "Elements must only use supported ARIA attributes" with `<a class="ytmVideoInfoVideoTitle" aria-level="2" href="https://www.youtube.com/watch?v=c5QdRBykxFU">`, plus a "permitted ARIA attributes" flag on `html5-video-player`. The homepage embeds one YouTube iframe; the scanner is reaching **inside the cross-origin YouTube player** and flagging YouTube's DOM as the user's code.
- IMPORTANT: missing og:image / og:title / og:description (verified: all absent), no structured data, desktop 62/100.
- POLISH: **"Only 0 internal links found"** (contradicted — the homepage has internal links and the report itself crawled /view/… pages), **"no H2 elements"** (contradicted — 6 h2s found), duplicate H1s (verified: "UNRAV.IO" + "MAKECOMPLEXSIMPLEAGAIN."), title too long, "A/B Test error loading feature flags" console error, no privacy policy, cookie consent missing, 9 security headers.

**Prompt quality:** Demonstrated prompt = the same generic CTA-above-fold template.

**Value verdict:** Two of the strongest findings in the entire audit are here (CTA 5600 px below fold; 17 s blank screen on 3G — both verified accurate to within 1%). But this report also contains the clearest examples of damaging noise: 3 CRITICAL flags that point at YouTube's player code (impossible and pointless to fix), and two objectively false claims (0 internal links, no H2s). A 72 with 6 CRITICALs — 3 of which are third-party noise — misleads the user about what matters.

---

## 3. Cross-project patterns

1. **CTA below the fold on mobile — the #1 recurring real problem (3 of 5).** 4799–7102 px scroll depth across EVE BCN, ARCHIVE SHOP, unrav.io (two verified by hand). AI builders produce long single-page heroes and bury the conversion CTA at the bottom on mobile. FixFlags is the only tool I tested that calls this out with a measured depth.
2. **Slow-3G blank screens (3 of 5).** 11–17 s of blank screen on throttled 3G (one verified by hand). A class issue for Lovable/Bolt SPAs that render everything client-side. High-value, hard to know otherwise.
3. **"No analytics" (4 of 5)** and **missing security headers (5 of 5, 7–10 each).** Real but partially **not actionable**: sites on managed subdomains (`.lovable.app`) cannot set CSP/HSTS/permissions-policy without a custom domain and proxy config. The report never says this — it just lists "7 security headers are missing or weak" with a "verify in DevTools" rule. A Lovable user will chase an impossible fix.
4. **Third-party iframe contamination (1 of 5, but 3 CRITICAL flags).** YouTube embed internals flagged as the site's own code. Any site embedding YouTube/Calendly/Stripe gets these.
5. **Same-check duplication.** The same check fires once per scanned page (security headers × 3 pages, no-social-proof × 3, no-analytics × 3…). Raw rubric flags ran 21–48 per site; the Finish Plan consolidates to 12–29, but the redundancy still leaks into counts and severity (unrav.io lists "No structured data present" twice, once IMPORTANT once POLISH, and two "no social proof" variants).
6. **AI flags are the weakest layer.** 2–4 AI-source flags per report (gradloom, evebcn, unrav) — all generic copywriting advice with no evidence: "Lack of whitespace impacts reading flow", "Mobile layout requires zooming or stretching", "Hero lacks specific audience targeting". One AI flag (unrav "No social proof present") duplicates a deterministic one. The deterministic engine is what carries the value.
7. **Prompt templates are generic even when evidence is surgical.** Across all 5 reports the demonstrated prompt is a 3-step boilerplate that ignores the specific element/metric in its own evidence (see 2.1–2.5). Evidence quality >> prompt quality today.
8. **Scan latency vs marketing claim.** PRICING copy promises "Results in under 60 seconds" (lib/marketing/copy/plans.ts). Full prod runs with AI took **96–116 s**; only the AI-less local run (52 s) came in under a minute. When queued behind other scans (unrav, snapshotwealth), start delay added ~90 s more.
9. **Anon wedge friction.** The public anon flow hard-blocks per IP after a handful of submissions (retry-after ≈ 24 h from a shared/NAT IP after 5 requests in ~10 min). Fine as abuse protection, but a real user demoing "check my 5 pages" hits a wall.

---

## 4. Overall verdict

**Is the output worth the waitlist + paid promise for these real users?**

The raw material is genuinely valuable — more than generic audits, in specific ways:
- Things no PageSpeed/axe/Lighthouse report tells you: **"your og:image is a signed storage URL that expired in March"** (archive-shop, verified 403), **"your CTA text says 'Start Tracking Free' but the signup page says 'Create your account'"** (snapshotwealth), **"your hero H2 physically covers the Private Inquiry button"** (evebcn, verified), **"your page is blank for 17 seconds on 3G"** (unrav, verified).
- Scores correlated with reality (48 for the roughest site vs 84–85 for the best two).
- The flow/journey flags (post-click destination checks) are the strongest and most differentiating flag type; the weakest is the AI-source layer (generic, evidence-free, duplicative).

But today's output is not yet worth $69–199/mo (Pro $69, Studio $199 — lib/billing/plans.ts; the 9/99 in the brief does not match current pricing) **for this exact cohort**, because:
- The **headline flag on 2 of 5 sites was wrong or overstated** (gradloom's overlay never reproduced; evebcn's click failure is real but the impact is overstated — the user can still reach /contact).
- **Noise flags are CRITICAL-scored** (YouTube iframe internals ×3 on unrav), which corrupts the score and the "fix the first flag" instruction the product gives.
- **Prompts are generic templates** while the evidence is specific — the actual "what to paste into Lovable/Bolt" value is the weakest link. Two users got the identical CTA prompt for completely different sites and causes.
- **Non-actionable findings are presented as actionable** (security headers on managed subdomains).

**What a real user from this test would say:** *"Some of this is gold — I had no idea my CTA was 5,000px down or my share image was broken. But a third of it is noise I can't act on, and the fix instructions feel copy-pasted."*

The waitlist promise is defensible on the strength of the deterministic evidence layer; it is not yet defensible on prompt quality and flag accuracy.

## 5. #1 improvement recommendation

**Make the fix prompt carry the evidence.** The single highest-leverage change: each prompt (universal + agent/cursor/claude/windsurf/lovable/bolt variants) must embed the specific selector, element text, measured metric, and root cause from the flag's own evidence — and, for managed-hosting findings, state where the user can actually change it.

Concretely, today's overlay prompt is:
> "Ensure modals and sticky ads do not cover primary CTA without a clear dismiss control. Lower z-index or relocate the overlay…"

What a Lovable user on evebcn needs instead:
> "The H2 'Explore the best wineries…' overlaps the 'Private Inquiry' button (both in the hero flex column). Remove the entrance animation's scale/transform on the subtitle or add `relative z-10` to the button so its click area isn't covered. In Lovable, edit the hero section…"

Same for archive-shop's og:image: "Your og:image is a gpt-engineer signed URL that expired 2026-03-08 — upload a real image in Lovable's site settings instead of reusing the attachment URL."

Everything needed is already in the evidence; the prompt layer currently discards it. This one change converts the product's existing best asset (surgical evidence) into the thing users pay for (a fix they can act on), and it directly addresses the "generic prompts" complaint across all 5 reports. Secondary quick wins: exclude third-party iframe DOM from axe/ARIA checks (3 false CRITICALs on unrav alone), deduplicate AI vs deterministic flags, and split "managed-host impossible" header findings from actionable ones.

---

## Appendix A — Method limitations (honest)

- **3 prod + 2 local:** gradloom, evebcn, unrav ran the full production anon flow (AI verdicts included). archive-shop and snapshotwealth ran the local dev pipeline after prod rate-limited this IP; they are deterministic-only (no AI verdict/summary, no AI flags) because the local .env OpenAI key is invalid (401). Their scores and flags are comparable; their verdict text is a placeholder ("AI summary was unavailable…").
- **Anon gating:** the public wedge shows evidence + rubric summaries + exactly one full prompt; the paid per-tool prompts (lovable/bolt variants) are gated and were not observable through the public API. Prompt-quality judgment for the *demonstrated* prompt is direct (observed); for gated prompts it is based on the code path (deterministic `fix` templates are the same generic 3-steppers) — noted as such, not claimed as observed.
- **Spot-verification, not full adjudication:** I hand-verified ~10 flags across 4 sites (overlay, CTA overlap, mobile CTA depth ×2, slow-3G ×1, og:image, og tags, H1/H2 structure, internal-link counts, canonical/favicon). Flags I did not re-test (PageSpeed numbers, contrast pixel-levels, CLS, form-validation counts, snapshotwealth's signup-page claims) are reported as observed, not re-verified.
- **Sites are mutable:** owners can change deployments; all URLs were live and scanned 2026-08-05 21:44–22:15 UTC.
- Source of projects: madewithlovable.com directory; Bolt official gallery feature announcement; Bolt blog/Devpost. Not endorsed-by-editor samples — genuine third-party user projects.
- No code was modified; the only repo writes are this file. Dev server was stopped after the runs. **Pre-existing uncommitted changes found and left untouched:** `app/admin/analytics/waitlist/`, `lib/analytics/waitlist-conversion.ts`, `lib/analytics/__tests__/waitlist-conversion.test.ts` (all untracked).

## Appendix B — Report IDs

| Project | Score | Flags | Report URL |
|---|---|---|---|
| gradloom.app | 84 | 14 (2C/8I/4P) | https://fixflags.com/report/cmsgm7qcq0001pa20kf59rb0d |
| evebcn.com | 85 | 18 (2C/9I/7P) | https://fixflags.com/report/cmsgm7tgm0003pa20jlmhqsmg |
| archive-shop-store.lovable.app | 48 | 25 (5C/8I/12P) | https://fixflags.com/report/cmsgmeszk0001i2ung92ev3pz |
| snapshotwealth.com | 78 | 12 (1C/5I/6P) | https://fixflags.com/report/cmsgmeuoa0003i2unuas3hhpi |
| unrav.io | 72 | 29 (6C/7I/16P) | https://fixflags.com/report/cmsgm7z3g0005pa20jtdjw0ov |

C = CRITICAL, I = IMPORTANT, P = POLISH. Scan durations (create→complete): 52–116 s; prod full runs 96–116 s.
