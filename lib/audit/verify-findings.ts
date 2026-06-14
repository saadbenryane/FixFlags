import { prisma } from '@/lib/db'
import { DeterministicFinding, runAllChecks } from './checks'
import { fetchAndParseMetadata } from './metadata'
import { fetchPageSpeedData } from './pagespeed'

const CHECK_ID_TO_RULE: Record<string, string> = {
  'title-missing': 'Page has a non-empty title tag',
  'description-missing': 'Page has a meta description',
  'og-image-missing': 'og:image tag is present and image URL returns 200',
  'h1-missing': 'Page has exactly one H1',
  'no-https': 'Site is served over HTTPS',
  'no-privacy-policy': 'Privacy policy link is present',
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

export type { DeterministicFinding }
