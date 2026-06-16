import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { ShareStatus } from '@/lib/audit/rubric'

export interface ReportRubricRow {
  id: string
  name: string
  grade: string | null
  score: number | null
  status: string | null
  summary: string
  flags: RankableFlag[]
}

export function buildReportShapeFromDb(
  rubricRowsRaw: Array<{
    id: string
    name: string
    grade: string | null
    score: number | null
    status: string | null
    summary: string
    flags: Array<{
      id: string
      rubric: string
      severity: string
      impactTag: string | null
      problem: string
      evidence: string
      whyItMatters: string
      fix: string
      agentPrompt: string | null
      cursorPrompt: string | null
      claudePrompt: string | null
      lovablePrompt: string | null
      boltPrompt: string | null
      verificationRule: string | null
      pageUrl: string | null
      confidence: number
    }>
  }>,
  flatFlags: Array<{
    id: string
    rubric: string
    severity: string
    impactTag: string | null
    problem: string
    evidence: string
    whyItMatters: string
    fix: string
    agentPrompt: string | null
    cursorPrompt: string | null
    claudePrompt: string | null
    lovablePrompt: string | null
    boltPrompt: string | null
    verificationRule: string | null
    pageUrl: string | null
    confidence: number
  }>,
  shareStatus: ShareStatus
): { rubricRows: ReportRubricRow[]; flags: RankableFlag[]; shareStatus: ShareStatus } {
  const mapFlag = (f: (typeof flatFlags)[number]): RankableFlag => ({
    id: f.id,
    rubric: f.rubric,
    severity: f.severity,
    impactTag: f.impactTag,
    problem: f.problem,
    evidence: f.evidence,
    whyItMatters: f.whyItMatters,
    fix: f.fix,
    agentPrompt: f.agentPrompt,
    cursorPrompt: f.cursorPrompt,
    claudePrompt: f.claudePrompt,
    lovablePrompt: f.lovablePrompt,
    boltPrompt: f.boltPrompt,
    verificationRule: f.verificationRule,
    pageUrl: f.pageUrl,
    confidence: f.confidence,
  })

  return {
    rubricRows: rubricRowsRaw.map((r) => ({
      id: r.id,
      name: r.name,
      grade: r.grade,
      score: r.score,
      status: r.status,
      summary: r.summary,
      flags: r.flags.map(mapFlag),
    })),
    flags: flatFlags.map(mapFlag),
    shareStatus,
  }
}
