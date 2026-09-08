# FixFlags Shopify app launch plan

**HISTORICAL PLAN / IMPLEMENTATION REFERENCE, superseded as direction on 2026-09-08.** The complete vision at knowledge/vision.md and phased ROADMAP.md govern new work. Old scope, hero, commercial-loop, rubric and layout decisions below are not active instructions. Reuse technical evidence through docs/site-v2-migration.md; do not treat historical readiness as current release proof.


**Status:** historical Shopify implementation plan; current connection work must follow the Site roadmap.  
**Supersedes:** paste-URL / $99 Watch (`.agents/sessions/paid-traffic-integrity-plan.md`).  
**Do not implement until a phase is assigned.**

Four layers, one product:

1. **Protect** — Can customers still buy?  
2. **Prove** — Screenshot + **video** of what FixFlags saw.  
3. **Understand** — Where customers drop, using only real data.  
4. **Improve** — Secondary, prioritized findings from the existing engine. Never in alerts.

Hero: **Know when customers can't buy.** Install reason: protect the paths that make the store money.

---

## 1. Executive decision

Ship **FixFlags as a public Shopify app** in purchase-path monitoring (same shelf as Revenue Shield).

Not a clone: same table-stakes (walk, retry, screenshot, **video**, alerts, install) plus **incident overlay on a real funnel** (when Shopify data is approved) plus **Improve** from our existing checks.

Free at launch. Pro = waitlist. Meta/paid traffic = post-launch differentiator, started in parallel. **No Stripe charging.**

Launch conversion: **install → first path verified with video → monitoring on.**  
Ads conversion: **LP → App Store install.**  
Do not delay launch for ShopifyQL (see §9).

---

## 2. Repository reality

No Shopify app. Browser engine is the head start.

### KEEP

| Piece | Path |
|---|---|
| Playwright session, mobile UA | `lib/audit/browser/{page-session,page-capture,capture-profile}.ts` |
| Consent/overlays | `overlay-probe.ts` |
| Never complete payment | `journey-safety.ts` |
| CTA walk | `lib/audit/flow/{discover-cta,run-flow-scan,post-click-probes}.ts` |
| Dead buy links | `checks/auth-checkout.ts` |
| Frame capture + **GIF compositor** | `lib/audit/capture/{frames,gif-compositor,visual-capture}.ts` |
| Screenshots → R2 | `lib/storage/screenshots` |
| Queue, worker, 5-min tick | `lib/queue/*`, `worker/` |
| Watch lease/retry | `lib/audit/project-watch.ts` |
| OAuth HMAC, encrypt | `lib/integrations/github.ts`, `lib/security/crypto.ts` |
| Resend | `lib/email/*` |
| Waitlist + `waitlist_joined` | Prisma `WaitlistLead`, `/api/stripe/waitlist` |
| GA4 / Meta pixel / `trackEvent` | `lib/analytics/*` |
| Deterministic checks (SEO, a11y, mobile, trust, conversion-friction, etc.) | `lib/audit/checks/index.ts` |

**Video today:** no Playwright `recordVideo`. GIFs from step frames exist. Launch video = add `recordVideo` (webm) **and** keep step screenshots + GIF fallback.

### ADAPT

- `runFlowScanStandalone`: force `MOBILE_CAPTURE_PROFILE`
- Slim integrity runner: no judge, no rubrics
- `runAllChecks` → **Improve allowlist** (cap, regroup)
- Homepage, waitlist feature keys, FunnelEvent names

### PARK

Product Review UI, scores, Agent, fix prompts, CLI/MCP, GEO, Stripe checkout SKU, Message/Experience/Reach as nav.

### REMOVE later

Marketed Product Review. Keep `/report/[id]` unadvertised.

---

## 3. Competitive analysis

| | Install for | Evidence | Weakness | FixFlags response |
|---|---|---|---|---|
| **Revenue Shield** | Store buy flow down | Video, screenshots, Slack/SMS, $0–$199, 3 reviews | Store-centric; little funnel/paid-traffic; agent/report UI | Match video+retry+alerts; simpler Protect UI; Understand + Improve; later ads→path |
| **Shoptest** | Journey still converts | Synthetic journeys, $99+ | Price; not Shopify-native install | Free; App Store |
| **Checkout Sentinel** | 1 path, email | Screenshot, 0 reviews | Thin | Auto-discover + video |
| **Noibu** | Real-user errors, GMV | Session replay, Plus | Needs traffic; pixel; enterprise | Synthetic works at 3am; don’t compete on session replay |
| **Uptime / Optmyzr** | URL up / Google ads URLs | HTTP | Misses 200 + dead ATC | Walk |
| **AdAlign** | Ad/page match | Scores | Not functional | Ignore for launch |
| **Triple Whale** | Attribution | Spend | Not path health | Don’t build attribution |
| **Shopify Analytics** | Native funnel | Sessions | No “why” / no reproduction | Overlay our RED on their drop |
| **SEO/CRO apps** | Rankings / tests | Reports | Not smoke alarms | Improve only |

**Must match for trust:** real browser, mobile, retries, screenshot, **watchable verification**, email, 1-click install, stop before pay.

**Exceed without becoming a pile:** (1) Protect is the home. (2) Prove is video of *our* walk, not FullStory. (3) Understand connects a drop to a reproduced step when data exists. (4) Improve is a short list, not 37 flags.

---

## 4. Final product architecture

**Overview** — Can the store make money right now? Path health, last run, open incident, last recovery.  
**Paths** — Monitored journeys; GREEN/RED/UNKNOWN; steps; screenshot; **Watch verification**; history; Recheck.  
**Funnel** — Visual session→cart→checkout→purchase **only with real ShopifyQL numbers**, else honest empty + “enable reports access” waitlist/upgrade path. Overlay FixFlags incidents on steps.  
**Improve** — Ranked items: Revenue / Search / Experience / Technical. Not in Overview alerts.

Hierarchy in UI: Protect first. Prove on the incident. Understand beside it. Improve last.

---

## 5. Merchant journey

Ad or listing → `/` or `/protect` (same message) → Install → embedded Overview (auto-walk in progress) → first GREEN/RED with video → monitoring on → email/Slack on RED → merchant watches video → Recheck → recovery email → optional Funnel/Improve → Pro waitlist.

No Playwright for the merchant. No Product Review onboarding.

---

## 6. Revenue-path verification

**Discover (launch):** GraphQL `read_products` + shop primary URL. Pick **up to 2** paths on free:

1. Highest-inventory or first `availableForSale` product with `onlineStoreUrl` (bestseller proxy without reports).  
2. If a collection is featured in navigation later — **v1.1**. Launch: 1–2 product purchase paths max.

Walk (mobile):

`PDP → first available variant → Add to cart → cart (drawer or /cart) → Checkout or Shop Pay sheet`

GREEN: checkout URL `/checkouts/` or Shop Pay UI visible.  
RED: twice, fresh browser: 4xx/5xx, ATC no-op, untappable, checkout error.  
UNKNOWN: captcha, password, no ATC, 1-of-2 fail, timeout without HTTP death.

`lib/integrity/run-path-probe.ts` wraps flow scan + journey-safety + video + screenshots.

---

## 7. Video evidence (launch requirement)

**Not prohibited.** Playwright `browser.newContext({ recordVideo: { dir, size: 375×812 } })` → webm. Existing `composeGif` + `captureInteractionFrames` as **fallback** if webm fails.

Per `VerificationRun`:

- Step screenshots (PDP, ATC, cart, checkout/fail)  
- **webm of the whole walk** (or GIF of key steps if encode fails)  
- reasonCode, failed step, timestamps, attempt 1/2  

**Playback:** in-app `<video>` (webm) + download. Incident CTA: **Watch verification**.

**Retention (cost):**

- RED/UNKNOWN: 14 days  
- GREEN: keep **last successful** only  
- GIF fallback same policy  

**Cost (order of magnitude):** 30s 375p webm ~0.5–2MB. Free shop ~4–8 runs/day. With last-GREEN-only: **≪ $0.10/shop/month** storage on R2. Browser time dominates (existing worker). Free plan stays viable.

Do not build session replay of real shoppers. This is proof of **FixFlags’ walk**.

---

## 8. Shopify integration

Public **embedded** app. CLI + `shopify.app.toml`. GraphQL Admin. Expiring offline tokens + token exchange. App Bridge CDN. No theme app extension (no checkout slowdown).

**Launch scopes:** `read_products`  
**Parallel request (not blocking first submit):** `read_reports` + Protected Customer Data **Level 2** for ShopifyQL sessions funnel. Production `shopifyqlQuery` **requires L2 even for aggregate funnels** (Shopify staff, 2026). That is extra review + install friction. **Do not hold Protect/Prove launch on it.**

**Webhooks:** `app/uninstalled`; GDPR trio (HMAC, shop/redact deletes); `products/update` debounce 15m. Theme publish if no extra scary scopes.

**GDPR:** we store shop email, product titles, URLs, videos of **our bot**. No customer PII at launch. Still implement the three webhooks.

**Billing API:** none until we charge. Listing: Free + Pro waitlist $0.

**Operator:** Partner app, dev store, icon, 1600×900 screenshots (include video still), support email.

---

## 9. Funnel intelligence (do not invent)

**Available and real:** ShopifyQL `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout` plus device breakdown. Also `added_to_cart_rate`, etc.

**Blocker:** production needs `read_reports` **and** Protected Customer Data Level 2. Web Pixel (`write_pixels`) is more invasive and not required if ShopifyQL lands.

**Launch Understand (no L2 yet):**

- Diagram of **FixFlags path steps** (not fake %): Product → Cart → Checkout with GREEN/RED per step from our last walk.  
- Copy: “These are paths we verified. Store-wide conversion numbers appear when reports access is approved.”  
- Waitlist tile: `funnel_analytics`

**Post-approval Understand:**

- ShopifyQL last 24h / 7d / 30d funnel  
- Device split if the query allows  
- Overlay: “Add to cart dropped vs 7d baseline **and** FixFlags RED at ATC on mobile”  
- Inverse: “Checkout starts down; FixFlags path GREEN — not a broken buy button”

Never invent percentages. Never compete with Triple Whale on spend attribution.

---

## 10. Improve system

Run **after** Protect is GREEN or as a daily job on the monitored URL. **Never in Slack/email incidents.**

Allowlist (adapt `runAllChecks`, skip AI judge, cap **8** items):

| Group | Keep |
|---|---|
| **Revenue** | conversion-friction, cta-focus, auth-checkout dead links, flow unclickable (if not already an incident) |
| **Search** | seo, metadata, og-image (product URL) |
| **Experience** | mobile, mobile-ux-quality, accessibility (serious only) |
| **Technical** | performance (critical LCP only), broken resources, security-headers (only if blocking) |

Drop: slop, visual-polish, messaging-clarity essays, trust-psychology fluff, PageSpeed as a score ring.

UI: title, why it matters in one line, evidence screenshot if we have it. No 37-issue dump. Recheck Improve weekly on free.

---

## 11. Monitoring + incidents + alerts

**Cheap often:** HTTP open-check on path URL every 15 min (existing `open-check.ts`). Fail → expensive walk.  
**Expensive when useful:** full mobile walk + video: install, 6h pulse, product webhook (15m debounce), after cheap fail, recovery (15m/1h/6h), manual (5/day).

**Incident:** open on confirmed RED; close on GREEN. In-app list.

**Alerts (launch):**

- In-app  
- Email (Resend) — required  
- **Slack incoming webhook** — launch, optional paste in settings (table stakes vs Revenue Shield; ~small surface)

Body: product, confirmed twice, failed step, Watch video, screenshot, Recheck. **No Improve advice.** Recovery email when GREEN.

UNKNOWN: in-app only, not Slack/email.

---

## 12. Free plan + paid waitlist

**Free:** 1–2 auto paths, 6h walk + cheap HTTP, video on runs (retention above), email + optional Slack webhook, 7-day history, 5 rechecks/day, Improve weekly cap 8, Funnel = verification overlay until L2.

**Waitlist keys:** `extra_paths`, `faster_cadence`, `funnel_analytics`, `paid_traffic`, `multi_store`, `history_video`, `improve_full`

No prices. “Join Pro waitlist.” Track feature.

---

## 13. Shopify App Store

**Title:** FixFlags: Purchase Path Monitor  
**Subtitle:** Know when customers can't buy  
**Terms:** `checkout monitor`, `purchase path`, `cart broken`, `store monitoring`, `add to cart`  
**Categories:** Operations; Site optimization (Revenue Shield).  

Screenshots: Overview health, RED + **video player**, path steps, funnel empty or real, Improve short list.  
Video on listing: 20–30s of a failed ATC walk if we can cut it.  

0→10 founder+DMs; 10→50 listing+review-after-GREEN+3d; 50→100 Search Ads if listing converts. Support 1 business day.

---

## 14. Website + paid acquisition

`/` and `/protect` same story. CTA Install on Shopify. Secondary: “See where customers drop” only as a line, not the hero.

**Ads only after public listing.**

Concepts: (1) Ads still running / can’t buy + video still (2) Store up ≠ can buy (3) Watch the walk fail. US/UK/CA/AU. $50/day × 7. Conversion: `shopify_install_completed`. Quality: first verification with video. Kill: install CPA > $80 or activate < 30% after 50 installs. Never hit legacy homepage.

---

## 15. Meta paid-traffic track

Parallel: Meta app, business verification, `ads_read`. After Shopify live: delivering website ads → destinations → extra paths. Funnel later: paid sessions if ShopifyQL+UTM exists — only when numbers are real. No pause. No fake spend.

---

## 16. Analytics

Add events: install start/complete, path discovered, verification completed, **video generated**, first GREEN/RED, evidence viewed, **video played**, funnel viewed, improve viewed, alert sent, recovered, waitlist (feature), uninstall.

Dashboard: activated watching shops, ttfv, video play rate on RED, false RED, D7 uninstall, waitlist mix, LP→install→activated.

---

## 17. Operations / security / privacy / support

HMAC webhooks; encrypt tokens; uninstall stops jobs + deletes videos; shop/redact full delete; Sentry web+worker before strangers; integrity job cap; R2 lifecycle for videos; support email; privacy: bot visits storefront, we record **our** session, no customer PII at launch; secrets `SHOPIFY_*`; existing deploy/rollback.

**Rough free cost/shop/month:** worker seconds (minutes of Chromium) + <$0.10 storage. Dominant cost is browser. Cap 2 paths × ~8 walks/day.

---

## 18. QA

Matrix: PDP, variants, sold-out pick, drawer vs cart page, cookie, popup, Shop Pay, third-party theme, slow, broken ATC → RED+video, checkout 500 → RED, network → UNKNOWN, password → UNKNOWN, uninstall, email, Slack webhook, Improve not in alert, funnel empty without L2 / real numbers with L2 on a dev store that has reports.

Classifier + HMAC + video upload unit tests. Dogfood one live store before submit.

---

## 19. Migration

Replace homepage/pricing/nav. Park samples/roast as entry. Keep old reports at `/report/*`. Dashboard for existing users: install Shopify CTA. Copy-drift tests updated. One thesis everywhere a stranger lands.

---

## 20. Sequenced implementation

Mergeable phases. Tests on each.

| Phase | Work | Accept | Likely files |
|---|---|---|---|
| **0** | Partner app, TOML, env, two-layer store | OAuth on dev store | `shopify.app.toml`, operator |
| **1** | Mobile buy-path probe, classify | Fixture GREEN / broken RED / timeout UNKNOWN | `lib/integrity/*`, adapt `run-flow-scan.ts` |
| **2** | **recordVideo + step shots + GIF fallback, playback** | RED run has watchable webm/gif | `lib/integrity/video.ts`, storage, `visual-capture` reuse |
| **3** | Embedded app, tokens, GDPR, uninstall | Install/open/uninstall | `app/shopify/*`, `lib/shopify/*` |
| **4** | Auto-discover 1–2 product paths | Empty catalog UNKNOWN | GraphQL products |
| **5** | Schedule, HTTP pulse, webhooks, incidents, email+Slack webhook | Transition-only alerts with video link | watch tick, Resend, slack incoming |
| **6** | Overview + Paths UI (Protect/Prove) | Merchant sees walk+video without us | embedded Polaris |
| **7** | Funnel UI: verification overlay now; ShopifyQL behind flag | No fake %; empty honest | `read_reports` later |
| **8** | Improve allowlist on path URL | ≤8 items, not in alerts | `checks/index` filter |
| **9** | Free caps + waitlist tiles | No charge | WaitlistLead feature |
| **10** | Events, Sentry, admin shops, video lifecycle | Funnel dashboard | analytics, ops |
| **11** | Listing, legal, **submit** | Submitted or named blocker | copy, screenshots |
| **12** | `/` + `/protect` | No Product Review hero | `lib/marketing/copy/*` |
| **13** | Prod + dogfood + traffic after listing live | Checklist | Railway |
| **P** | Meta + PCD L2 application | Parallel, not blocker | Partner dashboards |

Stay in this Next repo (`/shopify`). No second Remix app.

---

## 21. Launch checklist

- [ ] Install / uninstall / GDPR HMAC  
- [ ] Auto path on supported store  
- [ ] GREEN/RED/UNKNOWN trustworthy  
- [ ] Screenshots + **watchable video** on incidents  
- [ ] Monitoring + recovery  
- [ ] Email + optional Slack, no advice in alerts  
- [ ] Free caps  
- [ ] Funnel: honest scope (no invented data)  
- [ ] Improve secondary, capped  
- [ ] Waitlist, no billing  
- [ ] Analytics + Sentry  
- [ ] Privacy/terms/support  
- [ ] Listing submitted or blocker written  
- [ ] Site matches app  
- [ ] QA matrix including video  
- [ ] LP → install → activated measurable  
- [ ] Ads only when listing public  

---

## 22. Post-launch operating loop

Weekly: activated shops, ttfv, video play on RED, false RED, D7 uninstall, waitlist keys, Improve clicks.

- False RED → freeze alerts, fix classifier  
- Waitlist winner → first Shopify Billing SKU  
- `funnel_analytics` demand → prioritize L2  
- `paid_traffic` demand → Meta  
- Installs, 0 return, 0 waitlist → job weak; do not add more Improve noise  

---

## 23. Explicitly parked

Product Review as product, scores, Agent, CLI/MCP, Stripe charge, auto-pause, storefront JS, completing purchases, FullStory-style customer replay, Triple Whale, 15-min default full walks, fake funnel %, finish-what-your-AI-started.

---

## 24. Remaining risks / open decisions

| Item | Default |
|---|---|
| Partner/assets | Operator; eng cannot submit without them |
| App review + PCD L2 delay | Ship Protect/Prove/video first; Funnel numbers later |
| `themes/publish` scope | Skip if extra; product webhooks + 6h |
| Shop Pay = GREEN | Sheet/iframe/URL |
| Slack | Incoming webhook launch; Slack OAuth app later |
| Video encode fail | GIF from existing compositor |
| Sentry | Required before strangers |

**First mergeable PR:** Phase 1 probe + Phase 2 video on a fixture URL (no Shopify). **In parallel:** Partner app + dev store.

No strategy reopen unless we cannot distinguish GREEN vs RED on normal Online Store 2.0 + cannot produce a watchable clip of that walk.
