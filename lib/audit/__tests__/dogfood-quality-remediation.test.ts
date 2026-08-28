import { describe, expect, it } from 'vitest'
import {
  accessibilityBarrierFix,
  classifyAccessibilityBarrier,
  frictionFix,
} from '@/lib/audit/journey/evaluation-fix'
import {
  convertEvaluationToFindings,
  shouldKeepBrokenPromise,
} from '@/lib/audit/journey/run-journey-reviews'
import type { JourneyEvaluation } from '@/lib/audit/journey/evaluator-schema'
import { runSecurityHeaderChecks } from '@/lib/audit/checks/security-headers'
import { detectPagePurpose } from '@/lib/audit/page-purpose'
import { healthyMeta } from '@/lib/audit/__tests__/check-fixtures'

describe('journey evaluation fix templates', () => {
  it('uses type-specific friction fixes', () => {
    const unclear = frictionFix({
      stepNumber: 1,
      type: 'unclear-progress',
      description: 'Progress bar shows 33% without step name',
      evidence: 'Step 1 of 3 33% with no task list',
      severity: 'IMPORTANT',
      rubric: 'EXPERIENCE',
      impactTag: 'FRICTION',
    })
    expect(unclear).toMatch(/Label the current step/)
    expect(unclear).not.toMatch(/Reduce cognitive load/)

    const feedback = frictionFix({
      stepNumber: 2,
      type: 'missing-feedback',
      description: 'No confirmation after CTA',
      evidence: 'Tell me about your project click did nothing visible',
      severity: 'IMPORTANT',
      rubric: 'EXPERIENCE',
      impactTag: 'FRICTION',
    })
    expect(feedback).toMatch(/confirm acceptance immediately/i)
  })

  it('maps heading barriers to heading fixes, not keyboard/ARIA', () => {
    expect(
      classifyAccessibilityBarrier(
        'Heading structure is not correctly defined',
        'h1 then h3 with no h2'
      )
    ).toBe('heading')
    const fix = accessibilityBarrierFix({
      stepNumber: 1,
      barrier: 'Heading structure is not correctly defined resulting in confusing navigation',
      element: 'main',
      evidence: 'Outline skips from h1 to h3 on the case study',
    })
    expect(fix).toMatch(/heading structure/i)
    expect(fix).not.toMatch(/keyboard-accessible/)
  })

  it('convertEvaluationToFindings wires type-specific fixes', () => {
    const evaluation: JourneyEvaluation = {
      frictionPoints: [
        {
          stepNumber: 1,
          type: 'too-many-steps',
          description: 'Funnel requires too many steps',
          evidence: 'Three wizard steps on contact',
          severity: 'IMPORTANT',
          rubric: 'EXPERIENCE',
          impactTag: 'FRICTION',
        },
      ],
      brokenPromises: [
        {
          stepNumber: 2,
          expected: 'Navigating to an informative About page with a service menu',
          actual: 'General background without packaged offers',
          evidence: 'About has biography paragraphs',
          severity: 'IMPORTANT',
        },
      ],
      accessibilityBarriers: [
        {
          stepNumber: 3,
          barrier: 'Heading structure is not correctly defined',
          element: 'article',
          evidence: 'Skipped heading levels on case study',
        },
      ],
      confidence: 0.8,
      summary: 'test',
    }
    const personal = convertEvaluationToFindings(evaluation, [], 'https://example.com/', 'article')
    expect(personal.some((f) => f.checkId === 'journey-funnel-broken-promise')).toBe(false)
    const a11y = personal.find((f) => f.checkId === 'journey-funnel-accessibility-barrier')
    expect(a11y?.fix).toMatch(/heading/i)
    expect(a11y?.fix).not.toMatch(/keyboard-accessible/)
    const friction = personal.find((f) => f.checkId === 'journey-funnel-too-many-steps')
    expect(friction?.fix).toMatch(/Do not invent pricing/)
  })

  it('keeps commercial broken promises on marketing sites', () => {
    expect(
      shouldKeepBrokenPromise(
        'Expected pricing page with plans',
        'Got a blog post',
        'marketing'
      )
    ).toBe(true)
    expect(
      shouldKeepBrokenPromise(
        'Expected pricing page with plans',
        'Got about biography',
        'article'
      )
    ).toBe(false)
  })
})

describe('security header consolidation honesty', () => {
  const CORE_PRESENT = {
    'content-security-policy': "default-src 'self'; object-src 'none'",
    'strict-transport-security': 'max-age=31536000',
    'x-frame-options': 'SAMEORIGIN',
    'x-content-type-options': 'nosniff',
  }

  it('does not claim core headers missing when only aspirational gaps remain', () => {
    const flags = runSecurityHeaderChecks('https://example.com/', CORE_PRESENT)
    expect(flags.some((f) => f.checkId === 'security-headers-missing')).toBe(false)
    expect(flags.every((f) => !/core security headers are missing/i.test(f.problem))).toBe(true)
    expect(flags.some((f) => f.checkId === 'security-headers-hardening')).toBe(true)
  })

  it('lists only missing cores in consolidated fix', () => {
    const flags = runSecurityHeaderChecks('https://example.com/', {})
    const consolidated = flags.find((f) => f.checkId === 'security-headers-missing')
    expect(consolidated).toBeDefined()
    expect(consolidated?.problem).toMatch(/core security headers/)
    expect(consolidated?.fix).toMatch(/Content-Security-Policy/)
    expect(consolidated?.fix).toMatch(/SAMEORIGIN/)
    // Hardening is folded into the core Flag when cores are missing.
    expect(flags.some((f) => f.checkId === 'security-headers-hardening')).toBe(false)
  })
})

describe('personal page purpose with contact CTAs', () => {
  it('classifies portfolio sites with booking CTAs as article, not marketing', () => {
    const result = detectPagePurpose(
      healthyMeta({
        title: "I'm Saad - product and brand",
        h1s: ["I'm Saad Benryane"],
        ctaTexts: ['Start a project', 'Book a call', 'Get in touch'],
        navLandmarkCount: 2,
        links: [
          { href: '/work', text: 'Work', rel: null },
          { href: '/about', text: 'About', rel: null },
          { href: '/contact', text: 'Contact', rel: null },
          { href: '/journal', text: 'Journal', rel: null },
          { href: '/privacy', text: 'Privacy', rel: null },
        ],
        images: [
          { src: '/hero.png', alt: 'Portrait' },
          { src: '/work-1.png', alt: 'Case study' },
        ],
        pageText:
          'Selected work and case studies from product and brand collaborations. Portfolio journal with essays. My approach to product transformation for founders who need clarity on message, experience, and reach. Background in shipping AI-built software and advising teams.',
      }),
      'https://example.com/'
    )
    expect(result.purpose).toBe('article')
  })
})
