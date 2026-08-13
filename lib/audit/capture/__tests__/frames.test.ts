import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import type { Page } from 'playwright'

const { uploadScreenshot } = vi.hoisted(() => ({ uploadScreenshot: vi.fn() }))
vi.mock('@/lib/storage/screenshots', () => ({ uploadScreenshot }))

vi.mock('@/lib/utils/sleep', () => ({
  sleep: vi.fn(async () => {}),
}))

import {
  captureLoadFrames,
  captureInteractionFrames,
} from '../frames'

function fakePage(overrides: Record<string, unknown> = {}): Page {
  return {
    url: vi.fn(() => 'https://example.com/'),
    screenshot: vi.fn(async () => Buffer.from('png-bytes')),
    evaluate: vi.fn(async () => 'complete'),
    ...overrides,
  } as unknown as Page
}

describe('captureLoadFrames', () => {
  beforeEach(() => {
    uploadScreenshot.mockReset()
    uploadScreenshot.mockImplementation(async () => 'https://cdn.example/frame.png')
  })

  it('captures a blank frame, stops on complete, and uploads frames', async () => {
    const page = fakePage()
    const frameset = await captureLoadFrames(page, 'audit-1', 'desktop', 'home', {
      totalWindowMs: 4000,
      maxFrames: 8,
    })

    assert.equal(frameset.device, 'desktop')
    assert.equal(frameset.pageKey, 'home')
    assert.ok(frameset.totalTimeMs >= 0)
    assert.ok(frameset.frames.length >= 2)

    // Blank frame first, then a complete frame: readyState complete at i=3 breaks the loop
    assert.equal(frameset.frames[0].index, 0)
    assert.equal(frameset.frames[0].readyState, 'complete')

    // Every frame's url is replaced by the uploaded URL
    for (const frame of frameset.frames) {
      assert.equal(frame.url, 'https://cdn.example/frame.png')
    }
    expect(uploadScreenshot).toHaveBeenCalledWith(
      'audit-1',
      'desktop',
      expect.any(Buffer),
      expect.stringMatching(/^home-frame-\d+$/)
    )
    expect(page.screenshot).toHaveBeenCalledWith({ type: 'png', fullPage: false })
  })

  it('keeps the page url when upload returns null', async () => {
    uploadScreenshot.mockResolvedValue(null)
    const page = fakePage()
    const frameset = await captureLoadFrames(page, 'audit-1', 'mobile', 'home', {
      totalWindowMs: 2000,
      maxFrames: 4,
    })
    for (const frame of frameset.frames) {
      assert.equal(frame.url, 'https://example.com/')
    }
  })

  it('continues when a screenshot throws', async () => {
    const page = fakePage({
      screenshot: vi
        .fn()
        .mockRejectedValueOnce(new Error('browser closed'))
        .mockResolvedValue(Buffer.from('png')),
    })
    const frameset = await captureLoadFrames(page, 'audit-1', 'desktop', 'home', {
      totalWindowMs: 2000,
      maxFrames: 4,
    })
    assert.ok(frameset.frames.length >= 1)
  })

  it('skips the blank frame when captureBlankFrame is false', async () => {
    const page = fakePage()
    const frameset = await captureLoadFrames(page, 'audit-1', 'desktop', 'home', {
      captureBlankFrame: false,
      totalWindowMs: 2000,
      maxFrames: 4,
    })
    assert.ok(!frameset.frames.some((f) => f.index === 0 && f.readyState === 'complete' && f.url === 'https://example.com/'))
    assert.equal(frameset.frames[0].index, 0)
  })

  it('walks the full window when the page never reaches complete', async () => {
    const page = fakePage({
      evaluate: vi.fn(async () => 'loading'),
    })
    const frameset = await captureLoadFrames(page, 'audit-1', 'desktop', 'home', {
      captureBlankFrame: false,
      totalWindowMs: 3000,
      maxFrames: 3,
    })
    assert.equal(frameset.frames.length, 3)
  })

  it('uses the unknown readyState fallback when evaluate rejects mid-loop', async () => {
    const page = fakePage({
      evaluate: vi.fn().mockRejectedValue(new Error('navigated away')),
    })
    const frameset = await captureLoadFrames(page, 'audit-1', 'desktop', 'home', {
      captureBlankFrame: false,
      totalWindowMs: 2000,
      maxFrames: 2,
    })
    assert.equal(frameset.frames[0].readyState, 'unknown')
  })
})

describe('captureInteractionFrames', () => {
  beforeEach(() => {
    uploadScreenshot.mockReset()
    uploadScreenshot.mockImplementation(async () => 'https://cdn.example/frame.png')
  })

  it('captures pre-frames, runs the interaction, then post-frames', async () => {
    const page = fakePage()
    const interaction = vi.fn(async () => {})
    const frameset = await captureInteractionFrames(
      page,
      'audit-1',
      'mobile',
      'pricing',
      interaction,
      { preFrames: 2, postFrames: 3, postDelayMs: 300 }
    )

    assert.equal(frameset.frames.length, 5)
    assert.deepEqual(
      frameset.frames.map((f) => f.index),
      [0, 1, 2, 3, 4]
    )
    expect(interaction).toHaveBeenCalledTimes(1)
    expect(uploadScreenshot).toHaveBeenCalledWith(
      'audit-1',
      'mobile',
      expect.any(Buffer),
      expect.stringMatching(/^pricing-interaction-\d+$/)
    )
  })

  it('is non-fatal when the interaction throws', async () => {
    const page = fakePage()
    const frameset = await captureInteractionFrames(
      page,
      'audit-1',
      'desktop',
      'home',
      async () => {
        throw new Error('interaction exploded')
      },
      { preFrames: 1, postFrames: 1, postDelayMs: 0 }
    )
    assert.equal(frameset.frames.length, 2)
  })
})
