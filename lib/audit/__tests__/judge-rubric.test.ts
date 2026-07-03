import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  GRADE_THRESHOLDS,
  LAUNCH_CHECKLIST_IDS,
  REQUIRED_JUDGE_RUBRICS,
  RUBRIC_JUDGE_CRITERIA,
  formatRubricForJudgePrompt,
} from '@/lib/audit/rubric'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { buildJudgePrompt } from '@/lib/prompts/system-prompt'
import { gradeFromScore } from '@/lib/audit/scoring'
import { allCheckIdsHaveVerificationRules, verificationRuleForCheckId } from '@/lib/audit/verification-rules'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'

const judgeContext = {
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
  deterministicFlags: [],
}

describe('judge rubric constants', () => {
  it('requires all three rubrics in judge output', () => {
    assert.deepEqual([...REQUIRED_JUDGE_RUBRICS], [...RUBRIC_ORDER])
    assert.equal(REQUIRED_JUDGE_RUBRICS.length, 3)
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

  it('defines MESSAGE, EXPERIENCE, and REACH criteria', () => {
    for (const rubric of RUBRIC_ORDER) {
      assert.ok(RUBRIC_JUDGE_CRITERIA[rubric].length >= 3, `${rubric} needs rubric bullets`)
    }
  })

  it('includes criteria for every rubric in the judge prompt', () => {
    const prompt = formatRubricForJudgePrompt()
    for (const rubric of RUBRIC_ORDER) {
      assert.match(prompt, new RegExp(`${rubric}:`))
    }
  })

  it('buildJudgePrompt references rubrics and flags', () => {
    const prompt = buildJudgePrompt(judgeContext)
    assert.match(prompt, /MESSAGE/)
    assert.match(prompt, /newFlags/)
    assert.match(prompt, /FixFlags/)
  })

  it('aligns grade thresholds with scoring module', () => {
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.A), 'A')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.B), 'B')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.C), 'C')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.D), 'D')
    assert.equal(gradeFromScore(GRADE_THRESHOLDS.D - 1), 'F')
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
