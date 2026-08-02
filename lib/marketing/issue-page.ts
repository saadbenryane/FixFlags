import type { IssuePageData } from '@/lib/graph/queries'

/** Humanize checkId: mobile-lcp-critical → Mobile Lcp Critical */
export function humanizeCheckId(checkId: string): string {
  return checkId
    .split('-')
    .filter(Boolean)
    .map((part) => {
      if (/^(lcp|cls|fid|inp|ttfb|seo|csp|og|cta|ux|ai|api|mcp)$/i.test(part)) {
        return part.toUpperCase()
      }
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

export function issuePageTitle(data: Pick<IssuePageData, 'checkId' | 'problemTemplate'>): string {
  void data.problemTemplate
  // Prefer a stable title from checkId; problem text often embeds site-specific numbers.
  return `${humanizeCheckId(data.checkId)} - FixFlags Issue`
}

export function issuePageDescription(
  data: Pick<IssuePageData, 'problemTemplate' | 'siteCount' | 'occurrenceCount' | 'rubric'>,
): string {
  const base = data.problemTemplate.replace(/\s+/g, ' ').trim().slice(0, 120)
  return `${base} Seen on ${data.siteCount} audited sites (${data.occurrenceCount} observations). ${data.rubric} rubric. Free check with FixFlags.`
}

export function rubricLabel(rubric: string): string {
  const r = rubric.toUpperCase()
  if (r === 'MESSAGE') return 'Message'
  if (r === 'EXPERIENCE') return 'Experience'
  if (r === 'REACH') return 'Reach'
  return rubric.charAt(0) + rubric.slice(1).toLowerCase()
}
