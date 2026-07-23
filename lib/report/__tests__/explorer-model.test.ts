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
    assert.match(model.flags[0]?.fixPrompt ?? '', /^## Why$/m)
    assert.equal(model.flags[0]?.copyFixPrompt, model.flags[0]?.fixPrompt)
  })

  it('maps flagVisualEvidence gif/overlay onto visualUrl', () => {
    const model = buildLiveExplorerModel({
      url: 'https://example.com',
      pageType: 'Landing page',
      score: 72,
      verdict: 'Needs work.',
      flags: [
        {
          id: 'f1',
          checkId: 'cta-below-fold-mobile',
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          problem: 'CTA below fold',
          evidence: 'Button at 900px.',
          whyItMatters: 'Mobile users miss CTA.',
          fix: 'Move CTA up.',
        },
      ],
      rubricRows: [
        { name: 'MESSAGE', score: 70, grade: 'C' },
        { name: 'EXPERIENCE', score: 60, grade: 'D' },
        { name: 'REACH', score: 80, grade: 'B' },
      ],
      flagVisualEvidence: {
        'cta-below-fold-mobile': {
          gifUrl: 'https://cdn.example.com/cta.gif',
          overlayUrl: 'https://cdn.example.com/cta.png',
        },
      },
    })

    assert.equal(model.flags[0]?.visualUrl, 'https://cdn.example.com/cta.gif')
  })

  it('keeps every anonymous Flag and its evidence while exposing exactly one prompt', () => {
    const model = buildLiveExplorerModel({
      url: 'https://example.com',
      pageType: 'Landing page',
      score: 61,
      verdict: 'Several fixes remain.',
      promptAccess: 'one',
      demonstratedFlag: {
        id: 'f2',
        checkId: 'cta-below-fold-mobile',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'CTA below fold',
        evidence: 'The CTA starts below the 812px mobile viewport.',
        fix: 'Move the CTA above the fold.',
        agentPrompt: 'Move the primary CTA into the initial mobile viewport.',
      },
      flags: [
        {
          id: 'f1',
          checkId: 'h1-generic',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          problem: 'Generic headline',
          evidence: 'The H1 names a category but no outcome.',
          fix: 'Name the outcome.',
          agentPrompt: 'Rewrite the headline around the user outcome.',
        },
        {
          id: 'f2',
          checkId: 'cta-below-fold-mobile',
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          problem: 'CTA below fold',
          evidence: 'The CTA starts below the 812px mobile viewport.',
          fix: 'Move the CTA above the fold.',
          agentPrompt: 'Move the primary CTA into the initial mobile viewport.',
        },
        {
          id: 'f3',
          checkId: 'title-too-short',
          rubric: 'REACH',
          severity: 'POLISH',
          problem: 'Search title is too short',
          evidence: 'The title contains only eight characters.',
          fix: 'Write a descriptive search title.',
          agentPrompt: 'Expand the title with the product and outcome.',
        },
      ],
      rubricRows: [
        { name: 'MESSAGE', score: 65, grade: 'D' },
        { name: 'EXPERIENCE', score: 50, grade: 'F' },
        { name: 'REACH', score: 70, grade: 'C' },
      ],
    })

    assert.equal(model.flags.length, 3)
    assert.ok(model.flags.every((flag) => flag.evidence.length > 0))
    assert.deepEqual(
      model.flags.filter((flag) => flag.hasFixPrompt).map((flag) => flag.id),
      ['f2']
    )
    assert.equal(model.flags.find((flag) => flag.id === 'f1')?.fixPrompt, '')
    assert.equal(model.flags.find((flag) => flag.id === 'f3')?.copyFixPrompt, '')
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

  it('orders same-severity flags by impact and confidence for the default opened fix', () => {
    const model = buildLiveExplorerModel({
      url: 'https://example.com',
      pageType: 'Landing page',
      score: 68,
      verdict: 'Needs focused improvements.',
      flags: [
        {
          id: 'seo-polish',
          checkId: 'title-too-short',
          rubric: 'REACH',
          severity: 'POLISH',
          impactTag: 'SEO',
          problem: 'Title is short',
          evidence: 'Title is 8 characters.',
          whyItMatters: 'Search snippets underperform.',
          fix: 'Write a more specific title.',
          confidence: 0.95,
        },
        {
          id: 'conversion-polish-low-confidence',
          checkId: 'friction-no-social-proof',
          rubric: 'MESSAGE',
          severity: 'POLISH',
          impactTag: 'CONVERSION',
          problem: 'No proof near CTA',
          evidence: 'CTA has no proof nearby.',
          whyItMatters: 'Proof reduces risk.',
          fix: 'Add substantiated proof near the CTA.',
          confidence: 0.4,
        },
        {
          id: 'conversion-polish-high-confidence',
          checkId: 'mobile-cta-weak-label',
          rubric: 'MESSAGE',
          severity: 'POLISH',
          impactTag: 'CONVERSION',
          problem: 'CTA label is vague',
          evidence: 'CTA says "Click here".',
          whyItMatters: 'Vague CTAs reduce intent.',
          fix: 'Use outcome-specific CTA copy.',
          confidence: 0.9,
        },
      ],
      rubricRows: [
        { name: 'MESSAGE', score: 70, grade: 'C' },
        { name: 'EXPERIENCE', score: 75, grade: 'B' },
        { name: 'REACH', score: 80, grade: 'B' },
      ],
    })

    assert.deepEqual(
      model.flags.map((flag) => flag.id),
      ['conversion-polish-high-confidence', 'conversion-polish-low-confidence', 'seo-polish']
    )
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
