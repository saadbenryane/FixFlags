import type { PrismaClient } from '@prisma/client'
import { parsePublicIssueResearch } from '@/lib/graph/public-research'
import { readResearchReleaseEvidence, researchPermissionsSchema, researchReleaseInputSha256, reviewResearchReleaseEvidence } from './research-permissions'

/** Validate a proposed release in one snapshot without storing either input. */
export async function preflightResearchRelease(input: {
  release: unknown; manifest: unknown; now?: Date
}, db: Pick<PrismaClient, '$transaction'>) {
  const now = input.now ?? new Date()
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid research preflight cutoff')
  const boundary = { checkedAt: now.toISOString(), databaseWritten: false, published: false }
  const release = parsePublicIssueResearch(input.release, now)
  if (!release || !release.issues.length) return { ...boundary, status: 'invalid-release' } as const
  const manifest = researchPermissionsSchema.safeParse(input.manifest)
  if (!manifest.success || manifest.data.evidenceRef !== release.evidenceRef) {
    return { ...boundary, status: 'invalid-or-mismatched-manifest' } as const
  }
  const inputSha256 = researchReleaseInputSha256(release, manifest.data)
  const reviewed = manifest.data.reviewedInputSha256
  if (reviewed && reviewed !== inputSha256) return { ...boundary, status: 'reviewed-input-digest-mismatch' } as const
  const reviewedEvidence = manifest.data.reviewedEvidenceSha256
  if (Boolean(reviewed) !== Boolean(reviewedEvidence)) return { ...boundary, status: 'review-digests-incomplete' } as const
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const evidence = await readResearchReleaseEvidence(release, manifest.data, tx)
    if (!evidence) return { ...boundary, status: 'current-sources-or-counts-unverified' } as const
    const { versionedIssues, evidenceSha256, pageResponseCoverage } = await reviewResearchReleaseEvidence(release, evidence, inputSha256, tx)
    if (reviewedEvidence && evidenceSha256 && reviewedEvidence !== evidenceSha256) {
      return { ...boundary, status: 'reviewed-evidence-digest-mismatch' } as const
    }
    return {
      ...boundary,
      status: evidenceSha256 ? 'source-and-version-checks-passed' :
        versionedIssues !== release.issues.length ? 'declared-versions-unverified' : 'page-response-coverage-unverified',
      inputSha256,
      evidenceSha256,
      sampleSites: release.sampleSiteCount,
      issues: release.issues.length,
      issuesWithCorroboratedVersions: versionedIssues,
      ...(pageResponseCoverage && { pageResponseCoverage }),
      limitations: [
        'Checks reflect the current database snapshot and receipt evidence retained at the stated review cutoff.',
        'Corroborated finding counts establish affected Sites only. The manifest sample size is not a detector coverage denominator.',
        'Operator review of methodology, detector coverage, privacy and public copy is required for publication.',
      ],
    } as const
  }, { isolationLevel: 'RepeatableRead' })
}
