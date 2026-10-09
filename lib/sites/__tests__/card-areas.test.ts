import { describe, expect, it } from 'vitest'
import { cardAreaForCheck, ADDABLE_BOARD_CARDS, STARTER_BOARD_CARDS } from '@/lib/sites/card-areas'
import { buildCoverageFacts, SITE_COVERAGE_MAX_AGE_MS, siteCoverageIsStale } from '@/lib/sites/coverage'
import { encodeSiteId, parseSiteId } from '@/lib/sites/types'
import { siteCardHealth } from '@/lib/sites/site-health'
import { buildBoardCards } from '@/lib/sites/board-card'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

describe('site card packaging', () => {
  it('uses an eight-day evidence window with an exact cutoff', () => {
    const checkedAt = new Date('2026-09-01T12:00:00Z')
    expect(siteCoverageIsStale(checkedAt, new Date(checkedAt.getTime() + SITE_COVERAGE_MAX_AGE_MS - 1))).toBe(false)
    expect(siteCoverageIsStale(checkedAt, new Date(checkedAt.getTime() + SITE_COVERAGE_MAX_AGE_MS))).toBe(true)
    expect(siteCoverageIsStale(null, checkedAt)).toBe(true)
  })

  it('expires an old completed check without hiding its evidence or open Flags', () => {
    const completedAt = new Date('2026-09-01T12:00:00Z')
    const now = new Date('2026-09-10T12:00:00Z')
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt,
      now,
      evidenceCoverage: { metadata: true, desktopPageSpeed: true, flowScan: true },
      flags: [],
    })
    const search = facts.find((fact) => fact.area === 'search')
    expect(search).toMatchObject({
      state: 'unknown',
      label: SITE_BOARD_COPY.checkOutOfDate,
      checkedAt: completedAt.toISOString(),
      evidenced: true,
      stale: true,
    })
    const health = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage: facts,
      now,
    })
    expect(health).toMatchObject({ state: 'unknown', statusLabel: SITE_BOARD_COPY.checkOutOfDate })
    const cards = buildBoardCards({
      siteId: 'site-1',
      inFlight: false,
      hasLastKnown: false,
      health,
      coverageByArea: new Map(facts.map((fact) => [fact.area, fact])),
      flags: [],
      outcomes: [],
      pageCount: 1,
      captureUrl: null,
      checkedAt: completedAt.toISOString(),
    })
    expect(cards.find((card) => card.id === 'site')?.status).toBe(SITE_BOARD_COPY.checkOutOfDate)
    expect(cards.find((card) => card.id === 'search')?.status).toBe(SITE_BOARD_COPY.checkOutOfDate)

    const withFlag = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt,
      now,
      evidenceCoverage: { metadata: true },
      flags: [{ checkId: 'title-missing', rubric: 'REACH', severity: 'IMPORTANT', impactTag: null, status: 'OPEN' }],
    })
    expect(withFlag.find((fact) => fact.area === 'search')?.state).toBe('problem')
  })

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
    expect(ADDABLE_BOARD_CARDS).toEqual(['accessibility'])
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
      now: new Date('2026-09-29T12:00:00Z'),
      evidenceCoverage: null,
      flags: [],
    })
    expect(facts.every((f) => f.state === 'unknown' && f.label === 'Waiting for evidence')).toBe(true)
  })

  it('keeps completed areas unknown when there was no evidence', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: { desktopScreenshot: true },
      flags: [],
    })
    expect(facts.every((f) => f.state === 'unknown')).toBe(true)
    expect(facts.every((f) => f.evidenced === false)).toBe(true)
  })

  it('does not call Conversion or Performance healthy without direct evidence', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-23T12:00:00Z'),
      now: new Date('2026-09-24T12:00:00Z'),
      evidenceCoverage: {
        metadata: true,
        flowScan: false,
        journeyWalk: false,
        desktopPageSpeed: false,
        mobilePageSpeed: false,
      },
      flags: [],
    })
    const conversion = facts.find((fact) => fact.area === 'conversion')
    const performance = facts.find((fact) => fact.area === 'performance')
    expect(conversion?.state).toBe('unknown')
    expect(conversion?.label).toBe('Not checked yet')
    expect(conversion?.label).not.toBe('Looking good')
    expect(performance?.state).toBe('unknown')
    expect(performance?.label).not.toBe('Looking good')
  })

  it('calls Conversion healthy only after a journey ran', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-23T12:00:00Z'),
      now: new Date('2026-09-24T12:00:00Z'),
      evidenceCoverage: { flowScan: true },
      flags: [],
    })
    const conversion = facts.find((fact) => fact.area === 'conversion')
    expect(conversion).toMatchObject({
      state: 'healthy',
      label: 'Journey completed',
      detail: 'Latest browser journey reached its expected end',
    })
    expect(conversion?.detail).not.toContain('Score')
  })

  it('marks performance evidenced from page speed coverage', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: { desktopPageSpeed: true },
      flags: [],
    })
    expect(facts.find((f) => f.area === 'performance')).toMatchObject({
      state: 'healthy',
      label: 'Desktop speed measured',
      detail: 'Desktop page speed evidence completed',
    })
    expect(facts.find((f) => f.area === 'security')?.state).toBe('unknown')
  })

  it('names the performance viewport that produced evidence', () => {
    const build = (evidenceCoverage: { desktopPageSpeed?: boolean; mobilePageSpeed?: boolean }) =>
      buildCoverageFacts({
        auditStatus: 'COMPLETED',
        completedAt: new Date('2026-09-08T12:00:00Z'),
        now: new Date('2026-09-09T12:00:00Z'),
        evidenceCoverage,
        flags: [],
      }).find((fact) => fact.area === 'performance')

    expect(build({ mobilePageSpeed: true })).toMatchObject({
      label: 'Mobile speed measured',
      detail: 'Mobile page speed evidence completed',
    })
    expect(build({ desktopPageSpeed: true, mobilePageSpeed: true })).toMatchObject({
      label: 'Desktop + mobile measured',
      detail: 'Page speed evidence completed on both viewports',
    })
  })

  it('turns metadata evidence into a concrete Search answer', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: { metadata: true },
      flags: [],
    })
    expect(facts.find((fact) => fact.area === 'search')).toMatchObject({
      state: 'healthy',
      label: 'Metadata checked',
      detail: 'Page metadata was available to inspect',
    })
  })

  it('uses capture and verifier receipts for optional Uptime and Accessibility coverage', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: { desktopScreenshot: true, metadata: true },
      verifierExecutions: [
        { targetKey: 'module:accessibility', status: 'COMPLETED' },
      ],
      flags: [],
    })
    expect(facts.find((f) => f.area === 'uptime')).toMatchObject({
      state: 'healthy',
      label: 'Page reached',
      detail: 'The page loaded and produced inspectable metadata',
      evidenced: true,
    })
    expect(facts.find((f) => f.area === 'accessibility')).toMatchObject({
      state: 'healthy',
      label: 'Accessibility tested',
      detail: 'Automated accessibility tests completed',
      evidenced: true,
    })

    const notApplicable = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: { metadata: true },
      verifierExecutions: [
        { targetKey: 'module:accessibility', status: 'NOT_APPLICABLE' },
      ],
      flags: [],
    })
    expect(notApplicable.find((f) => f.area === 'accessibility')).toMatchObject({
      state: 'unknown',
      evidenced: false,
    })
  })

  it('evidences security and tracking only from completed module checks', () => {
    const base = {
      auditStatus: 'COMPLETED' as const,
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: {
        metadata: true,
        desktopPageSpeed: true,
        mobilePageSpeed: true,
        flowScan: true,
        desktopScreenshot: true,
      },
      flags: [],
    }
    const withoutModules = buildCoverageFacts(base)
    expect(withoutModules.find((fact) => fact.area === 'security')?.state).toBe('unknown')
    expect(withoutModules.find((fact) => fact.area === 'tracking')?.state).toBe('unknown')
    const hidden = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage: withoutModules,
      now: base.now,
      outcomes: [{ state: 'STALE', enabled: true }],
    })
    expect(hidden.statusLabel).toBe('Coverage incomplete')

    const withModules = buildCoverageFacts({
      ...base,
      verifierExecutions: [
        { targetKey: 'module:trust', status: 'COMPLETED' },
        { targetKey: 'module:security', status: 'COMPLETED' },
        { targetKey: 'module:measurement', status: 'COMPLETED' },
      ],
    })
    expect(withModules.find((fact) => fact.area === 'security')).toMatchObject({
      state: 'healthy',
      evidenced: true,
      label: 'Security checked',
      detail: 'HTTPS and mixed content checks completed',
    })
    expect(withModules.find((fact) => fact.area === 'tracking')).toMatchObject({
      state: 'healthy',
      evidenced: true,
      label: 'Measurement checked',
      detail: 'Public measurement checks completed',
    })
    const stale = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage: withModules,
      now: base.now,
      outcomes: [{ state: 'STALE', enabled: true }],
    })
    expect(stale.state).not.toBe('healthy')
    expect(stale.statusLabel).toBe('Stale')
    expect(stale.answer).toBe('A watched result is out of date.')

    const incomplete = buildCoverageFacts({
      ...base,
      verifierExecutions: [
        { targetKey: 'module:trust', status: 'NOT_APPLICABLE' },
        { targetKey: 'module:security', status: 'COMPLETED' },
        { targetKey: 'module:measurement', status: 'NOT_APPLICABLE' },
      ],
    })
    expect(incomplete.find((fact) => fact.area === 'security')?.state).toBe('unknown')
    expect(incomplete.find((fact) => fact.area === 'tracking')?.state).toBe('unknown')
  })

  it('retains last known health while checking', () => {
    const prior = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-01T12:00:00Z'),
      now: new Date('2026-09-02T12:00:00Z'),
      evidenceCoverage: { desktopPageSpeed: true },
      flags: [],
    })
    const facts = buildCoverageFacts({
      auditStatus: 'CHECKING',
      completedAt: null,
      now: new Date('2026-09-29T12:00:00Z'),
      evidenceCoverage: null,
      flags: [],
      lastKnown: prior,
      retainLastKnownWhileChecking: true,
    })
    expect(facts.find((f) => f.area === 'performance')?.state).toBe('healthy')
    expect(facts.find((f) => f.area === 'performance')?.detail).toBe('Desktop page speed evidence completed')
  })

  it('marks problem when open critical flags exist after completion', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
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
    })
    const conversion = facts.find((f) => f.area === 'conversion')
    expect(conversion?.state).toBe('problem')
    expect(conversion?.openFlagCount).toBe(1)
  })

  it('does not call a finished scan healthy when starter areas are unknown', () => {
    const coverage = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: { desktopScreenshot: true },
      flags: [],
    })
    const health = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
      now: new Date('2026-09-09T12:00:00Z'),
    })
    expect(health.state).toBe('unknown')
    expect(health.answer).not.toMatch(/looking good/i)
  })

  it('can be healthy only when required starter areas were evidenced', () => {
    const coverage = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      now: new Date('2026-09-09T12:00:00Z'),
      evidenceCoverage: { desktopScreenshot: true },
      flags: [],
    }).map((fact) => ({
      ...fact,
      state: 'healthy' as const,
      evidenced: true,
      label: 'Evidence checked',
      checkedAt: new Date('2026-09-08T12:00:00Z').toISOString(),
    }))
    const health = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
      now: new Date('2026-09-09T12:00:00Z'),
    })
    expect(health.state).toBe('healthy')
    expect(health.answer).toBe('0 Flags')

    const stale = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
      now: new Date('2026-09-09T12:00:00Z'),
      outcomes: [{ state: 'STALE', enabled: true }],
    })
    expect(stale.state).not.toBe('healthy')
    expect(stale.statusLabel).toBe('Stale')
    expect(stale.answer).not.toBe('0 Flags')

    const unverified = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
      now: new Date('2026-09-09T12:00:00Z'),
      outcomes: [{ state: 'COULD_NOT_VERIFY', enabled: true }],
    })
    expect(unverified.statusLabel).toBe('Couldn’t verify')

    const flagged = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
      now: new Date('2026-09-09T12:00:00Z'),
      outcomes: [{ state: 'FLAG', enabled: true }],
    })
    expect(flagged.state).not.toBe('healthy')
    expect(flagged.statusLabel).toBe(SITE_BOARD_COPY.flagStatus)

    const paused = siteCardHealth({
      inFlight: false,
      finished: true,
      hasLastKnown: false,
      flags: [],
      coverage,
      now: new Date('2026-09-09T12:00:00Z'),
      outcomes: [{ state: 'STALE', enabled: false }],
    })
    expect(paused.state).toBe('healthy')
    expect(paused.answer).toBe('0 Flags')
  })

  it('does not treat PARTIAL as a finished AuditStatus', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'PARTIAL',
      completedAt: null,
      now: new Date('2026-09-29T12:00:00Z'),
      evidenceCoverage: null,
      flags: [],
    })
    expect(facts.every((f) => f.state === 'unknown' && f.label === 'Waiting for evidence')).toBe(true)
  })
})
