# Paid Traffic Integrity — 30-day commercial loop

**HISTORICAL PLAN / IMPLEMENTATION REFERENCE, superseded as direction on 2026-09-08.** The complete vision at knowledge/vision.md and phased ROADMAP.md govern new work. Old scope, hero, commercial-loop, rubric and layout decisions below are not active instructions. Reuse technical evidence through docs/site-v2-migration.md; do not treat historical readiness as current release proof.


**Superseded (2026-09-05).** Launch vehicle is the Shopify app. Canonical plan: [shopify-app-launch-plan.md](./shopify-app-launch-plan.md). Paid-traffic / Meta is Phase 12 of that plan, not the install path.

Company thesis: FixFlags protects **paid destinations**, not stores. Unit of protection: a live paid URL and the conversion path behind it. v1 action: **buy**.

Do not reopen discovery unless this experiment is falsified (0 cards after 20 qualified conversations).

Canonical question: *When we are paying to send a stranger here, can that stranger still complete the action we are paying for?*

---

## Boundaries (do not cross)

| Neighbor | They start from | We do not |
|---|---|---|
| Revenue Shield | Shopify store, auto-discovered buy flows | Install Shopify, monitor the store as the object |
| AdAlign | Ad creative vs page | Scores, alignment, CRO suggestions |
| Optmyzr / uptime | URL status / OOS / pause | Stop at HTTP 200 |

We start from **the paid destination**. We exercise the path. Judgment is functional: can the stranger continue, yes / no / we do not know.

Meta + Shopify/ecommerce buy path is the wedge, not the company definition. Abstraction: paid destination → intended conversion action → integrity.

---

## 30-day objective

Strangers currently spending meaningful money on Meta **pay FixFlags to watch the paths behind that spend**.

Not: finish the pivot. Not: Live Meta OAuth. Not: a new report.

Gates:

- 20 qualified conversations (founder/operator or freelancer, website buys, ~$5k–$30k/mo Meta)
- 12 submit real paid destinations
- 8 see a successful first walk
- 3 cards
- ≥1 retained paid after trial

**0 cards after 20 properly qualified conversations = stop. Do not add reports, AI, or channels.**

---

## Offer

- Free: one-destination pre-flight (acquisition)
- Paid: Watch, **$99/month/account**, card on file, 7-day trial
- One SKU. No tier maze.
- Slack on confirmed GREEN↔RED only
- Paste 1–N live-ad destination URLs. Do not disguise paste as Meta connect.

ICP: founder/operator Shopify/ecom, $5k–$30k/mo Meta, website purchase paths. Secondary cohort: freelancers running 1–3 such brands. Not large agencies.

---

## Commercial loop (build this, in order)

1. Dedicated LP (`/protect`) — paid-traffic, not Product Review
2. Paste 1–N URLs
3. Deduplicate
4. Immediate **mobile** integrity walk
5. GREEN / RED / UNKNOWN + screenshot
6. Offer Watch
7. Slack webhook
8. Stripe $99
9. Re-run while watched
10. Alert on confirmed transitions only

Meta OAuth + app review **in parallel**. Not a blocker. After approval, Meta becomes source of truth (delivering website ads → destinations → walks → spend/ad association → anomaly re-walk). Do not rebuild Ads Manager. Do not auto-pause.

Do not invent spend on the dashboard before Meta is connected.

---

## Health taxonomy

GREEN: a new visitor on a phone can reach a state where they can pay (cart has the item and Buy / Shop Pay / payment fields are present). Stop before charge (`journey-safety.ts`).

RED: independently confirmed twice on a fresh browser that they **cannot continue**: 4xx/5xx/timeout, soft-404 / password / store unavailable, buy control missing or untappable after consent dismiss, add-to-bag does not add, buy/payment step errors or missing.

UNKNOWN: captcha/bot wall, could not find a buy control, intermittent (1 of 2), unsupported destination type. **Do not page as RED.**

Never RED: design, copy, CRO, slowness, scores, pixel/CAPI.

v1 supported: website ads to Shopify PDP / collection-with-product / single offer LP. Cookie dismiss. First in-stock variant.

v1 unsupported (say so): Instant Forms, Messenger, WhatsApp, unresolved catalog templates, password gates, login-required subscriptions, completed orders, auto-pause.

---

## Implementation slice (reuse, don’t rewrite)

### Reuse

- `lib/audit/browser/{page-session,page-capture,capture-profile,journey-safety,overlay-probe}.ts`
- `MOBILE_CAPTURE_PROFILE` (flow walk today hardcodes desktop in `runFlowScanStandalone`)
- `lib/audit/flow/{discover-cta,post-click-probes,destination-ux-probes}.ts`
- `lib/audit/checks/{flow,auth-checkout}.ts`, `open-check.ts`
- Queue + `processDueProjectWatches` lease pattern (`lib/audit/project-watch.ts`, 5-min tick)
- GitHub OAuth state/HMAC (`lib/integrations/github.ts`) as Meta connect template
- `lib/security/crypto.ts`, Stripe checkout/webhooks, screenshot upload

### New (minimum)

- `lib/integrity/run-destination-probe.ts` — mobile walk → GREEN/RED/UNKNOWN, no judge
- `lib/integrity/classify.ts` — map flow status + checkout smoke to taxonomy
- `lib/integrity/slack.ts` — incoming webhook, transition only, idempotent
- Prisma: `IntegrityDestination` (url, normalizedUrl, health, reason, evidence, lastTransitionAt, watchInterval, slackWebhookEncrypted) + optional later Meta ad ids / spend
- Routes: `POST /api/integrity/probe`, Watch, Slack config; UI `/protect`
- Stripe price for $99 Watch (do not reuse Product Review meter as the SKU)

### Adapt

- `run-flow-scan.ts` / `runFlowScanStandalone`: accept `MOBILE_CAPTURE_PROFILE`
- Slim runner: skip AI judge, rubrics, multi-page Product Review
- Watch tick: destination health jobs, Slack instead of (or beside) Resend flag-diff email
- Entitlement: Watch on this SKU is not Studio Product Watch

### Parallel (not blocking)

- Meta Marketing API app + `ads_read` review
- `lib/integrations/meta-ads.ts` + connect/callback
- After Live: pull `effective_status` delivering website ads, resolve `object_story_spec.link_data.link` / CTA link, dedupe, attach ad ids + insights spend/purchases
- Persist: destination ↔ ads ↔ health ↔ exposure timestamps (for later pause-with-permission)

### Park (do not work as the company bet)

- Homepage Product Review CTA as the paid motion
- Scores, Message/Experience/Reach, fix prompts, Agent pane as this SKU
- CLI, MCP, GEO, llms.txt, canvases, Timeline
- Shopify App Store clone of Revenue Shield
- Auto-pause, TikTok, Google, agency portal, funnel optimization

Existing Product Review code stays in the tree. It is not the experiment.

---

## Distribution (before Meta sophistication)

Founder-led only until a card exists:

1. Free pre-flight on `/protect`
2. 20 DMs to brands with live Meta website ads (Ad Library → walk their destination → factual screenshot)
3. r/FacebookAds, r/shopify, r/PPC as an operator
4. Freelance media-buyer groups

Artifact: *Your ads are live. This destination currently cannot complete Add to Cart on mobile. Here is the failed step.*

No fabricated spend. No substantial paid acquisition until founder-led shows willingness to pay.

---

## Sequence

| Days | Ship | Do not wait on |
|---|---|---|
| 1–7 | `/protect` paste, mobile probe, table, Slack, Stripe $99 trial, dogfood | Meta Live |
| 8–21 | 20 conversations, iterate taxonomy on real URLs | Ads Manager clone |
| 15–30 | Meta app review continues; enrich if approved | Auto-pause |
| 30 | Read gates. 0 cards → stop. | New features as a response to silence |
