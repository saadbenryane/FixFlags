import { prisma } from '@/lib/db'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'
import { DeterministicFinding, runAllChecks } from './checks'
import { fetchAndParseMetadata } from './metadata'
import { fetchPageSpeedData } from './pagespeed'

const CHECK_ID_TO_RULE: Record<string, string> = {
  'title-missing':
    'View page source or DevTools Elements, confirm a non-empty <title> tag.',
  'title-too-short':
    'Confirm the title is at least 10 characters and describes the page.',
  'title-too-long':
    'Confirm the title is 60 characters or fewer in search preview.',
  'description-missing':
    'View page source, confirm meta name="description" with content.',
  'description-too-short':
    'Confirm the meta description is at least 50 characters.',
  'description-too-long':
    'Confirm the meta description is 160 characters or fewer.',
  'og-image-missing':
    'View page source for og:image; open the image URL in a new tab (should return 200).',
  'og-title-missing': 'View page source, confirm meta property="og:title" is present.',
  'og-description-missing':
    'View page source, confirm meta property="og:description" is present.',
  'viewport-missing':
    'View page source, confirm meta name="viewport" with width=device-width.',
  'lang-missing': 'Confirm the <html> element has a lang attribute.',
  'canonical-missing': 'View page source, confirm link rel="canonical" points to this page.',
  'robots-blocks-indexing':
    'View page source, confirm robots meta does not include noindex.',
  'favicon-missing':
    'Confirm link rel="icon" or apple-touch-icon exists and the icon loads in the browser tab.',
  'perf-score-critical':
    'Run PageSpeed Insights; desktop performance score should be 50 or above.',
  'perf-score-poor':
    'Run PageSpeed Insights; desktop performance score should reach 75 or above.',
  'lcp-critical':
    'Chrome DevTools Lighthouse or PageSpeed Insights, LCP should be under 2.5s.',
  'lcp-poor':
    'Chrome DevTools Lighthouse or PageSpeed Insights, LCP should be under 2.5s.',
  'cls-critical': 'Lighthouse CLS should be 0.1 or lower.',
  'cls-poor': 'Lighthouse CLS should be 0.1 or lower.',
  'render-blocking':
    'Chrome DevTools Network, filter JS/CSS; blocking resources should not delay first paint.',
  'unused-js-large':
    'Chrome DevTools Coverage tab, unused JavaScript should be under 200KB.',
  'unused-css-large':
    'Chrome DevTools Coverage tab, unused CSS should be materially reduced.',
  'unoptimized-images':
    'Lighthouse should no longer flag unoptimized or non-modern image formats.',
  'inp-critical': 'PageSpeed Insights mobile INP should be 200ms or lower.',
  'inp-poor': 'PageSpeed Insights mobile INP should be 200ms or lower.',
  'images-missing-alt':
    'DevTools Elements, every informational img has a non-empty alt attribute.',
  'images-empty-alt':
    'Review decorative vs informational images; only decorative images use alt="".',
  'form-inputs-no-label':
    'Every visible input has an associated label or aria-label.',
  'buttons-no-text':
    'Every button has visible text or aria-label describing its action.',
  'links-no-text':
    'Every link has visible text, aria-label, or title describing the destination.',
  'iframe-no-title': 'Every iframe has a descriptive title attribute.',
  'tabindex-positive': 'No elements use tabindex greater than 0.',
  'color-contrast-poor':
    'Lighthouse accessibility audit for color-contrast should pass with no failing nodes.',
  'skip-link-missing':
    'Tab from the top of the page; first focusable element should be a skip-to-content link.',
  'keyboard-nav-trap':
    'Tab through modals and overlays; focus should not become stuck and Escape should close.',
  'focus-visible-missing':
    'Tab through interactive elements; each should show a visible focus indicator.',
  'h1-missing': 'DevTools Elements, confirm exactly one visible H1 on the page.',
  'h1-multiple': 'DevTools Elements, confirm only one H1; secondary headings should be H2/H3.',
  'no-structured-data':
    'View page source for script type="application/ld+json" or validate in Rich Results Test.',
  'external-links-unsafe':
    'External target=_blank links include rel="noopener noreferrer".',
  'sitemap-missing': 'Open /sitemap.xml; it should return 200 with valid XML.',
  'robots-txt-missing': 'Open /robots.txt; it should return 200.',
  'broken-internal-links':
    'Click or HEAD each flagged internal URL; all should return 200.',
  'no-https': 'Open the site URL, address bar should show HTTPS with a valid certificate.',
  'no-privacy-policy':
    'Footer or legal links should include a privacy policy reachable in one click.',
  'no-contact-info':
    'Footer or header should include email, contact form, or social links.',
  'cookie-consent-absent':
    'If analytics scripts load, a cookie consent banner should appear for EU visitors.',
  'console-errors-critical':
    'Chrome DevTools Console should show zero errors on page load.',
  'console-errors-some':
    'Chrome DevTools Console should show zero errors on page load.',
  'mobile-perf-critical':
    'PageSpeed Insights mobile performance score should be 50 or above.',
  'mobile-perf-poor':
    'PageSpeed Insights mobile performance score should reach 75 or above.',
  'tap-targets-small':
    'At 375px width, tap targets should be at least 48x48px with adequate spacing.',
  'mobile-lcp-critical':
    'PageSpeed Insights mobile LCP should be under 2.5s.',
  'h1-generic':
    'H1 should describe a specific product outcome, not a generic welcome message.',
  'no-cta-detected':
    'A primary CTA button or link should be visible above the fold.',
}

const VERIFIABLE_CHECK_IDS = new Set(Object.keys(CHECK_ID_TO_RULE))

/** Re-run deterministic checks on re-check and mark findings verified when checkId clears. */
export async function applyDeterministicVerification(
  recheckAuditId: string,
  parentAuditId: string,
  url: string
): Promise<void> {
  const parentFindings = await prisma.finding.findMany({
    where: {
      auditId: parentAuditId,
      checkId: { in: [...VERIFIABLE_CHECK_IDS] },
    },
  })

  if (parentFindings.length === 0) return

  let metadata
  try {
    metadata = await fetchAndParseMetadata(url)
  } catch {
    return
  }

  const pagespeed = await fetchPageSpeedData(url)
  const current = await runAllChecks(
    url,
    metadata,
    pagespeed.desktop,
    pagespeed.mobile,
    []
  )

  const currentCheckIds = new Set(
    current.filter((f) => VERIFIABLE_CHECK_IDS.has(f.checkId)).map((f) => f.checkId)
  )

  for (const finding of parentFindings) {
    if (!finding.checkId || !VERIFIABLE_CHECK_IDS.has(finding.checkId)) continue
    const stillFails = currentCheckIds.has(finding.checkId)
    await prisma.finding.update({
      where: { id: finding.id },
      data: {
        status: stillFails ? 'UNCHANGED' : 'FIXED',
        resolvedInId: stillFails ? null : recheckAuditId,
      },
    })
  }

  const recheckFindings = await prisma.finding.findMany({
    where: {
      auditId: recheckAuditId,
      checkId: { in: [...VERIFIABLE_CHECK_IDS] },
    },
  })

  for (const finding of recheckFindings) {
    if (!finding.checkId) continue
    const parentMatch = parentFindings.find((p) => p.checkId === finding.checkId)
    if (!parentMatch) continue
    const stillFails = currentCheckIds.has(finding.checkId)
    let status: 'FIXED' | 'UNCHANGED' | 'REGRESSED' = stillFails ? 'UNCHANGED' : 'FIXED'
    if (stillFails && parentMatch.severity !== finding.severity) {
      const rank = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 }
      if (rank[finding.severity] > rank[parentMatch.severity]) status = 'REGRESSED'
    }
    await prisma.finding.update({
      where: { id: finding.id },
      data: { status },
    })
  }
}

export function verificationRuleForCheckId(checkId: string): string | null {
  return CHECK_ID_TO_RULE[checkId] ?? null
}

/** Ensures every registered check has a verification rule (used in tests). */
export function allCheckIdsHaveVerificationRules(): boolean {
  return ALL_CHECK_IDS.every((id) => CHECK_ID_TO_RULE[id] !== undefined)
}

export type { DeterministicFinding }
