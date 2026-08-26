import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
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
    fix: 'Replace the H1 with an audience-and-outcome statement.',
  }

  it('does not invent a box when the Flag was not measured', () => {
    const highlights = buildEvidenceHighlightsForFlag(flag, 0)
    assert.equal(highlights.length, 0)
  })

  it('uses measured evidence targets when present', () => {
    const highlights = buildEvidenceHighlightsForFlag(
      {
        ...flag,
        evidenceTargets: [
          {
            kind: 'element',
            source: 'measured',
            device: 'desktop',
            rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.08 },
            label: 'Headline',
          },
        ],
      },
      0
    )
    assert.equal(highlights.length, 1)
    assert.equal(highlights[0]?.scope, 'element')
    assert.equal(highlights[0]?.measured, true)
    assert.equal(highlights[0]?.x, 0.1)
    assert.equal(highlights[0]?.y, 0.2)
  })

  it('uses page scope for measured metadata checks', () => {
    const metaFlag = {
      ...flag,
      checkId: 'description-missing',
      rubric: 'REACH',
      evidenceTargets: [
        {
          kind: 'page' as const,
          source: 'measured' as const,
          device: 'desktop' as const,
          label: 'This issue is in the page head, not a visible element',
        },
      ],
    }
    const highlights = buildEvidenceHighlightsForFlag(metaFlag, 0)
    assert.equal(highlights[0]?.scope, 'page')
    assert.equal(highlights[0]?.measured, true)
  })

  it('formats evidence and fix prompts with expert copy', () => {
    const evidence = formatFlagEvidence(flag)
    assert.match(evidence, /Headline reads|H1|category/i)

    const fix = formatFlagFixPrompt(flag)
    assert.match(fix, /This is a FixFlags finding from the live page/)
    assert.match(fix, /Task:/)
    assert.match(fix, /Make a short plan/)
    assert.doesNotMatch(fix, /^## Goal$/m)
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
