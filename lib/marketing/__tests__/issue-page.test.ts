import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  humanizeCheckId,
  issuePageTitle,
  issuePageDescription,
  rubricLabel,
  rubricBadgeClasses,
} from '@/lib/marketing/issue-page'

describe('humanizeCheckId', () => {
  it('splits kebab-case into title case', () => {
    assert.equal(humanizeCheckId('mobile-lcp-critical'), 'Mobile LCP Critical')
  })

  it('uppercases known acronyms', () => {
    assert.equal(humanizeCheckId('skip-link-missing'), 'Skip Link Missing')
    assert.equal(humanizeCheckId('color-contrast-poor'), 'Color Contrast Poor')
  })

  it('handles acronyms: LCP, CLS, FID, INP, TTFB', () => {
    assert.equal(humanizeCheckId('mobile-lcp-critical'), 'Mobile LCP Critical')
    assert.equal(humanizeCheckId('layout-cls-bad'), 'Layout CLS Bad')
    assert.equal(humanizeCheckId('fid-slow'), 'FID Slow')
    assert.equal(humanizeCheckId('inp-high'), 'INP High')
    assert.equal(humanizeCheckId('ttfb-slow'), 'TTFB Slow')
  })

  it('handles acronyms: SEO, CSP, OG, CTA, UX, AI, API, MCP', () => {
    assert.equal(humanizeCheckId('seo-title-missing'), 'SEO Title Missing')
    assert.equal(humanizeCheckId('csp-missing'), 'CSP Missing')
    assert.equal(humanizeCheckId('og-image-missing'), 'OG Image Missing')
    assert.equal(humanizeCheckId('cta-vague'), 'CTA Vague')
    assert.equal(humanizeCheckId('ux-friction'), 'UX Friction')
    assert.equal(humanizeCheckId('ai-summary-missing'), 'AI Summary Missing')
    assert.equal(humanizeCheckId('api-endpoint-unauthenticated'), 'API Endpoint Unauthenticated')
    assert.equal(humanizeCheckId('mcp-tool-missing'), 'MCP Tool Missing')
  })

  it('handles simple single-word checkId', () => {
    assert.equal(humanizeCheckId('performance'), 'Performance')
  })

  it('handles empty string', () => {
    assert.equal(humanizeCheckId(''), '')
  })

  it('handles checkId with :: fingerprint suffix', () => {
    assert.equal(humanizeCheckId('security-headers-missing::page:1'), 'Security Headers Missing::page:1')
  })
})

describe('issuePageTitle', () => {
  it('uses checkId for stable title', () => {
    const title = issuePageTitle({ checkId: 'color-contrast-poor', problemTemplate: '7 elements fail contrast' })
    assert.equal(title, 'Color Contrast Poor - FixFlags Issue')
  })

  it('ignores problemTemplate even when long', () => {
    const title = issuePageTitle({ checkId: 'skip-link-missing', problemTemplate: 'No skip link found on page with 47 elements' })
    assert.equal(title, 'Skip Link Missing - FixFlags Issue')
  })
})

describe('issuePageDescription', () => {
  it('includes problem text, site count, occurrences, rubric', () => {
    const desc = issuePageDescription({
      problemTemplate: 'Elements must meet minimum color contrast ratio thresholds',
      siteCount: 22,
      occurrenceCount: 44,
      rubric: 'EXPERIENCE',
    })
    assert.match(desc, /Elements must meet minimum color contrast ratio thresholds/)
    assert.match(desc, /22 audited sites/)
    assert.match(desc, /44 observations/)
    assert.match(desc, /EXPERIENCE rubric/)
    assert.match(desc, /Free check with FixFlags/)
  })

  it('truncates long problem text to 120 chars', () => {
    const long = 'A very long problem template that goes on and on about various issues that need to be fixed across multiple different page types and layouts for better accessibility'.repeat(2)
    const desc = issuePageDescription({
      problemTemplate: long,
      siteCount: 5,
      occurrenceCount: 10,
      rubric: 'MESSAGE',
    })
    assert.ok(desc.length < long.length)
    assert.match(desc, /Free check with FixFlags/)
  })
})

describe('rubricLabel', () => {
  it('formats MESSAGE', () => {
    assert.equal(rubricLabel('MESSAGE'), 'Message')
  })

  it('formats EXPERIENCE', () => {
    assert.equal(rubricLabel('EXPERIENCE'), 'Experience')
  })

  it('formats REACH', () => {
    assert.equal(rubricLabel('REACH'), 'Reach')
  })

  it('handles lowercase input', () => {
    assert.equal(rubricLabel('message'), 'Message')
    assert.equal(rubricLabel('experience'), 'Experience')
    assert.equal(rubricLabel('reach'), 'Reach')
  })

  it('falls through for unknown rubric', () => {
    assert.equal(rubricLabel('UNKNOWN'), 'Unknown')
  })
})

describe('rubricBadgeClasses', () => {
  it('returns brand classes for MESSAGE', () => {
    const classes = rubricBadgeClasses('MESSAGE')
    assert.match(classes, /bg-brand-muted/)
    assert.match(classes, /text-brand/)
    assert.match(classes, /border-brand-border/)
  })

  it('returns warning classes for EXPERIENCE', () => {
    const classes = rubricBadgeClasses('EXPERIENCE')
    assert.match(classes, /bg-warning-muted/)
    assert.match(classes, /text-warning-foreground/)
    assert.match(classes, /border-warning-border/)
  })

  it('returns success classes for REACH', () => {
    const classes = rubricBadgeClasses('REACH')
    assert.match(classes, /bg-success-muted/)
    assert.match(classes, /text-success/)
    assert.match(classes, /border-success-border/)
  })

  it('returns muted fallback for unknown rubric', () => {
    const classes = rubricBadgeClasses('UNKNOWN' as string)
    assert.match(classes, /bg-muted/)
    assert.match(classes, /text-muted-foreground/)
  })
})
