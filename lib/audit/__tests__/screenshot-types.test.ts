import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  deriveScreenshotCaptureStatus,
  normalizeInternalScreenshotUrl,
  parseScreenshotCaptureStatus,
  resolveCapturePair,
} from '@/lib/audit/screenshot-types'
import type { ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'

describe('resolveCapturePair', () => {
  it('keeps a missing capture loading until its status says failed', () => {
    const pair = resolveCapturePair([], { desktop: 'pending', mobile: 'failed' })
    assert.equal(pair.desktopState, 'loading')
    assert.equal(pair.mobileState, 'failed')
  })

  it('reports both devices loaded when evidence exists', () => {
    const pair = resolveCapturePair(
      [
        { device: 'DESKTOP', url: '/d.webp', width: 1280, height: 900 },
        { device: 'MOBILE', url: '/m.webp', width: 375, height: 812 },
      ],
      { desktop: 'ok', mobile: 'ok' }
    )
    assert.equal(pair.desktopState, 'loaded')
    assert.equal(pair.mobileState, 'loaded')
    assert.equal(pair.desktop, '/d.webp')
    assert.equal(pair.mobile, '/m.webp')
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
