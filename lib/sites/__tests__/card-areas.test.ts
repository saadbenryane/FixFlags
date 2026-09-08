import { describe, expect, it } from 'vitest'
import { cardAreaForCheck, STARTER_BOARD_CARDS } from '@/lib/sites/card-areas'
import { buildCoverageFacts } from '@/lib/sites/coverage'
import { encodeSiteId, parseSiteId } from '@/lib/sites/types'
import { siteCardHealth } from '@/lib/sites/site-health'

describe('site card packaging', () => {
  it('maps security and performance checks to board areas', () => {
    expect(cardAreaForCheck({ checkId: 'no-https' })).toBe('security')
    expect(cardAreaForCheck({ checkId: 'lcp-critical' })).toBe('performance')
    expect(cardAreaForCheck({ checkId: 'title-missing' })).toBe('search')
    expect(cardAreaForCheck({ checkId: 'no-cta-detected' })).toBe('conversion')
    expect(cardAreaForCheck({ checkId: 'measurement-pixel-missing', rubric: 'REACH' })).toBe(
      'tracking'
    )
  })

  it('keeps starter board order', () => {
    expect(STARTER_BOARD_CARDS).toEqual([
      'site',
      'conversion',
      'security',
      'search',
      'performance',
      'tracking',
    ])
  })

  it('encodes provisional site ids without touching graph Site', () => {
    const id = encodeSiteId({ kind: 'provisional', provisionalSiteId: 'abc' })
    expect(id).toBe('p_abc')
    expect(parseSiteId(id)).toEqual({
      kind: 'provisional',
      siteId: 'p_abc',
      provisionalSiteId: 'abc',
    })
    expect(parseSiteId('proj_1')).toEqual({
      kind: 'project',
      siteId: 'proj_1',
      projectId: 'proj_1',
    })
  })

  it('does not call zero flags healthy while checking', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'CAPTURING',
      completedAt: null,
      evidenceCoverage: null,
      flags: [],
      rubrics: [],
    })
    expect(facts.every((f) => f.state === 'checking')).toBe(true)
  })

  it('keeps completed areas unknown when there was no evidence', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      evidenceCoverage: { desktopScreenshot: true },
      flags: [],
      rubrics: [],
    })
    expect(facts.every((f) => f.state === 'unknown')).toBe(true)
    expect(facts.every((f) => f.evidenced === false)).toBe(true)
  })

  it('marks performance evidenced from page speed coverage', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      evidenceCoverage: { desktopPageSpeed: true },
      flags: [],
      rubrics: [],
    })
    expect(facts.find((f) => f.area === 'performance')?.state).toBe('healthy')
    expect(facts.find((f) => f.area === 'security')?.state).toBe('unknown')
  })

  it('retains last known health while checking', () => {
    const prior = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-01T12:00:00Z'),
      evidenceCoverage: { desktopPageSpeed: true },
      flags: [],
      rubrics: [],
    })
    const facts = buildCoverageFacts({
      auditStatus: 'CHECKING',
      completedAt: null,
      evidenceCoverage: null,
      flags: [],
      rubrics: [],
      lastKnown: prior,
      retainLastKnownWhileChecking: true,
    })
    expect(facts.find((f) => f.area === 'performance')?.state).toBe('healthy')
    expect(facts.find((f) => f.area === 'performance')?.detail).toMatch(/Checking now/)
  })

  it('marks problem when open critical flags exist after completion', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      evidenceCoverage: null,
      flags: [
        {
          checkId: 'no-cta-detected',
          rubric: 'MESSAGE',
          severity: 'CRITICAL',
          impactTag: 'CONVERSION',
          status: 'OPEN',
        },
      ],
      rubrics: [{ name: 'MESSAGE', score: 62 }],
    })
    const conversion = facts.find((f) => f.area === 'conversion')
    expect(conversion?.state).toBe('problem')
    expect(conversion?.openFlagCount).toBe(1)
  })

  it('does not call a finished scan healthy when starter areas are unknown', () => {
    const coverage = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      evidenceCoverage: { desktopScreenshot: true },
      flags: [],
      rubrics: [],
    })
    const health = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
    })
    expect(health.state).toBe('unknown')
    expect(health.answer).not.toMatch(/looking good/i)
  })

  it('can be healthy only when required starter areas were evidenced', () => {
    const coverage = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      evidenceCoverage: { desktopScreenshot: true },
      flags: [],
      rubrics: [],
    }).map((fact) => ({
      ...fact,
      state: 'healthy' as const,
      evidenced: true,
      label: 'Looking good',
    }))
    const health = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
    })
    expect(health.state).toBe('healthy')
    expect(health.answer).toMatch(/looking good/i)
  })

  it('does not treat PARTIAL as a finished AuditStatus', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'PARTIAL',
      completedAt: null,
      evidenceCoverage: null,
      flags: [],
      rubrics: [],
    })
    expect(facts.every((f) => f.state === 'checking')).toBe(true)
  })
})
