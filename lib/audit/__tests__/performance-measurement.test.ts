import { expect, it, vi, afterEach } from 'vitest'
import { performanceMeasurement, performanceMeasurementSchema } from '../performance-measurement'
afterEach(() => vi.useRealTimers())
it('retains only actual bounded provider measurement conditions', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
  const value = performanceMeasurement({ fetchTime: '2026-10-14T09:59:00Z', lighthouseVersion: '13.0', configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate', privateToken: 'secret' }, requestHeaders: 'secret' }, 'mobile')
  expect(value).toEqual({ version: 1, source: 'google-pagespeed', strategy: 'mobile', receivedAt: '2026-10-14T10:00:00.000Z', measuredAt: '2026-10-14T09:59:00Z', lighthouseVersion: '13.0', formFactor: 'mobile', throttlingMethod: 'simulate', scope: null })
})
it('binds whitelisted measurement conditions without retaining provider URLs, query values or unknown settings', () => {
  const raw = { requestedUrl: 'https://example.com/?project=PRIVATE_PROJECT', finalUrl: 'https://example.com/plans?token=PRIVATE_TOKEN',
    lighthouseVersion: '13.0', configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 }, privateToken: 'PRIVATE_SETTING' } }
  const original = performanceMeasurement(raw, 'mobile')
  expect(original.scope).toEqual({ requestedKey: expect.stringMatching(/^[a-f0-9]{64}$/), finalKey: expect.stringMatching(/^[a-f0-9]{64}$/), profileKey: expect.stringMatching(/^[a-f0-9]{64}$/) })
  expect(JSON.stringify(original)).not.toContain('PRIVATE_')
  expect(performanceMeasurement({ ...raw, configSettings: { ...raw.configSettings, privateToken: 'changed' } }, 'mobile').scope).toEqual(original.scope)
  expect(performanceMeasurement({ ...raw, configSettings: { ...raw.configSettings, throttling: { cpuSlowdownMultiplier: 1 } } }, 'mobile').scope?.profileKey).not.toBe(original.scope?.profileKey)
  expect(performanceMeasurement({ ...raw, finalUrl: 'https://example.com/different' }, 'mobile').scope?.finalKey).not.toBe(original.scope?.finalKey)
  expect(performanceMeasurement({ ...raw, configSettings: { emulatedFormFactor: 'mobile', throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 } } }, 'mobile').scope).toEqual(original.scope)
  expect(performanceMeasurementSchema.parse({ ...original, scope: undefined }).scope).toBeUndefined()
})
it('records unavailable historical conditions as unknown', () => {
  expect(performanceMeasurement({ fetchTime: 'not-a-date', lighthouseVersion: 12 }, 'desktop')).toMatchObject({ measuredAt: null, lighthouseVersion: null, formFactor: null, throttlingMethod: null })
})
