/**
 * Visual capture orchestrator. Decides what visual evidence to capture
 * for a given set of flags and composes the final outputs.
 */
import type { Browser, Page } from 'puppeteer'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { getVisualDescriptor } from './visual-types'
import { captureLoadFrames, captureInteractionFrames, type FrameSet } from './frames'
import { renderOverlay, type OverlayContext } from './overlays'
import { composeGif } from './gif-compositor'

export interface VisualEvidence {
  checkId: string
  device: 'desktop' | 'mobile'
  gifUrl: string | null
  overlayUrl: string | null
  type: 'animated-gif' | 'static-overlay' | 'side-by-side'
}

export interface VisualCaptureResult {
  visuals: VisualEvidence[]
  additionalFrames: FrameSet[]
}

export async function captureVisualEvidence(
  browser: Browser,
  page: Page,
  auditId: string,
  flags: Array<{ checkId: string; severity: string; rubric: string }>,
  device: 'desktop' | 'mobile' = 'mobile'
): Promise<VisualCaptureResult> {
  const result: VisualCaptureResult = { visuals: [], additionalFrames: [] }

  const gifFlags = flags.filter((f) => {
    const d = getVisualDescriptor(f.checkId)
    return d.type === 'animated-gif' && (d.device === device || d.device === 'both' || !d.device)
  })

  const overlayFlags = flags.filter((f) => {
    const d = getVisualDescriptor(f.checkId)
    return d.type === 'static-overlay' && (d.device === device || d.device === 'both' || !d.device)
  })

  if (gifFlags.length > 0) {
    for (const flag of gifFlags) {
      const desc = getVisualDescriptor(flag.checkId)
      if (desc.type !== 'animated-gif') continue
      try {
        const pageKey = `visual-${flag.checkId}`
        const isLoad = flag.checkId.includes('loading') || flag.checkId.includes('lcp') ||
          flag.checkId.includes('perf') || flag.checkId.includes('slow') ||
          flag.checkId.includes('blank') || flag.checkId.includes('delay')

        let frameSet: FrameSet | null = null
        if (isLoad) {
          frameSet = await captureLoadFrames(page, auditId, device, pageKey, {
            intervalMs: desc.gifIntervalMs ?? 500,
            maxFrames: desc.gifMaxFrames ?? 6,
            totalWindowMs: 8000,
          })
        } else {
          frameSet = await captureInteractionFrames(page, auditId, device, pageKey, async (p) => {
            await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
            await new Promise((r) => setTimeout(r, 500))
            await p.evaluate(() => window.scrollTo(0, 0))
          }, { preFrames: 2, postFrames: desc.gifMaxFrames ?? 4, postDelayMs: 2000 })
        }

        if (frameSet && frameSet.frames.length >= 2) {
          const gif = await composeGif(
            frameSet.frames.map((f) => ({
              buffer: f.buffer,
              delayMs: f.index === 0 ? 1000 : desc.gifIntervalMs ?? 500,
            })),
            { delayMs: desc.gifIntervalMs ?? 500, width: device === 'mobile' ? 375 : 640, quality: 10 }
          )
          if (gif) {
            const url = await uploadScreenshot(auditId, device, gif.buffer, `visual-${flag.checkId}`)
            result.visuals.push({ checkId: flag.checkId, device, gifUrl: url, overlayUrl: null, type: 'animated-gif' })
          }
        }
      } catch (err) {
        logger.error(`Failed to capture GIF for ${flag.checkId}`, err)
      }
    }
  }

  if (overlayFlags.length > 0) {
    const buf = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
    const meta = await import('sharp').then((s) => s.default(buf).metadata())
    const w = meta.width ?? 1280, h = meta.height ?? 900

    for (const flag of overlayFlags) {
      const desc = getVisualDescriptor(flag.checkId)
      if (desc.type !== 'static-overlay' || !desc.overlay) continue
      try {
        const ctx: OverlayContext = { screenshotBuffer: buf, width: w, height: h }
        enrichOverlayContext(ctx, flag.checkId)
        const res = await renderOverlay(desc.overlay, ctx)
        const url = await uploadScreenshot(auditId, device, res.buffer, `visual-${flag.checkId}`)
        result.visuals.push({ checkId: flag.checkId, device, gifUrl: null, overlayUrl: url, type: 'static-overlay' })
      } catch (err) {
        logger.error(`Failed to render overlay for ${flag.checkId}`, err)
      }
    }
  }

  return result
}

function enrichOverlayContext(ctx: OverlayContext, checkId: string): void {
  switch (checkId) {
    case 'perf-score-critical': case 'perf-score-poor':
      ctx.value = 0; ctx.label = 'PageSpeed Score'; break
    case 'cta-below-fold-mobile':
      ctx.region = { x: 0.2, y: 0.88, width: 0.6, height: 0.07 }; ctx.label = 'CTA below fold'; break
    case 'mobile-cta-thumb-zone':
      ctx.region = { x: 0.3, y: 0.65, width: 0.4, height: 0.06 }; ctx.label = 'Thumb zone issue'; break
    case 'form-inputs-zoom-mobile': case 'mobile-input-zoom':
      ctx.label = 'iOS zoom triggers'; break
    case 'loading-indicator-stuck': case 'loading-state-slow':
      ctx.region = { x: 0.1, y: 0.1, width: 0.8, height: 0.22 }; ctx.label = 'Loading UI persists'; break
    case 'friction-no-commitment-path':
      ctx.region = { x: 0.25, y: 0.45, width: 0.5, height: 0.06 }; ctx.label = 'No CTA found'; break
    case 'friction-form-too-many-fields':
      ctx.value = 6; ctx.label = 'Too many fields'; break
    case 'console-errors-critical': case 'console-errors-some':
      ctx.detail = 'JavaScript errors in console'; break
    case 'slow-3g-blank-screen':
      ctx.value = 5000; ctx.label = 'Blank on slow 3G'; break
  }
}
