import { describe, expect, it, vi } from 'vitest'
import { inspectGrowthReadiness } from '../measurement-readiness'

const options = { startDate: '2026-09-15', endDate: '2026-10-12' }
const env = { GA4_PROPERTY_ID: '541892062', GSC_PROPERTY: 'sc-domain:fixflags.com', GSC_SERVICE_ACCOUNT_KEY: '/private/synthetic-secret.json' }

describe('aggregate growth measurement readiness', () => {
  it('reports each absent prerequisite and performs no provider call by default', async () => {
    const inspect = vi.fn()
    const result = await inspectGrowthReadiness(options, {}, inspect)
    expect(result.prerequisites).toEqual({ ga4Property: 'unavailable', searchConsoleProperty: 'unavailable', reportingCredential: 'unavailable', browserMeasurement: 'unavailable', operationalDatabase: 'unavailable' })
    expect(result.reportingStatus).toBe('not-requested')
    expect(result.reporting).toBeNull()
    expect(inspect).not.toHaveBeenCalled()
  })

  it('never treats configured credentials or arbitrary properties as access proof', async () => {
    const inspect = vi.fn()
    const configured = await inspectGrowthReadiness(options, env, inspect)
    expect(configured.prerequisites.reportingCredential).toBe('present-unverified')
    const result = await inspectGrowthReadiness({ ...options, live: true }, { ...env, GA4_PROPERTY_ID: 'other-secret-property' }, inspect)
    expect(result.reportingStatus).toBe('prerequisites-unavailable')
    expect(inspect).not.toHaveBeenCalled()
    for (const secret of Object.values(env).concat('other-secret-property')) expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('retains a partial inspector report with its exact window and no replacement zeros', async () => {
    const report = { fetchedAt: '2026-10-13T00:00:00Z', observationWindow: options, databaseWritten: false, ga4: { status: 'report-read-failed' }, searchConsole: { status: 'report-read-succeeded', property: 'sc-domain:fixflags.com', metrics: null, limitations: ['Finalized web search only'] } }
    const inspect = vi.fn().mockResolvedValue(report)
    const result = await inspectGrowthReadiness({ ...options, live: true }, env, inspect)
    expect(inspect).toHaveBeenCalledWith(options.startDate, options.endDate)
    expect(result.reportingStatus).toBe('partial-or-unavailable')
    expect(result.reporting).toEqual(report)
    expect(result.observationWindow).toEqual(options)
  })

  it('suppresses provider and credential file exceptions', async () => {
    const inspect = vi.fn().mockRejectedValue(new Error('signed-url /private/synthetic-secret.json client_email secret@test.test'))
    const result = await inspectGrowthReadiness({ ...options, live: true }, env, inspect)
    expect(result.reportingStatus).toBe('unavailable')
    for (const secret of ['synthetic-secret', 'signed-url', 'client_email', 'secret@test.test']) expect(JSON.stringify(result)).not.toContain(secret)
  })

  it.each([['2026-02-30', '2026-10-12'], ['not-a-date', '2026-10-12'], ['2026-10-12', '2026-09-15']])('rejects invalid calendar windows before provider use (%s)', async (startDate, endDate) => {
    const inspect = vi.fn()
    await expect(inspectGrowthReadiness({ startDate, endDate, live: true }, env, inspect)).rejects.toThrow()
    expect(inspect).not.toHaveBeenCalled()
  })
})
