import { describe, expect, it } from 'vitest'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'

const base = {
  id: 'audit-1',
  status: 'CHECKING',
  progress: 42,
  reportCompleteness: 'UNKNOWN',
  failureCode: null,
  journeyReviewIncluded: false,
  screenshotCapture: { desktop: 'ok', mobile: 'ok' } as const,
  flags: [
    { id: 'flag-1', problem: 'The headline is unclear', rubric: 'MESSAGE' },
  ],
}

describe('buildFixFlagsScanMessages', () => {
  it('builds stable cumulative scan messages and linked Flags', () => {
    const first = buildFixFlagsScanMessages(base)
    const second = buildFixFlagsScanMessages(base)

    expect(second).toEqual(first)
    expect(first.map((item) => item.id)).toEqual([
      'scan:audit-1:preparing',
      'scan:audit-1:capturing',
      'scan:audit-1:checking',
      'scan:audit-1:flag:flag-1',
    ])
    expect(first[3]).toMatchObject({
      sessionId: 'audit-1',
      auditId: 'audit-1',
      role: 'agent',
      source: 'scan',
      flagId: 'flag-1',
      evidenceRef: { auditId: 'audit-1', flagId: 'flag-1' },
    })
  })

  it('never announces a journey for a reduced scan', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      status: 'JUDGING',
      progress: 70,
      journeyReviewIncluded: false,
    })
    expect(messages.map((item) => item.id)).not.toContain('scan:audit-1:journey')
  })

  it('announces an Important Message Flag ahead of equally severe SEO Flags', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      flags: [
        {
          id: 'seo-description',
          problem: 'Meta description is missing',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          checkId: 'description-missing',
          impactTag: 'SEO',
        },
        {
          id: 'headline',
          problem: 'The headline is unclear',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          checkId: 'headline-unclear',
          impactTag: 'CLARITY',
        },
      ],
    })

    expect(messages.filter((item) => item.kind === 'flag')[0]).toMatchObject({ flagId: 'headline' })
  })

  it('announces a Critical Experience Flag ahead of discovery-order SEO Flags', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      flags: [
        {
          id: 'seo-description',
          problem: 'Meta description is missing',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          checkId: 'description-missing',
          impactTag: 'SEO',
        },
        {
          id: 'seo-og-image',
          problem: 'og:image is missing, link previews show blank',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          checkId: 'og-image-missing',
          impactTag: 'SEO',
        },
        {
          id: 'seo-og-title',
          problem: 'og:title is missing',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          checkId: 'og-title-missing',
          impactTag: 'SEO',
        },
        {
          id: 'cta-fold',
          problem: 'Primary CTA is hidden below the fold on mobile',
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          checkId: 'cta-below-fold',
          impactTag: 'CONVERSION',
        },
      ],
    })

    const announced = messages.filter((item) => item.kind === 'flag')
    expect(announced).toHaveLength(3)
    expect(announced[0]).toMatchObject({ flagId: 'cta-fold' })
    expect(announced.map((item) => item.flagId)).not.toContain('seo-og-title')
    expect(messages.find((item) => item.id.endsWith(':additional-flags'))?.content).toContain(
      '1 more Flag',
    )
  })

  it('curates large Flag sets instead of flooding the Agent transcript', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      flags: Array.from({ length: 7 }, (_, index) => ({
        id: `flag-${index + 1}`,
        problem: `Grounded issue ${index + 1}`,
        rubric: 'EXPERIENCE',
      })),
    })

    expect(messages.filter((item) => item.kind === 'flag')).toHaveLength(3)
    expect(messages.find((item) => item.id.endsWith(':additional-flags'))?.content).toContain(
      '4 more Flags',
    )
  })

  it('announces an included journey only after its persisted anchor', () => {
    const before = buildFixFlagsScanMessages({
      ...base,
      progress: 45,
      journeyReviewIncluded: true,
    })
    const active = buildFixFlagsScanMessages({
      ...base,
      progress: 48,
      journeyReviewIncluded: true,
    })
    const complete = buildFixFlagsScanMessages({
      ...base,
      progress: 65,
      journeyReviewIncluded: true,
      journeyReviewAt: '2026-08-09T12:00:00.000Z',
    })

    expect(before.some((item) => item.id.endsWith(':journey'))).toBe(false)
    expect(active.find((item) => item.id.endsWith(':journey'))?.state).toBe('active')
    expect(complete.find((item) => item.id.endsWith(':journey'))).toMatchObject({
      state: 'complete',
      createdAt: '2026-08-09T12:00:00.000Z',
    })
  })

  it('uses public-safe failure copy and persisted partial completeness', () => {
    const failed = buildFixFlagsScanMessages({
      ...base,
      status: 'FAILED',
      progress: 20,
      failureCode: 'BROWSER_LAUNCH_FAILED',
    })
    const partial = buildFixFlagsScanMessages({
      ...base,
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: 'PARTIAL',
    })

    expect(failed.at(-1)).toMatchObject({ kind: 'failure', state: 'failed' })
    expect(failed.at(-1)?.content).not.toContain('BROWSER_LAUNCH_FAILED')
    expect(partial.at(-1)).toMatchObject({
      kind: 'completion',
      content: 'Your report is ready with some evidence missing.',
    })
  })

  it('does not claim a partial capture when capture failed before evidence existed', () => {
    const failed = buildFixFlagsScanMessages({
      ...base,
      status: 'FAILED',
      progress: 20,
      screenshotCapture: { desktop: 'failed', mobile: 'failed' },
      flags: [],
    })

    expect(failed.map((item) => item.content)).toContain('I couldn’t capture the page evidence.')
    expect(failed.map((item) => item.content)).not.toContain(
      'I captured part of the experience. The report will identify what is missing.'
    )
  })

  it('does not read or expose Action Timeline data', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      // Prove structurally unrelated data cannot influence the pure projection.
      actionTimeline: [{ label: 'Opened page' }],
    } as typeof base & { actionTimeline: Array<{ label: string }> })
    expect(messages.some((item) => item.content.includes('Opened page'))).toBe(false)
  })

  it('names a Flag path when it is not the pasted page', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      url: 'https://example.com/',
      flags: [
        {
          id: 'flag-2',
          problem: 'Checkout is unclear',
          rubric: 'EXPERIENCE',
          pageUrl: 'https://example.com/checkout',
        },
      ],
    })
    expect(messages.map((item) => item.content).join('\n')).toMatch(
      /I found an Experience Flag on \/checkout: Checkout is unclear/
    )
  })

  it('names the worthwhile Flag and leaves Polish observations in the Report', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      flags: [
        {
          id: 'cookie',
          problem: 'Analytics detected but no cookie consent found',
          rubric: 'REACH',
          severity: 'POLISH',
          checkId: 'cookie-consent-absent',
          impactTag: 'TRUST',
        },
        {
          id: 'schema',
          problem: 'No structured data (JSON-LD) found',
          rubric: 'REACH',
          severity: 'POLISH',
          checkId: 'no-structured-data',
          impactTag: 'SEO',
        },
        {
          id: 'headline',
          problem: 'The headline is unclear',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          checkId: 'headline-unclear',
          impactTag: 'CLARITY',
        },
      ],
    })

    const announced = messages.filter((item) => item.kind === 'flag')
    expect(announced).toHaveLength(1)
    expect(announced[0]).toMatchObject({ flagId: 'headline' })
    expect(messages.find((item) => item.id.endsWith(':additional-flags'))).toBeUndefined()
  })

  it('does not claim nothing needs action while checks are still running', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      flags: [
        {
          id: 'cookie',
          problem: 'Analytics detected but no cookie consent found',
          rubric: 'REACH',
          severity: 'POLISH',
          checkId: 'cookie-consent-absent',
        },
      ],
    })

    expect(messages.filter((item) => item.kind === 'flag')).toHaveLength(0)
    expect(messages.some((item) => item.id.endsWith(':no-attention'))).toBe(false)
  })

  it('does not claim nothing needs action when a completed Review has a worthwhile Flag', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      status: 'COMPLETED',
      progress: 100,
      flags: [
        {
          id: 'headline',
          problem: 'The headline is unclear',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          fix: '1. Rewrite the headline\n2. Keep the offer',
        },
        {
          id: 'cookie',
          problem: 'Analytics detected but no cookie consent found',
          rubric: 'REACH',
          severity: 'POLISH',
        },
      ],
    })

    expect(messages.filter((item) => item.kind === 'flag').map((item) => item.flagId)).toEqual([
      'headline',
    ])
    expect(messages.some((item) => item.id.endsWith(':no-attention'))).toBe(false)
  })

  it('says nothing needs action when a completed Review has only Polish observations', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: 'FULL',
      flags: [
        {
          id: 'cookie',
          problem: 'Analytics detected but no cookie consent found',
          rubric: 'REACH',
          severity: 'POLISH',
          checkId: 'cookie-consent-absent',
        },
        {
          id: 'schema',
          problem: 'No structured data (JSON-LD) found',
          rubric: 'REACH',
          severity: 'POLISH',
          checkId: 'no-structured-data',
        },
      ],
    })

    expect(messages.filter((item) => item.kind === 'flag')).toHaveLength(0)
    expect(messages.find((item) => item.id.endsWith(':no-attention'))?.content).toBe(
      'I didn’t find anything that deserves action yet. 2 observations are in the Report.'
    )
    expect(messages.at(-1)).toMatchObject({
      kind: 'completion',
      content: 'Your report is ready.',
    })
  })

  it('names Fixed versus New when an update review completes with a flat score', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: 'FULL',
      score: 72,
      previousScore: 72,
      updateDiff: {
        fixed: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        unchanged: [{ id: 'd' }],
        newIssues: [{ id: 'e' }, { id: 'f' }],
        regressed: [],
        inconclusive: [],
      },
    })
    const outcome = messages.find((item) => item.id.endsWith(':update-outcome'))
    expect(outcome?.content).toContain('3 Flags from last time are gone')
    expect(outcome?.content).toContain('2 new observations appeared')
    expect(outcome?.content).toContain('Score stayed at 72')
    expect(messages.some((item) => item.id.endsWith(':no-attention'))).toBe(false)
  })

  it('does not say nothing needs action when completed evidence is only partial', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: 'PARTIAL',
      flags: [
        {
          id: 'cookie',
          problem: 'Analytics detected but no cookie consent found',
          rubric: 'REACH',
          severity: 'POLISH',
        },
      ],
    })

    expect(messages.some((item) => item.id.endsWith(':no-attention'))).toBe(false)
    expect(messages.at(-1)?.content).toBe('Your report is ready with some evidence missing.')
  })

  it('names a Critical Flag without a fix while checking, then drops it from completed Attention', () => {
    const flag = {
      id: 'empty-fix',
      problem: 'The signup path is blocked',
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      fix: '',
    }
    const checking = buildFixFlagsScanMessages({
      ...base,
      flags: [flag],
    })
    const completed = buildFixFlagsScanMessages({
      ...base,
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: 'FULL',
      flags: [flag],
    })

    expect(checking.filter((item) => item.kind === 'flag').map((item) => item.flagId)).toEqual([
      'empty-fix',
    ])
    expect(completed.filter((item) => item.kind === 'flag')).toHaveLength(0)
    expect(completed.find((item) => item.id.endsWith(':no-attention'))?.content).toContain(
      '1 observation is in the Report'
    )
  })

  it('keeps a Flag at the confidence floor and excludes a near miss', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      flags: [
        {
          id: 'floor',
          problem: 'The headline is unclear',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          confidence: 0.65,
        },
        {
          id: 'low',
          problem: 'Primary CTA is weak',
          rubric: 'EXPERIENCE',
          severity: 'IMPORTANT',
          confidence: 0.64,
        },
      ],
    })

    expect(messages.filter((item) => item.kind === 'flag').map((item) => item.flagId)).toEqual([
      'floor',
    ])
  })

  it('counts only leftover Attention candidates as additional Flags', () => {
    const messages = buildFixFlagsScanMessages({
      ...base,
      flags: Array.from({ length: 5 }, (_, index) => ({
        id: `important-${index + 1}`,
        problem: `Grounded issue ${index + 1}`,
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
      })),
    })

    expect(messages.filter((item) => item.kind === 'flag')).toHaveLength(3)
    expect(messages.find((item) => item.id.endsWith(':additional-flags'))?.content).toContain(
      '2 more Flags'
    )
  })
})
