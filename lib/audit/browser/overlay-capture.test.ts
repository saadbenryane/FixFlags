import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import type { Page } from 'playwright'
import { overlayControlContext, type OverlayObservation } from '../checks/overlay-evidence'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), probe: vi.fn(), controls: vi.fn() }))
vi.mock('@/lib/storage/screenshots', () => ({ uploadScreenshot: (...args: unknown[]) => mocks.upload(...args) }))
vi.mock('./overlay-probe', () => ({ probeCoverAtPoint: (...args: unknown[]) => mocks.probe(...args) }))
vi.mock('./overlay-observation', () => ({ readOverlayControls: (...args: unknown[]) => mocks.controls(...args) }))
import { captureOverlayFailure } from './overlay-capture'

const scope = { pageUrl: 'https://example.com/', finalUrl: 'https://example.com/', profile: 'mobile', access: 'public' }
const control: OverlayObservation['controls'][number] = { kind: 'nav', selector: '#original', label: 'Original link',
  context: overlayControlContext(scope, 'nav', 'original'), disposition: 'failed', reason: 'persistent_overlay',
  blocker: { tag: 'div', id: 'cover', className: 'overlay', role: 'dialog', text: 'Advertisement', zIndex: '40' } }
beforeEach(() => {
  mocks.upload.mockReset().mockResolvedValue('/api/screenshots/audit/mobile?page=overlay-fixture'); mocks.probe.mockReset().mockResolvedValue(control.blocker)
  mocks.controls.mockReset().mockResolvedValue({ complete: true, pageUrl: scope.finalUrl, controls: [{ identity: 'original' }] })
})

async function pageFixture() {
  const bytes = await sharp({ create: { width: 375, height: 812, channels: 3, background: 'white' } }).png().toBuffer()
  const bounds = vi.fn().mockResolvedValue({ x: 20, y: 500, width: 300, height: 48 })
  const page = { locator: () => ({ boundingBox: bounds }), viewportSize: () => ({ width: 375, height: 812 }), screenshot: vi.fn().mockResolvedValue(bytes) } as unknown as Page
  return { page, bounds, bytes }
}

it('annotates the observed viewport and stores an immutable Flag-owned image', async () => {
  const { page, bytes } = await pageFixture(), deadline = Date.now() + 10_000
  const capture = await captureOverlayFailure(page, control, { auditId: 'audit', device: 'mobile', deadline, scope })
  expect(capture).toMatchObject({ context: control.context, url: '/api/screenshots/audit/mobile?page=overlay-fixture' })
  const [audit, device, image, key, options] = mocks.upload.mock.calls[0]
  expect([audit, device]).toEqual(['audit', 'mobile'])
  expect(key).toMatch(/^overlay-[a-f0-9-]+$/)
  expect(options).toEqual({ deadline })
  expect(image.equals(bytes)).toBe(false)
  expect(await sharp(image).metadata()).toMatchObject({ width: 375, height: 812, format: 'png' })
})

it.each(['moved', 'uncovered'] as const)('withholds an image when its target is %s during capture', async condition => {
  const { page, bounds } = await pageFixture()
  if (condition === 'moved') bounds.mockResolvedValueOnce({ x: 20, y: 500, width: 300, height: 48 }).mockResolvedValue({ x: 20, y: 300, width: 300, height: 48 })
  else mocks.probe.mockResolvedValue(null)
  expect(await captureOverlayFailure(page, control, { auditId: 'audit', device: 'mobile', deadline: Date.now() + 10_000, scope })).toBeUndefined()
  expect(mocks.upload).not.toHaveBeenCalled()
})

it('withholds an image when a visually similar control replaces the original', async () => {
  const { page } = await pageFixture()
  mocks.controls.mockResolvedValueOnce({ complete: true, pageUrl: scope.finalUrl, controls: [{ identity: 'original' }] })
    .mockResolvedValue({ complete: true, pageUrl: scope.finalUrl, controls: [{ identity: 'replacement' }] })
  expect(await captureOverlayFailure(page, control, { auditId: 'audit', device: 'mobile', deadline: Date.now() + 10_000, scope })).toBeUndefined()
  expect(mocks.upload).not.toHaveBeenCalled()
})
