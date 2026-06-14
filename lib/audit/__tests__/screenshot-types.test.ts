import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveScreenshotCaptureStatus,
  parseScreenshotCaptureStatus,
  resolveScreenshotUx,
} from '@/lib/audit/screenshot-types'

describe('resolveScreenshotUx', () => {
  it('marks limited when desktop screenshot missing', () => {
    const ux = resolveScreenshotUx([], { desktop: 'failed', mobile: 'failed' })
    assert.equal(ux.limited, true)
    assert.equal(ux.partial, false)
  })

  it('marks partial when desktop ok but mobile failed', () => {
    const ux = resolveScreenshotUx(
      [{ device: 'DESKTOP', url: '/d.webp', width: 1280, height: 900 }],
      { desktop: 'ok', mobile: 'failed' }
    )
    assert.equal(ux.limited, false)
    assert.equal(ux.partial, true)
  })

  it('does not mark partial when mobile still pending', () => {
    const ux = resolveScreenshotUx(
      [{ device: 'DESKTOP', url: '/d.webp', width: 1280, height: 900 }],
      { desktop: 'ok', mobile: 'pending' }
    )
    assert.equal(ux.partial, false)
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
    const stored = { desktop: 'ok', mobile: 'pending' }
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
