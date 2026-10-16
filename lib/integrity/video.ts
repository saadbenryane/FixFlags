import fs from 'fs/promises'
import type { Page } from 'playwright'
import { composeGif } from '@/lib/audit/capture/gif-compositor'
import { currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import { logger } from '@/lib/logger'
import { uploadIntegrityArtifact } from './storage'
import type { PathStepEvidence, PathStepLabel } from './types'

/** Capture the observation now. Private storage has no place in the live walk. */
export async function captureWalkStep(page: Page, label: PathStepLabel,
  steps: PathStepEvidence[], stepPngs: Array<Buffer | null>): Promise<void> {
  const url = page.url()
  let buffer: Buffer | null = null
  try {
    buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: false, timeout: 1500 }))
    if (page.url() !== url) buffer = null
  } catch { /* The observed step survives unavailable media. */ }
  steps.push({ label, url, screenshotUrl: null })
  stepPngs.push(buffer)
}

export async function persistWalkVideo(input: {
  runId: string
  attempt: number
  page: Page
  steps: PathStepEvidence[]
  stepPngs: Array<Buffer | null>
  recordingDir?: string
  deadline?: number
}): Promise<{ videoUrl: string | null; gifUrl: string | null }> {
  let videoUrl: string | null = null, gifUrl: string | null = null
  const video = input.page.video()
  // Request native closure even when the caller's budget has already ended.
  const closing = input.page.context().close()
  void closing.catch(() => undefined)
  const deadline = Math.min(input.deadline ?? Infinity, Date.now() + 5_000)
  const controller = new AbortController()
  const parent = currentExecutionOwnership()?.signal
  const signal = parent ? AbortSignal.any([controller.signal, parent]) : controller.signal
  const expired = new Error('Optional walk media deadline exceeded')
  const assertActive = () => { signal.throwIfAborted(); if (Date.now() >= deadline) throw expired }
  let rejectCancelled!: (error: unknown) => void
  const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject })
  void cancelled.catch(() => undefined)
  const abort = () => rejectCancelled(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  const timer = setTimeout(() => controller.abort(expired), Math.max(0, deadline - Date.now()))
  timer.unref?.()
  async function bounded<T>(work: () => Promise<T>): Promise<T> {
    assertActive()
    const result = await Promise.race([work(), cancelled])
    assertActive()
    return result
  }
  const options = { deadline, signal }
  try {
    await bounded(() => closing)
    for (const [index, buffer] of input.stepPngs.entries()) {
      const step = input.steps[index]
      if (!buffer || !step) continue
      try {
        const uploaded = await bounded(() => uploadIntegrityArtifact(input.runId,
          'attempt-' + input.attempt + '-' + index + '-' + step.label + '.png', buffer, 'image/png', options))
        step.screenshotUrl = uploaded.url
      } catch (error) {
        assertActive()
        logger.warn('Integrity walk frame persist failed', { runId: input.runId, error: String(error) })
      }
    }
    if (video) {
      try {
        const videoPath = await bounded(() => video.path())
        const bytes = await bounded(() => fs.readFile(videoPath))
        if (bytes.length) {
          const uploaded = await bounded(() => uploadIntegrityArtifact(input.runId,
            'attempt-' + input.attempt + '.webm', bytes, 'video/webm', options))
          videoUrl = uploaded.url
        }
      } catch (error) {
        assertActive()
        logger.warn('Integrity walk video persist failed', { runId: input.runId, error: String(error) })
      }
    }
    const frames = input.stepPngs.filter((buffer): buffer is Buffer => buffer !== null)
    if (frames.length) {
      const gif = await bounded(() => composeGif(frames.map((buffer, index) => ({ buffer,
        delayMs: index === 0 ? 900 : 700 })), { width: 375, height: 812, delayMs: 700 }))
      if (gif) {
        const uploaded = await bounded(() => uploadIntegrityArtifact(input.runId,
          'attempt-' + input.attempt + '.gif', gif.buffer, 'image/gif', options))
        gifUrl = uploaded.url
      }
    }
  } catch (error) {
    logger.warn('Optional integrity walk media could not complete', { runId: input.runId, error: String(error) })
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
    controller.abort(expired)
    // Recording finalization can outlive our optional-media budget. Remove
    // only this attempt's files after native closure actually acknowledges.
    void closing.then(async () => {
      if (video) await video.delete().catch(() => undefined)
      if (input.recordingDir) await fs.rm(input.recordingDir, { recursive: true, force: true })
    }).catch(() => undefined)
  }
  return { videoUrl, gifUrl }
}
