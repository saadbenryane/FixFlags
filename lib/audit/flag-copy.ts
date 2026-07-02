import { METADATA_CHECK_IDS } from '@/lib/marketing/evidence-regions'
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
  'flow-cta-stuck-loading',
  'scroll-ghost-sections',
  'flow-form-slow-feedback',
  'form-inputs-zoom-mobile',
  'flow-cta-destination-no-trust',
  'slow-3g-blank-screen',
  'slow-3g-cta-delayed',
  'loading-indicator-stuck',
  'loading-state-slow',
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
  'measurement-consent-blocking-incomplete':
    'Analytics and consent need to work together. Missing privacy controls create trust and compliance risk before users even sign up.',
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
    'The primary CTA exists but cannot be clicked - overlays or CSS block conversion.',
  'flow-cta-404':
    'The main CTA sends users to an error page - the worst possible first click.',
  'flow-cta-dead-end':
    'The CTA click goes nowhere meaningful, wasting paid traffic.',
  'flow-cta-external-leave':
    'Primary CTA sends visitors off-domain before they understand your offer.',
  'flow-pricing-nav-broken':
    'Visitors who click Pricing in the nav get a dead click - they cannot compare plans.',
  'flow-mobile-menu-broken':
    'Mobile visitors cannot reach Pricing or Features when the menu toggle fails.',
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
  'form-inputs-zoom-mobile':
    'iOS Safari zooms the viewport when inputs are too small, breaking the form experience.',
  'flow-cta-destination-no-trust':
    'Signup pages without privacy or contact links feel sketchy at the moment of conversion.',
  'slow-3g-blank-screen':
    'Mobile visitors on slow networks see a blank screen and bounce before your product loads.',
  'slow-3g-cta-delayed':
    'If the CTA takes 8+ seconds on 3G, most mobile visitors never see it.',
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
  return `Visible page evidence: ${raw}`
}

export function buildExpertFixPrompt(flag: RankableFlag): string {
  const why = resolveWhyItMatters(flag)
  const evidence = (flag.evidence ?? flag.problem).trim()
  const fix = resolveFixPrompt(flag) ?? flag.problem
  const verify = resolveVerificationRule(flag)

  const lines = [
    flag.problem.trim(),
    '',
    `Why it matters: ${why}`,
    '',
    `Evidence: ${evidence}`,
    '',
    `Fix:\n${fix}`,
  ]

  if (verify) {
    lines.push('', `Verify: ${verify}`)
  }

  return lines.join('\n')
}
