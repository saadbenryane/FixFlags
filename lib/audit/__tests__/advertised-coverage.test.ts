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
  it('keeps keyboard coverage partial and names durable setup with its integration limits', () => {
    const registry = validateAdvertisedCoverage()
    for (const id of ['accessibility.traps', 'accessibility.focus', 'accessibility.tab-order'])
      expect(registry.get(id)?.extent).toBe('partial')
    expect(registry.get('signup.authorization')?.evaluators).toContain('task:fixture-setup')
    expect(registry.get('signup.authorization')?.limitation).toContain('integration verification')
    expect(registry.get('tracking.markup')?.limitation).toContain('does not verify')
  })
})
