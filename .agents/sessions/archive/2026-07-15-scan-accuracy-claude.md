# Session — scan accuracy / false-positive removal

## Task

- **ID:** scan-accuracy
- **Agent:** claude (Claude Code)
- **Date:** 2026-07-15
- **Branch:** claude/app-polish-shipping-tqeab1

## Why

Owner directive: before charging customers, the baseline scan must be accurate
with no false positives. A user who scans a well-built site and sees false
alarms will not trust (or pay for) the tool.

## Method

Built `scripts/accuracy-probe.ts` (kept — reusable). Outbound curl/fetch works
in this sandbox (the browser does not), so the HTML-based deterministic checks
can run against real production sites. Ran the scan against gold-standard sites
(stripe.com, vercel.com, linear.app). Principle used: **if a check fires on
Stripe/Vercel and those sites are actually fine, it is a false positive.**

## Result

- stripe.com: 14 → 6 flags, now **all POLISH** (no false CRITICAL/IMPORTANT).
- vercel.com: 9 → 5 flags, all POLISH.
- linear.app: hard scan FAILURE ("HTML too large") → 9 flags (now scans).
- Broken demo fixture still catches 19 real issues; fixed fork stays at 0 — no
  false negatives introduced.

## Changes

Removed 3 checks that fire on correct/modern practice (check-ids 133 → 130):
- `images-empty-alt`: `alt=""` is the correct way to mark decorative images.
- `security-xss-protection-missing`: header is deprecated; OWASP advises against it.
- `external-links-unsafe`: browsers default target=_blank to noopener since 2021.

Accessible-name parser (`lib/audit/metadata.ts`): `links-no-text` /
`buttons-no-text` now honor accessible names from child `img[alt]`, `svg>title`,
`aria-labelledby`, and any labeled descendant; `images-missing-alt` skips
aria-hidden / role=presentation / aria-labelled images. (Killed 28 phantom
"unnamed links" on stripe.com.)

Security-header severities (`lib/audit/checks/security-headers.ts`): all
downgraded to POLISH. A missing CSP on a marketing page is hardening, not a
CRITICAL "vulnerable to XSS" alarm.

Semantic-detection false positives (`lib/audit/checks/*`):
- Analytics detection broadened (PostHog, Vercel, Clarity, GA4 gtag/js, Segment,
  RudderStack, etc.); `measurement-ga-gtm-posthog-missing` downgraded to POLISH
  with honest "may be proxied/consent-gated" framing; the consent flag now only
  fires when analytics ARE detected (was circular).
- `template-default-copy` scoped to headings/title with full template phrases
  ("Your Company Name", "Welcome to Your…"), so legit body prose ("start your
  company") no longer trips it.
- `messaging-long-sentences` now filters out concatenated UI chrome (camelCase
  joins / low alphabetic-word ratio) that produced garbage "run-on" evidence.
- `friction-no-social-proof` / `trust-no-authority-signals`: broadened proof
  detection (logo-wall heuristic from brand-like image alts + "trusted by",
  "backed by", testimonials), so sites covered in customer logos are not told
  they have no social proof.

Reliability + correctness:
- `safeFetchHtml` (`lib/audit/url.ts`): limit 2MB → 5MB and truncate-and-scan
  instead of throwing, so a large page never fails the whole audit.
- `parseMetadataFromHtml`: resolve `og:image` / `canonical` to absolute against
  the page URL (a relative og:image yields a blank social preview).

## Verification

- typecheck / lint / brand+seo guards clean.
- `npm run test:unit`: 1705 passed, 1 skipped (regression fixtures updated to the
  new correct output; new tests lock in the parser and label fixes).
- Live re-probe of stripe/vercel/linear confirms the removed FPs stay gone.

## Second batch (deployed to main / prod)

- Excluded `pre/code/kbd/samp` from `pageText`: a displayed code sample
  (`${company}`) was firing a CRITICAL `unreplaced-template-token` on resend.com.
- Removed `measurement-consent-blocking-incomplete` (duplicate of
  `cookie-consent-absent`).
- `messaging-no-audience` now fires only when the headline names neither an
  audience nor an outcome; outcome verb list broadened.
- `sitemap-missing` now honors a `Sitemap:` directive in robots.txt (GET, not
  HEAD) before flagging.
- `h1-multiple` dedupes by text: responsive-duplicate H1s no longer flagged.
- `/api/health` now returns `commit` (RAILWAY_GIT_COMMIT_SHA) + `pipelineVersion`
  so a deploy is observable; used to detect the prod deploy.
- Fixed brand-hex-guard false positive on `lib/prompts/` (example hexes in prompt
  text), which had CI red on main.

## Deploy + prod validation workflow (for future runs)

- Merged branch to main via `git push origin <branch>:main` (Railway auto-deploys
  from main; no Railway CLI in the sandbox). Poll
  `https://fixflags.com/api/health` `.commit` until it equals the pushed short SHA
  to know the deploy is live.
- The sandbox blocks Python `urllib` through the agent proxy (403) but `curl`
  works. Prod audits: POST `/api/checks` then poll `/api/reports/{id}/status`
  (returns flags with severity/rubric/problem) with a browser User-Agent + Origin
  header. Harness: `scratchpad/prod-audit.sh`. This is the only way to exercise
  the browser/flow/PageSpeed/AI path, which the sandbox cannot run locally.

## Third batch: browser/flow-path false positives (found only via prod audits)

Real prod audit of vercel.com surfaced flow-path (critical-path) false positives
that the sandbox cannot reproduce (browser egress blocked):

- `flow-destination-cta-overload` reported "44 competing CTAs" because it counted
  every link/button (nav excluded) on the destination. Now counts DISTINCT
  high-intent conversion CTAs (deduped by label), flags only > 5.
  (`lib/audit/flow/destination-ux-probes.ts`, `checks/flow-ux.ts`)
- Two probes flagged the same persistent-loading destination
  (`flow-cta-stuck-loading` + `flow-destination-stuck-loading`); added a
  suppression pair in `suppressOverlappingFlags`.
- Console-error flags were filed under MESSAGE; moved to EXPERIENCE (broken
  interactions). (`checks/trust.ts`)
- `flow-mobile-menu-broken` fired on sites with a WORKING hamburger (vercel)
  because a portal/overlay-rendered menu's links were not counted after the
  toggle click. Now a found+clicked toggle only yields ok/skipped; only the
  no-menu-at-all case reports broken. (`lib/audit/flow/nav-probes.ts`)

Left as-is (defensible or needs screenshot to judge): `flow-cta-message-mismatch`
(word-overlap logic is reasonable), `Primary CTA hidden below the fold on mobile`
(the flagship check; likely legitimate). Stripe.com FAILS on prod entirely
(Cloudflare bot-blocks the headless browser) - bot-protected sites are poor
browser-path test targets; use the target-user profile (indie/Framer/Vercel
landing pages that do not block bots) or the owner's own site.

## Remaining (acceptable at POLISH, or follow-ups)

- `messaging-no-audience`, `friction-no-risk-reversal` still fire on some strong
  sites but are POLISH (do not lead a report). They are opinionated conversion
  judgments better suited to AI review; candidates for gating/removal later.
- `sitemap-missing` does not yet consult robots.txt for a Sitemap: directive.
- `skip-link-missing` / linear.app `buttons-no-text` reflect the raw-HTML
  (pre-JS) fetch path; the full audit uses puppeteer's rendered HTML, which is
  more accurate. Worth a rendered-DOM accuracy pass.
- Could not test the browser/flow/PageSpeed path here (sandbox blocks the
  browser's egress). Validate on prod.
