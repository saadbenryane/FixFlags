import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  deriveScreenshotCaptureStatus,
  normalizeInternalScreenshotUrl,
  parseScreenshotCaptureStatus,
  resolveScreenshotPresentation,
} from '@/lib/audit/screenshot-types'
import type { ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'

describe('resolveScreenshotPresentation', () => {
  it('keeps missing captures neutral while capture is pending', () => {
    assert.deepEqual(
      resolveScreenshotPresentation('CAPTURING', [], {
        desktop: 'pending',
        mobile: 'pending',
      }),
      { state: 'pending' }
    )
  })

  it('marks unavailable only after capture has failed', () => {
    assert.deepEqual(
      resolveScreenshotPresentation('CHECKING', [], {
        desktop: 'failed',
        mobile: 'failed',
      }),
      {
        state: 'unavailable',
        failureCode: 'SCREENSHOT_CAPTURE_FAILED',
      }
    )
  })

  it('marks partial only after mobile explicitly failed', () => {
    assert.deepEqual(
      resolveScreenshotPresentation(
        'CHECKING',
        [{ device: 'DESKTOP', url: '/d.webp', width: 1280, height: 900 }],
        { desktop: 'ok', mobile: 'failed' }
      ),
      { state: 'partial', failedDevices: ['MOBILE'] }
    )
  })

  it('reports complete when both devices have evidence', () => {
    assert.deepEqual(
      resolveScreenshotPresentation(
        'COMPLETED',
        [
          { device: 'DESKTOP', url: '/d.webp', width: 1280, height: 900 },
          { device: 'MOBILE', url: '/m.webp', width: 375, height: 812 },
        ],
        null
      ),
      { state: 'complete' }
    )
  })
})

describe('normalizeInternalScreenshotUrl', () => {
  it('keeps internal screenshot requests on the current report origin', () => {
    assert.equal(
      normalizeInternalScreenshotUrl('http://localhost:3000/api/screenshots/audit-1/desktop'),
      '/api/screenshots/audit-1/desktop'
    )
    assert.equal(
      normalizeInternalScreenshotUrl('http://192.168.11.138:3000/api/screenshots/audit-1/mobile?page=flow-1'),
      '/api/screenshots/audit-1/mobile?page=flow-1'
    )
  })

  it('leaves external images untouched', () => {
    assert.equal(
      normalizeInternalScreenshotUrl('https://cdn.example.com/screenshots/audit-1.png'),
      'https://cdn.example.com/screenshots/audit-1.png'
    )
  })
})

describe('parseScreenshotCaptureStatus', () => {
  it('reads screenshots from performanceData', () => {
    const parsed = parseScreenshotCaptureStatus({
      screenshots: { desktop: 'ok', mobile: 'failed' },
    })
    assert.deepEqual(parsed, { desktop: 'ok', mobile: 'failed' })
  })

  it('returns null for invalid payload', () => {
    assert.equal(parseScreenshotCaptureStatus(null), null)
    assert.equal(parseScreenshotCaptureStatus({ screenshots: {} }), null)
  })
})

describe('deriveScreenshotCaptureStatus', () => {
  it('prefers stored status when present', () => {
    const stored: ScreenshotCaptureStatus = { desktop: 'ok', mobile: 'pending' }
    const derived = deriveScreenshotCaptureStatus('CAPTURING', [], stored)
    assert.deepEqual(derived, stored)
  })

  it('derives ok from screenshot rows', () => {
    const derived = deriveScreenshotCaptureStatus('COMPLETED', [
      { device: 'DESKTOP' },
      { device: 'MOBILE' },
    ], null)
    assert.deepEqual(derived, { desktop: 'ok', mobile: 'ok' })
  })

  it('marks failed after capture phase when rows missing', () => {
    const derived = deriveScreenshotCaptureStatus('COMPLETED', [], null)
    assert.deepEqual(derived, { desktop: 'failed', mobile: 'failed' })
  })
})
