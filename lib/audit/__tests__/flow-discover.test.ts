import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  extractCtaElementsFromHtml,
  rankScoredCtaCandidate,
  scoreCtaCandidates,
} from '@/lib/audit/flow/score-cta-candidates'
import { flowCtaSelector } from '@/lib/audit/flow/discover-cta'
import { isAuthUtilityLink, isExternalBookingHref, scoreCtaLink } from '@/lib/audit/flow/link-scoring'
import { runFlowChecks } from '@/lib/audit/checks/flow'

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
    assert.equal(top.score, 95)
  })

  it('ranks Book a call above header Login', () => {
    const html = `
      <body>
        <header><nav><a href="/login">Login</a></nav></header>
        <main>
          <h1>From vision to reality</h1>
          <a href="https://calendly.com/demo">Book a call</a>
        </main>
      </body>
    `
    const elements = extractCtaElementsFromHtml(html)
    const scored = scoreCtaCandidates('https://example.com', elements)
    const top = rankScoredCtaCandidate(scored)
    assert.ok(top)
    assert.equal(top.text, 'Book a call')
    assert.ok(top.score > scoreCtaLink('/login', 'Login'))
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

describe('flow auth utility handling', () => {
  it('identifies login links as auth utility', () => {
    assert.equal(isAuthUtilityLink('/login', 'Login'), true)
    assert.equal(isAuthUtilityLink('#', 'Book a call'), false)
  })

  it('does not flag dead_end when an auth link was tested (fallback path)', () => {
    const flags = runFlowChecks({
      status: 'dead_end',
      steps: [],
      finalUrl: 'https://example.com',
      ctaText: 'Login',
      ctaHref: '/login',
    })
    assert.equal(flags.length, 0)
  })

  it('treats external booking hrefs as intentional conversion paths', () => {
    assert.equal(
      isExternalBookingHref('https://calendar.app.google/5ybQ7ahxCmMpMqq66'),
      true
    )
  })
})
