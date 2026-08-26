import { describe, expect, it } from 'vitest'
import {
  buildSilentFormFailureFlag,
  runNetworkEngagementChecks,
} from '@/lib/audit/checks/network-engagement'
import { runOverlayBlockerChecks } from '@/lib/audit/checks/overlay'
import {
  buildUserProductContract,
  displayProductPurpose,
  inferProductContract,
  parseProductContract,
  validateProductContractInput,
} from '@/lib/audit/product-contract'
import { createActionTimeline, parseActionTimeline } from '@/lib/audit/action-timeline'
import { isEngagementPath } from '@/lib/audit/browser/network-monitor'
import { isBlockedPaymentUrl, probeEmailForAudit } from '@/lib/audit/browser/journey-safety'
import { deriveTruthLabel } from '@/lib/report/explorer-model'
import {
  filterToolingPathFlags,
  looksLikeToolingPathNoise,
} from '@/lib/audit/tooling-path-filter'
import { orderJourneysFromContract } from '@/lib/audit/journey/run-journey-reviews'

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

  it('builds silent form failure flag', () => {
    const flag = buildSilentFormFailureFlag(
      { url: 'https://example.com/api/subscribe', method: 'POST', status: 200 },
      'API returned success but no thank-you copy'
    )
    expect(flag.checkId).toBe('form-submit-silent-failure')
    expect(flag.severity).toBe('CRITICAL')
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
    expect(contract.purpose.startsWith('Help visitors:')).toBe(false)
  })

  it('shows a human purpose and hides the generic Help visitors fallback', () => {
    expect(
      displayProductPurpose('Help visitors: I build products, brands, and companies.')
    ).toBe('I build products, brands, and companies.')
    expect(
      displayProductPurpose('Help visitors get value from saadbenryane.com')
    ).toBeNull()
    expect(displayProductPurpose('Help customers register')).toBe(
      'Help customers register'
    )
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

  it('validates and builds user contract', () => {
    const ok = validateProductContractInput({
      purpose: 'Help teams ship',
      firstValueJourney: 'Open pricing and start trial',
      criticalOutcomes: ['Pricing loads', 'Signup works'],
    })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    const built = buildUserProductContract(ok.value)
    expect(built.source).toBe('user')
    expect(built.criticalOutcomes).toHaveLength(2)
  })
})

describe('journey ordering from contract', () => {
  it('prefers pricing and signup after first-visit', () => {
    const ordered = orderJourneysFromContract({
      purpose: 'Help buyers compare plans',
      firstValueJourney: 'Open pricing, then signup',
      criticalOutcomes: ['Checkout starts'],
      inferredAt: '2026-07-20T00:00:00.000Z',
      source: 'heuristic',
    })
    expect(ordered[0]).toBe('first-visit')
    expect(ordered.indexOf('pricing-evaluation')).toBeLessThan(ordered.indexOf('contact-support'))
    expect(ordered.indexOf('signup')).toBeLessThan(ordered.indexOf('contact-support'))
  })
})

describe('tooling-path anti-FP', () => {
  it('detects Scout-style tooling paths', () => {
    expect(
      looksLikeToolingPathNoise(
        'Broken $ placeholder in /tmp/playwright-mcp-session.yml dump'
      )
    ).toBe(true)
    expect(looksLikeToolingPathNoise('Missing og:image on homepage')).toBe(false)
  })

  it('filters tooling-path Flags', () => {
    const flags = filterToolingPathFlags([
      {
        problem: 'Unreplaced template token',
        evidence: 'Found ${price} near playwright-mcp session path',
      },
      {
        problem: 'Missing CTA',
        evidence: 'No primary button above the fold',
      },
    ])
    expect(flags).toHaveLength(1)
    expect(flags[0].problem).toBe('Missing CTA')
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
    expect(deriveTruthLabel('DETERMINISTIC', 'form-submit-silent-failure')).toBe('Reproduced')
    expect(deriveTruthLabel('DETERMINISTIC', 'title-missing')).toBe('Detected')
    expect(deriveTruthLabel('JOURNEY', 'journey-signup-no-form')).toBe('Reproduced')
  })
})
