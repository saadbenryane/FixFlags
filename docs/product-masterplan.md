# FixFlags implementation masterplan

**Definitive complete-product plan. Status: NEXT. Documentation only until a later task claims implementation.**

This file owns **what to build, in what order, and what may be claimed publicly**. It absorbs the former messaging-migration plan.

| Layer | Document |
| --- | --- |
| Why | [knowledge/vision.md](../knowledge/vision.md) |
| Customer IA | [product-architecture.md](product-architecture.md) |
| How we speak | [voice-and-copy.md](voice-and-copy.md) |
| Evidence truth | [knowledge/evidence-rules.md](../knowledge/evidence-rules.md) |
| **This plan** | Sequence, Now/Next/Later, acceptance |
| Engineering phases | [ROADMAP.md](../ROADMAP.md) (Site cutover; does not replace this plan) |
| Code today | [PRODUCT.md](../PRODUCT.md) |
| Persistence reuse | [site-v2-migration.md](site-v2-migration.md) |
| Behavior contracts | [product-prd.md](product-prd.md) |
| Interface states | [workspace-interface.md](workspace-interface.md) |
| Card design | [card-board-experience.md](card-board-experience.md) |

Do not execute production UI, monitoring, Agent, pricing, or report deletion from this file until BOARD claims that scope. Preserve in-progress owners (`homepage-hero-voice`, `homepage-end-user-polish`, `board-card-chrome`).

**Truth vs vision:** Architecture describes the intended product. Public copy claims only shipped behavior. A later capability that affects IA (FixFlags Agent FAB, Flag vs Recommendation, report retirement) is designed now even if it ships later.

---

## Product in one paragraph

FixFlags is continuous monitoring for businesses that depend on their online experience. The customer adds a website. FixFlags analyzes the live experience broadly, learns Pages and Journeys, and keeps watching. When something is important enough to act on, it raises a Flag. The customer, their team, agency, or coding AI Fixes it. FixFlags Verifies the live result. Monitoring continues. Complexity stays behind the product. Depth is available. Interruption is scarce.

Governing rule: **Analyze broadly. Flag what matters.** Customer loop: **Flag. Fix. Verify.** Analyze is the entry, not the product.

## Final information architecture

Account owns Sites. A Site is the persistent home. Home is a calm card board (Pages, Conversion/Journeys, Security, Search, Performance, Tracking, then library and connection-enriched cards). Flags are the attention destination. Pages and Journeys are reached through cards, not extra primary nav. Connections enrich the Site. History lives on Flags, cards, and the Agent, not a raw run log. The FixFlags Agent is a bottom-right assistant over the same objects, with a path into human support. The customer's coding AI is a separate job: **Send a Flag to your AI.** Reports and the legacy report Agent pane are compatibility, then retired.

Full object, nav, card, Agent, and integration models: [product-architecture.md](product-architecture.md).

## Critical path

1. **Lock vocabulary and invert tests** so Analyze, Journey, and Flag. Fix. Verify. can land without the suite fighting them.
2. **Business-importance Flag projector** so board counts, 0 Flags, and later notifications mean Flag, not every stored finding.
3. **One monitoring truth** (packaging vs Watch weekly/daily vs 3/30/90 pools vs access-policy) before cadence copy.
4. **Lean Site chrome:** Pages card, card face = category + Flag count + metric, Home · Flags, configuration in Site settings. Design for Agent FAB; do not add an Agent tab.
5. **First complete loop on the Site:** Analyze → board → Flag → Fix / Send to AI → Verify → Watch, with honest coverage and Verify states.
6. **Acquisition copy** only after (2), (3) honesty, and unshipped-integration cleanup.
7. **Unify Shopify into the same Site**; Flag-shaped notifications; then Agent + support context; then report/Agent-pane retirement.

Phases 1–4 in [ROADMAP.md](../ROADMAP.md) remain the engineering cutover for tenancy, coverage, Fix/Verify/Watch. This masterplan sequences the **complete intended product** around that core, including marketing, Agent, support, and retirement.

## Highest-risk architectural decisions

| Decision | Risk if wrong | Constraint |
| --- | --- | --- |
| `isCustomerFlag` projector (not POLISH=Recommendation, not a new table) | 0 Flags lies; noisy product | Combine existing ranking signals; fixtures before marketing |
| Monitoring entitlements vs public cadence | Trust and billing | Pulse vs verification (FF-B3 locked). Public copy is weekly/daily until pulse exists. No silent quota change. |
| Home · Flags vs Home · Flags · Site | Third tab becomes a junk drawer | Site settings, not a third product mode |
| Agent FAB vs report Agent pane | Two AI products | Design FAB now; do not invest in the pane as destination |
| Report URL compatibility vs Site-first | Broken shares vs split mental model | Keep `/report/[id]` working; stop sending owners there |
| Shopify as connection vs company | Two products | Same Site after install |
| Notification default | Noise or silence | Flags (or Critical only) — never “Everything” |
| Graph Prisma Site vs customer Site | Tenant leak | Never reuse `graph_*` as private Site |

## Product gaps blocking truthful messaging

These must be true in product (or copy must stay soft) before the new language is used as if shipped:

- Flags on the board are only what matters (projector).
- 0 Flags is never printed as all-clear without coverage.
- Monitoring cadence matches entitlements and Help.
- Verify is independent evidence, not “Fresh check passed” / absence.
- Homepage does not name Meta, GSC, deployments, MCP, or hourly Watch as present.
- Legal/privacy is URL-first, not Shopify-app-only.
- “Recommendations” are not marketed until the projector exists.
- “You're covered.” is not used.

## Legacy systems to retire

| Surface | Disposition |
| --- | --- |
| Report-first experience | **Migrate** value to Site; **redirect** owners; **keep** public evidence URLs for a compatibility window |
| `/report/[id]` routes | **Keep** until FF-K; then **redirect** signed-in owners to Site; public policy per SECURITY.md |
| Report emails / keep-report | **Migrate** to Site |
| Report fixtures, samples, SEO report pages | **Migrate** chrome; recapture if baked-in copy |
| Report docs (`content/docs/reports.md`, Help scores) | **Migrate** to Site/Flag language |
| Report contract | **Keep** as compatibility until cutover; then shrink |
| Legacy Agent pane (`WorkspaceChatPanel`) | **Replace** with FixFlags Agent; **deprecate** as destination |
| `/api/reports/[id]/chat` | **Reuse** grounding ideas; **merge or replace** under Site-scoped Agent |
| AI-builder-era messaging | **Delete** from customer copy |
| Check my website | **Replace** with Analyze |
| Needs attention / Checks passed / Fresh check passed | **Delete** from customer UI |
| Check → Flag → Fix → Verify; Find → Understand → Fix → Verify | **Replace** with Flag. Fix. Verify. (internal Analyze → … → Monitor stays off chrome) |
| Shopify-only company framing | **Migrate** listing/legal; **keep** native install |
| Products rail label | **Replace** with Sites |
| Finish Plan as primary artifact | **Keep** internally for ranking/compat; **do not** restore as customer product |
| Outcome as customer word | **Keep** in code; **Journey** in UI |
| Dual homepage registries | **Merge** how-it-works onto Care copy |

## Quick wins

After terminology + test locks (FF-A): Analyze CTA (partially shipping under `homepage-hero-voice`), Pages card rename (coordinate `board-card-chrome`), drop unshipped coverage groups, Send a Flag to your AI label on Flag actions, Sample instead of Controlled example, SEO home description, Watch email “issue(s)” → Flag, Journey on Outcome chrome. Do not ship Flag-importance homepage claims before the projector.

## Now / Next / Later summary

**Now (exists; align or refine):** URL Analyze → `/sites/{id}` board; cards; Flag page with Fix this / Copy prompt / Verify; Watch scheduler; Shopify integrity + email/Slack; live support FAB; accounts, billing, Help/Docs; 100+ checks; Playwright journeys; anonymous teaser → claim; Care homepage hero Analyze.

**Next (required for the first complete FixFlags experience):** Flag projector + Recommendations in card depth; honest 0 Flags + coverage; monitoring entitlement alignment; Verify customer states; Pages card and card-face language; Home · Flags + Site settings; Analyze/first-run/auth copy; Flag. Fix. Verify. on acquisition; Flag-shaped Watch/Shopify mail; URL-first legal; Help/docs/email lexicon; Sites not Products; unshipped-integration honesty; report no longer the signed-in home (already mostly true) and chrome leaks fixed.

**Later (intended; architect now):** FixFlags Agent FAB + support escalation with Site/Flag context; notification prefs (Flags / Critical only / Custom); Slack as Site channel; Meta, Analytics, Search Console, deployments as connections; Commerce/Paid traffic/Changes cards; MCP unpark; dedicated History only if needed; teams/agencies; protective actions; richer Send-to-AI; report route deletion after compatibility proof.

Later does not mean undesigned. Agent FAB, Flag projector, and report retirement shape navigation and data now.

## Parallel execution map

```text
FF-A Foundation (lexicon, tests) ─────────────────────────────┐
                                                               │
FF-B Domain truth ──┬── B1 projector (single owner)            │
                    ├── B3 entitlements (business + billing)   │
                    └── B4 Verify semantics                    │
                                                               │
FF-C Site chrome ── Pages/cards/nav (after A; coord board-card)│
FF-D Flag UX ────── after B1 for counts; copy can start earlier│
FF-E First loop ─── after A; cadence claims wait on B3         │
                                                               │
FF-F Monitoring/history ── after B3                            │
FF-G Shopify unify ────── can start after Site identity stable │
FF-I Acquisition ──────── after B honesty + C Pages + E Analyze│
FF-J Help/email/legal ─── after B3 for cadence; else lexicon   │
                                                               │
FF-H Agent/support ────── design with C; implement after Site  │
FF-K Report retirement ── after Site is the signed-in product  │
FF-L Validation ──────── after the claimed wave, not only at end
```

Do not parallelize two owners on `lib/sites/*`, `CareHomepage` / `care-homepage.ts`, or `BoardCard` without a BOARD split.

---

## Classification

| Tag | Meaning |
| --- | --- |
| **Now** | Shipped; align language or small behavior |
| **Next** | Required for first complete experience |
| **Later** | Intended product; design for it now if it affects IA |
| **PP** | Product prerequisite (copy would lie without it) |
| **MM** | Messaging/presentation; behavior exists |
| **FO** | Future opportunity inside the intended architecture |
| **IC** | Internal cleanup |

---

## Truth matrix (public claims)

| Claim | Evidence (2026-09-09) | Public today | After prerequisite |
| --- | --- | --- | --- |
| Analyze | `AuditInput` → `/sites/{id}` | Analyze (hero shipping); other CTAs mixed | All acquisition CTAs |
| 100+ automated tests | `ALL_CHECK_IDS` ≈ 201 | Yes | Recheck before raising |
| Real browser journeys | Playwright + journey checks | Yes | Same |
| Analyze broadly. Flag what matters. | Checks run widely; board Flags all OPEN rows | Soft: broad analysis | After projector |
| Flag = act on this | All OPEN rows counted | Do not claim importance-only | After projector |
| Recommendations | No entity; Improvements = Finish Plan | Do not market | After projector, in card depth |
| 0 Flags | Help honest; board Looking good | Do not use as all-clear | Coverage states |
| Continuous monitoring | Watch exists | Monitoring / keeps watch, no fake cadence | After FF-B3 |
| Cadence | Pricing weekly/daily at `$49`; Watch weekly/daily; pool 3/30/90 hidden | Soft or name code | One truth |
| Verify | Scoped child audit; copy “not observed” | Verify fix | Independent states |
| Notifications | Watch email; Shopify email+Slack; no prefs | Do not describe modes | After prefs |
| Shopify | OAuth, walks, alerts | FixFlags for Shopify, same product | Unified connection |
| Meta / Analytics / GSC / deploys | Internal or unshipped | Do not claim | After adapters |
| Send a Flag to your AI | Copy prompt | Yes (copy mechanism) | Richer payload; MCP later |
| MCP | Parked in `proxy.ts` | Developer docs only if unparked | Homepage when real |
| FixFlags Agent | Report pane only | Do not market FAB | After FF-H |
| Privacy | Page Shopify-shaped | Quiet: we do not sell data | URL-first legal |

---

## Architecture findings (do not rediscover)

### Flag vs Recommendation

Prisma `Flag`: source DETERMINISTIC | AI | JOURNEY; severity CRITICAL | IMPORTANT | POLISH; status OPEN | FIXED | IGNORED | REGRESSED. Every OPEN row is a Flag today. `isAttentionCandidate` excludes POLISH from Finish Plan (max 3). Site board counts all OPEN Flags. Ranking exists in `priority-flags.ts` but the board orders by severity then createdAt.

**Lean architecture:** no Recommendation table. Evolve attention into `isCustomerFlag` using severity, impactTag, journey/page purpose, existing demotion signals. Remainder = Recommendations in card depth. POLISH checkout failure can still be a Flag. IMPORTANT metadata on an unimportant page can be a Recommendation.

### Monitoring (one customer concept)

Internally distinct: first Analyze, Watch, Verify, Shopify pulse (15m) / walk (6h), later event triggers, retries. Externally: **FixFlags is watching.** Do not teach six run types. Watch/pause/cadence in Site settings.

`access-policy.canUseWatch` Studio-only vs entitlements Free Watch is a contradiction to fix (FF-F5).

### History

Now: Flag verify attempts; report score history. No Site activity feed. Intended: Flag timeline; card last-evidenced; Agent “what changed?”. No History nav until a job cards/Flags/Agent cannot answer.

### Two AIs

FixFlags Agent = in-product assistant (FAB). Coding AI = Send a Flag to your AI (copy now, MCP later). Do not collapse.

### Support

`SupportSession`: visitorToken, optional userId, pageUrl; auditId only from `/report|audit/` paths. No siteId/flagId. Report immersive hides support FAB. Intended: Agent escalates with Site/Flag/route/transcript; reuse live-support store.

### Reports

Primary handoff is already `/sites/{id}`. `/report/[id]` remains public evidence, export, SEO, Agent history. Re-home value per [product-architecture.md](product-architecture.md); then retire.

---

# Waves

Each item is an implementation unit for another agent. Claim BOARD. Do not implement from this documentation-only run.

---

## Wave A — Foundation

**Capability:** One lexicon and docs hierarchy so later waves do not fight tests or competing visions.  
**Now/Next:** Next (docs in this run are Now).  
**Exit:** Constants exist; Journey/Analyze tests inverted or scheduled with first consumer; indexes point here.

### FF-A1 Terminology module — IC / Next

- **Current:** Forked CTAs in REVIEW_ENTRY, CUSTOMER_TERMS, CARE_HOME, PLANS, billing.
- **Intended:** `terminology.ts`: `analyzeCta`, `coreLoopLabel` (`Flag. Fix. Verify.`), `zeroFlags`, `sendFlagToAi`, Pages card name, Sample.
- **Rationale / impact:** Stops copy drift; customers see one product.
- **Files:** `lib/marketing/copy/terminology.ts` then consumers.
- **Deps:** Canon. **Parallel:** No. **Tests:** pricing-parity, shopify-customer-ready.
- **Acceptance:** Single Analyze string; CORE_LOOP_LABEL matches canon.
- **Legacy retired:** Check my website as primary constant.

### FF-A2 Brand leftovers — MM / Next

- **Current:** BRAND.tagline still Find what is getting in the way.
- **Intended:** Monitoring + looked after.
- **Files:** `lib/marketing/copy/brand.ts`. **Deps:** A1. **Tests:** homepage-message.
- **Acceptance:** Tagline matches canon. **Parallel:** After A1.

### FF-A3 Test locks — MM / Next

- **Current:** Bans `journeys?`; locks Check my website.
- **Intended:** Analyze CTA; Journey allowed; coverage-incomplete ≠ 0 Flags; after projector, Recommendations do not increment Flag counts; homepage does not name unshipped integrations.
- **Files:** `lib/__tests__/homepage-message.test.ts`, pricing-parity, shopify-customer-ready, AuditInput.test, e2e public-journeys.
- **Deps:** A1. **Parallel:** Same PR as first CTA. **Legacy:** Check my website test lock.

### FF-A4 Dual homepage registry — IC / Next

- **Current:** CareHomepage live; `/how-it-works` uses leftover `homepage.ts`.
- **Intended:** One loop story. **Files:** route how-it-works to Care copy or mark leftover. **Deps:** A3. **Parallel:** After A3.

### FF-A5 Documentation hierarchy — IC / Now (this run)

- **Intended:** Vision → architecture → messaging → evidence → this plan → specialized docs. Obsolete files labeled. **Acceptance:** A new agent can reconstruct the product from docs without chat history.

---

## Wave B — Core domain truth

**Capability:** Honest Flags, coverage, monitoring, Verify. **Blocks** Flag-importance and cadence marketing. **Next. PP.**

### FF-B1 Customer Flag projector — PP / Next

- **Product capability:** Board Flag counts and Flag list = important enough to act on.
- **Current:** Every OPEN Flag counted; Finish Plan excludes POLISH.
- **Intended:** `isCustomerFlag`; remainder as Recommendations in depth. No new Recommendation table. Not POLISH=Recommendation.
- **Rationale:** Otherwise “Flag what matters” is false.
- **Customer impact:** Fewer, better Flags; 0 Flags becomes meaningful with coverage.
- **Architectural impact:** Notifications, cards, Agent, and health all consume the projector.
- **Files:** `lib/audit/attention.ts`, `priority-flags.ts`, `lib/sites/flags.ts`, `coverage.ts`, `site-health.ts`, `board-card.ts`, `application/queries.ts`.
- **Deps:** Fixtures: broken contact = Flag; optional meta = Recommendation; POLISH-on-checkout still Flag if Journey-critical.
- **Migration:** Improvements still from Attention; do not change stored severity as the only gate.
- **Tests:** board-card, coverage, attention, site-health, projector units, accuracy corpus.
- **Acceptance:** Contact form Flag; optional title-too-long on non-Journey page can be Recommendation; projector Recommendations do not make Site unhealthy; coverage-incomplete still not healthy.
- **Blocks:** Homepage Flag-importance; Recommendation marketing; Flag-only notifications.
- **Parallel:** No. Coordinate `board-card-chrome` if touching `lib/sites`.
- **Legacy:** Finish Plan remains internal ranking, not the inbox.

### FF-B2 0 Flags rendering — PP / Next

- **Current:** Looking good / Needs attention.
- **Intended:** Canon state table in voice-and-copy. Never 0 Flags as all-clear when learning, unknown, failed, stale, unscheduled.
- **Files:** `site-health.ts`, `board-card.ts`, help `reading-your-report`.
- **Deps:** B1 for counts; coverage-incomplete copy can ship earlier as MM.
- **Tests:** Fixture with unknown security card never all-clear.
- **Acceptance:** Same. **Parallel:** With B1 if same owner.
- **Legacy:** Looking good as health prose.

### FF-B3 Monitoring entitlement decision — PP / Next — **locked 2026-09-09**

- **Decision:** Public packaging matches Watch. Free: weekly verification, one site. Pro: `$49`/website/mo, daily verification. Studio: volume waitlist. Pulse (cheap reachability of inferred journeys) is the later closer-than-daily job; do not print continuous or hourly until it exists. Hidden `auditLimit` 3/30/90 stays off `/pricing`. Paid COGS envelope ~`$12`/site/mo; measure `auditRunCost` p50 before `STRIPE_PAID_OPEN`.
- **Until pulse exists:** do not print 24/7 or hourly. Paid CTA is the waitlist. Do not silently enable hourly full walks.
- **Files:** `lib/billing/plans.ts`, `entitlements.ts`, `access-policy.ts`, `copy/plans.ts`, help billing, PRODUCT.md, `knowledge/strategy.md`.
- **Risk:** High. No silent quota change. Preserve paid records. `STRIPE_PAID_OPEN` stays false.
- **Acceptance:** Pricing, Help, entitlements, Watch API, and PRODUCT.md agree. No hourly full Playwright at $49.
- **Blocks:** Hourly/24h sentences until pulse ships.
- **Parallel:** Packaging copy in this lock. Pulse runtime is Phase 4.

### FF-B4 Verify semantics — PP / Next

- **Current:** Flag FIXED = not observed; Improvement VERIFIED = independent; UI Fresh check passed.
- **Intended:** Verified / Still open / Inconclusive / Couldn't verify. Never resolve from Done, deploy, or absence.
- **Files:** `SiteFlagActions.tsx`, Flag page, `flag-status-resolution.ts`, help flag-fix-recheck, `copy/flags.ts`.
- **Deps:** Evidence rules already require this.
- **Acceptance:** Absence-only monitoring does not show Verified on Site Flag.
- **Legacy:** Fresh check passed. **Parallel:** Copy MM after semantics confirmed.

### FF-B5 Unshipped integration claims — MM / Next

- **Current:** Coverage groups list deployments, paid traffic, real visitor failures.
- **Intended:** Remove or mark coming; never as current coverage.
- **Files:** `care-homepage.ts` checks.groups; leftover `homepage.ts`.
- **Acceptance:** Grep: no Meta/GSC/deploy as shipped. **Blocks:** Acquisition rewrite. **Parallel:** Yes.

---

## Wave C — Site architecture

**Capability:** Customer objects visible; lean nav; cards glanceable. **Next.** Design Later Agent so chrome does not conflict.

### FF-C1 Pages card — MM / Next

- **Current:** Area id `site`, name Site.
- **Intended:** Customer name Pages; metric page count; area id may stay `site`. Aggregate health in header / Flags badge.
- **Files:** `card-areas.ts`, `board-card.ts`, BoardCard, BoardDetails, CARE_HOME.site, prototype.
- **Deps:** Coordinate `board-card-chrome` / `homepage-end-user-polish`.
- **Tests:** board-card.test expects Pages. **Acceptance:** First card says Pages on sample and live board.
- **Legacy:** Site as first card name.

### FF-C2 Card face — MM / Next

- **Intended:** Category, Flag count, one useful metric. Stop Needs attention, Needs a fix, Checks passed, Latest check passed, Looking good as face copy.
- **Metrics:** Pages = page count; Security = Protected or failing control; Search = crawlable pages; Performance = LCP; Conversion = Journey name or the Flag; Tracking = named public events (not Connected if overclaim); Uptime/Accessibility when added.
- **Files:** SITE_BOARD_COPY, site-health, coverage, queries, care-homepage cards.
- **Deps:** B1 for Flag counts. **Tests:** BoardCard, CareHomepage.
- **Unknown/loading:** Learning, Checking, Not verified yet, Couldn't verify. No 0 Flags.

### FF-C3 Navigation — Next (behavior + copy)

- **Current:** Account rail Sites/Billing/Docs/Help/Settings; Site local tabs Dashboard · Flags · Site; no site switcher; Products leftover.
- **Intended:** Inside Site: Home, Flags (badge), Site settings, All Sites / switcher, Agent FAB (placeholder until H). Mobile: Home · Flags · More. No Pages/Journeys/History/Reports/Agent nav items.
- **Files:** `components/sites/SiteBoard.tsx`, `components/layout/sidebar.tsx`, ProductOverviewGrid.
- **Architectural impact:** Do not add Agent tab. Third tab named Site only until settings exist, then retire as primary.
- **Acceptance:** Customer can answer “how is the Site / what needs me / settings” without a report.
- **Parallel:** After C1/C2 preferred. **Legacy:** Products, Agent | Report.

### FF-C4 Site settings split — Next

- **Current:** Site tab mixes coverage, outcomes, configuration.
- **Intended:** Watch, notifications, connections, danger zone in settings. Journeys on Conversion card + confirm UI. Coverage visible on Pages/cards.
- **Files:** SiteBoard Site tab, future settings route.
- **Later:** Compact multi-Site switcher.

### FF-C5 Card taxonomy vs library — Now/Next/Later

- **Now:** Starter cards as shipped. **Next:** Align names/metrics. **Later:** Commerce, Paid traffic, Changes when connections exist. Add card opens library. Categories are not nav.

---

## Wave D — Flag lifecycle

**Capability:** Attention, optional depth, Fix, coding-AI handoff, Verify UI. **Next.**

### FF-D1 Flag list and detail — Now refine / Next

- **Intended:** What, where, why, evidence, what to do, how Verify will run. Actions: Fix this, Send a Flag to your AI, Share, Verify.
- **Files:** Flag page, `SiteFlagActions.tsx`, `copy/flags.ts`.
- **Deps:** B1 for list membership; B4 for Verify labels.
- **Acceptance:** A Flag is ready to act without a glossary.
- **Legacy:** Copy prompt as lead label; Needs a fix.

### FF-D2 Recommendations in depth — Next (after B1)

- **Intended:** Card detail lists Recommendations. They do not badge Home, do not notify.
- **Files:** board details, queries. **Do not market until B1.** **Later:** Agent can explain Recommendations.

### FF-D3 AI payload — MM / Next

- **Current:** `buildExpertFixPrompt` (Goal, Constraint, Context, Why, Plan, Verify).
- **Intended:** Dedicated URL/session and Journey fields when present.
- **Files:** `lib/audit/flag-copy.ts`. **Parallel:** Yes. **Anonymous:** evidence visible; prompt gated until claim (keep).

### FF-D4 MCP handoff — Later / FO

- **Current:** Parked `/api/mcp`, API keys, docs.
- **Intended:** Progressive option beside copy when customer-ready. Homepage only then.
- **Files:** `lib/mcp/`, `proxy.ts`, docs. **Do not** Connect MCP on marketing now.
- **Architectural impact:** Same Flag object; different transport.

### FF-D5 Journey chrome — MM / Next

- **Current:** Outcome / Inferred.
- **Intended:** Journey in customer chrome; Looks right · Edit stays. Model name Outcome OK internally.
- **Files:** SiteOutcomeEdit, conversion card. **Parallel:** Yes.
- **Legacy:** Outcome as customer word; Funnel.

---

## Wave E — First complete customer experience

**Capability:** Analyze → learning → board → Flag → Fix → Verify → claim Watch. **Next.**

User journey must be felt, not explained: first board is the Site; claim starts Watch; never a second product.

### FF-E1 Analyze CTA — MM / Next (hero partially Now)

- **Current:** Hero Analyze under homepage-hero-voice; other CTAs mixed.
- **Intended:** Analyze everywhere a URL is submitted; placeholder yourwebsite.com.
- **Files:** terminology, care-homepage, AuditInput, plans CTA, billing. **Deps:** A. **Collision:** homepage-hero-voice.
- **Legacy:** Check my website.

### FF-E2 First-run loading — MM / Next

- **Current:** Reviewing your site, Running checks, Funnel review.
- **Intended:** Learning your website / discovering pages / testing Journeys.
- **Files:** `errors.ts` AUDIT_PROGRESS, SiteBoard. **Acceptance:** No Funnel. Failure is not 0 Flags.

### FF-E3 Auth / claim — MM / Next

- **Current:** Site check underway; Keep watching; /post-login.
- **Intended:** Analyze was first look; save to monitor. Keep /post-login and one teaser.
- **Files:** `auth.ts`, claim dialog. **Deps:** B3 for “covered” claims — never You're covered.
- **SECURITY:** claim same Site; no duplicate usage.

### FF-E4 Account Sites list — MM / Next

- **Current:** Check a website URL; Products; No open Flags.
- **Intended:** Analyze; Sites; 0 Flags only if projector+coverage allow.
- **Files:** ProductOverviewGrid, REPORT_COPY.dashboard, sidebar.

### FF-E5 Accessibility and mobile of the loop — Next

- **Intended:** 375 and 1280; 44px targets; status + color; essential actions on mobile. **Verify in browser** per QUALITY.md.
- **Later:** Further a11y depth (Accessibility card).

---

## Wave F — Monitoring, history, notifications

**Capability:** One watch; quiet interruption; understandable time. **Next** for honesty; **Later** for prefs and extra channels.

### FF-F1 One monitoring concept — Next

- **Intended:** Customer: FixFlags is watching. Internals remain Analyze/Watch/Verify/Shopify/events.
- **Files:** Site settings, Help, PRODUCT.md after B3.
- **Acceptance:** Help does not teach six run types or contradict B3.

### FF-F2 Watch regression email — MM / Next

- **Current:** N issue(s).
- **Intended:** Flag voice; count from projector after B1.
- **Files:** `lib/audit/project-watch.ts`.

### FF-F3 Shopify integrity alerts — MM / Next

- **Keep** urgency. Direction: 1 Flag. Customers can't complete checkout. Recovery: Verified.
- **Files:** `lib/integrity/alerts.ts`. Same Flag object eventually (FF-G1).

### FF-F4 Notification prefs — Later (design Now)

- **Mental model:** Flags (default) · Critical only · Custom. Not Everything / Flags only / Custom.
- **Channels:** Email first (Resend). Slack where already Shopify; then Site-level Slack. No SMS/push in first complete version. No daily digest invention. Recovery/Verified may notify if the customer asked.
- **Dedup, quiet hours, per-Site, Journey, category:** Custom. Architect keys now (Site, Flag fingerprint, severity/importance).
- **Files (later):** Site settings, `lib/integrity/alerts.ts` generalization, Watch mailer.

### FF-F5 access-policy vs entitlements Watch — IC / Next

- **Intended:** Studio-only policy cannot silently deny Free Watch if entitlements allow it (or vice versa after B3).
- **Files:** `access-policy.ts`, `entitlements.ts`.

### FF-F6 History — Next (Flag/card) / Later (dedicated)

- **Next:** Flag opened / attempts / verified / regressed on Flag page. Card last evidenced.
- **Later:** Agent answers what changed. Dedicated History only if needed.
- **Do not** ship an activity feed of every check.

### FF-F7 Event-triggered monitoring — Later

- **Intended:** Deployments, Shopify events, analytics anomalies can trigger a closer look. Same Watch concept. **Architect** as another trigger, not a product mode.

---

## Wave G — Connections as context

**Capability:** Integrations make FixFlags smarter. **Now** Shopify wedge; **Next** unify; **Later** adapters.

For each: value, context, monitoring, Flag importance, Verify, Agent, state, prerequisite, UI home.

| ID | Connection | Value | Context | Monitoring | Flags | Verify | Agent | State | Home | When |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FF-G1 | Shopify | Purchase path, catalog | Orders, shop | Pulse/walk | Commerce Flags | Re-walk checkout | Explain checkout | Now path; Next unify into Site Flag | Commerce card + native install | Next unify |
| FF-G2 | Email | Interruption | Account email | n/a | Notify Flags | Recovery mail | n/a | Now | Site notification settings | Next Flag-shaped |
| FF-G3 | Slack | Team channel | Webhook | n/a | Same Flags | Same | n/a | Shopify now | Site settings | Later Site-wide |
| FF-G4 | Tracking pixels | Measurement health | Public events | Checks | Tracking Flags | Recheck events | Explain pixel | Now checks | Tracking card | Now |
| FF-G5 | Analytics | Volume / Journey | Visitor stats | Enrich cadence later | Importance | n/a | What changed | Internal GA for FixFlags SEO; not customer connect | Conversion/Flags | Later |
| FF-G6 | Search Console | Search impact | Coverage/queries | Enrich Search | Search Flags | n/a | Indexing | OAuth code exists, not sold | Search card | Later |
| FF-G7 | Meta | Paid landing | Ads, pixels | Enrich | Paid Flags | n/a | Why this page | Internal CAPI only | Paid traffic card | Later |
| FF-G8 | Deployments | When it started | Release time | Trigger look | Timing on Flag | Compare before/after | What changed | Railway webhook parked | Changes card | Later |
| FF-G9 | MCP | Coding AI access | Flags/evidence | n/a | Handoff | n/a | Send to AI | Parked | Send to AI + settings | Later |

Connect in context, not a logo wall. Revoke in Site settings. Lost connection = coverage gap, not a dead dashboard.

**Shopify positioning:** Keep install, purchase-path walks, confirmed-twice alerts, Can buy / Can't buy on that path. Change listing/legal that say FixFlags **is** a Shopify-only monitor. After install: same Site.

**Do not** automatic ad pauses, deploys, or purchases.

---

## Wave H — FixFlags Agent and support

**Capability:** Persistent assistant; graceful human support. **Later** to ship FAB; **Next** to stop investing in the report pane and to persist Site context on support. **Design now.**

### FF-H1 Agent product model — Later (IA Now)

- **Intended:** Bottom-right FAB. Context: account, Site, route, card/Flag, recent monitoring, conversation. Can explain, navigate, gather context, help fix, send to coding AI (confirm), escalate to support. Cannot silently edit repos, pause ads, deploy, or place orders.
- **Current:** `WorkspaceChatPanel` + `/api/reports/[id]/chat` on `/report/*`. Immersive report hides support FAB.
- **Reuse:** Chat message store, grounding on flags/evidence, live-support sessions, admin `/admin/feedback`.
- **Replace:** Agent as a destination competing with Home.
- **Files (later):** new Site-scoped assistant module; do not extend report pane as the product.
- **Acceptance:** Customer never needs “open the Agent tab.” FAB available on Site Home and Flag.
- **Copy:** Ask FixFlags vs Send a Flag to your AI — two names, two jobs ([voice-and-copy.md](voice-and-copy.md)).

### FF-H2 Support escalation — Next (context) / Later (via Agent)

- **Current:** SupportWidget; SupportSession without siteId/flagId; auditId from report URLs only.
- **Intended Next:** Persist siteId, optional flagId, route; extract from `/sites/`. Do not hide support on Site.
- **Intended Later:** Agent offers “talk to support”; packet includes conversation summary, customer, Site, Flag, recent monitoring. Minimize PII ([knowledge/privacy.md](../knowledge/privacy.md), SECURITY.md).
- **Files:** `lib/live-support/*`, SupportWidget, Prisma SupportSession, admin feedback.
- **Acceptance:** Support can open the Site/Flag without the customer repeating the URL.

### FF-H3 Retire report Agent pane — Later (after H1) / stop investing Now

- **Disposition:** Deprecate as customer model immediately in docs. Redirect signed-in report users to Site. Keep anonymous report evidence per report-contract until FF-K.
- **Files:** `ReportWorkspaceSplitShell`, `WorkspaceChatPanel`.
- **Legacy retired:** AI Agent product.

---

## Wave I — Acquisition (marketing is the product)

**After B honesty, C Pages, E Analyze.** **Next.** Do not fight `homepage-hero-voice` files without a split.

### FF-I1 Homepage — MM / Next

Hero: keep looked after; tighter body; Analyze (may already ship); board sample Pages + Flag counts + Sample; workflow Flag. Fix. Verify. (drop Check); 100+ with Analyze broadly, remove unshipped groups; Journeys shortened; one AI story (Send a Flag to your AI); Flag-shaped notification sample; Shopify as connection; one or two concrete risks then calm; close Analyze + monitoring; footer/OG from seo.home.

**Files:** `care-homepage.ts`, `CareHomepage.tsx`, tests, `seo.ts`. **Do not** implement against leftover `homepage.ts`. **Do not** repeat Flag. Fix. Verify. on every card.

### FF-I2 How-it-works, pricing, Shopify pages — MM / Next

Same loop. Pricing CTA Analyze; cadence after B3; connections honest (Shopify available). `/install` `/protect` listing: purchase-path value, same product.

### FF-I3 SEO / OG / JSON-LD / manifests — MM / Next

`seo.ts`, `structured-data.ts`, brand. Stop website-checker leftovers.

### FF-I4 Partners, roast, tools — Later / low

Deprioritize AI-builder leftovers. Not critical path.

### FF-I5 Growth / analytics / telemetry — Now (internal) / Next (events)

Keep honest launch funnel ([fixflags-analytics](.agents/skills/fixflags-analytics/SKILL.md)). Do not invent daily reports for engagement. Instrument Analyze, claim, Flag open, Verify, Watch — not vanity.

---

## Wave J — Help, docs, email, legal, billing copy, settings

**Next** for lexicon; cadence after B3.

### FF-J1 Help / Docs / FAQ — MM / Next

- **Inventory:** `lib/help/catalog.ts`; `content/docs/{index,getting-started,reports,troubleshooting}.md`; `copy/faq.ts`; MCP/CLI parked.
- **Intended:** Site, Pages, Journeys, Flags, Recommendations (after B1), Flag. Fix. Verify., monitoring honesty. Reports docs become compatibility then Site guides.
- **Preserve** changelog history wording. New entry when the cut ships.
- **Must not lie on cadence:** what-counts-as-a-check, flag-fix-recheck, when-credits-run-out, update-review-credits, free-vs-pro.
- **Knowledge IA:** [docs/knowledge-base-ia.md](knowledge-base-ia.md) must retarget reports → Site (item below).

### FF-J2 Emails — MM / Next

Nurture: Analyze, monitoring, Flag. Fix. Verify. Drop AI-builder checklist as the product. Watch/Shopify: Flag voice. Billing: monitoring resumes after B3 nouns. KEEP_REPORT → Site. Inbox must match dashboard.

### FF-J3 Legal / privacy — MM + counsel / Next

`legal.ts` is Shopify-app-only. URL-first: Analyze collects URL, our browser walk, screenshots/video of our session; account email; optional Shopify; we do not sell data; we do not routinely place orders. Homepage quiet. FAQ one sentence. **Do not invent legal terms.**

### FF-J4 Pricing / packaging copy — after B3

Do not change live Stripe IDs in a copy task. Public list is `$49`/website/mo (Free weekly, Pro daily). Flag leftover 3/30/90, Connections included, projectLimitLabel “1 product”, credits/reviews/scans in old help. Plans buy responsibility (cadence, Sites, coverage), not a different product.

### FF-J5 Account vs Site settings — Next

Identity/security/billing at account. Watch/notifications/connections at Site. **Later:** default notification prefs at account.

### FF-J6 Samples / fixtures — MM / Next

Recapture homepage evidence if chrome is baked in. Sample designation. Tests using fixture titles.

---

## Wave K — Report and legacy retirement

**Later** for hard delete; **Next** to stop treating report as the product.

| Artifact | Keep | Migrate | Redirect | Deprecate | Delete |
| --- | --- | --- | --- | --- | --- |
| `/report/[id]` public evidence | Compatibility window | Evidence → Flag | Signed-in owners → `/sites/{id}` | As primary IA | After window + SECURITY review |
| Share links | Policy | Sanitized Flag URL later | — | Report as product | — |
| Export | — | Flag/Site export | — | Report PDF as product | — |
| SEO report pages | Until recrawled | Metadata | 301 when ready | — | Old checker copy |
| Report fixtures/tests | Compat tests | Site fixtures | — | Layout tests as target | When Site tests cover |
| `knowledge/report-contract.md` | Compat | Shrink | — | As vision | When routes gone |
| Finish Plan / Fix List | Internal | Ranking → projector | — | Customer artifact | UI remnants |
| Rubric scores as health | Internal | — | — | Site health | Customer chrome |
| Legacy Agent pane | Until H1 | Grounding → Agent | Site | Destination | Pane |
| Check my website / Needs attention / Find→Understand | — | — | — | — | Customer copy |
| Shopify-only company | Native path | Listing/legal | — | Company frame | Copy |

**Data:** Do not destroy Audit/Flag history. Project remains physical Site backing until a deliberate rename ([site-v2-migration.md](site-v2-migration.md)). Customer Site ≠ graph Site.

**Compatibility:** One anonymous teaser; evidence visible; prompts gated. Auth `/post-login`. Public graph isolation. These survive retirement.

---

## Wave L — Polish and validation

### FF-L1 Grep sweep — MM

Needs attention, checks passed, fresh check, Check my website, Work with your AI, Controlled example, Find → Understand, Site check. Optional grep gate over copy, help, docs, emails.

### FF-L2 Prototype

`prototypes/fixflags-board` when board chrome migrates.

### FF-L3 Do not mass-rename

check, audit, Outcome, Flag.severity stay internal.

### FF-L4 Human journey

375 and 1280: homepage → Analyze → board → Flag → Fix/Send to AI → Verify → claim. Pricing, help, one email preview, privacy. Feeling test and simplicity test below.

### FF-L5 Performance / a11y / ops

Keep current QUALITY gates. Pricing page already optimized. Worker/Playwright/recovery stay. No new operational product; monitoring honesty is the ops-facing customer need.

### FF-L6 Analytics

See FF-I5. Admin funnel remains internal.

---

## Terminology lint (implementers)

1. Canonical labels in `terminology.ts`.
2. Banned customer phrases: Needs attention; Checks passed; Fresh check passed; Check my website as primary CTA; Controlled example, not a live assessment; Work with your AI as lead; Connect MCP on marketing heroes; You're covered; Analyze everything; 0 Flags as omniscience.
3. Targeted tests (lint strategy). Internal nouns stay.

---

## Journey coverage (product, not copy-only)

| Stage | Change | Stay |
| --- | --- | --- |
| Discovery / SEO | Metadata, tagline | Brand, looked after |
| Homepage | Copy, 3-step, sample, two AIs | URL-first, AuditInput, board primitive |
| Analyze | CTA | Handoff to `/sites` |
| First result | Loading nouns, Flag counts | Same Site identity |
| Auth | Claim as continue monitoring | /post-login, one teaser |
| Dashboard | Pages, metrics, 0 Flags rules, lean nav | Card grid, Add library |
| Pages / Journeys | Card access | Infer + confirm |
| Flag | Importance, AI labels | Evidence, Fix this, Verify |
| Recommendations | After projector | Not an inbox |
| Fix | Who does it, already true | No repo edits by FixFlags |
| Verify | State names | Independent child audit |
| Monitoring | Honest cadence, one concept | Scheduler existence |
| History | Flag/card/Agent | No raw logs as product |
| Notification | Voice; prefs later | Shopify/Watch exist |
| Integrations | Honesty; homes designed | Shopify wedge |
| Agent | FAB later | Do not grow report pane |
| Support | Site context | Live-support store |
| Settings / billing | Nouns; cadence after B3 | Free/Pro/Studio, Stripe closed |
| Help/docs | Inventory | Historical changelog |
| Report | Compatibility then retire | Public evidence policy |

---

## Pricing / packaging (decisions, not silent copy)

- 3/30/90 pool vs 24h/hourly
- Connections included
- Help Shopify recheck caps vs Site Watch
- `projectLimitLabel` still “1 product”
- Credits/reviews/scans in older help

Do not change prices from this plan. B3 is the blocker.

---

## Implementation acceptance

A new capable agent with no chat history, after reading vision, architecture, messaging, evidence rules, and this plan, must understand every item in the user acceptance list (what FixFlags is, who it is for, Analyze vs monitoring, Pages, Journeys, Flags, Recommendations, business importance, 0 Flags, Fix, Verify, monitoring, history, notifications, integrations, Shopify, FixFlags Agent, coding AI, MCP, support, report and old Agent fate, nav, Now/Next/Later, safe public copy, critical path, parallelism).

**Feeling test:** I connected my website. FixFlags understands what matters, keeps monitoring it, and tells me when I should care.

**Simplicity test:** Fail a wave if it adds more status words, dashboards, chores, or taxonomy than it removes.

**Truth test:** Public copy never claims Later as Now.

---

## What not to do

- POLISH = Recommendation; new Recommendation table because taxonomy
- Market Recommendations, MCP, hourly Watch, Meta, or the Agent FAB before prerequisites
- Repeat Flag. Fix. Verify. in hero, board, Flag page, and footer
- Implement homepage against `homepage.ts` leftovers
- Rename Pages on the sample only
- Invent daily reports or an activity feed
- Mass-rename internal check/audit/Outcome
- Build a competing Agent tab
- Organize nav around scans/reports/audits
- Execute overlapping files with in-progress BOARD owners
- Change production UI in a documentation task
- Claim vision as shipped

---

## Verification for implementers

1. Read [product-architecture.md](product-architecture.md), [voice-and-copy.md](voice-and-copy.md), and this file. PRODUCT.md for what code does.
2. Claim BOARD on `main` with non-overlapping files.
3. Start at Wave A unless the item is pure docs already done.
4. If copy and runtime disagree, change runtime first (PP) or soften copy.
5. Prove with the fixture and surface named in acceptance, not grep alone. Browser-verify UI.
6. Record a session receipt. Do not claim the complete product done until the first complete experience (Next items) plus honesty gates pass. Later items remain Later.
