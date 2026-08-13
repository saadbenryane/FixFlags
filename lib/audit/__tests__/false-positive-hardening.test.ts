import { describe, expect, it } from 'vitest'
import { isDeadHref, isNonPageActionHref, classifyCtaHref } from '@/lib/audit/flow/link-scoring'
import { scoreCtaCandidates } from '@/lib/audit/flow/score-cta-candidates'
import { runSlopChecks } from '@/lib/audit/checks/slop'
import { runLayoutChecks } from '@/lib/audit/checks/layout'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { validateTriageOutput } from '@/lib/audit/validate-triage-output'
import { diffMatchKey } from '@/lib/audit/diff-flags'
import type { PageMetadata } from '@/lib/audit/metadata'
import type { CaptureMetrics } from '@/lib/audit/capture-metrics'
import type { DeterministicFlag } from '@/lib/audit/flag-types'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'

function meta(overrides: Partial<PageMetadata> = {}): PageMetadata {
  return {
    title: 'Profilium',
    description: 'AI product intelligence',
    h1s: ['Profilium'],
    pageText: 'Contact our team today to get started.',
    links: [
      { href: 'mailto:contact@profilium.co', text: 'Contact' },
      { href: 'tel:+15555551212', text: 'Call us' },
      { href: '#', text: 'Get started' },
      { href: '/pricing', text: 'View pricing' },
    ],
    elementIds: ['pricing'],
    ctaTexts: ['Get started'],
    hasStructuredData: false,
    hasPrivacyPolicy: true,
    hasContactInfo: true,
    ...overrides,
  } as PageMetadata
}

function captureMetrics(overrides: Partial<CaptureMetrics> = {}): CaptureMetrics {
  return {
    mobilePrimaryCtaTopPx: 400,
    mobilePrimaryCtaText: 'Get started',
    competingPrimaryCtaCount: 1,
    competingPrimaryCtaLabels: ['Get started'],
    mobileViewportHeight: 812,
    mobileScrollY: 0,
    mobileDocumentHeight: 4000,
    stuckLoadingIndicator: false,
    stuckLoadingLabel: null,
    uniqueFontFamilies: 2,
    fontFamilySample: ['Inter'],
    buttonBorderRadii: [8],
    motionIgnoresReducedPreference: false,
    motionSampleLabel: null,
    inputsBelow16px: [],
    loadExperience: null,
    ...overrides,
  }
}

function checkIds(findings: Array<{ checkId: string }>): string[] {
  return findings.map((f) => f.checkId)
}

describe('mailto:/tel: are not dead links (profilium cta-dead-link false positive)', () => {
  it('classifies mailto/tel/sms as intentional actions, not placeholders', () => {
    for (const href of ['mailto:contact@profilium.co', 'tel:+15555551212', 'sms:+15555551212']) {
      expect(isDeadHref(href)).toBe(false)
      expect(isNonPageActionHref(href)).toBe(true)
      expect(classifyCtaHref(href).isPlaceholder).toBe(false)
    }
  })

  it('still treats empty, #, and javascript: hrefs as dead', () => {
    expect(isDeadHref('')).toBe(true)
    expect(isDeadHref('#')).toBe(true)
    expect(isDeadHref('javascript:void(0)')).toBe(true)
    expect(isDeadHref('about:blank')).toBe(true)
    expect(isDeadHref('/pricing')).toBe(false)
    expect(isDeadHref('https://app.profilium.co/signup')).toBe(false)
  })

  it('does not fire cta-dead-link for a mailto or tel CTA', () => {
    const findings = runSlopChecks(
      meta({ links: [{ href: 'mailto:contact@profilium.co', text: 'Contact', rel: null }, { href: 'tel:+15555551212', text: 'Call us', rel: null }] })
    )
    expect(checkIds(findings)).not.toContain('cta-dead-link')
  })

  it('still fires cta-dead-link for an empty-destination CTA', () => {
    const findings = runSlopChecks(meta({ links: [{ href: '#', text: 'Get started', rel: null }] }))
    expect(checkIds(findings)).toContain('cta-dead-link')
  })

  it('flow CTA scoring never selects a mailto link as the page-navigation CTA', () => {
    const candidates = scoreCtaCandidates('https://app.profilium.co/', [
      { idx: 0, tag: 'a', text: 'Contact sales', href: 'mailto:sales@profilium.co' },
      { idx: 1, tag: 'a', text: 'Get started', href: '/signup' },
    ])
    expect(candidates.map((c) => c.href)).toEqual(['https://app.profilium.co/signup'])
  })
})

describe('scroll-depth sanity caps (profilium 10243px on 812px viewport)', () => {
  it('never reports CRITICAL for a CTA far beyond two screens of scroll', () => {
    const flags = runLayoutChecks(
      captureMetrics({
        mobilePrimaryCtaTopPx: 10243,
        mobilePrimaryCtaText: 'Pricing',
        mobileViewportHeight: 812,
        mobileDocumentHeight: 12000,
      })
    )
    expect(checkIds(flags)).toContain('cta-below-fold-mobile')
    expect(flags[0]?.severity).toBe('IMPORTANT')
  })

  it('keeps CRITICAL for a CTA just below the fold', () => {
    const flags = runLayoutChecks(
      captureMetrics({
        mobilePrimaryCtaTopPx: 900,
        mobilePrimaryCtaText: 'Get started',
        mobileViewportHeight: 812,
        mobileDocumentHeight: 4000,
      })
    )
    expect(flags[0]?.severity).toBe('CRITICAL')
  })

  it('suppresses the flag when the measurement is impossible (beyond document height)', () => {
    expect(
      runLayoutChecks(
        captureMetrics({
          mobilePrimaryCtaTopPx: 15000,
          mobileViewportHeight: 812,
          mobileDocumentHeight: 12000,
        })
      )
    ).toHaveLength(0)
  })

  it('suppresses the flag when viewport or document height is unusable', () => {
    expect(
      runLayoutChecks(
        captureMetrics({ mobilePrimaryCtaTopPx: 900, mobileViewportHeight: 0, mobileDocumentHeight: 4000 })
      )
    ).toHaveLength(0)
    expect(
      runLayoutChecks(
        captureMetrics({ mobilePrimaryCtaTopPx: 900, mobileViewportHeight: 812, mobileDocumentHeight: 0 })
      )
    ).toHaveLength(0)
  })
})

describe('flow-cta-unclickable probe reliability', () => {
  it('does not fire CRITICAL when the element never existed (probe artifact)', () => {
    const flags = runFlowChecks({
      status: 'unclickable',
      steps: [],
      finalUrl: 'https://app.profilium.co/',
      ctaText: 'Get started',
      clickFailure: 'element_missing',
    })
    expect(checkIds(flags)).not.toContain('flow-cta-unclickable')
    expect(checkIds(flags)).not.toContain('overlay-blocks-cta')
  })

  it('still fires the overlay flag when an overlay blocked the CTA', () => {
    const flags = runFlowChecks({
      status: 'unclickable',
      steps: [],
      finalUrl: 'https://app.profilium.co/',
      ctaText: 'Get started',
      overlayBlocker: {
        tag: 'div',
        id: 'cookie-banner',
        className: 'banner',
        role: null,
        text: 'Accept cookies',
        zIndex: '999',
      },
    })
    expect(checkIds(flags)).toContain('overlay-blocks-cta')
    expect(checkIds(flags)).not.toContain('flow-cta-unclickable')
  })

  it('reports a real interaction error at honest confidence with the error text', () => {
    const flags = runFlowChecks({
      status: 'unclickable',
      steps: [],
      finalUrl: 'https://app.profilium.co/',
      ctaText: 'Get started',
      clickFailure: 'interaction_error',
      clickError: 'element is not stable - waiting for animations to finish',
    })
    const flag = flags.find((f) => f.checkId === 'flow-cta-unclickable')
    expect(flag?.confidence).toBe(0.85)
    expect(flag?.evidence).toContain('element is not stable')
  })

  it('keeps the legacy unclassified unclickable path flagged', () => {
    const flags = runFlowChecks({
      status: 'unclickable',
      steps: [],
      finalUrl: 'https://app.profilium.co/',
      ctaText: 'Get started',
    })
    expect(checkIds(flags)).toContain('flow-cta-unclickable')
  })
})

describe('AI triage confidence gate (CRITICAL needs corroboration-grade confidence)', () => {
  const deterministic: DeterministicFlag[] = []

  function triageWithFlag(severity: 'CRITICAL' | 'IMPORTANT', confidence: number): TriageOutput {
    return {
      pageJob: 'Sell product intelligence',
      pageType: 'homepage',
      verdict: 'Solid start.',
      score: 72,
      launchReadiness: 'fix_first',
      launchChecklist: [
        { id: 'https', label: 'HTTPS', passed: true },
        { id: 'social-preview', label: 'Social preview', passed: true },
        { id: 'mobile-cta', label: 'Mobile CTA', passed: true },
        { id: 'console-errors', label: 'Console errors', passed: true },
        { id: 'privacy-contact', label: 'Privacy & contact', passed: true },
      ],
      rubrics: [
        {
          name: 'MESSAGE',
          score: 60,
          grade: 'C',
          status: 'NEEDS_WORK',
          assessmentState: 'ASSESSED',
          confidence: 0.8,
          summary: 'Generic copy.',
        },
        {
          name: 'EXPERIENCE',
          score: 70,
          grade: 'B',
          status: 'GOOD',
          assessmentState: 'ASSESSED',
          confidence: 0.8,
          summary: 'Decent.',
        },
        {
          name: 'REACH',
          score: 80,
          grade: 'B',
          status: 'GOOD',
          assessmentState: 'ASSESSED',
          confidence: 0.8,
          summary: 'Fine.',
        },
      ],
      newFlags: [
        {
          rubric: 'MESSAGE',
          impactTag: 'CLARITY',
          severity,
          problem: 'Hero headline reads like a generic template phrase',
          evidence: 'H1: "Welcome to the future" appears generic.',
          whyItMatters: 'Visitors do not know what the product does.',
          confidence,
          pageUrl: null,
        },
      ],
    }
  }

  it('downgrades low-confidence CRITICAL AI flags to IMPORTANT', () => {
    const out = validateTriageOutput(triageWithFlag('CRITICAL', 0.85), deterministic)
    expect(out.newFlags[0]?.severity).toBe('IMPORTANT')
    expect(out.newFlags[0]?.confidence).toBe(0.85)
  })

  it('keeps CRITICAL when confidence clears the gate', () => {
    const out = validateTriageOutput(triageWithFlag('CRITICAL', 0.95), deterministic)
    expect(out.newFlags[0]?.severity).toBe('CRITICAL')
  })

  it('anchors an unsupported verdict to the highest-priority persisted evidence', () => {
    const output = triageWithFlag('IMPORTANT', 0.95)
    output.verdict =
      'The primary call-to-action is not visible to mobile users, which severely impacts conversion potential.'
    const out = validateTriageOutput(output, [
      ...deterministic,
      {
        checkId: 'mobile-lcp-critical',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'Mobile LCP is critically slow (5.5s)',
        evidence: 'The measured mobile LCP is 5.5 seconds.',
        fix: 'Reduce the largest contentful paint time.',
        confidence: 1,
        source: 'DETERMINISTIC',
      },
    ])

    expect(out.verdict).toBe('Highest priority: Mobile LCP is critically slow (5.5s).')
    expect(out.verdict).not.toContain('call-to-action')
  })
})

describe('per-page ::page:N dedup in re-check diffs', () => {
  it('collapses per-page variants onto one base check match key', () => {
    const base = diffMatchKey({ checkId: 'cta-dead-link', problem: 'x', rubric: 'MESSAGE' })
    expect(
      diffMatchKey({ checkId: 'cta-dead-link::page:1', problem: 'x', rubric: 'MESSAGE' })
    ).toBe(base)
    expect(
      diffMatchKey({ checkId: 'cta-dead-link::page:4', problem: 'x', rubric: 'MESSAGE' })
    ).toBe(base)
  })

  it('keeps distinct checks distinct', () => {
    expect(
      diffMatchKey({ checkId: 'cta-dead-link', problem: 'x', rubric: 'MESSAGE' })
    ).not.toBe(diffMatchKey({ checkId: 'title-too-short', problem: 'y', rubric: 'REACH' }))
  })
})
