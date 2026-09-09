# FixFlags product architecture

**Intended product. Status: VISION / NEXT.** Public claims still follow shipped behavior in [PRODUCT.md](../PRODUCT.md) and [voice-and-copy.md](voice-and-copy.md). Implementation order: [product-masterplan.md](product-masterplan.md). Owner narrative: [knowledge/vision.md](../knowledge/vision.md). Evidence: [knowledge/evidence-rules.md](../knowledge/evidence-rules.md).

This file owns the customer information architecture: objects, navigation, Agent, support, history, monitoring concept, and how reports retire. It does not claim these surfaces already ship.

## Authority

| Layer | Document |
| --- | --- |
| Why and for whom | [knowledge/vision.md](../knowledge/vision.md) |
| How the product is structured | **This file** |
| How FixFlags speaks | [voice-and-copy.md](voice-and-copy.md) |
| What evidence may claim | [knowledge/evidence-rules.md](../knowledge/evidence-rules.md) |
| What to build, in what order | [product-masterplan.md](product-masterplan.md) |
| Engineering phases and Site cutover | [ROADMAP.md](../ROADMAP.md) |
| What code does today | [PRODUCT.md](../PRODUCT.md) |
| Legacy report routes | [knowledge/report-contract.md](../knowledge/report-contract.md) |

If documents disagree on customer objects or navigation, this file wins over workspace-interface, card-board, and older PRD wording. Vision still wins on product purpose. Evidence rules still win on certainty and recovery.

## Product

FixFlags is continuous monitoring for businesses that depend on their online experience.

The customer adds a website. FixFlags learns what that business is trying to accomplish. It analyzes broadly across the live experience, understands important Pages and Journeys, incorporates useful context from connected systems, and continuously monitors what matters. When something important deserves attention, it raises a Flag. The customer, their team, agency, or coding AI can Fix it. FixFlags Verifies the live result. Monitoring continues.

**Analyze broadly. Flag what matters.**

Customer loop: **Flag. Fix. Verify.**

Underlying lifecycle (not UI chrome): Analyze → Understand → Monitor → Flag → Fix → Verify → Monitor.

Feeling: I connected my website. FixFlags understands what matters, keeps monitoring it, and tells me when I should care. Not: I bought a site-audit dashboard.

Complexity stays behind the product. Depth is available. Interruption is scarce.

## Organize around the customer's objects

Do not organize the application around scans, reports, audits, check runs, agent runs, browser sessions, or internal severity enums.

Ask: what object is the customer looking at? What job are they doing? Could this be understood without a paragraph of explanation?

## Canonical objects

| Object | Job | Not |
| --- | --- | --- |
| **Site** | The online property FixFlags looks after. Persistent home for Pages, Journeys, monitoring, Flags, Recommendations, connections, history, configuration. | A one-time report. The first dashboard card. |
| **Pages** | Discovered pages. Makes coverage tangible. Inspectable. First board card. | The Site itself. A sitemap product. |
| **Journeys** | Important flows: Purchase, Signup, Contact, Book, Donate. Connect pages and behavior to intent. | A funnel builder. Internal name Outcome may remain in code. |
| **Flags** | Problems important enough to act on. Attention layer. | Every test failure. A scan result list. |
| **Recommendations** | Useful improvements that do not warrant interruption. Available depth. | A second inbox. Notification fodder. |
| **Connections** | Context that makes monitoring smarter. Shopify, later Meta, analytics, Search Console, tracking, deployments, channels, MCP. | An integration marketplace. A second product. |
| **FixFlags Agent** | Persistent assistant over the Site. Explains, navigates, gathers context, helps fix, sends to coding AI, escalates to support. | The legacy report Agent pane. A coding agent that edits the repo. |
| **Coding AI** | External tools that implement a Fix. | FixFlags itself. |

Coverage, checks, audits, and severity remain internal machinery.

## Account-level structure

Signed-in account owns one or more Sites (plan-limited).

```
Account
  Sites[]           list, switch, add (Analyze)
  Billing
  Account settings  identity, security, default notification prefs
  FixFlags Agent    FAB, not a destination
  Support           via Agent escalation, Help, email
```

**Now:** `/dashboard` is the Sites list (rail says Sites; avatar still says Products). Billing, Settings, Help, Docs, Admin.

**Next:** one Sites home. Compact Site switcher when more than one Site exists. Remove Products wording.

No account-level Reports, Agent workspace, or MCP dashboard in primary nav.

## Site-level structure

One Site is the product.

```
Site
  Home              card board (calm overview)
  Flags             attention list + Flag detail
  Pages             via Pages card (not a required nav item)
  Journeys          via Conversion card + confirm (direct nav only if they earn it)
  Connections       Site settings + in-context Connect
  History           on Flag, card, and Agent; not a raw log
  Site settings     watch, notifications, connections, danger zone
```

### Recommended navigation

Beautiful IA removes destinations.

**Desktop, inside a Site**

| Control | Why it exists |
| --- | --- |
| Site identity (host) | Where I am |
| Home | How is the Site doing? |
| Flags | What needs me? Persistent because attention is the job. Badge = open Flag count |
| Site settings (gear) | Watch, connections, notifications for this Site |
| All Sites | Switch. Later: compact switcher |
| FixFlags Agent FAB | Always available, context-aware |

**Not persistent nav:** Pages, Journeys, History, Connections marketplace, Reports, Agent tab, Checks.

**Mobile, inside a Site**

Home · Flags · More (settings, All Sites). Same FAB. Do not add a fourth primary tab.

**Account chrome (when not inside a Site)**

Sites · (Billing, Settings in overflow/rail). Agent FAB. Support via Agent or Help.

**Today vs intended:** Site board already uses local Dashboard · Flags · Site tabs without routes. **Site** tab currently mixes coverage, outcomes, configuration. Split: Home stays the board; configuration moves to Site settings; Journeys live on the Conversion card and confirm UI. Do not keep a third primary tab named Site if it means “everything else.” If a third tab is needed short-term, name it **Site** only for settings/coverage until settings exist, then retire it.

## Dashboard / card model

Home answers: How is the Site doing? What matters now? What does FixFlags understand? What changed? Do I need to do anything?

Face of a card: **category · Flag count · useful metric.** Open for depth (analysis, Flags, Recommendations, coverage, connect).

### Card taxonomy

Starter (now / next, public checks):

| Card | Metric direction | Appears |
| --- | --- | --- |
| Pages | Page count | Always |
| Conversion | Journey name, or the Flag | Always (Journeys live here) |
| Security | Protected or the failing control | Always |
| Search | Crawlable pages (not ranking) | Always |
| Performance | LCP | Always |
| Tracking | Named public events | Always |

Library (add when useful, no connection required): Uptime, Accessibility.

When a connection exists (later): Commerce (Shopify), Paid traffic (Meta), Changes (deployments). Same board, richer cards. Do not empty-state a Meta card as if it were connected.

Add card opens the library. Categories do not become nav.

## Page model

A Page has URL, title, last evidenced time, related Journeys, Flags, Recommendations, captures. The Pages card lists them. Page detail can be a sheet or route under the Site, not a separate product. Coverage is “which pages we actually opened,” not a claimed sitemap of the internet.

## Journey model

Inferred, confirmable (Looks right · Edit). A Journey has name, steps/pages, last verification, Flags. Customer language: Journey. Code may keep Outcome. Do not ship a funnel editor.

## Flag and Recommendation model

Findings may be stored as Flag rows internally. Customer Flag = business-importance projector (`isCustomerFlag`), not POLISH=Recommendation. Recommendations = remaining useful findings in card depth. Notifications use Flags. 0 Flags = nothing important enough to act on, with coverage still required. See [voice-and-copy.md](voice-and-copy.md) and masterplan W1.

Flag detail: what, where, why it matters, evidence, what to do, how Verify will run. Actions: Fix this, Send a Flag to your AI, Share, Verify. Agent can open the same Flag.

## Monitoring and history

One customer concept: **FixFlags is watching.** Internally Analyze, Watch, Verify, Shopify pulse, later event triggers may differ. Externally do not teach six run types.

History the customer cares about:

- This Flag: opened, attempts, verified, regressed
- This card: last evidenced, notable change
- Agent: “What changed since yesterday?”

**No dedicated History nav** until there is a customer job that cards, Flags, and Agent cannot answer. Do not ship an activity feed of every check.

Watch, pause, cadence live in Site settings. Public cadence must match entitlements ([PRODUCT.md](../PRODUCT.md) vs pricing).

## Integrations model

Question: what does this let FixFlags understand better?

| Connection | Value | Home | Now / Next / Later |
| --- | --- | --- | --- |
| Shopify | Commerce, purchase path, products | Commerce card + native install | Now (wedge); Next unify into Site |
| Email | Flag interruption | Site notification settings | Now (Watch + Shopify); Next Flag-shaped Site mail |
| Slack | Channel for same Flags | Site settings (Shopify has webhook) | Now Shopify-only; Next Site-level |
| Tracking pixels | Public measurement | Tracking card | Now as checks |
| Analytics | Visitor/Journey volume | Enriches Conversion/Flags | Later connection |
| Search Console | Search impact | Enriches Search | Later (OAuth code exists) |
| Meta | Paid landing importance | Paid traffic card / Flag context | Later |
| Deployments | When it started | Changes card / Flag timing | Later |
| MCP | Coding AI access to Flags | Send to AI progressive; settings | Later (parked) |

Connect in context (on the Flag or card it improves), not a logo wall. Site settings lists connected sources and revoke.

## Two AIs

| | FixFlags Agent | Customer's coding AI |
| --- | --- | --- |
| Where | Bottom-right FAB in the product | Customer's editor / tool |
| Job | Understand and operate FixFlags | Implement the Fix |
| Grounding | Site, Pages, Journeys, Flags, Recommendations, monitoring, connections | Flag handoff payload |
| Concept | Ask FixFlags | **Send a Flag to your AI** |
| Mechanism | New assistant over Site context | Copy prompt now; MCP later |
| Must not | Autonomously edit customer repos, pause ads, deploy, or place orders | Replace FixFlags monitoring |

Do not collapse these into one “AI” feature. The legacy report Agent pane (scan transcript + `/api/reports/[id]/chat`) is an obsolete product model. Reuse its grounding and message store ideas; retire it as a destination.

### FixFlags Agent capabilities

| Allowed | Later / gated | Never by default |
| --- | --- | --- |
| Explain a Flag, coverage, metric | Send to coding AI (user confirms) | Silent repo writes |
| Navigate to Home, Flag, Pages, settings | Start Verify (user confirms) | Fabricating evidence |
| Gather context for support | Pause/resume Watch (user confirms) | Unscoped data export |
| Answer what changed, what is monitored | | |

Context packet: account, Site id, current route, visible card/Flag, recent monitoring summary, conversation. Privacy: same tenant isolation as the Site; do not dump PII into support without minimization.

### Support escalation

Reuse `SupportSession` / `SupportMessage` / live-support widget. Today: cookie visitor, `pageUrl`, optional auditId from `/report/...` only. **Next:** persist `siteId`, optional `flagId`, route, Agent transcript summary. Hide the separate FAB once Agent owns escalation, or merge the FAB into Agent. Report immersive currently disables support; Site must not.

Flow: Customer ↔ FixFlags Agent ↔ product context; when needed Customer ↔ Agent ↔ Support (admin already has `/admin/feedback` conversations).

## Settings and billing

Account settings: identity, security, defaults. Site settings: monitoring, notifications (Flags / Critical only / Custom), connections, delete. Billing remains account-level. Plans buy responsibility (cadence, Sites, coverage), not a different product.

## Desktop and mobile

Same objects. Desktop: board grid + Flag detail beside or as sheet. Mobile: board stream, Flag as full screen, Agent as sheet from FAB. Essential actions exist on both.

## Reports are not the product

`/report/[id]` is a compatibility evidence URL (share, SEO, export, anonymous teaser history). Valuable pieces re-home:

| Report capability | New home |
| --- | --- |
| Ranked Flags | Site Flags |
| Evidence, captures | Flag detail |
| Fix prompt | Send a Flag to your AI |
| Verify / update review | Flag Verify |
| Scan transcript | Agent (optional progress), not a pane |
| Score / rubrics | Not Site health; may remain internal |
| Review history | Flag history + Agent “what changed?” |
| Public link | Sanitized Flag or Site-safe evidence URL, later |

Compatibility period: keep `/report/[id]` working; signed-in primary path stays `/sites/{id}`. Then redirect owners to Site; keep public evidence policy per SECURITY.md. Do not run Site dashboard + Report product + Agent pane as three mental models.

## What exists now (architecture view)

- URL Analyze → `/sites/{id}` board (primary)
- Cards, Flag page, Fix this / Copy prompt / Verify
- Watch scheduler (cadence ≠ packaging)
- Shopify integrity path + alerts
- Live support FAB (weak Site context)
- Report Agent pane on `/report/*`
- Help, docs, billing, accounts

## Designed now, built next or later

Design for the FAB, Flag projector, Site settings, and report retirement now so Home · Flags does not ossify into Agent | Report. Shopify Commerce card and notification prefs can wait. Meta/GSC/deploy cards wait for adapters. MCP stays parked until customer-ready.

```text
Account ── Sites list ── Site Home (cards)
                │              ├── Pages (card)
                │              ├── Journeys (Conversion card)
                │              ├── Flags ── Flag detail ── Fix / Send to coding AI / Verify
                │              └── Site settings (watch, connections, notifications)
                │
                └── FixFlags Agent (FAB) ── Support escalation
```
