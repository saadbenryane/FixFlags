# Messaging migration plan

**NEXT. Definitive implementation plan. Documentation only in this run. Do not execute production UI, copy, notification, or component changes from this file until a later task claims that scope.**

Canon: [voice-and-copy.md](voice-and-copy.md). Baseline: [PRODUCT.md](../PRODUCT.md). Vision: [knowledge/vision.md](../knowledge/vision.md). Evidence: [knowledge/evidence-rules.md](../knowledge/evidence-rules.md). Roadmap: [ROADMAP.md](../ROADMAP.md).

Behavior wins until a prerequisite ships. Do not make the new language true with synonyms.

Preserve in-progress owners: `homepage-end-user-polish`, `board-card-chrome`. Claim non-overlapping scope before editing their files.

---

## Executive summary

**1. Product change in one paragraph.** FixFlags stays continuous monitoring for businesses that depend on their website. Analyze is how people arrive. Monitoring is the product. FixFlags inspects broadly, then raises Flags only when something is important enough to act on. The customer, a teammate, an agency, or an AI coding tool performs the Fix. FixFlags verifies the live result and keeps watch. The dashboard can be deep. Interruptions stay rare.

**2. Governing rule.** Analyze broadly. Flag what matters.

**3. Critical path.** Lock vocabulary primitives and invert tests that ban Journey / lock Check my website. Decide monitoring cadence truth (packaging vs Watch weekly/daily vs 3/30/90 pools). Ship a business-importance Flag projector so board counts mean Flag, not every stored finding. Then Pages/card language, Analyze first-run, Flag. Fix. Verify., homepage, then emails/help/legal.

**4. Major product prerequisites.** (a) Customer Flag vs Recommendation projection based on business importance, not POLISH=Recommendation. (b) Monitoring entitlement honesty: public hourly/24h vs code weekly/daily Watch and monthly pools. (c) 0 Flags never rendered when coverage is incomplete. (d) Verify states tied to independent evidence, not absence. (e) Stop marketing unshipped integrations as present. (f) Legal/privacy still Shopify-only while the product is URL-first.

**5. What can ship quickly (Messaging Migration).** Analyze CTA. Flag. Fix. Verify. on homepage and how-it-works. Replace Needs attention / Checks passed / Fresh check passed with Flag counts and metrics. Pages card name. Send a Flag to your AI as the lead AI label. Sample instead of Controlled example. SEO home description. Pricing CTA. Nurture subject lines once cadence claims are honest or softened.

**6. What must not be marketed yet.** Recommendations as a shipped object. Notification modes. MCP as generally available. Meta, Analytics, Search Console, deployments as customer connections. Hourly Watch. “You're covered.” Analyze everything. 0 Flags as omniscience.

**7. Recommended waves.** W0 Foundation → W1 Flag/coverage/monitoring truth → W2 Product primitives (Pages, cards, Verify) → W3 Core Site experience → W4 Acquisition → W5 Monitoring and interruption → W6 Supporting ecosystem → W7 Cleanup and validation.

---

## Classification legend

| Class | Meaning |
| --- | --- |
| **MM** | Messaging Migration. Behavior exists. Language, hierarchy, or presentation must change. |
| **PP** | Required Product Prerequisite. New copy would be misleading until behavior or logic changes. |
| **FO** | Future Product Opportunity. Vision supports it. This migration does not require it. |
| **IC** | Internal Cleanup. Maintainability only. Include only when it reduces inconsistency or implementation risk. |

Every substantial item below has a class. Parallel agents may take MM items that do not share files with an in-progress owner, after W0 primitives exist.

---

## Truth matrix

| Claim | Customer value | Technical evidence (2026-09-09) | Status | Allowed wording today | After prerequisite | Systems |
| --- | --- | --- | --- | --- | --- | --- |
| Analyze | First look at a live URL | `AuditInput` → `startScanWithHandoff` → `/sites/{id}` | Shipped (wrong CTA) | Soft: enter a URL, first analysis | **Analyze** | `terminology.ts`, `care-homepage.ts`, `AuditInput.tsx` |
| 100+ automated tests | Credibility | `ALL_CHECK_IDS` = 201 | Shipped | **100+ automated tests** | Same; recheck count before raising | `lib/audit/check-ids.ts` |
| Real browser journeys | Proof it uses the site like a visitor | Playwright + journey checks | Shipped | **Real browser journeys** | Same | `lib/audit/journey/`, screenshot capture |
| Analyze broadly | Depth without noise | Checks run widely; board still Flags all of them | Partial | Broad analysis / 100+ tests | After Flag projector: Analyze broadly. Flag what matters. | checks + `lib/sites/flags.ts` |
| Flag importance | Attention worth acting on | All OPEN rows are Flags. `isAttentionCandidate` excludes POLISH from Finish Plan only. Board counts all severities. | Partial | Do not claim Flags are only what matters | After projector: Flag = important enough to act on | `prisma Flag`, `lib/audit/attention.ts`, `lib/sites/*` |
| Recommendations | Optional depth | No Recommendation entity. Copy says “recommendation” on dismiss. Improvements are top-3 Attention for claimed Products. | Missing | Do not market | After projector: Recommendations in card depth | Flag rows + board projection |
| 0 Flags | Quiet attention | Help is honest. Board says Looking good. Zero OPEN Flags of any severity required for healthy. | Partial | Do not use 0 Flags as all-clear | 0 Flags + coverage states in canon | `site-health.ts`, help catalog |
| Continuous monitoring | Keep watch | Watch scheduler exists | Partial | Monitoring / keeps watch, without fake cadence | After entitlement decision | `project-watch.ts`, `entitlements.ts` |
| Monitoring frequency | Trust | Packaging: Free 24h, paid hourly. Code: Free Watch weekly, paid daily, hourly rejected. Pool 3/30/90. Help mixes 24h, weekly, and Shopify 5 rechecks/day. | Missing as packaged | Soft schedule language, or name only what code does | After business decision aligns code and pricing | `plans.ts`, `copy/plans.ts`, help |
| Verify | Independent proof | Site Verify enqueues scoped child audit; Improvement VERIFIED ≠ Flag FIXED from absence. Copy still “not observed.” | Partial | Verify fix. Do not say Fresh check passed. | Verified / still open / inconclusive / couldn't verify | `commands.ts` VERIFY_FLAG, `diff-flags.ts`, `task-contracts.ts` |
| Notifications | Interrupt rarely | Shopify integrity email+Slack. Watch regression email (“N issue(s)”). No prefs UI. No digest/push/SMS. | Partial | Do not describe modes | After Site Flag notifications + prefs | `integrity/alerts.ts`, `project-watch.ts` |
| Shopify | Commerce context + distribution | OAuth, install, 6h walks, 15m pulse, RED/GREEN alerts | Partial shipped | FixFlags for Shopify, same product | Unified Site connection | `lib/shopify/`, `lib/integrity/` |
| Meta | Paid-traffic context | Internal ads pixel/CAPI only | Planned / aspirational | Do not claim customer Meta connection | After adapter | vision, `lib/analytics/meta-capi.ts` |
| Analytics | Visitor context | Internal GA pull for growth; page measurement checks | Partial (checks only) | Tracking checks, not “connect Analytics” | After connection | `lib/growth/ga-pull.ts`, measurement checks |
| Search Console | Search impact | Internal GSC for FixFlags SEO; customer OAuth code exists, not sold | Planned | Do not claim | After adapter | `lib/integrations/google-search-console.ts` |
| Deployments | Change context | Not a customer connection. Railway webhook parked. | Aspirational | Do not list as shipped coverage | After adapter | homepage checks groups |
| Tracking | Measurement health | Deterministic measurement/pixel checks | Partial | Tracking card from public checks | Connected-account tracking = later | `measurement-*` checks |
| Send a Flag to your AI | Handoff without re-explaining | Copy prompt via `buildExpertFixPrompt` (Goal, Constraint, Context, Why, Plan, Verify). URL not a dedicated section. | Shipped (copy) | Send a Flag to your AI. Copy remains the mechanism. | Richer payload + optional MCP | `SiteFlagActions.tsx`, `flag-copy.ts` |
| MCP | Standard AI access | Tools exist. `proxy.ts` parks `/api/mcp`, API keys, `/docs/mcp`. Tests lock homepage away from Connect MCP. | Parked | Developer docs only, if unparked for docs hosts | Homepage only when customer-ready | `lib/mcp/`, `proxy.ts` |
| Privacy | Data is not the business | Privacy page: we do not sell personal data. Page is Shopify-install shaped. | Partial / stale | Quiet: we do not sell your data, on Privacy/FAQ | After legal rewrite for URL-first | `legal.ts` |
| Pages card | Inspect discovered pages | Area id `site`, name Site, metric page count, detail `checkedPages` | Shipped object, wrong name | After rename: Pages | Same | `card-areas.ts`, `board-card.ts` |

---

## Architecture findings (re-audit)

### Flag model (actual)

Stored `Flag` rows: source DETERMINISTIC | AI | JOURNEY; severity CRITICAL | IMPORTANT | POLISH; status OPEN | FIXED | IGNORED | REGRESSED; plus rubric, impactTag, confidence, evidence, whyItMatters, fix, verificationRule, checkId, pageUrl, fingerprint.

Creation: checks → persist; AI triage (CRITICAL with confidence < 0.9 downgraded to IMPORTANT); journey evaluator (POLISH allowed on friction; accessibility forced IMPORTANT).

Ranking: `compareFlagsByPriority` in `lib/audit/priority-flags.ts` (noisy polish demotion, severity, customer-visible demotion for SEO/SHARING/MEASUREMENT, contract/journey boosts, impactTag, confidence). Site board **does not use this comparator**; it orders by Prisma severity then createdAt.

Customer surfaces disagree:

| Surface | POLISH / low-importance |
| --- | --- |
| Full Fix List / report | Included |
| Finish Plan / Attention (≤3) | Excluded (`isAttentionCandidate`) |
| Improvement seed (claimed Product) | Excluded (from Finish Plan) |
| Site board Flag counts | **Included** |
| Area `problem` vs `attention` | POLISH-only → attention, not problem |
| Site healthy | Requires **zero** OPEN Flags of any severity |

Watch email says “N issue(s).” Shopify alerts are not Flags.

**PP, not MM:** “A Flag is important enough to act on” is false on the Site board until a projector exists.

### Recommendation model (lean recommendation)

Do **not** add a Prisma `Recommendation` table for this migration.

Do **not** map POLISH → Recommendation.

**Lean architecture:** keep storing findings as Flag rows. Add one customer projector (evolve `isAttentionCandidate` into something like `isCustomerFlag`) that returns Flag vs Recommendation using business importance:

Signals already in code, to combine rather than replace:

- severity (signal)
- impactTag (REVENUE/CONVERSION vs SEO)
- `customerVisibleDemotion` / `noisyPolishDemotion`
- journey/outcome association and page purpose
- confidence
- card area (conversion/performance vs search niceties)

Customer Flag list, board Flag counts, and notifications use the Flag set. Card depth can list Recommendations. Improvements remain the claimed-site fix-loop entity for attention-worthy items.

If the projector cannot yet promote a POLISH checkout failure or demote an IMPORTANT metadata issue, that is remaining PP work, not a copy task. Start with documented rules + fixtures (broken contact = Flag; missing optional meta on an unimportant page = Recommendation). Iterate with the accuracy corpus. Do not wait for a perfect model before stopping POLISH from inflating 0 Flags.

### 0 Flags and coverage

`siteCardHealth` already refuses healthy when required starter areas are unevidenced. Help already says zero Flags is not healthy when cards are unknown. Board copy still says Looking good.

Canon states are in [voice-and-copy.md](voice-and-copy.md). Implementation must not print 0 Flags in learning, unknown, failed, stale, or unscheduled states.

### Pages vs Site IA

| Noun | Role |
| --- | --- |
| Site | Persistent monitored property. Nav destination for coverage, connections, settings. |
| Pages | First board card. Discovered/explored pages. Useful metric: page count. Internal area id may stay `site`. |
| Journeys | Important workflows. Model name Outcome may remain internal. Confirm UI can stay. |
| Category cards | Security, Search, Performance, Conversion, Tracking; library Uptime, Accessibility. |
| Flags | Attention across those areas. |
| Recommendations | Optional depth in the same cards. |

Mobile: Pages, then areas with Flags, then remaining cards. Desktop: same model, denser grid. Do not add a second dashboard.

### Card face and metrics

Desired face: category, Flag count, one useful metric. Not mechanical.

| Card | Best metric now | Unknown / loading / empty |
| --- | --- | --- |
| Pages | Page count | Learning / pages loading. Never 0 Flags. |
| Security | Protected, or the failing control | Not verified yet |
| Search | Crawlable page count (not ranking) | Not verified yet |
| Performance | LCP (name the page in detail) | Measuring / not verified |
| Conversion | 0 Flags + Journey name, or the Flag title if 1 | Journey not inferred yet |
| Tracking | Named public events observed, not “Connected” if overclaim | Events not observed |
| Uptime | Reachable / window when real | Not added |
| Accessibility | Short honest scope, not Checks passed | Not added |

Avoid status prose when Flag count + metric + color already speak.

### Monitoring truth

| Layer | What it does |
| --- | --- |
| Public pricing | 24/7, Free every 24 hours, Pro up to every hour |
| `PLAN_DEFINITIONS` | Same labels; `auditLimit` 3/30/90 monthly |
| Watch intervals | Free weekly; paid weekly\|daily; hourly rejected |
| `access-policy.canUseWatch` | Studio/admin only (contradicts entitlements) |
| Shopify integrity | Pulse 15m; full walk 6h |
| Manual Analyze | New URL / new audit |
| Verify | Scoped child audit; meters usage when claimed |
| Help | Mix of 24h packaging, “Keep watching is weekly on Free,” and Shopify “five rechecks per day” |

**PP / business decision before cadence copy:** align entitlements to packaging, or packaging to entitlements, or use only schedule-honest language (“FixFlags monitors on a plan-specific schedule”) until aligned. Do not ship Analyze-only MM that still says hourly if code cannot.

### Notifications

Shipped: Watch regression email; Shopify integrity email+Slack; nurture; billing; waitlist; demo; keep-report; live-support admin. No customer prefs. No digest/push/SMS.

Target later: Flags (default), optional Custom. Do not invent daily reports. “Everything” is a bad default label.

### AI handoff

`buildExpertFixPrompt`: Goal, Constraint, Context (issue + evidence), Why it matters, Plan, Verify. Add URL/session and Journey as dedicated fields when tightening the prompt (MM on prompt builder, not a new product). MCP parked.

### Integrations

See truth matrix. Homepage `CARE_HOME.checks.groups` and leftover `homepage.ts` Connect states over-claim deployments, paid traffic, real visitor failures, Meta, Analytics, GSC.

### Dual copy registries

Live homepage: `CareHomepage` + `care-homepage.ts`. `/how-it-works` still uses `LANDING_PAGE` / `HOW_IT_WORKS_PAGE` in `homepage.ts`. `homepage-message.test.ts` bans `journeys?` on landing strings. Care homepage already says “browser journeys.” Invert tests before Journey copy.

---

## Terminology lint strategy

Do not build a CMS. Keep this small.

1. **Canonical labels** in `lib/marketing/copy/terminology.ts`: `analyzeCta`, `coreLoopLabel` (`Flag. Fix. Verify.`), `zeroFlags`, `sendFlagToAi`, Flag pluralizer, Sample, Pages card name. Board and marketing import them.
2. **Banned customer phrases** (extend `BANNED_CUSTOMER_PHRASES`): Needs attention; Checks passed; Fresh check passed; Check my website as primary CTA; Controlled example, not a live assessment; Work with your AI as lead; Connect MCP on marketing heroes.
3. **Targeted tests** (replace old locks): acquisition CTA is Analyze; customer UI has no Needs attention; Journey allowed; Site card name is Pages; coverage-incomplete fixture cannot render 0 Flags; after projector, Recommendations do not increment Flag counts; homepage does not name unshipped integrations as present.
4. **Grep gate** (optional small script or existing completeness check) over `lib/marketing/copy`, `lib/help/catalog.ts`, `content/docs`, `lib/email/templates.ts` for the banned set.
5. **Comments** at `terminology.ts` and this plan: “Needs attention is wrong.” Point to the canon.

Internal nouns stay: check, audit, Outcome, Flag.severity, MCP tool names.

---

## Waves

Item fields: ID, class, surface, current → desired, why, files, deps, risk, tests, acceptance, blocks, parallel.

### W0 — Foundation

**Goal:** One lexicon. Tests will not fight Journey or Analyze. Agents share the canon (this run).

| ID | Class | Surface | Current → desired | Why | Files | Deps | Risk | Tests | Acceptance | Blocks | Parallel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W0.1 | IC | Terminology module | Forked CTAs in REVIEW_ENTRY, CUSTOMER_TERMS, CARE_HOME, PLANS, billing | Drift | `lib/marketing/copy/terminology.ts` then consumers | Canon | High fan-out | pricing-parity, shopify-customer-ready | Single Analyze string; CORE_LOOP_LABEL = Flag. Fix. Verify. | Yes, most MM | No, do first |
| W0.2 | MM | Brand leftovers | BRAND.tagline still “Find what is getting in the way…” | Emails/metadata | `brand.ts` | W0.1 | Footer blast | homepage-message | Tagline matches monitoring + looked after | SEO/emails | After W0.1 |
| W0.3 | MM | Test locks | Bans journeys; locks Check my website | Blocks canon | `lib/__tests__/homepage-message.test.ts`, pricing-parity, shopify-customer-ready, AuditInput.test, e2e public-journeys | W0.1 | e2e | those files | New invariants listed in lint strategy | CTA ship | Same PR as first CTA |
| W0.4 | IC | Dual homepage registry | care-homepage vs homepage.ts | Two products | Prefer Care as live; mark homepage.ts leftover or route how-it-works to Care copy | W0.3 | how-it-works drift | homepage-message | One loop story | W4 | After W0.3 |

**Exit:** constants exist; tests that would fail Analyze/Journey are updated or scheduled in the same PR as first consumer.

---

### W1 — Product truth (prerequisites)

**Goal:** Board Flag counts, coverage, and monitoring claims can be spoken honestly.

#### W1.1 Customer Flag projector — PP — **blocks Flag-importance copy**

- **Surface:** Site board, Flag list, card counts, later notifications
- **Current:** Every OPEN Flag counted; Finish Plan excludes POLISH
- **Desired:** `isCustomerFlag` using business importance; remainder presentable as Recommendations in depth
- **Why:** Otherwise 0 Flags and “Flag what matters” are false
- **Files:** `lib/audit/attention.ts` (evolve, do not naively keep `isPolishSeverity` as the only gate), `priority-flags.ts` signals, `lib/sites/flags.ts`, `coverage.ts`, `site-health.ts`, `board-card.ts`, `application/queries.ts`
- **Deps:** Accuracy fixtures: contact form Flag; optional meta Recommendation; POLISH-on-checkout still Flag if Journey-critical
- **Risk:** Count changes; claimed Improvements still from Attention
- **Tests:** board-card, coverage, attention, site-health, new projector unit tests
- **Acceptance:** Broken contact = Flag. Optional title-too-long on a non-Journey page can be Recommendation. POLISH alone does not make Site unhealthy if projector says Recommendation. Coverage-incomplete still not healthy.
- **Blocks:** Homepage “Flags are only what matters”; Recommendation marketing; notification Flag-only mode
- **Parallel:** No. One owner. Not homepage-end-user-polish files if possible (lib/sites overlap with board-card-chrome: coordinate)

#### W1.2 0 Flags rendering — PP

- **Current:** Looking good / Needs attention
- **Desired:** Canon state table
- **Files:** `site-health.ts`, `board-card.ts`, help `reading-your-report`
- **Deps:** W1.1 for counts; can ship coverage-incomplete copy earlier as MM
- **Acceptance:** Fixture with unknown security card never shows 0 Flags as all-clear
- **Blocks:** Healthy homepage sample if it lies
- **Parallel:** With W1.1 if same owner

#### W1.3 Monitoring entitlement decision — PP — **business**

- **Current:** Pricing hourly/24h; Watch weekly/daily; pool 3/30/90; access-policy Studio-only vs entitlements Free Watch
- **Desired:** One truth. Options: (A) change Watch to match packaging, (B) change packaging to weekly/daily, (C) interim: “monitors on a schedule” + name Free vs paid without hourly
- **Files:** `lib/billing/plans.ts`, `entitlements.ts`, `access-policy.ts`, `copy/plans.ts`, help billing articles, PRODUCT.md after code change
- **Deps:** Operator/pricing decision. Stripe still closed.
- **Risk:** High. Do not silently change quotas.
- **Acceptance:** Pricing, Help, entitlements, Watch API, and PRODUCT.md agree
- **Blocks:** Hourly/24h sentences on homepage, pricing, FAQ, emails
- **Parallel:** Decision can run beside W1.1; copy waits

#### W1.4 Verify semantics — PP (partial MM)

- **Current:** Flag FIXED = not observed; Improvement VERIFIED = independent attempt; UI “Fresh check passed”
- **Desired:** Customer: Verified (independent pass), Still open, Inconclusive, Couldn't verify. Never resolve from Done, deploy, or absence alone
- **Files:** `SiteFlagActions.tsx` copy; Flag page; `flag-status-resolution.ts` / improvement reconcile docs; help flag-fix-recheck; `copy/flags.ts` FIXED description
- **Deps:** Evidence rules already require this
- **Acceptance:** Absence-only monitoring does not show Verified on Site Flag
- **Blocks:** Workflow “Fresh check passed”
- **Parallel:** Copy MM after semantics confirmed

#### W1.5 Unshipped integration claims — MM (honesty)

- **Current:** Coverage groups list deployments, paid traffic, real visitor failures
- **Desired:** Remove or mark as coming; never as current coverage
- **Files:** `care-homepage.ts` checks.groups; leftover `homepage.ts` proof.states
- **Acceptance:** Grep homepage copy: no Meta/GSC/deploy as shipped
- **Blocks:** Homepage rewrite W4
- **Parallel:** Yes

---

### W2 — Product primitives

| ID | Class | Item | Notes |
| --- | --- | --- | --- |
| W2.1 | MM | Pages card rename | `CARD_CATALOG.site.name` → Pages. Keep area id `site`. Metric page count. Move aggregate health to header/Flags nav. Files: `card-areas.ts`, `board-card.ts`, BoardCard, BoardDetails, CARE_HOME.site, prototype, card-board docs (already pointed). **Coordinate `board-card-chrome` / `homepage-end-user-polish`.** Tests: board-card.test expects “Site”. Acceptance: first card says Pages on homepage sample and live board. Blocks W4 sample. |
| W2.2 | MM | Card status language | Stop Needs attention, Needs a fix, Checks passed, Latest check passed, Looking good as face copy. Face = n Flags + metric. Files: `SITE_BOARD_COPY`, `site-health.ts`, `coverage.ts`, queries.ts, care-homepage cards. Tests: BoardCard.test, CareHomepage.test. |
| W2.3 | MM | Card metrics | Implement table in architecture section. Tracking: do not say Connected unless events named. Conversion: Journey or Flag title. |
| W2.4 | MM | Unknown/loading/disconnected | Learning, Checking, Not verified yet, Couldn't verify. No 0 Flags. |
| W2.5 | MM | Flag. Fix. Verify. presentation | Three steps, responsibility obvious. Workflow section IDs currently check/flag/fix/verify. Drop Check. Visual: Flag orange, Fix ink, Verify green. Files: care-homepage workflow, CareHomepage.tsx workflow, how-it-works LANDING_PAGE.steps. **Do not repeat slogan on every card.** |
| W2.6 | IC | Machine state vs labels | Keep CardHealthState enums. Labels from terminology. |

---

### W3 — Core experience (Analyze through Verify)

User journey: Analyze → first result → auth → dashboard → Pages/categories → detail → Flag → Fix / Send to AI / Share → Verify → monitoring.

| ID | Class | Surface | Current → desired | Files | Deps | Acceptance | Parallel |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W3.1 | MM | Analyze CTA + placeholder | Check my website → Analyze; keep yourwebsite.com | terminology, care-homepage, AuditInput, plans CTA, billing display CTA | W0 | Hero is Analyze | After W0 |
| W3.2 | MM | First-run loading | Reviewing your site, Running checks, Funnel review | `errors.ts` AUDIT_PROGRESS, SiteBoard | W3.1 | Learning your website / discovering pages / testing Journeys. No Funnel. | Yes |
| W3.3 | MM | Incomplete / fail / timeout | Existing honest gaps | SiteBoard, audit errors | — | Failure is not 0 Flags | Yes |
| W3.4 | MM | Auth / claim | Site check underway; fix prompts; Keep watching | `auth.ts`, claim dialog | W1.3 for covered claims | Analyze was first look; save to monitor. Auth when continuing. | Yes |
| W3.5 | MM | Dashboard / Flag detail | Copy prompt lead; Needs a fix | SiteFlagActions, Flag page | W1.1, W2 | Send a Flag to your AI as customer concept; clipboard remains. Fix this + Verify fix stay. | After W2 |
| W3.6 | MM | AI payload | Prompt may omit dedicated URL/Journey | `flag-copy.ts` | — | Prompt includes Flag, evidence, URL, expected result, verify rule when present | Yes |
| W3.7 | FO | MCP in Flag handoff | Parked | Unpark + settings + docs when ready | Not in this migration | Homepage still no Connect MCP | Later |
| W3.8 | MM | Outcomes chrome | Outcome / Inferred | SiteOutcomeEdit | — | Journey language in customer chrome; Looks right · Edit can stay | Yes |
| W3.9 | MM | Products overview | Check a website URL; No open Flags | ProductOverviewGrid, REPORT_COPY.dashboard | W3.1 | Analyze; 0 Flags only if projector+coverage allow | Yes |
| W3.10 | MM | Legacy report | Agent/Report/Update review | Compatibility only | — | Do not restyle as the product. Align leaked chrome only. | Low priority |

Transition Analyze → monitoring should be felt, not explained: first board is the Site; claim/save starts Watch; never a second product.

---

### W4 — Acquisition

#### Homepage rewrite (MM, after W1.5 and W2)

Current Care sections in order: hero+board, workflow (4 steps), 100+ checks, outcomes, actions (Read/Share/AI), MCP repeat, quiet notifications, Shopify, final CTA.

| Section | Action |
| --- | --- |
| Hero headline | **Keep** Your website, looked after. |
| Hero body | **Rewrite** tighter: monitors live website; 100+ automated tests and real browser journeys; flags what matters. Not every capability in one sentence. |
| URL + CTA | **Rewrite** Analyze |
| Trust | **Keep** if true (no credit card) |
| Board sample | **Rewrite** Pages, Flag counts, metrics; **Sample** if needed; drop Controlled example sentence; **add CTA** after preview |
| Workflow | **Merge/shorten** to Flag. Fix. Verify. Drop Check. Responsibility clear. Failed/passed labels: Flag title / Verified, not Needs attention / Fresh check passed |
| 100+ / checks | **Rewrite** Analyze broadly. Flag what matters. Tests + journeys + understanding. **Remove** unshipped groups |
| Outcomes | **Keep/shorten** as Journeys. Shows intelligence without a lecture |
| Actions + MCP | **Merge** into one AI story: Send a Flag to your AI. Prompt mechanism. MCP not homepage until W3.7 |
| Quiet / notifications | **Rewrite** Flag-shaped examples. Sample. No daily digest invention |
| Shopify | **Keep** as connection, not the company |
| Risk | **Add** one or two concrete consequence lines, then calm. No dollar amounts. Placement: hero support or workflow, not every section |
| Privacy | **Not** homepage manifesto. Optional one line in FAQ/footer |
| Close | **Rewrite** Analyze + monitoring |
| Footer / OG | **Rewrite** with SEO.home |

Files: `care-homepage.ts`, `CareHomepage.tsx` (structure for 3-step workflow and merged AI), tests, `seo.ts`. **Owner collision:** wait or split files with homepage-end-user-polish.

#### Other acquisition

| ID | Class | Surface | Notes |
| --- | --- | --- | --- |
| W4.2 | MM | /how-it-works | Same three-step loop. Drop leftover HERO “Review my site.” |
| W4.3 | MM | Pricing | CTA Analyze. Cadence only after W1.3. Connections included → honest (Shopify available; not a grid of vapor). |
| W4.4 | MM | Shopify /install /protect /listing | Tailored purchase-path value. Same product after install. Prevent redefining the company. HEALTH_COPY Can buy / Can't buy can stay on that path. |
| W4.5 | MM | SEO, OG, Twitter, JSON-LD, manifests | `seo.ts`, `structured-data.ts`, brand. Stop website-checker leftovers. BRAND.tagline. |
| W4.6 | MM | Partners, roast, tools | Deprioritize AI-builder / Shopify-only leftover. Not the critical path. |
| W4.7 | MM | README | First paragraph still Outcomes / keeps watching. Point at canon for public language. |

---

### W5 — Monitoring and interruption

| ID | Class | Item | Notes |
| --- | --- | --- | --- |
| W5.1 | PP | Watch scheduler honesty | After W1.3. Help flag-fix-recheck weekly vs 24h. Shopify help 5 rechecks/day vs Site credits. |
| W5.2 | MM | Watch regression email | “N issue(s)” → Flag voice. `project-watch.ts` |
| W5.3 | MM | Shopify integrity alerts | Keep urgency. Direction: 1 Flag. Customers can't complete checkout. Recovery: Verified. `alerts.ts` |
| W5.4 | FO | Site notification prefs | Flags / Custom. Email first (Resend exists). Slack only where Shopify already has it. No SMS/push in this migration. No daily report. |
| W5.5 | FO | Dedup / recovery for Site Flags | Roadmap Phase 4. Watch already idempotent. |
| W5.6 | FO | Meta/GSC/Analytics/deploy adapters | Improve Flag importance and notifications later. Do not logo-wall. |
| W5.7 | IC | access-policy vs entitlements Watch | Fix contradiction so Studio-only policy cannot silently deny Free Watch. |

---

### W6 — Supporting ecosystem

#### Help, docs, FAQ (MM, after W0/W1.3)

Inventory: `lib/help/catalog.ts` (getting-started, Flags and proof, billing, MCP and editors parked, account); `content/docs/{index,getting-started,reports,troubleshooting}.md`; `copy/faq.ts`; MCP/CLI docs parked.

Migrate vocabulary. Preserve changelog history in `CHANGELOG_ENTRIES` (do not pretend past releases were Flag. Fix. Verify.). New entry when the cut ships.

Help articles that must not ship cadence lies: `what-counts-as-a-check`, `flag-fix-recheck`, `when-credits-run-out`, `update-review-credits`, `free-vs-pro`.

#### Emails (MM)

| Kind | Templates | Direction |
| --- | --- | --- |
| Nurture | welcome, firstAuditNudge, monitoring, launchChecklist | Analyze, monitoring, Flag. Fix. Verify. Drop AI-builder checklist as the product. |
| Notification | Watch, Shopify integrity | Flag voice |
| Billing | paymentFailed | Monitoring resumes… after W1.3 nouns |
| Auth/waitlist/demo | WAITLIST, DEMO, KEEP_REPORT | Site not report |
| Recovery | live-support admin | Internal OK |

Inbox must match dashboard.

#### Legal / privacy (MM + legal review)

`legal.ts` Terms/Privacy are Shopify-app-only. Plan a URL-first rewrite: what we collect on Analyze (URL, our browser walk, screenshots/video of our session), account email, optional Shopify install, we do not sell data, we do not routinely place orders. Homepage quiet. FAQ one sentence. **Do not invent legal terms beyond repo evidence; counsel if needed.**

#### Samples / fixtures

Homepage evidence images: recapture if chrome text is baked in. Sample designation. Tests using fixture titles. No Storybook found as a customer surface.

#### Developer / MCP

When unparked: docs explain Send a Flag to your AI first, then MCP tools. ide-integrations README still AI-built products — FO/docs when unparked. Do not promote from marketing now.

---

### W7 — Cleanup and validation

| ID | Class | Item |
| --- | --- | --- |
| W7.1 | MM | Grep sweep: Needs attention, checks passed, fresh check, Check my website, Work with your AI, Controlled example, Find → Understand, Site check |
| W7.2 | MM | Replace string locks with lint-strategy invariants |
| W7.3 | MM | Prototype `prototypes/fixflags-board` when board chrome migrates |
| W7.4 | IC | Do not mass-rename check, audit, Outcome, Flag.severity |
| W7.5 | MM | Human journey review (acceptance below) at 375 and 1280 |
| W7.6 | MM | Cross-surface: homepage, how-it-works, pricing, help, docs, live board, Flag page, one email preview, privacy |

---

## Journey coverage (what changes vs stays)

| Stage | Change | Stay |
| --- | --- | --- |
| Discovery / SEO | Metadata, tagline | Brand name, looked after |
| Homepage | Copy, 3-step, sample, merge AI | URL-first, real AuditInput, board primitive |
| Analyze | CTA | Handoff to `/sites` |
| First result | Loading nouns, Flag counts | Same Site identity |
| Auth | Claim as continue monitoring | /post-login, one teaser |
| Dashboard | Pages, metrics, 0 Flags rules | Card grid, Add library |
| Detail | Analysis + Flags + later Recommendations | Evidence, sources |
| Flag | AI label, impact calm | Evidence, Fix this, Verify |
| Fix | Who does it, already true | No repo edits by FixFlags |
| Verify | State names | Independent child audit |
| Monitoring | Honest cadence | Scheduler existence |
| Notification | Voice; prefs later | Shopify alerts exist |
| Integrations | Honesty | Shopify wedge |
| Settings / billing | Nouns; cadence after W1.3 | Plans Free/Pro/Studio, Stripe closed |
| Help/docs | Inventory above | Historical changelog |

---

## Risk and business impact (where)

Pattern: concrete fact → why it matters → calm reassurance. No invented dollars. No guarantees.

| Place | Use |
| --- | --- |
| Homepage | One or two examples (checkout, paid landing, form) |
| Flag detail | whyItMatters already exists; keep specific |
| Notifications | The Flag title is the impact |
| Category summaries | Only if a Flag exists |
| Shopify | Can't buy is already concrete; keep |

Do not repeat revenue fear on every card.

---

## Understanding the website (truth)

| Capability | Status | Customer inspect? | Market? |
| --- | --- | --- | --- |
| Important pages | Shipped (AuditPage, page count) | Pages card | Yes |
| Journeys / Outcomes | Partial infer + confirm UI | Confirm | Yes, as learns what the site is for |
| Commerce / forms / signup | Journey + conversion checks | Flags | Yes as examples, not omniscience |
| Language | lang checks | Detail | Quiet |
| Purpose heuristics | `page-purpose.ts` internal | No | Do not explain the classifier |

Copy: FixFlags understands what this website is trying to do. Not: perfect understanding.

---

## Pricing / packaging inconsistencies (decisions, not silent copy)

- 3/30/90 pool hidden while selling 24h/hourly
- Connections included
- Help Shopify recheck caps vs Site Watch
- `projectLimitLabel` still “1 product”
- Credits/reviews/scans in older help

Do not change prices in this migration. Flag W1.3 as the blocker.

---

## Shopify positioning

Keep: install path, purchase-path walks, confirmed-twice alerts, Can buy / Can't buy in that app.

Change: listing/legal that say FixFlags **is** a Shopify-only purchase-path monitor. After install, same Site, Flags, monitoring.

---

## Parallelism and owners

| Slice | Safe parallel after W0 | Collision |
| --- | --- | --- |
| terminology + tests | First | — |
| Flag projector (lib/sites + attention) | After W0 | board-card-chrome |
| Analyze CTA + pricing CTA | After W0.3 | pricing files if another owner |
| Homepage rewrite | After W1.5 W2 W1.3 cadence | homepage-end-user-polish |
| Emails | After W0 | — |
| Help/docs | After W1.3 | — |
| Legal | After product counsel | — |
| MCP unpark | FO, separate | public-product-scope tests |

---

## Implementation acceptance

A new user, without a glossary, should understand from the product:

What FixFlags is. Why it exists. What Analyze does. Why it continues after Analyze. What it monitors. What a Flag is. Why a Recommendation is different (only after W1.1). What 0 Flags means. What Pages are. What a Journey is. Who Fixes. Who Verifies. How monitoring continues. How they get notified (honestly: Shopify/Watch today; prefs later). How integrations make it smarter (Shopify today). How to send a Flag to their AI. Why MCP exists (developer path, not fake availability). What happens with their data. What is available vs planned.

**Feeling test:** I connected my website. FixFlags understands what matters, keeps monitoring it, and tells me when I should care. Not: I bought a website auditing dashboard.

**Simplicity test:** Fail the migration if it adds more status words, dashboards, required customer chores, or taxonomy than it removes. Complexity stays behind the projector, scheduler, and checks.

**Lint test:** Banned phrases gone from customer surfaces. Analyze is the URL CTA. Needs attention gone. Coverage-incomplete ≠ 0 Flags. Unshipped integrations not claimed. Cadence matches W1.3.

---

## What not to do

- POLISH = Recommendation
- New Recommendation table “because taxonomy”
- Market Recommendations or MCP or hourly Watch or Meta before prerequisites
- Repeat Flag. Fix. Verify. in hero, board, Flag page, and footer
- Implement homepage against `homepage.ts` leftovers
- Rename Pages on the sample only
- Invent daily reports
- Mass-rename internal check/audit/Outcome
- Execute this plan in the same task as in-progress homepage polish without a board claim

---

## Verification for implementers

1. Read [voice-and-copy.md](voice-and-copy.md) and this file.
2. Claim BOARD on `main` with non-overlapping files.
3. Start at W0 unless the item is pure docs.
4. If copy and runtime disagree, change runtime first (PP) or soften copy.
5. Prove with the fixture and surface named in acceptance, not grep alone.
6. Record a session receipt. Do not claim the whole migration done until W7 human journey passes.
