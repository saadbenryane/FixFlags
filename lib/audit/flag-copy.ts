import { METADATA_CHECK_IDS, formatVisualEvidence } from '@/lib/marketing/evidence-regions'
import { verificationRuleForCheckId } from '@/lib/audit/verification-rules'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { resolveFixPrompt } from '@/lib/audit/priority-flags'

/** Checks fixed in source/head/config - not by staring at a screenshot region. */
const CODE_OR_HEAD_CHECKS = new Set<string>([
  ...METADATA_CHECK_IDS,
  'no-structured-data',
  'sitemap-missing',
  'robots-txt-missing',
  'no-https',
  'console-errors-critical',
  'console-errors-some',
  'external-links-unsafe',
  'broken-internal-links',
  'broken-page-anchors',
  'no-privacy-policy',
  'no-contact-info',
  'cookie-consent-absent',
  'render-blocking',
  'unused-js-large',
  'unused-css-large',
  'unoptimized-images',
  'perf-score-critical',
  'perf-score-poor',
  'lcp-critical',
  'lcp-poor',
  'cls-critical',
  'cls-poor',
  'inp-critical',
  'inp-poor',
  'mobile-perf-critical',
  'mobile-perf-poor',
  'mobile-lcp-critical',
  'flow-cta-404',
  'flow-cta-dead-end',
  'flow-cta-external-leave',
  'flow-pricing-nav-broken',
  'flow-mobile-menu-broken',
  'flow-form-no-validation',
  'flow-cta-blank-destination',
  'flow-form-slow-feedback',
  'flow-cta-destination-no-trust',
  'cta-dead-link',
])

/** Visible UI/copy checks where screenshot context helps humans. */
const VISUAL_EVIDENCE_CHECKS = new Set<string>([
  'h1-generic',
  'heading-hierarchy-missing',
  'h1-missing',
  'h1-multiple',
  'no-cta-detected',
  'cta-below-fold-mobile',
  'motion-ignores-reduced-preference',
  'visual-typography-sprawl',
  'visual-radius-inconsistent',
  'competing-ctas',
  'flow-no-cta-found',
  'flow-cta-unclickable',
  'tap-targets-small',
  'placeholder-copy-detected',
  'template-default-copy',
  'unreplaced-template-token',
  'social-proof-unverifiable',
  'images-missing-alt',
  'images-empty-alt',
  'form-inputs-no-label',
  'buttons-no-text',
  'links-no-text',
  'color-contrast-poor',
  'skip-link-missing',
  'keyboard-nav-trap',
  'focus-visible-missing',
  'loading-indicator-stuck',
  'loading-state-slow',
  'flow-cta-stuck-loading',
  'scroll-ghost-sections',
  'slow-3g-blank-screen',
  'slow-3g-cta-delayed',
])

const GENERIC_WHY_PATTERN =
  /affects the (message|experience|reach) quality of your page/i

export function isCodeOrHeadCheck(checkId: string): boolean {
  return CODE_OR_HEAD_CHECKS.has(checkId)
}

export function isGenericWhyItMatters(text: string | null | undefined): boolean {
  if (!text?.trim()) return true
  return GENERIC_WHY_PATTERN.test(text)
}

const WHY_IT_MATTERS: Record<string, string> = {
  'measurement-ga-gtm-posthog-missing':
    'Without analytics you are shipping blind - you cannot tell whether a change increased signups or quietly broke them.',
  'security-mixed-content':
    'Mixed HTTP resources on an HTTPS page can trigger browser warnings or blocked assets, making the launch URL look unsafe.',
  'visual-typography-sprawl':
    'Too many font families make an AI-built page feel assembled from fragments instead of a coherent product.',
  'visual-radius-inconsistent':
    'Inconsistent CTA corner radius makes key actions feel visually unrelated, which reduces polish and trust.',
  'form-missing-validation':
    'Forms without validation allow broken submissions and leave visitors guessing when required information is missing.',
  'checkout-link-dead':
    'A dead checkout or payment link means visitors who want to pay literally cannot - every click here is lost revenue.',
  'auth-page-broken':
    'If sign-up or login is broken, motivated visitors hit a wall at the exact moment they were ready to convert.',
  'competing-ctas':
    'Too many equally-weighted CTAs above the fold split attention, so visitors hesitate instead of taking the one action that matters.',
  'messaging-weak-value-prop':
    'A vague headline makes visitors spend their first seconds decoding the offer instead of deciding whether it solves their problem.',
  'messaging-jargon-overload':
    'Jargon hides the concrete job your product performs, which makes the page feel less credible and harder to act on.',
  'messaging-no-audience':
    'When visitors cannot tell who the product is for, qualified buyers fail to self-identify and leave before reading deeper.',
  'messaging-long-sentences':
    'Dense, run-on copy slows scanning; busy visitors miss the value and skip the CTA.',
  'messaging-headline-too-short':
    'A one- or two-word headline usually lacks enough context for a first-time visitor to understand the offer.',
  'friction-no-commitment-path':
    'Visitors need a low-risk next step. Without pricing, trial, or demo paths, interest stalls before conversion.',
  'friction-trial-commitment-unclear':
    'Unclear trial commitment makes users hesitate because they cannot tell whether starting will require payment or cancellation work.',
  'friction-form-too-many-fields':
    'Long first-contact forms ask for trust before earning it, causing qualified visitors to abandon the conversion path.',
  'friction-no-risk-reversal':
    'A sign-up CTA without commitment details feels risky, especially for users comparing unfamiliar products.',
  'friction-no-social-proof':
    'Proof near the CTA reduces perceived risk; without it, visitors must trust your claims with no external support.',
  'trust-no-authority-signals':
    'Real authority signals help new visitors decide the product is credible enough to try, buy, or share internally.',
  'trust-testimonial-quality':
    'Generic praise feels interchangeable; specific attributed proof helps visitors believe the product works for people like them.',
  'trust-unsupported-claims':
    'Absolute claims without evidence trigger skepticism and can make the rest of the page feel inflated.',
  'trust-no-direct-contact':
    'No visible support or contact path makes the business feel unreachable at the moment users need reassurance.',
  'trust-no-internal-links':
    'Sparse navigation gives evaluators no way to inspect pricing, docs, proof, or support before committing.',
  'hierarchy-competing-actions':
    'Competing primary actions create choice paralysis; a clear visual order helps users understand the intended next step.',
  'hierarchy-no-sections':
    'Without section headings, users cannot skim the page for features, pricing, proof, or answers.',
  'hierarchy-no-headline':
    'Missing the main headline removes the page anchor users rely on to understand where they landed.',
  'hierarchy-information-density':
    'Crowded above-the-fold copy forces users to parse too much before they know what to do next.',
  'mobile-input-zoom':
    'Inputs below 16px trigger iOS zoom, disorienting users during signup or contact forms.',
  'mobile-cta-thumb-zone':
    'A CTA near the top edge adds one-handed reach friction on larger phones.',
  'mobile-cta-weak-label':
    'Vague mobile CTA labels make users uncertain about what tapping will do, which lowers intent.',
  'mobile-no-viewport':
    'Without a mobile viewport tag, phones render a desktop layout with tiny text and hard-to-tap controls.',
  'mobile-load-delay-content':
    'Delayed mobile content burns the short decision window before users can read the headline or reach the CTA.',
  'title-missing':
    'Search results and browser tabs show an untitled page - visitors skip links that look broken or generic.',
  'title-too-short':
    'Short titles waste SERP space and fail to communicate your offer before the click.',
  'title-too-long':
    'Google truncates long titles mid-phrase, hiding your brand or main keyword.',
  'description-missing':
    'Google and social platforms invent snippets when you omit a description - often missing your hook and CTA.',
  'description-too-short':
    'Thin descriptions look spammy in search results and under-sell the page.',
  'description-too-long':
    'Truncated descriptions cut off your CTA and leave an ellipsis instead of a reason to click.',
  'og-image-missing':
    'Shared links on Slack, LinkedIn, and iMessage show blank cards without og:image - fewer clicks from referrals.',
  'og-image-broken':
    'A broken preview image makes shared links look untrustworthy or abandoned.',
  'og-title-missing':
    'Social apps fall back to the page title; a missing og:title often produces a weak or wrong preview headline.',
  'og-description-missing':
    'Without og:description, link previews omit your pitch and hurt share click-through.',
  'viewport-missing':
    'Mobile browsers render desktop-width layouts - text shrinks and CTAs become hard to tap.',
  'lang-missing':
    'Screen readers and translation tools guess the language, hurting accessibility and SEO locale signals.',
  'canonical-missing':
    'Duplicate URLs split ranking signals and analytics when the canonical is undefined.',
  'robots-blocks-indexing':
    'noindex keeps the page out of Google entirely - fine for staging, fatal for a launch URL.',
  'favicon-missing':
    'Tabs and bookmarks show a generic icon, making your site look unfinished next to competitors.',
  'h1-missing':
    'The H1 is the primary on-page headline for humans and search - missing it weakens clarity in seconds.',
  'h1-multiple':
    'Multiple H1s dilute the main message and confuse search engines about the page topic.',
  'h1-generic':
    'Category headlines ("Build X with AI") do not tell visitors what they get - outcome-led H1s convert better.',
  'heading-hierarchy-missing':
    'Without section headings, the page reads as one wall of text and hurts scanability.',
  'no-cta-detected':
    'Visitors who are ready to act have no obvious next step, so intent dies on the page.',
  'cta-below-fold-mobile':
    'On phones, most visitors never scroll to a below-fold CTA - you lose signups you already earned.',
  'loading-indicator-stuck':
    'A skeleton or spinner that never clears makes the product look broken before anyone reads a word.',
  'loading-state-slow':
    'A long first-screen loading state makes visitors wait before they can understand or act on the page.',
  'motion-ignores-reduced-preference':
    'Vestibular disorders and focus needs make looping hero motion a hard stop - OS reduce-motion must be honored.',
  'tap-targets-small':
    'Cramped nav and buttons cause mis-taps and frustration on touch screens.',
  'no-structured-data':
    'Rich results (sitelinks, product cards) require structured data - you leave SERP enhancements on the table.',
  'external-links-unsafe':
    'target=_blank without noopener is a known tab-nabbing risk and fails security-minded reviews.',
  'sitemap-missing':
    'Crawlers discover pages slower without a sitemap - new landing pages take longer to index.',
  'robots-txt-missing':
    'Without robots.txt you cannot declare crawl preferences or point crawlers to your sitemap.',
  'broken-internal-links':
    'Broken links break trust mid-journey and waste crawl budget on 404s.',
  'broken-page-anchors':
    'Broken hash links break in-page navigation and make the site feel unfinished.',
  'no-https':
    'Browsers mark HTTP sites "Not secure" - a hard stop for signup and payment flows.',
  'no-privacy-policy':
    'Privacy links are expected before collecting email or analytics - missing ones erode trust at signup.',
  'no-contact-info':
    'No visible contact path makes the business feel anonymous when visitors have questions.',
  'cookie-consent-absent':
    'Tracking without consent banners creates compliance risk in the EU and UK.',
  'console-errors-critical':
    'Runtime errors often break analytics, auth, or checkout scripts silently.',
  'console-errors-some':
    'Console errors signal fragile integrations that may fail for real users.',
  'perf-score-critical':
    'Slow loads increase bounce before visitors read your headline - especially on mobile networks.',
  'perf-score-poor':
    'Mediocre performance costs conversions on every marketing dollar you spend.',
  'lcp-critical':
    'Hero content paints too late - visitors see a blank or shifting layout and leave.',
  'lcp-poor':
    'Delayed largest paint pushes your value prop below the patience threshold (~2.5s).',
  'cls-critical':
    'Layout jumps cause mis-clicks and make the page feel broken during load.',
  'cls-poor':
    'Visible shift during load reduces trust in polish and professionalism.',
  'render-blocking':
    'Blocking scripts delay first paint so the page feels empty on first visit.',
  'unused-js-large':
    'Shipping unused JavaScript slows every visitor for code they never execute.',
  'unused-css-large':
    'Extra CSS blocks render and adds weight without improving the UI.',
  'unoptimized-images':
    'Oversized images are the most common cause of slow LCP on marketing pages.',
  'inp-critical':
    'Sluggish taps and clicks make forms and CTAs feel unresponsive after load.',
  'inp-poor':
    'Interaction delay frustrates users trying to complete the primary action.',
  'mobile-perf-critical':
    'Most traffic is mobile - a failing mobile score means most visitors get a bad experience.',
  'mobile-perf-poor':
    'Mobile visitors on 4G hit friction before they reach your CTA.',
  'mobile-lcp-critical':
    'Mobile hero paint is too slow for thumb-scrollers who decide in one screen.',
  'images-missing-alt':
    'Missing alt text excludes screen-reader users and hurts image search relevance.',
  'images-empty-alt':
    'Empty alt on meaningful images hides content from assistive tech.',
  'form-inputs-no-label':
    'Unlabeled inputs fail WCAG and confuse autofill and voice control.',
  'buttons-no-text':
    'Icon-only buttons without labels are unusable for screen readers.',
  'links-no-text':
    'Links with no accessible name fail audits and hurt keyboard/screen-reader navigation.',
  'iframe-no-title':
    'Untitled iframes disorient screen-reader users about embedded content.',
  'tabindex-positive':
    'Positive tabindex breaks natural tab order and traps keyboard users.',
  'color-contrast-poor':
    'Low contrast makes body copy and CTAs hard to read for many visitors.',
  'skip-link-missing':
    'Keyboard users must tab through the entire nav on every page load without a skip link.',
  'keyboard-nav-trap':
    'Focus traps block keyboard users from completing forms or closing overlays.',
  'focus-visible-missing':
    'No visible focus ring makes keyboard navigation guesswork.',
  'placeholder-copy-detected':
    'Placeholder text ships to production and screams "unfinished" to visitors.',
  'template-default-copy':
    'Boilerplate copy prevents visitors from understanding why your product is different.',
  'unreplaced-template-token':
    'Visible {{tokens}} break trust instantly - they look like a deploy mistake.',
  'cta-dead-link':
    'A dead CTA trains visitors that clicking leads nowhere - they stop trying.',
  'social-proof-unverifiable':
    'Fake stats and placeholder testimonials erode trust faster than having no proof at all.',
  'flow-no-cta-found':
    'Automated flow scan found no actionable primary CTA in the viewport.',
  'flow-cta-unclickable':
    'The primary CTA exists but cannot be clicked. Overlays or CSS block conversion.',
  'overlay-blocks-nav':
    'A modal or sticky overlay intercepts clicks to primary navigation, so users cannot reach category pages.',
  'overlay-blocks-cta':
    'A modal or sticky overlay sits on top of the primary CTA, so users cannot start the next step.',
  'overlay-blocks-form':
    'A sticky ad or overlay covers form controls, so users cannot select options or submit.',
  'api-engagement-unauthorized':
    'Newsletter, signup, or contact APIs reject requests as unauthorized, so engagement never completes.',
  'api-engagement-server-error':
    'Engagement APIs return server errors, so users who try to convert hit a dead end.',
  'form-submit-api-unauthorized':
    'The form collects input but the submit API returns 401/403, blocking signup or newsletter.',
  'form-submit-api-server-error':
    'Form submit hits a server error, so completed forms fail with a generic message.',
  'form-submit-silent-failure':
    'The submit API and the page disagree on success, so users think nothing happened or trust a fake confirmation.',
  'flow-cta-404':
    'The main CTA sends users to an error page - the worst possible first click.',
  'flow-cta-dead-end':
    'The CTA click goes nowhere meaningful, wasting paid traffic.',
  'flow-cta-external-leave':
    'Primary CTA sends visitors off-domain before they understand your offer.',
  'flow-pricing-nav-broken':
    'Visitors who click Pricing in the nav get a dead click - they cannot compare plans.',
  'flow-mobile-menu-broken':
    'Mobile visitors cannot reliably reach Pricing or Features when the header has no working menu pattern.',
  'flow-form-no-validation':
    'Visitors who submit an empty form get silence instead of guidance - they abandon instead of fixing typos.',
  'flow-cta-blank-destination':
    'A blank screen after the CTA click makes visitors think the site is broken and they leave before signup.',
  'flow-cta-stuck-loading':
    'Skeleton UI that never resolves signals a broken app and kills trust at the conversion moment.',
  'scroll-ghost-sections':
    'Invisible sections after scroll make the page feel empty and unfinished.',
  'flow-form-slow-feedback':
    'Delayed validation feels broken even when errors eventually appear.',
  'flow-cta-destination-no-trust':
    'Signup pages without privacy or contact links feel sketchy at the moment of conversion.',
  'slow-3g-blank-screen':
    'Mobile visitors on slow networks see a blank screen and bounce before your product loads.',
  'slow-3g-cta-delayed':
    'If the CTA takes 8+ seconds on 3G, most mobile visitors never see it.',
  'corridor-og-title-drift':
    'Identical share titles across funnel pages make every link preview look the same in Slack and social.',
  'corridor-og-description-drift':
    'Reused Open Graph descriptions hide what makes each funnel page unique when shared.',
  'journey-first-visit-unclear-value-prop':
    'First-time visitors bounce when the landing page does not state the product outcome in a clear headline.',
  'journey-first-visit-hidden-cta':
    'Without an obvious next step, first-visit intent dies on the homepage.',
  'journey-first-visit-dead-end':
    'A conversion corridor with no path forward loses visitors who were ready to continue.',
  'journey-first-visit-destination-no-next-action':
    'Clicking through to a dead-end destination wastes the click that got the visitor there.',
  'journey-signup-no-form':
    'Signup paths without a visible form block the moment a visitor decides to convert.',
  'journey-signup-too-many-fields':
    'Long signup forms increase abandonment before the first success moment.',
  'journey-contact-not-found':
    'Buyers who cannot find help stall before purchasing.',
}

export function whyItMattersForCheckId(checkId: string): string {
  return (
    WHY_IT_MATTERS[checkId] ??
    'Leaving this unfixed creates friction or missed conversions on a page you intend to ship.'
  )
}

export function resolveWhyItMatters(flag: RankableFlag): string {
  if (flag.whyItMatters && !isGenericWhyItMatters(flag.whyItMatters)) {
    return flag.whyItMatters
  }
  if (flag.checkId) return whyItMattersForCheckId(flag.checkId)
  return flag.whyItMatters ?? flag.problem
}

export function resolveVerificationRule(flag: RankableFlag): string | null {
  if (flag.verificationRule?.trim()) return flag.verificationRule.trim()
  if (flag.checkId) return verificationRuleForCheckId(flag.checkId)
  return null
}

/** Human-readable evidence in the report UI - no screenshot fluff for head/code checks. */
export function formatDisplayEvidence(checkId: string | null | undefined, evidence: string): string {
  const raw = evidence.trim()
  if (!checkId || isCodeOrHeadCheck(checkId)) return raw
  if (!VISUAL_EVIDENCE_CHECKS.has(checkId)) return raw
  if (/screenshot|viewport|visible|above the fold|below the fold/i.test(raw)) return raw
  return formatVisualEvidence(checkId, raw)
}

export function buildExpertFixPrompt(flag: RankableFlag): string {
  const evidence = (flag.evidence ?? flag.problem).trim()
  const fix = normalizeFixBody(resolveFixPrompt(flag) ?? flag.problem)
  const verify = resolveVerificationRule(flag)

  const constraint = flag.rubric === 'MESSAGE'
    ? 'Do not restructure layout, change visual styles, or touch non-copy files.'
    : flag.rubric === 'EXPERIENCE'
      ? 'Do not rewrite marketing copy unless it directly affects usability. Do not change unrelated components.'
      : 'Do not change visible page content unless it affects social previews. Do not touch layout or copy.'

  const severity = flag.severity === 'CRITICAL'
    ? 'This is a critical issue that directly blocks conversions or trust.'
    : flag.severity === 'IMPORTANT'
      ? 'This is an important issue that degrades the product experience.'
      : 'This is a polish issue that improves overall quality.'

  const lines = [
    `## Goal`,
    flag.problem.trim(),
    '',
    '## Constraint',
    `- ${constraint}`,
    `- ${severity}`,
    '',
    '## Context',
    `- Issue: ${flag.rubric} / ${flag.severity}`,
    `- Evidence: ${evidence}`,
    '',
    '## Plan',
    fix,
  ]

  if (verify) {
    lines.push('', '## Verify', verify)
  }

  return lines.join('\n')
}

/** Pull actionable steps out of legacy Goal/Observed/Expected essays. */
function normalizeFixBody(raw: string): string {
  const trimmed = raw.trim()
  const expected = trimmed.match(
    /## Expected behavior\s*\n+([\s\S]*?)(?=\n## |\s*$)/i
  )
  if (expected?.[1]?.trim()) return expected[1].trim()

  if (/^## Goal\b/im.test(trimmed)) {
    const withoutVerify = trimmed.replace(/\n## How to verify\s*\n[\s\S]*$/i, '').trim()
    const withoutHeaders = withoutVerify
      .replace(/^## Goal\s*\n+/im, '')
      .replace(/\n## Observed behavior\s*\n+/gi, '\n')
      .replace(/\n## Expected behavior\s*\n+/gi, '\n')
      .trim()
    if (withoutHeaders) return withoutHeaders
  }

  return trimmed
}
