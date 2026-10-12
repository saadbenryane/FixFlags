import { describe, expect, it } from 'vitest'
import { outcomeIncidentTransition, readOutcomeIncident } from '../domain/outcome-incident'

const coverage = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'],
  bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', config: { startUrl: 'https://example.com/' } }] }
const base = { state: 'FLAG', coverage, evidence: { reason: 'http_unavailable' }, runRequestId: 'first', flagIds: ['flag-1'], previous: null }
describe('recorded Outcome incidents', () => {
  it('keeps one incident across repeated failure and unknown checks, then confirms recovery and recurrence', () => {
    const first = outcomeIncidentTransition(base)
    expect(first).toMatchObject({ transition: 'failure', incidentRunRequestId: 'first', rootFlagIds: ['flag-1'] })
    const prior = { id: 'assessment-1', state: 'FLAG', coverage, evidence: { incident: first } }
    expect(outcomeIncidentTransition({ ...base, state: 'COULD_NOT_VERIFY', flagIds: [], previous: prior })).toMatchObject({ transition: 'unknown', incidentRunRequestId: 'first' })
    const ongoing = outcomeIncidentTransition({ ...base, runRequestId: 'second', flagIds: ['flag-2'], previous: prior })
    expect(ongoing).toMatchObject({ transition: 'ongoing_failure', incidentRunRequestId: 'first', rootFlagIds: ['flag-1'], flagIds: ['flag-2'] })
    const recovered = outcomeIncidentTransition({ ...base, state: 'CLEAR', flagIds: [], previous: { ...prior, evidence: { incident: ongoing } } })
    expect(recovered).toMatchObject({ transition: 'recovery', recoveredFlagIds: ['flag-1'] })
    expect(outcomeIncidentTransition({ ...base, runRequestId: 'again', flagIds: ['flag-3'], previous: { ...prior, state: 'CLEAR', evidence: { incident: recovered } } })).toMatchObject({ transition: 'regression', incidentRunRequestId: 'again', rootFlagIds: ['flag-3'] })
  })
  it('never labels missing, changed or incomplete scope as recovered', () => {
    const prior = { id: 'before', state: 'FLAG', coverage, evidence: { incident: outcomeIncidentTransition(base) } }
    for (const observed of [{ ...coverage, observedBindings: [] }, { ...coverage, environment: 'staging' },
      { ...coverage, bindings: [{ ...coverage.bindings[0], version: 2 }] }]) {
      expect(outcomeIncidentTransition({ ...base, state: 'CLEAR', coverage: observed, previous: prior }).transition).not.toBe('recovery')
    }
    expect(outcomeIncidentTransition({ ...base, state: 'CLEAR', previous: { ...prior, evidence: {} } }).transition).toBe('clear')
    expect(readOutcomeIncident({ incident: { version: 2 } })).toBeNull()
  })
})
