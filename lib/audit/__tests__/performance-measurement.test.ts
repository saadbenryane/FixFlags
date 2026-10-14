import { expect, it, vi, afterEach } from 'vitest'
import { performanceMeasurement } from '../performance-measurement'
afterEach(() => vi.useRealTimers())
it('retains only actual bounded provider measurement conditions', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
  const value = performanceMeasurement({ fetchTime: '2026-10-14T09:59:00Z', lighthouseVersion: '13.0', configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate', privateToken: 'secret' }, requestHeaders: 'secret' }, 'mobile')
  expect(value).toEqual({ version: 1, source: 'google-pagespeed', strategy: 'mobile', receivedAt: '2026-10-14T10:00:00.000Z', measuredAt: '2026-10-14T09:59:00Z', lighthouseVersion: '13.0', formFactor: 'mobile', throttlingMethod: 'simulate' })
})
it('records unavailable historical conditions as unknown', () => {
  expect(performanceMeasurement({ fetchTime: 'not-a-date', lighthouseVersion: 12 }, 'desktop')).toMatchObject({ measuredAt: null, lighthouseVersion: null, formFactor: null, throttlingMethod: null })
})
