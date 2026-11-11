import { describe, expect, it } from 'vitest'
import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { COVERAGE_CATALOG } from '../coverage-catalog'
import { ADVERTISED_COVERAGE, advertisedCoverageObligations, validateAdvertisedCoverage } from '../advertised-coverage'

describe('advertised coverage registration', () => {
  it('enumerates every catalog responsibility without treating registration or fixture names as acceptance', () => {
    const inventory = advertisedCoverageObligations()
    expect(inventory).toHaveLength(108)
    for (const entry of inventory) {
      expect(entry.label).toBe(COVERAGE_CATALOG.flatMap(area => area.groups.flatMap(group => group.items))
        .find(item => item.id === entry.id)?.label)
      expect(entry.obligations).toHaveLength(entry.acceptance.proofEnvironments.length * entry.acceptance.scenarios.length)
      expect(entry.obligations.every(obligation => obligation.status === 'evidence_required' && obligation.receipt === null)).toBe(true)
    }
    expect(inventory.find(entry => entry.id === 'performance.inp')?.obligations).toEqual(expect.arrayContaining([
      { environment: 'live_provider', scenario: 'repaired', status: 'evidence_required', receipt: null },
    ]))
  })
  it('maps every unchanged customer label through an explicit stable coverage identity', () => {
    const items = COVERAGE_CATALOG.flatMap(area => area.groups.flatMap(group => group.items))
    expect(new Set(items.map(item => item.id)).size).toBe(items.length)
    expect(validateAdvertisedCoverage().size).toBe(items.length)
  })
  it('publishes only a few available examples per area, each worded exactly as the catalog', () => {
    expect(HOMEPAGE_CHECK_COVERAGE.areas.map(area => area.id)).toEqual(COVERAGE_CATALOG.map(area => area.id))
    for (const area of HOMEPAGE_CHECK_COVERAGE.areas) {
      const groups = COVERAGE_CATALOG.find(entry => entry.id === area.id)!.groups
      expect(area.examples).toHaveLength(3)
      for (const example of area.examples) {
        const group = groups.find(entry => entry.items.some(item => item.id === example.id))
        expect(group?.items.find(item => item.id === example.id)?.label).toBe(example.label)
        expect(group?.title).not.toMatch(/^Coming soon/)
      }
    }
  })
  it('rejects omissions, duplicate identities, unknown evaluators, and unspecified limitations', () => {
    expect(() => validateAdvertisedCoverage(ADVERTISED_COVERAGE.slice(1))).toThrow('Missing advertised')
    expect(() => validateAdvertisedCoverage([...ADVERTISED_COVERAGE, ADVERTISED_COVERAGE[0]])).toThrow('Invalid advertised')
    expect(() => validateAdvertisedCoverage([{ ...ADVERTISED_COVERAGE[0], evaluators: ['page:invented'] }, ...ADVERTISED_COVERAGE.slice(1)])).toThrow('Missing coverage evaluator')
    expect(() => validateAdvertisedCoverage([{ ...ADVERTISED_COVERAGE[0], limitation: '' }, ...ADVERTISED_COVERAGE.slice(1)])).toThrow('Invalid advertised')
  })
  it('names exercised keyboard scope, focus limits, and durable setup integration limits', () => {
    const registry = validateAdvertisedCoverage()
    for (const id of ['accessibility.traps', 'accessibility.focus', 'accessibility.tab-order'])
      expect(registry.get(id)?.evaluators).toEqual(['page:keyboard'])
    expect(registry.get('accessibility.focus')?.extent).toBe('partial')
    expect(registry.get('accessibility.tab-order')?.extent).toBe('heuristic')
    expect(registry.get('signup.authorization')?.evaluators).toContain('task:fixture-setup')
    expect(registry.get('signup.authorization')?.limitation).toContain('integration verification')
    expect(registry.get('tracking.markup')?.limitation).toContain('does not verify')
  })
  it('requires meaningful local scenarios and retains external acceptance obligations', () => {
    const registry = validateAdvertisedCoverage()
    expect(registry.size).toBe(108)
    for (const entry of registry.values()) {
      expect(entry.acceptance.requiredObservations.length).toBeGreaterThan(0)
      expect(entry.acceptance.scenarios).toEqual(expect.arrayContaining(entry.acceptance.recovery === 'recorded_observation'
        ? ['working', 'incomplete'] : ['working', 'failing', 'incomplete', 'repaired']))
      expect(entry.acceptance.proofEnvironments).toContain('local_worker')
    }
    expect(registry.get('performance.inp')?.acceptance).toMatchObject({ recovery: 'provider_reporting_window', proofEnvironments: ['local_worker', 'live_provider'] })
    expect(registry.get('conversion.claims')?.acceptance.recovery).toBe('advisory_reassessment')
    expect(registry.get('signup.cleanup')?.acceptance.recovery).toBe('authorized_lifecycle')
    expect(registry.get('accounts.deletion')?.evaluators).toEqual(['task:automatic-accounts'])
    expect(registry.get('uptime.history')?.evaluators).toEqual(['projection:uptime'])
    expect(registry.get('uptime.recovery')?.acceptance).toMatchObject({ recovery: 'scheduled_transition', proofEnvironments: ['local_worker', 'live_schedule'] })
    expect(registry.get('uptime.provenance')?.acceptance).toMatchObject({ recovery: 'recorded_observation', scenarios: ['working', 'incomplete'] })
    expect(registry.get('search.links')?.evaluators).toEqual(['page:seo'])
  })
  it('refuses a manifest that omits repair, source evidence, or live provider proof', () => {
    const changed = (id: string, fields: Record<string, unknown>) => ADVERTISED_COVERAGE.map(entry => entry.id === id
      ? { ...entry, acceptance: { ...entry.acceptance, ...fields } } : entry) as typeof ADVERTISED_COVERAGE
    expect(() => validateAdvertisedCoverage(changed('pages.responses', { scenarios: ['working', 'failing', 'incomplete'] }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('performance.inp', { recovery: 'comparable_observation' }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('performance.inp', { proofEnvironments: ['local_worker'] }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('security.https', { requiredObservations: ['unrelated-source'] }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('uptime.recovery', { proofEnvironments: ['local_worker'] }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('uptime.provenance', { recovery: 'comparable_observation' }))).toThrow('Missing acceptance')
  })
})
