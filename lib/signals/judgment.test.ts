import { describe, expect, it } from 'vitest'
import { synthesizeProductSignals } from './judgment'

describe('synthesizeProductSignals', () => {
  it('keeps sparse events as noise instead of flooding Attention', () => {
    expect(
      synthesizeProductSignals([
        {
          kind: 'ERROR',
          name: 'TypeError',
          route: '/signup',
          sessionHash: 'one',
          numericValue: null,
          release: null,
        },
      ])
    ).toEqual([])
  })

  it('describes repeated evidence as observed without claiming causality', () => {
    const signals = Array.from({ length: 3 }, (_, index) => ({
      kind: 'ERROR',
      name: 'TypeError',
      route: '/signup',
      sessionHash: `session-${index}`,
      numericValue: null,
      release: { externalId: '1.8' },
    }))
    const [context] = synthesizeProductSignals(signals)
    expect(context).toMatchObject({
      truthClass: 'OBSERVED',
      kind: 'ERROR_PATTERN',
      count: 3,
      release: '1.8',
    })
    expect(context?.summary).toContain('was observed')
    expect(context?.summary).not.toContain('caused')
  })

  it('synthesizes only unhealthy performance patterns with enough evidence', () => {
    const contexts = synthesizeProductSignals(
      Array.from({ length: 5 }, () => ({
        kind: 'PERFORMANCE',
        name: 'LCP',
        route: '/',
        sessionHash: null,
        numericValue: 3_200,
        release: null,
      }))
    )
    expect(contexts[0]).toMatchObject({ kind: 'PERFORMANCE_PATTERN', truthClass: 'OBSERVED' })
  })
})
