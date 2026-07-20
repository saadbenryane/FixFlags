import { describe, expect, it } from 'vitest'
import { runNetworkEngagementChecks } from '@/lib/audit/checks/network-engagement'
import { runOverlayBlockerChecks } from '@/lib/audit/checks/overlay'
import { inferProductContract, parseProductContract } from '@/lib/audit/product-contract'
import { createActionTimeline, parseActionTimeline } from '@/lib/audit/action-timeline'
import { isEngagementPath } from '@/lib/audit/browser/network-monitor'
import { isBlockedPaymentUrl, probeEmailForAudit } from '@/lib/audit/browser/journey-safety'
import { deriveTruthLabel } from '@/lib/report/explorer-model'

describe('network engagement checks', () => {
  it('flags same-origin engagement 401', () => {
    const flags = runNetworkEngagementChecks([
      {
        url: 'https://example.com/wp-json/newsletter',
        method: 'POST',
        status: 401,
        resourceType: 'fetch',
        sameOrigin: true,
        engagementPath: true,
        at: Date.now(),
      },
    ])
    expect(flags.some((f) => f.checkId === 'api-engagement-unauthorized')).toBe(true)
  })

  it('flags form probe 500', () => {
    const flags = runNetworkEngagementChecks([], {
      url: 'https://example.com/api/subscribe',
      method: 'POST',
      status: 500,
    })
    expect(flags.some((f) => f.checkId === 'form-submit-api-server-error')).toBe(true)
  })

  it('ignores third-party noise when not same-origin', () => {
    const flags = runNetworkEngagementChecks([
      {
        url: 'https://ads.example.net/pixel',
        method: 'GET',
        status: 403,
        resourceType: 'xhr',
        sameOrigin: false,
        engagementPath: false,
        at: Date.now(),
      },
    ])
    expect(flags).toHaveLength(0)
  })
})

describe('overlay blocker checks', () => {
  it('emits overlay-blocks-cta', () => {
    const flags = runOverlayBlockerChecks(
      'cta',
      {
        tag: 'div',
        id: 'adblock-modal',
        className: 'modal overlay',
        role: 'dialog',
        text: 'Disable your adblocker',
        zIndex: '9999',
      },
      'Get started'
    )
    expect(flags).toHaveLength(1)
    expect(flags[0].checkId).toBe('overlay-blocks-cta')
  })
})

describe('product contract', () => {
  it('infers purpose and journey from metadata', () => {
    const contract = inferProductContract('https://acme.com/pricing', {
      title: 'Acme Pricing',
      description: 'Simple plans for growing teams.',
      h1s: ['Pricing'],
      pageText: 'Start free trial today',
    })
    expect(contract.purpose).toContain('Simple plans')
    expect(contract.firstValueJourney.toLowerCase()).toContain('pricing')
    expect(contract.criticalOutcomes.length).toBeGreaterThan(0)
  })

  it('parses stored contract', () => {
    const parsed = parseProductContract({
      purpose: 'Help founders ship',
      firstValueJourney: 'Land and signup',
      criticalOutcomes: ['Signup works'],
      inferredAt: '2026-07-20T00:00:00.000Z',
      source: 'heuristic',
    })
    expect(parsed?.purpose).toBe('Help founders ship')
  })
})

describe('action timeline', () => {
  it('records capped events', () => {
    const timeline = createActionTimeline(1000)
    timeline.push('navigate', 'Open URL', { url: 'https://example.com' })
    timeline.push('flow', 'CTA click')
    const events = timeline.snapshot()
    expect(events).toHaveLength(2)
    expect(events[0].kind).toBe('navigate')
    expect(parseActionTimeline({ actionTimeline: events })).toHaveLength(2)
  })
})

describe('journey safety helpers', () => {
  it('blocks payment hosts', () => {
    expect(isBlockedPaymentUrl('https://checkout.stripe.com/pay')).toBe(true)
    expect(isBlockedPaymentUrl('https://example.com/signup')).toBe(false)
  })

  it('builds probe email', () => {
    expect(probeEmailForAudit('abc123')).toContain('fixflags-probe+')
    expect(probeEmailForAudit('abc123')).toContain('@example.com')
  })

  it('detects engagement paths', () => {
    expect(isEngagementPath('/api/newsletter/subscribe')).toBe(true)
    expect(isEngagementPath('/static/logo.png')).toBe(false)
  })
})

describe('truth labels', () => {
  it('marks overlay and network as Reproduced', () => {
    expect(deriveTruthLabel('DETERMINISTIC', 'overlay-blocks-cta')).toBe('Reproduced')
    expect(deriveTruthLabel('DETERMINISTIC', 'api-engagement-unauthorized')).toBe('Reproduced')
    expect(deriveTruthLabel('DETERMINISTIC', 'title-missing')).toBe('Detected')
    expect(deriveTruthLabel('JOURNEY', 'journey-signup-no-form')).toBe('Reproduced')
  })
})
