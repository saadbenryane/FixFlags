import { describe, expect, it } from 'vitest'
import { buildReportShapeFromDb } from '@/lib/audit/build-report-shape'
import type { ShareStatus } from '@/lib/audit/rubric'

describe('buildReportShapeFromDb', () => {
  const sampleFlag = {
    id: 'flag-1',
    checkId: 'check-1',
    rubric: 'MESSAGE' as const,
    severity: 'HIGH' as const,
    impactTag: 'CONVERSION' as const,
    problem: 'Problem description',
    evidence: 'Evidence text',
    whyItMatters: 'Why it matters',
    fix: 'Fix suggestion',
    agentPrompt: 'Agent prompt',
    cursorPrompt: 'Cursor prompt',
    claudePrompt: 'Claude prompt',
    windsurfPrompt: 'Windsurf prompt',
    lovablePrompt: 'Lovable prompt',
    boltPrompt: 'Bolt prompt',
    verificationRule: 'Verification rule',
    pageUrl: 'https://example.com',
    confidence: 0.9,
    evidenceTargets: [{ kind: 'element', source: 'measured', device: 'desktop' }],
  }

  const sampleRubricRow = {
    id: 'row-1',
    name: 'MESSAGE',
    grade: 'B' as const,
    score: 75,
    status: 'NEEDS_WORK' as const,
    summary: 'Row summary',
    flags: [sampleFlag],
  }

  const sampleFlatFlags = [sampleFlag]

  const sampleShareStatus: ShareStatus = 'good_to_share'

  it('maps rubric rows with flags', () => {
    const result = buildReportShapeFromDb(
      [sampleRubricRow],
      sampleFlatFlags,
      sampleShareStatus
    )

    expect(result.rubricRows).toHaveLength(1)
    expect(result.rubricRows[0]).toEqual({
      id: 'row-1',
      name: 'MESSAGE',
      grade: 'B',
      score: 75,
      status: 'NEEDS_WORK',
      summary: 'Row summary',
      flags: [sampleFlag],
    })
  })

  it('maps flat flags to RankableFlag array', () => {
    const result = buildReportShapeFromDb(
      [sampleRubricRow],
      sampleFlatFlags,
      sampleShareStatus
    )

    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual(sampleFlag)
  })

  it('preserves share status', () => {
    const result = buildReportShapeFromDb(
      [sampleRubricRow],
      sampleFlatFlags,
      sampleShareStatus
    )

    expect(result.shareStatus).toEqual(sampleShareStatus)
  })

  it('handles multiple rubric rows', () => {
    const row2 = {
      ...sampleRubricRow,
      id: 'row-2',
      name: 'EXPERIENCE' as const,
      grade: 'A' as const,
      score: 90,
      status: 'GOOD' as const,
      summary: 'Experience summary',
      flags: [
        {
          ...sampleFlag,
          id: 'flag-2',
          rubric: 'EXPERIENCE' as const,
        },
      ],
    }

    const result = buildReportShapeFromDb(
      [sampleRubricRow, row2],
      [sampleFlag, { ...sampleFlag, id: 'flag-2', rubric: 'EXPERIENCE' as const }],
      sampleShareStatus
    )

    expect(result.rubricRows).toHaveLength(2)
    expect(result.rubricRows[0].name).toBe('MESSAGE')
    expect(result.rubricRows[1].name).toBe('EXPERIENCE')
    expect(result.flags).toHaveLength(2)
  })

  it('handles null grade and score', () => {
    const rowWithNulls = {
      ...sampleRubricRow,
      id: 'row-null',
      grade: null,
      score: null,
      status: null,
    }

    const result = buildReportShapeFromDb(
      [rowWithNulls],
      [],
      sampleShareStatus
    )

    expect(result.rubricRows[0].grade).toBeNull()
    expect(result.rubricRows[0].score).toBeNull()
    expect(result.rubricRows[0].status).toBeNull()
  })

  it('handles flags with null optional fields', () => {
    const flagWithNulls = {
      ...sampleFlag,
      id: 'flag-null',
      checkId: null,
      impactTag: null,
      agentPrompt: null,
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      verificationRule: null,
      pageUrl: null,
    }

    const result = buildReportShapeFromDb(
      [{ ...sampleRubricRow, flags: [flagWithNulls] }],
      [flagWithNulls],
      sampleShareStatus
    )

    expect(result.rubricRows[0].flags[0].checkId).toBeNull()
    expect(result.rubricRows[0].flags[0].impactTag).toBeNull()
    expect(result.rubricRows[0].flags[0].agentPrompt).toBeNull()
    expect(result.rubricRows[0].flags[0].pageUrl).toBeNull()
  })

  it('handles empty arrays', () => {
    const result = buildReportShapeFromDb([], [], sampleShareStatus)

    expect(result.rubricRows).toEqual([])
    expect(result.flags).toEqual([])
    expect(result.shareStatus).toEqual(sampleShareStatus)
  })

  it('returns correct RankableFlag type structure', () => {
    const result = buildReportShapeFromDb(
      [sampleRubricRow],
      sampleFlatFlags,
      sampleShareStatus
    )

    const flag = result.flags[0]
    expect(flag).toHaveProperty('id')
    expect(flag).toHaveProperty('checkId')
    expect(flag).toHaveProperty('rubric')
    expect(flag).toHaveProperty('severity')
    expect(flag).toHaveProperty('impactTag')
    expect(flag).toHaveProperty('problem')
    expect(flag).toHaveProperty('evidence')
    expect(flag).toHaveProperty('whyItMatters')
    expect(flag).toHaveProperty('fix')
    expect(flag).toHaveProperty('agentPrompt')
    expect(flag).toHaveProperty('cursorPrompt')
    expect(flag).toHaveProperty('claudePrompt')
    expect(flag).toHaveProperty('windsurfPrompt')
    expect(flag).toHaveProperty('lovablePrompt')
    expect(flag).toHaveProperty('boltPrompt')
    expect(flag).toHaveProperty('verificationRule')
    expect(flag).toHaveProperty('pageUrl')
    expect(flag).toHaveProperty('confidence')
    expect(flag).toHaveProperty('evidenceTargets')
  })
})
