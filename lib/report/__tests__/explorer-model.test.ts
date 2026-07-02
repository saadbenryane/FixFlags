import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { buildLiveExplorerModel, buildPartialExplorerModel } from '@/lib/report/explorer-model'

describe('explorer-model', () => {
  it('builds live explorer model with sorted flags and highlights', () => {
    const model = buildLiveExplorerModel({
      url: 'https://example.com',
      pageType: 'Landing page',
      score: 72,
      verdict: 'Needs work before launch.',
      flags: [
        {
          id: 'f1',
          checkId: 'h1-generic',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          problem: 'Generic headline',
          evidence: 'Headline is vague.',
          whyItMatters: 'Visitors bounce.',
          fix: 'Rewrite headline.',
        },
        {
          id: 'f2',
          checkId: 'cta-below-fold-mobile',
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          problem: 'CTA below fold',
          evidence: 'Button at 900px.',
          whyItMatters: 'Mobile users miss CTA.',
          fix: 'Move CTA up.',
        },
      ],
      screenshots: [
        { device: 'DESKTOP', url: '/desktop.png', width: 1280, height: 900 },
        { device: 'MOBILE', url: '/mobile.png', width: 375, height: 812 },
      ],
      rubricRows: [
        { name: 'MESSAGE', score: 70, grade: 'C' },
        { name: 'EXPERIENCE', score: 60, grade: 'D' },
        { name: 'REACH', score: 80, grade: 'B' },
      ],
    })

    assert.equal(model.displayHost, 'example.com')
    assert.equal(model.flags.length, 2)
    assert.equal(model.flags[0]?.severity, 'CRITICAL')
    assert.equal(model.flags[1]?.severity, 'IMPORTANT')
    assert.ok(model.allHighlights.length >= 2)
    assert.match(model.flags[0]?.evidence ?? '', /900px|Button/)
    assert.match(model.flags[0]?.fixPrompt ?? '', /Why it matters:/)
    assert.equal(model.flags[0]?.copyFixPrompt, model.flags[0]?.fixPrompt)
  })

  it('builds partial explorer model when flags exist', () => {
    const model = buildPartialExplorerModel({
      url: 'https://example.com',
      pageType: 'Landing page',
      score: 55,
      flags: [
        {
          id: 'f1',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          problem: 'Generic headline',
        },
      ],
      rubrics: [{ name: 'MESSAGE', score: 55, grade: 'D' }],
    })

    assert.ok(model)
    assert.equal(model?.flags.length, 1)
    assert.equal(model?.flags[0]?.title, 'Generic headline')
  })

  it('returns null partial explorer model without flags', () => {
    assert.equal(
      buildPartialExplorerModel({
        url: 'https://example.com',
        flags: [],
      }),
      null
    )
  })
})
