/** Page triage offers reviews of recorded content, not measured visitor outcomes. */
export const TRIAGE_REVIEW_COPY = {
  'copy-clarity': {
    problem: 'Review the recorded copy with its surrounding context',
    why: 'Review the headline, nearby support, audience, and page purpose together before changing the wording.',
  },
  'action-clarity': {
    problem: 'Review whether the recorded action explains the next step',
    why: 'Review the action wording and intended destination together. Visitor behavior and conversion were not measured.',
  },
  'visual-hierarchy': {
    problem: 'Review the relative prominence of the recorded actions',
    why: 'Review these recorded actions in the captured layout before changing their prominence. This does not establish a blocked action or visitor confusion.',
  },
  'search-snippet': {
    problem: 'Review the recorded search-preview wording',
    why: 'Review the title and description against the page purpose. Search appearance, ranking, and click-through changes were not measured.',
  },
  sources: { pageText: 'Page copy', title: 'Title', description: 'Description', headline: 'Headline', ctaText: 'Action wording' },
} as const

export function triageCategorySummary(recordedFindings: number, recommendations: number, incomplete: boolean): string {
  const recorded = recordedFindings > 0 ? 'Recorded check findings are available with their evidence.' : 'No check finding was recorded in this category.'
  const review = recommendations > 0 ? 'Review the source-backed Recommendations in context.' : 'No additional source-backed Recommendation was admitted.'
  return `${recorded} ${review} ${incomplete ? 'Some proposed observations could not be matched to the captured sources. Review incomplete coverage.' : 'Review coverage for unchecked areas.'}`
}
