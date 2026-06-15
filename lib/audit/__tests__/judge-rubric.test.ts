import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  GRADE_THRESHOLDS,
  LAUNCH_CHECKLIST_IDS,
  REQUIRED_JUDGE_AREAS,
  SUBJECTIVE_AREA_RUBRIC,
  SUBJECTIVE_JUDGE_AREAS,
  formatRubricForJudgePrompt,
} from '@/lib/audit/rubric'
import { AREA_ORDER } from '@/lib/audit/constants'
import { buildJudgePrompt } from '@/lib/prompts/system-prompt'
import { gradeFromScore } from '@/lib/audit/scoring'
import { allCheckIdsHaveVerificationRules, verificationRuleForCheckId } from '@/lib/audit/verify-findings'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'

describe('judge rubric constants', () => {
  it('requires all seven areas in judge output', () => {
    assert.deepEqual([...REQUIRED_JUDGE_AREAS], [...AREA_ORDER])
    assert.equal(REQUIRED_JUDGE_AREAS.length, 7)
  })

  it('defines five launch checklist gates', () => {
    assert.equal(LAUNCH_CHECKLIST_IDS.length, 5)
    assert.deepEqual(LAUNCH_CHECKLIST_IDS, [
      'https',
      'social-preview',
      'mobile-cta',
      'console-errors',
      'privacy-contact',
    ])
  })

  it('aligns grade thresholds with scoring module', () => {
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.A), 'A')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.B), 'B')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.C), 'C')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.D), 'D')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.D - 1), 'F')
  })

  it('defines conversion, trust, and content criteria', () => {
    for (const area of SUBJECTIVE_JUDGE_AREAS) {
      assert.ok(SUBJECTIVE_AREA_RUBRIC[area].length >= 3, `${area} needs rubric bullets`)
    }
  })

  it('injects rubric into judge prompt', () => {
    const prompt = buildJudgePrompt({
      url: 'https://example.com',
      pageText: 'Example',
      metadata: {
        title: 'Example',
        description: 'Desc',
        h1s: ['Hello'],
        ctaTexts: ['Start'],
        hasStructuredData: true,
      },
      scores: {
        desktopPerf: 80,
        mobilePerf: 70,
        mobileLcp: 2500,
        desktopLcp: 2000,
        cls: 0.05,
      },
      topOpportunities: [],
      deterministicFindings: [],
    })

    assert.ok(prompt.includes('CONVERSION:'))
    assert.ok(prompt.includes('Primary CTA visible above the fold'))
    assert.ok(prompt.includes('color contrast'))
    assert.ok(prompt.includes('launch checklist IDs must be exactly'))
  })

  it('formatRubricForJudgePrompt includes subjective and objective sections', () => {
    const text = formatRubricForJudgePrompt()
    assert.ok(text.includes('Subjective area rubric'))
    assert.ok(text.includes('Objective area rubric'))
    assert.ok(text.includes('TRUST:'))
    assert.ok(text.includes('MOBILE:'))
  })
})

describe('verification rules completeness', () => {
  it('covers every deterministic checkId', () => {
    assert.equal(allCheckIdsHaveVerificationRules(), true)
    for (const checkId of ALL_CHECK_IDS) {
      const rule = verificationRuleForCheckId(checkId)
      assert.ok(rule, `missing verification rule for ${checkId}`)
      assert.ok(rule.length > 10, `verification rule too short for ${checkId}`)
    }
  })
})
