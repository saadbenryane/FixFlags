import fs from 'fs/promises'
import type { Page } from 'playwright'
import { composeGif } from '@/lib/audit/capture/gif-compositor'
import { logger } from '@/lib/logger'
import { uploadIntegrityArtifact } from './storage'

export async function persistWalkVideo(input: {
  runId: string
  attempt: number
  page: Page
  stepPngs: Buffer[]
}): Promise<{ videoUrl: string | null; gifUrl: string | null }> {
  let videoUrl: string | null = null
  let gifUrl: string | null = null

  const video = input.page.video()
  const context = input.page.context()
  await input.page.close().catch(() => {})
  await context.close().catch(() => {})

  if (video) {
    try {
      const videoPath = await video.path()
      const bytes = await fs.readFile(videoPath)
      if (bytes.length > 0) {
        const uploaded = await uploadIntegrityArtifact(
          input.runId,
          `attempt-${input.attempt}.webm`,
          bytes,
          'video/webm'
        )
        videoUrl = uploaded.url
      }
      await fs.unlink(videoPath).catch(() => {})
    } catch (err) {
      logger.warn('Integrity walk video persist failed', {
        runId: input.runId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (input.stepPngs.length > 0) {
    try {
      const gif = await composeGif(
        input.stepPngs.map((buffer, index) => ({
          buffer,
          delayMs: index === 0 ? 900 : 700,
        })),
        { width: 375, height: 812, delayMs: 700 }
      )
      if (!gif) return { videoUrl, gifUrl }
      const uploaded = await uploadIntegrityArtifact(
        input.runId,
        `attempt-${input.attempt}.gif`,
        Buffer.from(gif.buffer),
        'image/gif'
      )
      gifUrl = uploaded.url
    } catch (err) {
      logger.warn('Integrity walk GIF fallback failed', {
        runId: input.runId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { videoUrl, gifUrl }
}
