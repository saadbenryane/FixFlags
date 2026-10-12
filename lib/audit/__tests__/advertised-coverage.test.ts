import { describe, expect, it } from 'vitest'
import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { ADVERTISED_COVERAGE, validateAdvertisedCoverage } from '../advertised-coverage'

describe('advertised coverage registration', () => {
  it('maps every unchanged customer label through an explicit stable coverage identity', () => {
    const items = HOMEPAGE_CHECK_COVERAGE.areas.flatMap(area => area.groups.flatMap(group => group.items))
    expect(new Set(items.map(item => item.id)).size).toBe(items.length)
    expect(validateAdvertisedCoverage().size).toBe(items.length)
    for (const area of HOMEPAGE_CHECK_COVERAGE.areas) for (const group of area.groups)
      expect(group.checks).toEqual(group.items.map(item => item.label))
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
    expect(registry.size).toBe(104)
    for (const entry of registry.values()) {
      expect(entry.acceptance.requiredObservations.length).toBeGreaterThan(0)
      expect(entry.acceptance.scenarios).toEqual(expect.arrayContaining(['working', 'failing', 'incomplete', 'repaired']))
      expect(entry.acceptance.proofEnvironments).toContain('local_worker')
    }
    expect(registry.get('performance.inp')?.acceptance).toMatchObject({ recovery: 'provider_reporting_window', proofEnvironments: ['local_worker', 'live_provider'] })
    expect(registry.get('conversion.claims')?.acceptance.recovery).toBe('advisory_reassessment')
    expect(registry.get('signup.cleanup')?.acceptance.recovery).toBe('authorized_lifecycle')
    expect(registry.get('uptime.recovery')?.acceptance).toMatchObject({ recovery: 'scheduled_transition', proofEnvironments: ['local_worker', 'live_schedule'] })
  })
  it('refuses a manifest that omits repair, source evidence, or live provider proof', () => {
    const changed = (id: string, fields: Record<string, unknown>) => ADVERTISED_COVERAGE.map(entry => entry.id === id
      ? { ...entry, acceptance: { ...entry.acceptance, ...fields } } : entry) as typeof ADVERTISED_COVERAGE
    expect(() => validateAdvertisedCoverage(changed('pages.responses', { scenarios: ['working', 'failing', 'incomplete'] }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('performance.inp', { recovery: 'comparable_observation' }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('performance.inp', { proofEnvironments: ['local_worker'] }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('security.https', { requiredObservations: ['unrelated-source'] }))).toThrow('Missing acceptance')
    expect(() => validateAdvertisedCoverage(changed('uptime.recovery', { proofEnvironments: ['local_worker'] }))).toThrow('Missing acceptance')
  })
})
