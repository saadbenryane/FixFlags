# Scan Catalog

*Last updated: 2026-07-14*

Single source of truth for every scan FixFlags runs or plans to run, organized by rubric.

**Rubrics** (from `lib/audit/constants.ts`): `MESSAGE`, `EXPERIENCE`, `REACH`.

**Methods:** `deterministic` (code rules), `AI` (judge on screenshots + evidence), `agent` (Playwright navigation).

See [scan-roadmap.md](./scan-roadmap.md) for phased build order.

---

## Message

Does the page communicate clearly and convert? Copy, positioning, CTAs, credibility.

### Live

| Scan family | Method | Check IDs |
|-------------|--------|-----------|
| **Content scan** | deterministic | `h1-generic`, `no-cta-detected` |
| **Console error scan** | deterministic | `console-errors-critical`, `console-errors-some` |
| **Slop scan** | deterministic | `placeholder-copy-detected`, `template-default-copy`, `unreplaced-template-token`, `cta-dead-link` |
| **Messaging clarity scan** | deterministic | `messaging-weak-value-prop`, `messaging-jargon-overload`, `messaging-no-audience`, `messaging-long-sentences`, `messaging-headline-too-short` |
| **Conversion friction scan** | deterministic | `friction-no-commitment-path`, `friction-trial-commitment-unclear`, `friction-form-too-many-fields`, `friction-no-risk-reversal`, `friction-no-social-proof` |
| **Trust psychology scan** | deterministic | `trust-no-authority-signals`, `trust-testimonial-quality`, `trust-unsupported-claims`, `trust-no-direct-contact`, `trust-no-internal-links` |
| **CTA focus scan** | deterministic | `competing-ctas` |
| **AI message review** | AI | Headline specificity, audience fit, benefit hierarchy, CTA copy, social proof, copy hierarchy |
| **Launch gate: mobile CTA** | AI + evidence | Primary CTA visible above fold on 375px |

### Roadmap

| Scan family | Method | Notes |
|-------------|--------|-------|
| **Social proof scan** | AI | Testimonial credibility, pricing confidence |

---

## Experience

Does the page work, feel good, and work on mobile? Layout, speed, accessibility, interactions.

### Live

| Scan family | Method | Check IDs |
|-------------|--------|-----------|
| **Screenshot capture** | agent | Desktop 1280×900, mobile 375×812 |
| **Performance scan** | deterministic | `perf-score-critical`, `perf-score-poor`, `lcp-critical`, `lcp-poor`, `cls-critical`, `cls-poor`, `render-blocking`, `unused-js-large`, `unused-css-large`, `unoptimized-images`, `inp-critical`, `inp-poor` |
| **Mobile scan** | deterministic | `mobile-perf-critical`, `mobile-perf-poor`, `tap-targets-small`, `mobile-lcp-critical` |
| **Layout scan** | deterministic | `cta-below-fold-mobile` (375×812 viewport metrics during mobile capture) |
| **Accessibility scan** | deterministic | `images-missing-alt`, `images-empty-alt`, `form-inputs-no-label`, `buttons-no-text`, `links-no-text`, `iframe-no-title`, `tabindex-positive`, `color-contrast-poor`, `skip-link-missing`, `keyboard-nav-trap`, `focus-visible-missing` |
| **Viewport scan** | deterministic | `viewport-missing`, `lang-missing` |
| **Flow scan** | agent | `flow-no-cta-found`, `flow-cta-unclickable`, `flow-cta-404`, `flow-cta-dead-end`, `flow-cta-external-leave`, `flow-cta-message-mismatch` |
| **Auth & checkout smoke** | deterministic | `auth-page-broken`, `checkout-link-dead` |
| **Visual hierarchy scan** | deterministic | `hierarchy-competing-actions`, `hierarchy-too-many-fonts`, `hierarchy-no-sections`, `hierarchy-no-headline`, `hierarchy-information-density` |
| **Mobile UX quality scan** | deterministic | `mobile-input-zoom`, `mobile-cta-thumb-zone`, `mobile-cta-weak-label`, `mobile-stuck-loading`, `mobile-load-delay-content` |
| **AI experience review** | AI | CTA above fold, layout, mobile usability, keyboard/contrast, CWV, broken interactions |
| **Launch gate: console errors** | deterministic | No critical console errors |
| **How far a review goes** | deterministic + AI | Plan depth: fully review this page (Free), pages it links to (Pro), or one level beyond (Studio). Open-check unique eligible public destinations. |

### Roadmap

| Scan family | Method | Notes |
|-------------|--------|-------|
| **Real device mobile scan** | agent | iPhone Safari + Android Chrome |
| **Interaction scan** | agent | Modals, sticky nav, form validation |
| **Visual polish scan** | AI + agent | Dark mode, empty states, font flash |
| **Native app scan** | agent | Real device tap-through |

---

## Reach

Can people find, share, trust, and measure the site? SEO, previews, legal, analytics.

### Live

| Scan family | Method | Check IDs |
|-------------|--------|-----------|
| **Metadata scan** | deterministic | `title-missing`, `title-too-short`, `title-too-long`, `description-missing`, `description-too-short`, `description-too-long`, `og-image-missing`, `og-image-broken`, `og-title-missing`, `og-description-missing`, `canonical-missing`, `robots-blocks-indexing`, `favicon-missing` |
| **SEO scan** | deterministic | `h1-missing`, `h1-multiple`, `no-structured-data`, `external-links-unsafe`, `sitemap-missing`, `robots-txt-missing`, `broken-internal-links` |
| **Trust scan** | deterministic | `no-https`, `no-privacy-policy`, `no-contact-info`, `cookie-consent-absent` |
| **Measurement scan** | deterministic | `analytics-missing` |
| **Security basics scan** | deterministic | `security-mixed-content` |
| **Security headers scan** | deterministic | `security-csp-missing`, `security-csp-unsafe-inline`, `security-hsts-missing`, `security-hsts-too-short`, `security-frame-options-missing`, `security-frame-options-too-permissive`, `security-content-type-options-missing`, `security-xss-protection-missing` |
| **Preview cards UI** | UI | Rendered Google snippet + social card from metadata |
| **AI reach review** | AI | Share tags, indexability, privacy/contact, analytics |
| **Launch gates** | mixed | `https`, `social-preview`, `privacy-contact` |

### Roadmap

| Scan family | Method | Notes |
|-------------|--------|-------|
| **Secret leak scan** | deterministic | API keys in page source or bundles |
| **Expanded critical path** | deterministic | Cross-page OG consistency |
| **Store listing scan** | deterministic | App Store / Play Store metadata (native apps) |

---

## Cross-rubric modes

Not rubrics themselves — audit modes that run all three.

| Mode | Status | Description |
|------|--------|-------------|
| **Product Review** | Live | How far a review goes follows the plan: this page, pages it links to, or one level beyond. Open-check unique eligible public destinations. |
| **Re-check** | Live | Re-runs checks, diffs flags, marks FIXED / REGRESSED |
| **CI deploy gate** | Roadmap | Block deploy if launch gates fail |
| **Weekly pulse** | Roadmap | Scheduled re-check, alert on regressions |

---

## Launch gates

Five yes/no checks from report evidence (`lib/audit/rubric.ts`):

| Gate ID | Primary rubric | What it checks |
|---------|----------------|----------------|
| `https` | Reach | Site served over HTTPS |
| `social-preview` | Reach | og:image present and valid |
| `mobile-cta` | Message / Experience | Primary CTA above fold on mobile |
| `console-errors` | Experience | No critical JS console errors |
| `privacy-contact` | Reach | Privacy policy and contact info findable |

---

## Check ID registry

All deterministic check IDs live in `lib/audit/check-ids.ts`. When adding a scan, register the ID there and add a verification rule in `lib/audit/verify-flags.ts`.

**Current count:** see `CHECK_ID_COUNT` in `check-ids.ts` (updates with each phase).
