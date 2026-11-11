import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectGaPageviewCutover } from '../ga-pageview-cutover'

const { authorize, request } = vi.hoisted(() => ({ authorize: vi.fn(), request: vi.fn() }))
vi.mock('../google-auth', () => ({ googleServiceAccount: authorize }))

const candidate = { NEXT_PUBLIC_GA_PAGEVIEW_MODE: 'controlled', NEXT_PUBLIC_GA_ID: 'G-5GEP9X4ZWG',
  GA4_PROPERTY_ID: 'properties/541892062' }
const resource = 'properties/541892062/dataStreams/15085844419'
const stream = { name: resource, type: 'WEB_DATA_STREAM',
  webStreamData: { measurementId: 'G-5GEP9X4ZWG', defaultUri: 'https://fixflags.com/' } }
const settings = { name: resource + '/enhancedMeasurementSettings', streamEnabled: true, pageChangesEnabled: true }

describe('controlled GA4 pageview cutover', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    authorize.mockResolvedValue({ request })
    request.mockResolvedValueOnce({ data: stream }).mockResolvedValueOnce({ data: settings })
  })

  it('blocks an automatic build, unknown measurement, or wrong property before provider access', async () => {
    for (const [env, status] of [
      [{ NEXT_PUBLIC_GA_PAGEVIEW_MODE: 'automatic' }, 'candidate-mode-mismatch'],
      [{ NEXT_PUBLIC_GA_ID: 'unrelated' }, 'candidate-measurement-mismatch'],
      [{ GA4_PROPERTY_ID: 'unrelated' }, 'property-mismatch'],
    ] as const) {
      expect(await inspectGaPageviewCutover({ ...candidate, ...env })).toMatchObject({ status })
    }
    expect(authorize).not.toHaveBeenCalled()
  })

  it('reads only the intended stream and settings with read-only permissions', async () => {
    expect(await inspectGaPageviewCutover(candidate)).toMatchObject({
      status: 'browser-history-enabled', webStreamVerified: true, enhancedMeasurement: true, browserHistoryPageviews: true,
      providerWritten: false, databaseWritten: false, candidateBuildVerified: false, runtimeVerified: false,
    })
    expect(authorize).toHaveBeenCalledWith(['https://www.googleapis.com/auth/analytics.readonly'])
    expect(request.mock.calls.map(([input]) => [input.method, input.url])).toEqual([
      ['GET', 'https://analyticsadmin.googleapis.com/v1beta/' + resource],
      ['GET', 'https://analyticsadmin.googleapis.com/v1alpha/' + settings.name],
    ])
  })

  it.each([
    ['disabled page changes', { ...settings, pageChangesEnabled: false }, 'provider-prerequisite-met'],
    ['a disabled stream', { ...settings, streamEnabled: false }, 'provider-prerequisite-met'],
    ['incomplete settings', { name: settings.name, streamEnabled: true }, 'settings-unverified'],
    ['unrelated settings', { name: 'unrelated', streamEnabled: false }, 'settings-unverified'],
  ])('handles explicit settings and refuses incomplete or unrelated evidence: %s', async (_settings, providerSettings, status) => {
    request.mockReset().mockResolvedValueOnce({ data: stream }).mockResolvedValueOnce({ data: providerSettings })
    expect(await inspectGaPageviewCutover(candidate)).toMatchObject({ status })
  })

  it('withholds cutover for a different web origin or measurement and suppresses provider errors', async () => {
    for (const details of [{ defaultUri: 'https://other.example' }, { measurementId: 'G-OTHER123' }]) {
      request.mockReset().mockResolvedValueOnce({ data: { ...stream, webStreamData: { ...stream.webStreamData, ...details } } })
        .mockResolvedValueOnce({ data: { ...settings, pageChangesEnabled: false } })
      expect(await inspectGaPageviewCutover(candidate)).toMatchObject({ status: 'web-stream-mismatch' })
    }
    request.mockReset().mockRejectedValue(new Error('private provider response'))
    const unavailable = await inspectGaPageviewCutover(candidate)
    expect(unavailable).toMatchObject({ status: 'provider-read-unavailable' })
    expect(JSON.stringify(unavailable)).not.toContain('private')
  })
})
