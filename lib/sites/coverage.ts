import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { cardAreaForCheck } from '@/lib/sites/card-areas'

export type CoverageFact = {
  area: SiteCardArea
  state: CardHealthState
  label: string
  detail: string | null
  checkedAt: string | null
  openFlagCount: number
  score: number | null
}

export type SiteFlagSeed = {
  id: string
  improvementId: string | null
  checkId: string | null
  rubric: string
  severity: string
  impactTag: string | null
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  pageUrl: string | null
  status: string
  area: SiteCardArea
}

export function buildCoverageFacts(input: {
  auditStatus: string
  completedAt: Date | null
  evidenceCoverage: unknown
  flags: Array<{
    checkId: string | null
    rubric: string
    severity: string
    impactTag: string | null
    status?: string | null
  }>
  rubrics: Array<{ name: string; score: number | null }>
}): CoverageFact[] {
  const checking = !['COMPLETED', 'FAILED', 'PARTIAL'].includes(input.auditStatus)
  const checkedAt = input.completedAt?.toISOString() ?? null
  const openByArea = new Map<SiteCardArea, number>()

  for (const flag of input.flags) {
    if (flag.status && flag.status !== 'OPEN' && flag.status !== 'open') continue
    const area = cardAreaForCheck(flag)
    openByArea.set(area, (openByArea.get(area) ?? 0) + 1)
  }

  const rubricScore = (name: string) =>
    input.rubrics.find((r) => r.name === name)?.score ?? null

  const areas: SiteCardArea[] = [
    'security',
    'search',
    'performance',
    'conversion',
    'tracking',
    'uptime',
    'accessibility',
  ]

  return areas.map((area) => {
    const openFlagCount = openByArea.get(area) ?? 0
    let score: number | null = null
    if (area === 'conversion') score = rubricScore('MESSAGE')
    if (area === 'performance') score = rubricScore('EXPERIENCE')
    if (area === 'search' || area === 'tracking' || area === 'security') {
      score = rubricScore('REACH')
    }

    let state: CardHealthState = 'unknown'
    let label = 'Not checked yet'
    let detail: string | null = null

    if (checking) {
      state = 'checking'
      label = 'Checking'
      detail = 'Live analysis in progress'
    } else if (input.auditStatus === 'FAILED') {
      state = 'unknown'
      label = 'Couldn’t verify'
      detail = 'This analysis did not finish'
    } else if (openFlagCount > 0) {
      const criticalish = input.flags.some(
        (f) =>
          cardAreaForCheck(f) === area &&
          (f.severity === 'CRITICAL' || f.severity === 'IMPORTANT')
      )
      state = criticalish ? 'problem' : 'attention'
      label = openFlagCount === 1 ? '1 thing needs attention' : `${openFlagCount} things need attention`
      detail = score != null ? `Score ${score}` : null
    } else if (checkedAt) {
      state = 'healthy'
      label = 'Looking good'
      detail = score != null ? `Score ${score}` : 'Latest check passed for this area'
    }

    return {
      area,
      state,
      label,
      detail,
      checkedAt,
      openFlagCount,
      score,
    }
  })
}
