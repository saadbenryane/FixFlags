/**
 * Multi-frame capture engine. Captures a time-series of screenshots during
 * page load for composing into animated GIFs.
 */
import type { Page } from 'playwright'
import { captureScreenshot } from '../browser/capture-screenshot'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'

export interface FrameCaptureOptions {
  maxFrames?: number
  intervalMs?: number
  totalWindowMs?: number
  captureBlankFrame?: boolean
  deadline?: number
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
    deadline = Infinity,
  } = options ?? {}

  const frames: CapturedFrame[] = []
  const startedAt = Date.now()
  const captureDeadline = Math.min(deadline, startedAt + totalWindowMs)

  if (captureBlankFrame) {
    try {
      const buffer = await captureScreenshot(page, { type: 'png', fullPage: false }, captureDeadline)
      const readyState = await page.evaluate(() => document.readyState)
      frames.push({ index: 0, timestampMs: 0, url: page.url(), readyState, buffer })
    } catch { /* continue */ }
  }

  const frameInterval = totalWindowMs / maxFrames
  for (let i = frames.length; i < maxFrames; i++) {
    if (Date.now() >= captureDeadline) break
    const targetMs = i * frameInterval
    const elapsed = Date.now() - startedAt
    if (elapsed < targetMs) await sleep(Math.min(targetMs - elapsed, captureDeadline - Date.now()))
    if (Date.now() >= captureDeadline) break

    const readyState = await page.evaluate(() => document.readyState).catch(() => 'unknown')
    if (readyState === 'complete' && i > 2) {
      try {
        const buffer = await captureScreenshot(page, { type: 'png', fullPage: false }, captureDeadline)
        frames.push({ index: i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
      } catch { /* skip */ }
      break
    }

    try {
      const buffer = await captureScreenshot(page, { type: 'png', fullPage: false }, captureDeadline)
      frames.push({ index: i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
    } catch { /* skip */ }
  }

  for (const frame of frames) {
    if (Date.now() >= deadline) break
    try {
      const key = `${pageKey}-frame-${frame.index}`
      const url = await uploadScreenshot(auditId, device, frame.buffer, key, { deadline })
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
  options?: { preFrames?: number; postFrames?: number; postDelayMs?: number; deadline?: number }
): Promise<FrameSet> {
  const { preFrames = 2, postFrames = 4, postDelayMs = 2000, deadline = Infinity } = options ?? {}
  const frames: CapturedFrame[] = []
  const startedAt = Date.now()

  for (let i = 0; i < preFrames; i++) {
    if (Date.now() >= deadline) break
    await sleep(Math.min(200, deadline - Date.now()))
    try {
      const buffer = await captureScreenshot(page, { type: 'png', fullPage: false }, deadline)
      const readyState = await page.evaluate(() => document.readyState)
      frames.push({ index: i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
    } catch { /* skip */ }
  }

  try { if (Date.now() < deadline) await interaction(page) } catch (err) {
    logger.error('Interaction failed during frame capture', err)
  }

  const postInterval = postDelayMs / postFrames
  for (let i = 0; i < postFrames; i++) {
    if (Date.now() >= deadline) break
    await sleep(Math.min(postInterval, deadline - Date.now()))
    try {
      const buffer = await captureScreenshot(page, { type: 'png', fullPage: false }, deadline)
      const readyState = await page.evaluate(() => document.readyState)
      frames.push({ index: preFrames + i, timestampMs: Date.now() - startedAt, url: page.url(), readyState, buffer })
    } catch { /* skip */ }
  }

  for (const frame of frames) {
    if (Date.now() >= deadline) break
    try {
      const key = `${pageKey}-interaction-${frame.index}`
      const url = await uploadScreenshot(auditId, device, frame.buffer, key, { deadline })
      if (url) frame.url = url
    } catch (err) {
      logger.error(`Failed to upload interaction frame ${frame.index}`, err)
    }
  }

  return { frames, totalTimeMs: Date.now() - startedAt, device, pageKey }
}

import { sleep } from '@/lib/utils/sleep'
