import { describe, expect, it } from 'vitest'
import { assessFormProbeResponse, assessFormProbeConfirmation } from '../form-probe-assessment'

function input(status: number, existingCheckIds = new Set<string>()) {
  return { probe: { method: 'POST', status, url: 'https://example.com/submit' }, stepNumber: 3, pageUrl: 'https://example.com/signup', existingCheckIds }
}

describe('recorded form response assessment', () => {
  it.each([401, 403, 422, 500])('preserves the existing response classification for %s', status => {
    const result = assessFormProbeResponse(input(status))
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({ checkId: status >= 500 ? 'form-submit-api-server-error' : 'form-submit-api-unauthorized', stepNumber: 3, url: 'https://example.com/signup', confidence: 0.85 })
    expect(result.findings[0].evidence).toContain(`POST ${status} https://example.com/submit`)
    expect(result.events).toEqual([{ kind: 'network', label: `Form probe ${status}`, url: 'https://example.com/submit', status }])
  })
  it('ignores unavailable responses and repeated findings', () => {
    expect(assessFormProbeResponse(input(0)).findings).toEqual([])
    expect(assessFormProbeResponse(input(200)).findings).toEqual([])
    expect(assessFormProbeResponse(input(500, new Set(['form-submit-api-server-error'])))).toEqual({ findings: [], events: [] })
  })
  it.each([[200, false, true], [500, true, true], [200, true, false], [500, false, false], [0, true, false]] as const)('compares status %s with confirmation %s', (status, showsSuccess, failed) => {
    const result = assessFormProbeConfirmation({ ...input(status), showsSuccess })
    expect(result.findings).toHaveLength(failed ? 1 : 0)
    expect(result.events).toHaveLength(failed ? 1 : 0)
    if (failed) expect(result.findings[0].checkId).toBe('form-submit-silent-failure')
  })
  it('does not duplicate a recorded confirmation mismatch', () => {
    expect(assessFormProbeConfirmation({ ...input(200, new Set(['form-submit-silent-failure'])), showsSuccess: false })).toEqual({ findings: [], events: [] })
  })
})
