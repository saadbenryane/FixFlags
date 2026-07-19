/**
 * Multi-frame capture engine. Captures a time-series of screenshots during
 * page load for composing into animated GIFs.
 */
import type { Page } from 'puppeteer'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'

export interface FrameCaptureOptions {
  maxFrames?: number
  intervalMs?: number
  totalWindowMs?: number
  captureBlankFrame?: boolean
}

export interface CapturedFrame {
  index: number
  timestampMs: number
  url: string
  readyState: string
  buffer: Buffer
}

export interface FrameSet {
  frames: CapturedFrame[]
  totalTimeMs: number
  device: 'desktop' | 'mobile'
  pageKey: string
}

export async function captureLoadFrames(
  page: Page,
  auditId: string,
  device: 'desktop' | 'mobile',
  pageKey: string,
  options?: FrameCaptureOptions
): Promise<FrameSet> {
  const {
    maxFrames = 8,
    totalWindowMs = 8000,
    captureBlankFrame = true,
  } = options ?? {}

  const frames: CapturedFrame[] = []
  const startedAt = Date.now()

  if (captureBlankFrame) {
    try {
      const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
      const readyState = await page.evaluate(() => document.readyState)
      frames.push({ index: 0, timestampMs: 0, url: page.url(), readyState, buffer })
    } catch { /* continue */ }
  }

  const frameInterval = totalWindowMs / maxFrames
  for (let i = frames.length; i < maxFrames; i++) {
    const targetMs = i * frameInterval
    const elapsed = Date.now() - startedAt
    if (elapsed < targetMs) await sleep(targetMs - elapsed)

    const readyState = await page.evaluate(() => document.readyState).catch(() => 'unknown')
    if (readyState === 'complete' && i > 2) {
      try {
        const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
        frames.push({ index: i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
      } catch { /* skip */ }
      break
    }

    try {
      const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
      frames.push({ index: i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
    } catch { /* skip */ }
  }

  for (const frame of frames) {
    try {
      const key = `${pageKey}-frame-${frame.index}`
      const url = await uploadScreenshot(auditId, device, frame.buffer, key)
      if (url) frame.url = url
    } catch (err) {
      logger.error(`Failed to upload frame ${frame.index}`, err)
    }
  }

  return { frames, totalTimeMs: Date.now() - startedAt, device, pageKey }
}

export async function captureInteractionFrames(
  page: Page,
  auditId: string,
  device: 'desktop' | 'mobile',
  pageKey: string,
  interaction: (page: Page) => Promise<void>,
  options?: { preFrames?: number; postFrames?: number; postDelayMs?: number }
): Promise<FrameSet> {
  const { preFrames = 2, postFrames = 4, postDelayMs = 2000 } = options ?? {}
  const frames: CapturedFrame[] = []
  const startedAt = Date.now()

  for (let i = 0; i < preFrames; i++) {
    await sleep(200)
    try {
      const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
      const readyState = await page.evaluate(() => document.readyState)
      frames.push({ index: i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
    } catch { /* skip */ }
  }

  try { await interaction(page) } catch (err) {
    logger.error('Interaction failed during frame capture', err)
  }

  const postInterval = postDelayMs / postFrames
  for (let i = 0; i < postFrames; i++) {
    await sleep(postInterval)
    try {
      const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
      const readyState = await page.evaluate(() => document.readyState)
      frames.push({ index: preFrames + i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
    } catch { /* skip */ }
  }

  for (const frame of frames) {
    try {
      const key = `${pageKey}-interaction-${frame.index}`
      const url = await uploadScreenshot(auditId, device, frame.buffer, key)
      if (url) frame.url = url
    } catch (err) {
      logger.error(`Failed to upload interaction frame ${frame.index}`, err)
    }
  }

  return { frames, totalTimeMs: Date.now() - startedAt, device, pageKey }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
