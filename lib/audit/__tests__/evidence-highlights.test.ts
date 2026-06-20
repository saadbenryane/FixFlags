import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEvidenceHighlightsForFlag,
  formatFlagEvidence,
  formatFlagFixPrompt,
  parseEvidenceAnchorsFromPerformanceData,
} from '@/lib/audit/evidence-highlights'

describe('evidence-highlights', () => {
  const flag = {
    id: 'flag-1',
    checkId: 'h1-generic',
    rubric: 'MESSAGE',
    severity: 'IMPORTANT',
    problem: 'Headline is generic',
    evidence: 'Headline reads a category label, not an outcome.',
  }

  it('builds preset element highlights without anchors', () => {
    const highlights = buildEvidenceHighlightsForFlag(flag, 0)
    assert.ok(highlights.length >= 1)
    assert.equal(highlights[0]?.scope, 'element')
    assert.equal(highlights[0]?.flagId, 'flag-1')
    assert.match(highlights[0]?.visualTarget ?? '', /Hero headline/i)
  })

  it('uses page scope for metadata checks', () => {
    const metaFlag = {
      ...flag,
      checkId: 'description-missing',
      rubric: 'REACH',
    }
    const highlights = buildEvidenceHighlightsForFlag(metaFlag, 0)
    assert.equal(highlights[0]?.scope, 'page')
  })

  it('formats evidence and fix prompts with expert copy', () => {
    const evidence = formatFlagEvidence(flag)
    assert.match(evidence, /Headline reads|H1|category/i)

    const fix = formatFlagFixPrompt(flag, 'Rewrite the headline with a concrete outcome.')
    assert.match(fix, /Why:/)
    assert.match(fix, /Do:/)
    assert.match(fix, /Verify:/)
    assert.doesNotMatch(fix, /look at Hero headline on the screenshot/i)
  })

  it('parses evidence anchors from performance data', () => {
    const parsed = parseEvidenceAnchorsFromPerformanceData({
      desktop: null,
      evidenceAnchors: {
        'h1-generic': {
          desktop: { x: 0.5, y: 0.3, width: 0.8, height: 0.1 },
        },
      },
    })
    assert.ok(parsed?.['h1-generic']?.desktop)
  })
})
