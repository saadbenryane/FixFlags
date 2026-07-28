import type { DeterministicFlag } from '../flag-types'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function runSearchPerformanceChecks(
  auditId: string,
  pageUrl: string
): Promise<DeterministicFlag[]> {
  const flags: DeterministicFlag[] = []

  try {
    const indexStatus = await prisma.indexStatus.findUnique({
      where: { auditId_url: { auditId, url: pageUrl } },
    })

    if (indexStatus) {
      if (indexStatus.verdict === 'FAIL') {
        flags.push({
          checkId: 'indexing-failure',
          rubric: 'REACH',
          severity: 'CRITICAL',
          problem: 'Page is not indexed',
          evidence:
            indexStatus.coverageState ||
            'Google Search Console reports this page is not indexed.',
          fix: 'Check coverage state in Google Search Console and address the issue preventing indexing.',
          confidence: 1,
          source: 'DETERMINISTIC',
          impactTag: 'SEO',
          pageUrl,
        })
      }

      if (
        indexStatus.coverageState?.toLowerCase().includes('soft 404')
      ) {
        flags.push({
          checkId: 'soft-404',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          problem: 'Soft 404 detected',
          evidence:
            indexStatus.coverageState ||
            'Google Search Console detected a soft 404.',
          fix: 'Provide meaningful content on this page or return a proper 404 HTTP status.',
          confidence: 1,
          source: 'DETERMINISTIC',
          impactTag: 'SEO',
          pageUrl,
        })
      }

      if (indexStatus.robotsTxtState === 'DISALLOWED') {
        flags.push({
          checkId: 'robots-blocked',
          rubric: 'REACH',
          severity: 'CRITICAL',
          problem: 'Page is blocked by robots.txt',
          evidence:
            'Google Search Console reports this page is blocked by robots.txt.',
          fix: 'Remove the robots.txt directive blocking this page to allow crawling and indexing.',
          confidence: 1,
          source: 'DETERMINISTIC',
          impactTag: 'SEO',
          pageUrl,
        })
      }

      if (indexStatus.indexingState === 'BLOCKED_BY_META_TAG') {
        flags.push({
          checkId: 'noindex-meta',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          problem: 'Page has noindex meta tag',
          evidence:
            'Google Search Console reports a noindex robots meta tag on this page.',
          fix: 'Remove the noindex meta tag to allow indexing.',
          confidence: 1,
          source: 'DETERMINISTIC',
          impactTag: 'SEO',
          pageUrl,
        })
      }

      if (
        indexStatus.googleCanonical &&
        indexStatus.userCanonical &&
        indexStatus.googleCanonical !== indexStatus.userCanonical
      ) {
        flags.push({
          checkId: 'canonical-mismatch',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          problem: 'Canonical mismatch',
          evidence: `Google selected: ${indexStatus.googleCanonical}. Declared: ${indexStatus.userCanonical}`,
          fix: 'Align your canonical tag with the page Google selects, or fix signals causing Google to choose differently.',
          confidence: 1,
          source: 'DETERMINISTIC',
          impactTag: 'SEO',
          pageUrl,
        })
      }
    }

    const perfCount = await prisma.searchPerformance.count({
      where: { auditId, url: pageUrl },
    })

    if (perfCount > 0) {
      const topQuery = await prisma.searchPerformance.findFirst({
        where: { auditId, url: pageUrl, position: { not: undefined } },
        orderBy: { impressions: 'desc' },
        select: { ctr: true, position: true, impressions: true, query: true },
      })

      if (topQuery && topQuery.position < 10 && topQuery.ctr < 0.02) {
        flags.push({
          checkId: 'low-ctr',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          problem: `Low CTR for query "${topQuery.query}"`,
          evidence: `Position: ${topQuery.position.toFixed(1)}. CTR: ${(topQuery.ctr * 100).toFixed(1)}%. Impressions: ${topQuery.impressions.toLocaleString()}`,
          fix: 'Improve your title and meta description to attract more clicks from the search results.',
          confidence: 0.8,
          source: 'DETERMINISTIC',
          impactTag: 'SEO',
          pageUrl,
        })
      }
    }
  } catch (err) {
    logger.error(
      'Search performance checks failed',
      err instanceof Error ? err : new Error(String(err))
    )
  }

  return flags
}
