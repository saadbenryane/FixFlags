import type { RankableFlag } from '@/lib/audit/flag-types'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'

export function repoFindingToRankableFlag(finding: {
  id: string
  severity: string
  category: string
  filePath: string
  problem: string
  evidence: string
  fix: string
  agentPrompt: string | null
  cursorPrompt: string | null
  claudePrompt: string | null
  windsurfPrompt: string | null
}): RankableFlag {
  const location = finding.filePath
  return {
    id: `repo:${finding.id}`,
    checkId: `repo-${finding.category}`,
    rubric: 'EXPERIENCE',
    severity: finding.severity,
    impactTag: /secret|token|credential/i.test(`${finding.category} ${finding.problem}`)
      ? 'TRUST'
      : 'FRICTION',
    problem: finding.problem,
    evidence: `${location}: ${finding.evidence}`,
    whyItMatters: 'Repository issues can ship broken code even when the live site looks fine.',
    fix: finding.fix,
    agentPrompt: finding.agentPrompt,
    cursorPrompt: finding.cursorPrompt,
    claudePrompt: finding.claudePrompt,
    windsurfPrompt: finding.windsurfPrompt,
    lovablePrompt: finding.agentPrompt,
    boltPrompt: finding.agentPrompt,
    verificationRule: null,
    pageUrl: null,
    confidence: 0.9,
    source: 'REPO',
  } as RankableFlag
}

export async function loadRepoFlagsForAudit(input: {
  userId: string | null
  auditUrl: string
}): Promise<RankableFlag[]> {
  if (!input.userId) return []

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, plan: true, role: true, subscriptionStatus: true },
  })
  if (!user || !canScanRepositories(user)) return []

  const host = canonicalProductHost(input.auditUrl)
  const recentScan = await prisma.repoScan.findFirst({
    where: {
      userId: input.userId,
      status: 'COMPLETED',
      ...(host
        ? {
            repoFullName: { contains: host.split('.')[0], mode: 'insensitive' as const },
          }
        : {}),
    },
    orderBy: { completedAt: 'desc' },
    include: {
      findings: {
        where: { severity: { in: ['CRITICAL', 'IMPORTANT'] } },
        orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
        take: 12,
      },
    },
  })

  if (!recentScan?.findings.length) return []
  return recentScan.findings.map(repoFindingToRankableFlag)
}
