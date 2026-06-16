import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractCtaElementsFromHtml,
  rankScoredCtaCandidate,
  scoreCtaCandidates,
} from '@/lib/audit/flow/score-cta-candidates'
import { flowCtaSelector } from '@/lib/audit/flow/discover-cta'

describe('flow CTA discovery scoring', () => {
  it('ranks signup CTA above footer links', () => {
    const html = `
      <body>
        <a href="/privacy">Privacy</a>
        <a href="/signup">Get started free</a>
        <button>Contact sales</button>
      </body>
    `
    const elements = extractCtaElementsFromHtml(html)
    const scored = scoreCtaCandidates('https://example.com', elements)
    const top = rankScoredCtaCandidate(scored)
    assert.ok(top)
    assert.equal(top.text, 'Get started free')
    assert.equal(top.score, 90)
  })

  it('skips dead href links but keeps actionable buttons', () => {
    const html = `
      <body>
        <a href="#">Get started</a>
        <button>Start free trial</button>
      </body>
    `
    const elements = extractCtaElementsFromHtml(html)
    const scored = scoreCtaCandidates('https://example.com', elements)
    assert.equal(scored.length, 1)
    assert.equal(scored[0].text, 'Start free trial')
  })

  it('builds stable data attribute selector', () => {
    assert.equal(flowCtaSelector(2), '[data-fixflags-flow-idx="2"]')
  })
})
