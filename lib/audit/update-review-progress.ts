/**
 * Update Review is a diff against the last Review, not a second first impression.
 * Score can stay flat when New Flags offset Fixed ones. Explain that instead of
 * letting the number look like the work did not count.
 */

export type UpdateReviewCounts = {
  fixed: number
  unchanged: number
  newIssues: number
  newOnReviewedPage: number
  newOnNewPage: number
  regressed: number
  inconclusive: number
}

export type UpdateReviewDiffLike = {
  fixed: unknown[]
  unchanged: unknown[]
  newIssues: Array<{ foundOnNewPage?: boolean }>
  regressed: unknown[]
  inconclusive: unknown[]
}

export function countsFromUpdateDiff(diff: UpdateReviewDiffLike): UpdateReviewCounts {
  const newOnNewPage = diff.newIssues.filter((item) => item.foundOnNewPage).length
  return {
    fixed: diff.fixed.length,
    unchanged: diff.unchanged.length,
    newIssues: diff.newIssues.length,
    newOnNewPage,
    newOnReviewedPage: diff.newIssues.length - newOnNewPage,
    regressed: diff.regressed.length,
    inconclusive: diff.inconclusive.length,
  }
}

function newObservationClause(counts: UpdateReviewCounts): string {
  if (counts.newOnReviewedPage > 0 && counts.newOnNewPage > 0) {
    return `${counts.newOnReviewedPage} new ${
      counts.newOnReviewedPage === 1 ? 'observation appeared' : 'observations appeared'
    } on pages already reviewed, and ${counts.newOnNewPage} on newly reviewed pages`
  }
  if (counts.newOnNewPage > 0 && counts.newOnReviewedPage === 0) {
    return `${counts.newOnNewPage} new ${
      counts.newOnNewPage === 1 ? 'observation appeared' : 'observations appeared'
    } on pages this update review checked for the first time`
  }
  if (counts.newIssues > 0) {
    return `${counts.newIssues} new ${
      counts.newIssues === 1 ? 'observation appeared' : 'observations appeared'
    } on pages already reviewed`
  }
  return `${counts.newIssues} new observations appeared`
}

export function previousScoreFromHistory(
  history: Array<{ id: string; score: number | null }> | null | undefined,
  currentId: string | null | undefined
): number | null {
  if (!history || history.length === 0) return null
  const currentIndex = currentId
    ? history.findIndex((point) => point.id === currentId)
    : history.length - 1
  const index = currentIndex > 0 ? currentIndex : history.length - 1
  const previous = history[index - 1]
  return typeof previous?.score === 'number' ? previous.score : null
}

export function scoreOffsetExplanation(input: {
  previousScore: number | null
  currentScore: number | null
  counts: UpdateReviewCounts
}): string | null {
  const { previousScore, currentScore, counts } = input
  if (previousScore == null || currentScore == null) return null
  if (
    counts.fixed === 0 &&
    counts.newIssues === 0 &&
    counts.regressed === 0 &&
    counts.unchanged === 0 &&
    counts.inconclusive === 0
  ) {
    return null
  }

  if (currentScore === previousScore && counts.fixed > 0 && counts.newIssues > 0) {
    return `Score stayed at ${currentScore}. ${counts.fixed} ${
      counts.fixed === 1 ? 'Flag from last time is gone' : 'Flags from last time are gone'
    }, and ${newObservationClause(counts)}.`
  }

  if (currentScore === previousScore && counts.fixed > 0 && counts.newIssues === 0) {
    return `Score stayed at ${currentScore}. ${counts.fixed} ${
      counts.fixed === 1 ? 'Flag from last time is gone' : 'Flags from last time are gone'
    }, and remaining Flags still carry the same weight.`
  }

  if (currentScore < previousScore && counts.newIssues > 0) {
    if (counts.newOnReviewedPage > 0) {
      return `Score moved from ${previousScore} to ${currentScore}. New observations on pages already reviewed outweighed what was Fixed.`
    }
    return `Score moved from ${previousScore} to ${currentScore}. New observations outweighed what was Fixed.`
  }

  if (currentScore > previousScore && counts.fixed > 0) {
    return `Score moved from ${previousScore} to ${currentScore}. ${counts.fixed} ${
      counts.fixed === 1 ? 'Flag from last time is gone' : 'Flags from last time are gone'
    }.`
  }

  if (currentScore === previousScore) {
    return `Score stayed at ${currentScore}. This update review is a snapshot of what is still open.`
  }

  return `Score moved from ${previousScore} to ${currentScore}.`
}
