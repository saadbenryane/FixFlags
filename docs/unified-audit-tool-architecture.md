# The Unified Web Audit Tool: First-Principles Architecture

**Research Date:** July 27, 2026
**Goal:** Design the ultimate web audit tool that combines every data source into one product.

---

## Part 1: Data Source Analysis

### 1. Performance Data

**Sources:** Lighthouse (via PSI API), CrUX API, WebPageTest API, custom RUM

| Aspect | Detail |
|--------|--------|
| **Unique insight** | The gap between lab conditions (Lighthouse) and real-world user experience (CrUX). Lab tells you *what to fix*. Field tells you *what's actually broken for users*. Neither alone is sufficient. |
| **APIs** | PSI: `GET pagespeedonline.googleapis.com/v5/runPagespeed` (free, 25k/day). CrUX: `POST chromeuxreport.googleapis.com/v1/records:queryRecord` (free, 150 req/s). WebPageTest: REST API with API key (200 page loads/day free). |
| **Unified rubric** | Normalize to Google's CWV thresholds: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. Score 0-100 based on p75 distribution across field + lab. |
| **Signal-to-noise ratio** | **High.** CrUX is ground truth. Lighthouse is diagnostic. WebPageTest is forensic. Noise comes from lab-vs-field divergence (a site can score 95 in Lighthouse and fail CrUX). |

**Critical insight:** Google ranks using CrUX field data, not Lighthouse scores. Any unified tool must weight field data over lab data for "truth" and use lab data for "fix direction."

---

### 2. SEO Data

**Sources:** Google Search Console API (4 sub-APIs), SEMrush API, Ahrefs API, structured data validation

| Aspect | Detail |
|--------|--------|
| **Unique insight** | GSC tells you *how Google sees you* (indexation, queries, CTR). SEMrush/Ahrefs tell you *how the web sees you* (backlinks, authority, competitive position). Combined: a complete picture of search visibility. |
| **APIs** | GSC Search Analytics: 25k rows/request, 50k/day, 16-month retention. GSC URL Inspection: 2,000 queries/day/property. GSC Sitemaps: unlimited. SEMrush: paid ($129.95-$499.95/mo), 10 API units/sec. Ahrefs: paid ($99+/mo). |
| **Unified rubric** | Three sub-scores: (1) Indexation Health = % of submitted URLs indexed, (2) Visibility = organic clicks × position weighted by keyword volume, (3) Authority = backlink quality composite from referring domains × domain scores. |
| **Signal-to-noise ratio** | **Medium-high.** GSC data is authoritative but delayed (2-3 days). SEMrush/Ahrefs traffic estimates are approximate. Backlink data has ~30% noise from link farms and spam. |

**Critical insight:** GSC's Indexing API is only for JobPosting/BroadcastEvent pages, not general indexing. The URL Inspection API (2k/day) is the only programmatic way to check index status. This is the most rate-limited data source — prioritize high-value URLs.

---

### 3. UX/Session Data

**Sources:** Microsoft Clarity (free), FullStory (paid), Hotjar/Contentsquare (paid)

| Aspect | Detail |
|--------|--------|
| **Unique insight** | Quantitative metrics (performance, SEO) tell you *what* happens. Session data tells you *why* it happens. Rage clicks, dead clicks, and pogo-sticking are the behavioral fingerprints of UX failures. |
| **APIs** | Clarity: Export API (REST, JWT auth), free unlimited. FullStory: DXData API (structured event sequences), enterprise pricing. Hotjar: now Contentsquare, no public API. |
| **Unified rubric** | Frustration Score = f(rage_click_rate, dead_click_rate, error_encounter_rate, rage_session_pct). Baseline: rage_click_rate > 5% = critical, 2-5% = warning. |
| **Signal-to-noise ratio** | **Medium.** Clarity is free but samples. FullStory's DXData is structured and queryable. Hotjar/Contentsquare has no public API. Noise comes from bot traffic inflating session counts. |

**Critical insight:** Session data is the *ground truth for user experience* but requires sufficient traffic. For low-traffic sites (<1000 sessions/month), fall back to Lighthouse UX audits and heuristic evaluation.

---

### 4. Accessibility

**Sources:** axe-core (open source), Lighthouse a11y category, WCAG 2.2 compliance

| Aspect | Detail |
|--------|--------|
| **Unique insight** | Accessibility failures are binary — they either block users or they don't. A single missing `alt` attribute can make content invisible to screen readers. axe-core's zero-false-positive guarantee makes it the gold standard. |
| **APIs** | axe-core: `axe.run()` JavaScript API (free, open source). @axe-core/playwright integration. Lighthouse a11y category via PSI API. WAVE API (paid). CompliScan (paid, includes AI fix suggestions). |
| **Unified rubric** | WCAG compliance levels: A (must), AA (should), AAA (nice). Score = weighted violation count: critical × 3 + serious × 2 + moderate × 1. Target: 0 critical + 0 serious for AA compliance. |
| **Signal-to-noise ratio** | **Very high.** axe-core catches ~30-40% of WCAG issues (the automatable ones). The rest require manual testing. False positive rate is near zero. |

**Critical insight:** Automated a11y testing catches less than half of real issues. The tool should clearly state what it *can* and *cannot* verify, and flag areas needing manual review.

---

### 5. Security

**Sources:** Security headers, SSL/TLS analysis, mixed content detection, vulnerability scanning

| Aspect | Detail |
|--------|--------|
| **Unique insight** | Security failures are invisible to users until they cause damage. Missing headers (CSP, HSTS, X-Frame-Options) are silent vulnerabilities. Mixed content blocks HTTPS benefits. |
| **APIs** | SecurityHeaders.com API (free tier). SSL Labs API (free). Mozilla Observatory (free). NVD/NIST CVE database (free). Snyk for dependency scanning (freemium). |
| **Unified rubric** | Grade A-F based on header completeness + SSL config + mixed content count + outdated dependencies. Weight: missing CSP = critical, missing HSTS = high, missing X-Content-Type-Options = medium. |
| **Signal-to-noise ratio** | **High.** Security checks are deterministic — headers either exist or they don't. SSL grade is well-established. Only noise: false positives from CDN/WAF layers. |

---

### 6. Content Quality

**Sources:** AI-powered copy analysis (GPT-4/Claude), readability formulas (Flesch-Kincaid), tone consistency checking

| Aspect | Detail |
|--------|--------|
| **Unique insight** | Content quality is the hardest dimension to measure objectively. But specific signals are measurable: readability grade level, keyword stuffing, thin content, duplicate content, brand voice consistency. |
| **APIs** | OpenAI API for AI analysis. Readability formulas (Flesch-Kincaid, Gunning Fog, Coleman-Liau) — all implementable locally. GeoScore API for AI readability. TextLens API for sentiment + SEO scoring. |
| **Unified rubric** | Content Score = 0.3 × readability_fit + 0.25 × keyword_coverage + 0.2 × depth_of_coverage + 0.15 × uniqueness + 0.1 × brand_voice_consistency. |
| **Signal-to-noise ratio** | **Medium-low.** Readability formulas are deterministic but crude. AI analysis is rich but non-deterministic. Need multiple signals to triangulate. |

---

### 7. Visual Design

**Sources:** Layout consistency analysis, brand adherence checking, responsive design validation

| Aspect | Detail |
|--------|--------|
| **Unique insight** | Visual quality is subjective, but specific signals are measurable: layout shifts (CLS), font consistency, color palette adherence, responsive breakpoint coverage, visual hierarchy. |
| **APIs** | No established public APIs. Custom Playwright + vision model analysis. Screenshot comparison (perceptual hashing). CSS analysis via extracted stylesheets. |
| **Unified rubric** | Design Score = 0.3 × layout_stability + 0.25 × responsive_coverage + 0.2 × visual_hierarchy + 0.15 × brand_consistency + 0.1 × typography_coherence. |
| **Signal-to-noise ratio** | **Low-medium.** This is the most subjective dimension. Requires vision AI models for meaningful analysis. |

---

### 8. Conversion

**Sources:** CTA effectiveness analysis, funnel analytics, form analytics

| Aspect | Detail |
|--------|--------|
| **Unique insight** | Conversion failures are revenue failures. CTA placement, form friction, and funnel drop-off are directly measurable through session data and form analytics. |
| **APIs** | Clarity funnels (free). GA4 funnel exploration (free). Formisimo/Hotjar form analytics (paid). Custom funnel tracking via Clarity Export API. |
| **Unified rubric** | Conversion Health = 0.4 × CTA_visibility + 0.3 × form_completion_rate + 0.2 × funnel_efficiency + 0.1 × trust_signal_presence. |
| **Signal-to-noise ratio** | **High when traffic exists, zero when it doesn't.** Conversion data requires actual users. For new/low-traffic sites, fall back to heuristic evaluation. |

---

### 9. Technical SEO

**Sources:** Crawl data, sitemap analysis, robots.txt validation, canonical chain analysis

| Aspect | Detail |
|--------|--------|
| **Unique insight** | Technical SEO issues are the "plumbing" of search visibility. Broken canonicals, redirect chains, orphan pages, and sitemap errors silently destroy crawl efficiency and rankings. |
| **APIs** | Screaming Frog (desktop, paid). Sitebulb (paid). Custom crawl via Playwright. robots.txt parsing (local). Sitemap parsing (local). GSC Sitemaps API for submission status. |
| **Unified rubric** | Technical Health = 0.3 × crawl_efficiency + 0.25 × canonical_integrity + 0.25 × redirect_health + 0.1 × sitemap_completeness + 0.1 × robots_txt_correctness. |
| **Signal-to-noise ratio** | **Very high.** Crawl issues are deterministic. Redirect chains either exist or they don't. |

---

### 10. Real User Monitoring

**Sources:** Custom RUM script for ongoing monitoring

| Aspect | Detail |
|--------|--------|
| **Unique insight** | One-time audits capture a snapshot. RUM captures trends. Performance degrades over time as features are added. RUM catches regressions before users complain. |
| **APIs** | Custom RUM script (self-built). web-vitals npm package. SpeedCurve, Calibre, Request Metrics (all paid). |
| **Unified rubric** | Trend Score = direction of CWV metrics over time (improving/stable/degrading). Alert on any metric crossing threshold boundary. |
| **Signal-to-noise ratio** | **High** if properly implemented. **Zero** if RUM script is blocked by ad blockers (20-40% of traffic). |

---

## Part 2: Unified Data Model

### The Signal Graph

Every data source produces **Signals** — atomic units of insight. A Signal has:

```typescript
interface Signal {
  id: string;
  source: DataSource;           // where it came from
  domain: SignalDomain;         // performance, seo, a11y, etc.
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;           // 0-1, how sure are we
  evidence: Evidence[];         // raw data backing this signal
  affectedUrls: string[];       // which URLs are impacted
  estimatedImpact: ImpactScore; // estimated business impact
  suggestedFix: FixPrompt;      // actionable fix prompt
  crossReferences: Signal[];    // related signals from other domains
  timestamp: Date;
}
```

### Cross-Domain Signal Correlation

The power of this tool is not any single signal — it's the **correlations across domains**:

| Correlation | What it reveals |
|-------------|-----------------|
| High CLS + Rage clicks | Layout instability is actively frustrating users |
| Low LCP + Low organic traffic | Slow pages are being penalized by Google |
| Missing CSP + Session hijacking risk | Security gap + potential UX breach |
| Low readability + High bounce rate | Content doesn't match user intent or ability |
| Missing alt text + Low mobile traffic | Accessibility failure is blocking mobile users |
| Redirect chain + Low crawl budget | Technical SEO is wasting Google's crawl resources |
| Dead clicks on CTA + Low conversion | The conversion element is broken or misleading |

### The Unified Score Model

```
Overall Health Score (0-100)
├── Performance (weight: 25%)
│   ├── Core Web Vitals (field data, 60%)
│   ├── Lab Performance (Lighthouse, 25%)
│   └── RUM Trends (15%)
├── SEO (weight: 20%)
│   ├── Indexation Health (30%)
│   ├── Visibility & Rankings (35%)
│   └── Authority & Backlinks (35%)
├── UX & Conversion (weight: 20%)
│   ├── Behavioral Signals (40%)
│   ├── Conversion Health (35%)
│   └── Content Quality (25%)
├── Accessibility (weight: 15%)
│   ├── Automated Violations (50%)
│   ├── WCAG Compliance Level (30%)
│   └── Manual Testing Flags (20%)
├── Security (weight: 10%)
│   ├── Headers (40%)
│   ├── SSL/TLS (30%)
│   └── Vulnerabilities (30%)
└── Technical Health (weight: 10%)
    ├── Crawl Efficiency (35%)
    ├── Canonical Integrity (35%)
    └── Redirect Health (30%)
```

**Why these weights:** Performance and SEO have the highest direct impact on traffic and revenue. UX/Conversion directly affects revenue. Accessibility is a legal requirement. Security protects against catastrophic failure. Technical health is foundational but lower-level.

---

## Part 3: The Single Pane of Glass Dashboard

### Layer 1: Executive View (What's my number?)

```
┌─────────────────────────────────────────────────────┐
│  WEBSITE HEALTH SCORE                               │
│                                                     │
│     ████████████████████████░░░░░  74/100           │
│     ▲ +3 from last week                            │
│                                                     │
│  ┌─────────┬─────────┬─────────┬─────────┬────────┐│
│  │  PERF   │   SEO   │   UX    │  A11Y   │ SECURE ││
│  │   82    │   68    │   71    │   89    │   95   ││
│  │  ▲ +5   │  ▼ -2   │  ▲ +8   │  ── 0   │  ▲ +1 ││
│  └─────────┴─────────┴─────────┴─────────┴────────┘│
│                                                     │
│  🔴 3 Critical Issues  🟡 12 Warnings  🟢 87 Passing│
└─────────────────────────────────────────────────────┘
```

### Layer 2: Domain View (Where to look?)

Click any domain card to see its breakdown with cross-references:

```
┌─────────────────────────────────────────────────────┐
│  PERFORMANCE DEEP DIVE                              │
│                                                     │
│  Core Web Vitals (Field - CrUX)                     │
│  LCP: 3.2s ▼ NEEDS IMPROVEMENT                     │
│  INP: 145ms ▲ GOOD                                 │
│  CLS: 0.18 ▼ NEEDS IMPROVEMENT                     │
│                                                     │
│  Cross-references found:                            │
│  → High CLS correlates with rage clicks (Clarity)  │
│  → Slow LCP correlates with position drop (GSC)    │
│  → Image size audit: 3 oversized images found      │
│                                                     │
│  Fix priority (by impact × effort):                 │
│  1. [FIX] Compress hero image (est. LCP -400ms)    │
│  2. [FIX] Add loading="lazy" to below-fold images  │
│  3. [FIX] Inline critical CSS                      │
└─────────────────────────────────────────────────────┘
```

### Layer 3: Issue View (What to fix?)

Each issue card shows:

```
┌─────────────────────────────────────────────────────┐
│  🔴 CRITICAL: Layout shift on product cards         │
│                                                     │
│  What: CLS of 0.28 on /products page               │
│  Why it matters: Google penalizes this in rankings  │
│  Evidence:                                         │
│   • CrUX p75 CLS: 0.28 (threshold: 0.1)          │
│   • 23% of sessions show rage clicks near cards    │
│   • Conversion drops 12% on this page              │
│  Root cause: Dynamic ad injection pushes content    │
│  Fix prompt: [Copy to clipboard]                   │
│  Confidence: 94%                                   │
│                                                     │
│  Affected URLs: /products, /products/*             │
│  First detected: 2026-07-20                        │
│  Trend: Worsening (was 0.15 last week)            │
└─────────────────────────────────────────────────────┘
```

---

## Part 4: Fix Prompt Generation from Combined Signals

### The Fix Prompt Pipeline

```
Signal Cluster → Root Cause Analysis → Fix Generation → Validation
```

**Step 1: Signal Clustering**

When multiple signals point to the same root cause, they form a **Signal Cluster**:

```
Cluster #47: "Product page layout instability"
├── Signal: CLS 0.28 (Performance)
├── Signal: Rage clicks on product grid (UX)
├── Signal: Conversion -12% on /products (Conversion)
├── Signal: Ad injection without size reservation (Technical)
└── Confidence: 94% (5 correlated signals)
```

**Step 2: Root Cause Analysis**

The AI analyzes the cluster to determine the single root cause:

> "The product grid dynamically loads ad units between product cards. The ad containers have no fixed height, causing layout shifts when ads load asynchronously. This simultaneously triggers CLS penalties (performance), frustrates users (rage clicks), and reduces purchases (conversion drop)."

**Step 3: Fix Prompt Generation**

A fix prompt is generated with full context:

```
FIX PROMPT (Copy to your AI editor):

Problem: The product grid on /products has a CLS of 0.28 caused by 
dynamically injected ad containers between product cards. The ad 
containers have no fixed height reservation.

Context:
- This page gets 45% of organic traffic
- CLS has degraded from 0.15 to 0.28 in the past week
- 23% of sessions show rage clicks on this grid
- Conversion rate dropped from 3.2% to 2.8%

Fix:
1. Add min-height to ad containers: `.ad-slot { min-height: 250px; }`
2. Use CSS `contain: layout` on product cards
3. Reserve space with aspect-ratio or fixed dimensions
4. Move ad loading to after LCP (use Intersection Observer)

Validation:
- Target: CLS < 0.1 on /products
- Verify: Run Lighthouse after fix, check CrUX in 28 days
- Monitor: Watch for rage click reduction in Clarity
```

### Cross-Domain Fix Prioritization

Not all fixes are equal. The system prioritizes by:

```
Priority = Impact × Confidence / Effort

Where:
- Impact = traffic_affected × revenue_per_visit × severity_weight
- Confidence = number_of_correlated_signals / total_signals_in_cluster
- Effort = estimated_development_hours (from fix complexity)
```

This means a fix affecting high-traffic pages with correlated signals across performance + conversion + UX will always outrank a single-domain low-traffic fix.

---

## Part 5: Proposed Architecture

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER                        │
│                                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │  PSI    │ │  CrUX   │ │  GSC    │ │ Clarity │ │  WPT   ││
│  │  API    │ │  API    │ │  API    │ │  API    │ │  API   ││
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘│
│       │           │           │           │          │      │
│  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌───┴────┐│
│  │ SEMrush │ │  axe-   │ │ Security│ │  RUM    │ │  Crawl ││
│  │  API    │ │  core   │ │Headers  │ │  Script │ │ Engine ││
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘│
│       │           │           │           │          │      │
│       └──────┬────┴─────┬─────┴─────┬─────┘          │      │
│              │          │           │                 │      │
│              ▼          ▼           ▼                 ▼      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SIGNAL NORMALIZATION ENGINE              │   │
│  │  Raw data → Signal objects → Cross-references         │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                       PROCESSING LAYER                        │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ SIGNAL CLUSTERING │  │ ROOT CAUSE AI    │                 │
│  │ (Correlation      │→ │ (GPT-4/Claude    │                 │
│  │  detection)       │  │  analysis)       │                 │
│  └──────────────────┘  └────────┬─────────┘                 │
│                                  │                           │
│  ┌──────────────────┐  ┌────────┴─────────┐                 │
│  │ SCORING ENGINE   │← │ FIX GENERATOR   │                  │
│  │ (Weighted domain │  │ (Prompt + validation)│              │
│  │  scores)         │  └──────────────────┘                 │
│  └──────────────────┘                                       │
│                                                               │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                       STORAGE LAYER                           │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Time-series DB  │  │  Graph DB        │                 │
│  │  (Signals,       │  │  (Signal         │                 │
│  │   scores,        │  │   relationships, │                 │
│  │   trends)        │  │   URL clusters)  │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                               │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                       │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Dashboard UI    │  │  API / Webhook   │                 │
│  │  (Single pane    │  │  (External       │                 │
│  │   of glass)      │  │   integrations)  │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack (Proposed)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Browser engine | Playwright | Already the standard; axe-core integrates natively |
| Ingestion workers | BullMQ + Redis | Job queue for async API calls with rate limiting |
| Normalization | TypeScript | Type-safe signal processing |
| AI analysis | OpenAI GPT-4o + Claude fallback | Per AGENTS.md AI invariants |
| Time-series DB | TimescaleDB (PostgreSQL extension) | Signal history, trend detection |
| Graph DB | Neo4j or PostgreSQL LTree | Signal cross-references, URL relationships |
| API | Next.js API routes | Consistent with existing FixFlags architecture |
| Dashboard | React + D3.js | Interactive charts, drill-down capability |

### Pricing Model Insight

| Tier | Data Sources | Target User |
|------|-------------|-------------|
| Free | Lighthouse + CrUX + Security headers + axe-core | Individual developers |
| Pro ($49/mo) | + GSC + SEMrush + Clarity + Crawl | Small teams |
| Business ($199/mo) | + FullStory + Custom RUM + API access | Growing companies |
| Enterprise | All sources + White-label + SLA | Agencies, enterprises |

The free tier is the acquisition funnel — it's enough to show value, limited enough to drive upgrades.

---

## Part 6: What Makes This Different

### Existing tools and their gaps

| Tool | What it does | What it misses |
|------|-------------|----------------|
| Google Lighthouse | Performance + a11y + SEO scores | Field data, backlinks, UX behavior, conversion |
| SEMrush | SEO intelligence | Performance, accessibility, security, UX |
| Clarity | Session replay + heatmaps | Performance metrics, SEO, security |
| axe-core | Accessibility violations | Everything else |
| Screaming Frog | Technical SEO crawling | Performance field data, UX, conversion |
| GTmetrix | Performance monitoring | SEO, accessibility, UX, conversion |
| PageSpeed Insights | Lighthouse + CrUX | SEO depth, UX behavior, conversion, backlinks |

### The Unified Advantage

No single tool today does all of these:

1. **Cross-domain correlation** — finding that CLS causes rage clicks causes conversion loss
2. **Single scoring system** — one 0-100 score that accounts for all dimensions
3. **Prioritized fix prompts** — ranked by business impact, not just technical severity
4. **Trend detection** — catching regressions before they become crises
5. **Evidence-based fixes** — every fix prompt backed by correlated data from multiple sources

The fundamental insight is that **website quality is a system, not a collection of independent scores**. A slow page is also a poorly ranked page is also a frustrating page is also a low-converting page. The tool that connects these dots wins.

---

## Part 7: Implementation Priority

### Phase 1: Foundation (Months 1-3)
- Lighthouse + CrUX integration (already exists in FixFlags)
- axe-core integration
- Security headers check
- Basic scoring model

### Phase 2: SEO Layer (Months 3-6)
- GSC API integration
- SEMrush/Ahrefs integration
- Technical SEO crawler (Playwright-based)
- Enhanced scoring with SEO weights

### Phase 3: Behavior Layer (Months 6-9)
- Clarity integration (free, high signal)
- Session replay correlation engine
- Conversion funnel analysis
- Cross-domain signal correlation

### Phase 4: AI Intelligence (Months 9-12)
- Root cause analysis AI
- Fix prompt generation from correlated signals
- Trend detection and regression alerts
- Custom RUM script deployment

### Phase 5: Enterprise (Months 12+)
- White-label dashboard
- API for external integrations
- Multi-site portfolio view
- Competitive benchmarking

---

*This report proposes the architecture for a tool that doesn't yet exist. The closest current tools are FixFlags (which covers performance + a11y + content quality) and Screaming Frog (which covers technical SEO + on-page). Neither connects the full picture. The opportunity is to be the first tool that makes website quality a single, actionable, cross-correlated metric.*
