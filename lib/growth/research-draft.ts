import type { PrismaClient } from '@prisma/client'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { isPermittedPublicResearchCheck, MIN_PUBLIC_RESEARCH_SITES } from '@/lib/graph/public-research'
import { countResearchGroups } from './research-independence'
import { checkResearchIssueEvidence, readResearchManifestCohort, readResearchManifestEvidence, researchPermissionsSchema } from './research-permissions'
import { readResearchRecoveryCandidate } from './research-recovery-readiness'

/** Derive review counts from an operator-selected private cohort. */
export async function prepareResearchDraft(input: { manifest: unknown; start: Date; end: Date; now?: Date } &
  ({ checkId: string } | { recoveries: true }), db: Pick<PrismaClient, '$transaction'>) {
  const { start, end } = input
  const now = input.now ?? new Date()
  const boundary = { version: 1, evidenceAsOf: now.toISOString(), databaseWritten: false, publicationApproved: false } as const
  if (![start, end].every(date => Number.isFinite(date.getTime())) || start > end || end > now ||
    ('checkId' in input && !isPermittedPublicResearchCheck(input.checkId))) {
    return { ...boundary, status: 'invalid-draft-scope' } as const
  }
  const parsed = researchPermissionsSchema.safeParse(input.manifest)
  if (!parsed.success || parsed.data.reviewedInputSha256 || parsed.data.reviewedEvidenceSha256) {
    return { ...boundary, status: 'unreviewed-manifest-required' } as const
  }

  const scope = { manifest: parsed.data, window: { start, end } }
  const observationWindow = { windowStart: start.toISOString(), windowEnd: end.toISOString() }
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    if ('recoveries' in input) {
      const cohort = await readResearchManifestCohort(scope, tx)
      if (!cohort) return { ...boundary, status: 'cohort-unverified' } as const
      const sources = new Map([...cohort.sourceEvidence].map(([auditId, source]) => [auditId, {
        ...source, earliestRequestAt: new Date(Math.max(start.getTime(), source.grantedAt.getTime())),
      }]))
      const candidate = await readResearchRecoveryCandidate(tx, scope.window, sources, cohort.groups, { requireScheduledCoverage: true })
      if (!candidate) return { ...boundary, status: 'recovery-evidence-below-minimum' } as const
      return {
        ...boundary,
        status: 'reviewable-recovery-draft',
        draft: { ...observationWindow, sampleSiteCount: cohort.sampleSites, recovery: candidate },
        limitations: [
          'Only eligible manifest audits contribute. Comparable follow-up and recurrence are withheld if a retained scheduled receipt in a mature seven-day window lacks eligible manifest evidence.',
          'Follow-up and recurrence fields indicate whether the privacy floor was met when assessable. Unobserved outcomes and uninterrupted recovery remain unknown.',
        ],
      } as const
    }
    const { checkId } = input
    const checkVersion = CHECK_REGISTRY[checkId].version
    const cohort = await readResearchManifestEvidence({ ...scope, observedBy: now }, tx)
    if (!cohort) return { ...boundary, status: 'cohort-unverified' } as const
    const issue = cohort.observations.get(checkId)
    if (!issue || issue.sites.size < MIN_PUBLIC_RESEARCH_SITES || countResearchGroups(issue.audits, cohort.groups) < MIN_PUBLIC_RESEARCH_SITES) {
      return { ...boundary, status: 'issue-below-minimum' } as const
    }
    const { versionedIssues, pageResponse } = await checkResearchIssueEvidence(
      [{ checkId, checkVersion }], now, cohort, tx, false,
    )
    if (versionedIssues !== 1) return { ...boundary, status: 'current-version-evidence-unverified' } as const
    if (pageResponse && pageResponse.coverage.status !== 'sample-covered') {
      return { ...boundary, status: 'page-response-coverage-unverified' } as const
    }
    return {
      ...boundary,
      status: 'reviewable-draft',
      draft: {
        ...observationWindow,
        sampleSiteCount: cohort.sampleSites,
        issue: { checkId, checkVersion, siteCount: issue.sites.size, occurrenceCount: issue.flags.size },
        ...(pageResponse && { pageResponseCoverage: pageResponse.coverage }),
      },
      limitations: [
        'Counts describe eligible retained observations from the supplied cohort. The sample size does not establish prevalence.',
        'This draft excludes framework counts and requires separate copy, methodology, permission and release review.',
      ],
    } as const
  }, { isolationLevel: 'RepeatableRead' })
}
