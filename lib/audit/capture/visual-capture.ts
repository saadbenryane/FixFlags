/**
 * Visual capture orchestrator. Decides what visual evidence to capture
 * for a given set of flags and composes the final outputs.
 */
import type { Browser, Page } from 'playwright'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { getVisualDescriptor, type VisualDescriptor } from './visual-types'
import { captureLoadFrames, captureInteractionFrames, type FrameSet } from './frames'
import { renderOverlay, type OverlayContext } from './overlays'
import { composeGif, composeSideBySide } from './gif-compositor'

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

export interface VisualCaptureMetrics {
  perfScore?: number | null
  mobilePrimaryCtaTopPx?: number | null
  competingPrimaryCtaCount?: number | null
  stuckLoadingIndicator?: boolean
  formFieldCount?: number | null
  consoleErrorCount?: number | null
}

/** Cap expensive GIF captures per device so scans stay within deadline. */
const MAX_GIFS_PER_DEVICE = 3
const MAX_OVERLAYS_PER_DEVICE = 5
const MAX_SIDE_BY_SIDE = 3

export async function captureVisualEvidence(
  browser: Browser,
  page: Page,
  auditId: string,
  flags: Array<{ checkId: string; severity: string; rubric: string }>,
  device: 'desktop' | 'mobile' = 'mobile',
  metrics?: VisualCaptureMetrics
): Promise<VisualCaptureResult> {
  const result: VisualCaptureResult = { visuals: [], additionalFrames: [] }

  const gifFlags = flags
    .filter((f) => {
      const d = getVisualDescriptor(f.checkId)
      return d.type === 'animated-gif' && matchesDevice(d, device)
    })
    .slice(0, MAX_GIFS_PER_DEVICE)

  const overlayFlags = flags
    .filter((f) => {
      const d = getVisualDescriptor(f.checkId)
      return d.type === 'static-overlay' && matchesDevice(d, device)
    })
    .slice(0, MAX_OVERLAYS_PER_DEVICE)

  const sideBySideFlags = flags
    .filter((f) => {
      const d = getVisualDescriptor(f.checkId)
      return d.type === 'side-by-side' && matchesDevice(d, device)
    })
    .slice(0, MAX_SIDE_BY_SIDE)

  for (const flag of gifFlags) {
    const desc = getVisualDescriptor(flag.checkId)
    if (desc.type !== 'animated-gif') continue
    try {
      const pageKey = `visual-${flag.checkId}`
      const isLoad =
        flag.checkId.includes('loading') ||
        flag.checkId.includes('lcp') ||
        flag.checkId.includes('perf') ||
        flag.checkId.includes('slow') ||
        flag.checkId.includes('blank') ||
        flag.checkId.includes('delay')

      let frameSet: FrameSet | null = null
      if (isLoad) {
        frameSet = await captureLoadFrames(page, auditId, device, pageKey, {
          intervalMs: desc.gifIntervalMs ?? 500,
          maxFrames: desc.gifMaxFrames ?? 6,
          totalWindowMs: 8000,
        })
      } else {
        frameSet = await captureInteractionFrames(
          page,
          auditId,
          device,
          pageKey,
          async (p) => {
            await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
            await new Promise((r) => setTimeout(r, 500))
            await p.evaluate(() => window.scrollTo(0, 0))
          },
          { preFrames: 2, postFrames: desc.gifMaxFrames ?? 4, postDelayMs: 2000 }
        )
      }

      if (frameSet && frameSet.frames.length >= 2) {
        const gif = await composeGif(
          frameSet.frames.map((f) => ({
            buffer: f.buffer,
            delayMs: f.index === 0 ? 1000 : desc.gifIntervalMs ?? 500,
          })),
          {
            delayMs: desc.gifIntervalMs ?? 500,
            width: device === 'mobile' ? 375 : 640,
          }
        )
        if (gif) {
          const url = await uploadScreenshot(auditId, device, gif.buffer, `visual-${flag.checkId}`)
          result.visuals.push({
            checkId: flag.checkId,
            device,
            gifUrl: url,
            overlayUrl: null,
            type: 'animated-gif',
          })
        }
      }
    } catch (err) {
      logger.error(`Failed to capture GIF for ${flag.checkId}`, err)
    }
  }

  if (overlayFlags.length > 0) {
    const buf = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    const meta = await import('sharp').then((s) => s.default(buf).metadata())
    const w = meta.width ?? 1280
    const h = meta.height ?? 900

    for (const flag of overlayFlags) {
      const desc = getVisualDescriptor(flag.checkId)
      if (desc.type !== 'static-overlay' || !desc.overlay) continue
      try {
        const ctx: OverlayContext = { screenshotBuffer: buf, width: w, height: h }
        enrichOverlayContext(ctx, flag.checkId, metrics)
        const res = await renderOverlay(desc.overlay, ctx)
        const url = await uploadScreenshot(auditId, device, res.buffer, `visual-${flag.checkId}`)
        result.visuals.push({
          checkId: flag.checkId,
          device,
          gifUrl: null,
          overlayUrl: url,
          type: 'static-overlay',
        })
      } catch (err) {
        logger.error(`Failed to render overlay for ${flag.checkId}`, err)
      }
    }
  }

  for (const flag of sideBySideFlags) {
    const desc = getVisualDescriptor(flag.checkId)
    if (desc.type !== 'side-by-side') continue
    try {
      const evidence = await captureSideBySide(browser, page, auditId, flag.checkId, desc, device)
      if (evidence) result.visuals.push(evidence)
    } catch (err) {
      logger.error(`Failed to capture side-by-side for ${flag.checkId}`, err)
    }
  }

  return result
}

function matchesDevice(desc: VisualDescriptor, device: 'desktop' | 'mobile'): boolean {
  return desc.device === device || desc.device === 'both' || !desc.device
}

async function captureSideBySide(
  browser: Browser,
  currentPage: Page,
  auditId: string,
  checkId: string,
  desc: VisualDescriptor,
  device: 'desktop' | 'mobile'
): Promise<VisualEvidence | null> {
  const mode = desc.sideBySideMode ?? 'before-after'
  const leftBuf = Buffer.from(await currentPage.screenshot({ type: 'png', fullPage: false }))
  let rightBuf: Buffer
  let leftLabel = 'Before'
  let rightLabel = 'After'

  if (mode === 'desktop-mobile') {
    leftLabel = 'Desktop'
    rightLabel = 'Mobile'
    const otherProfile = device === 'desktop' ? MOBILE_CAPTURE_PROFILE : DESKTOP_CAPTURE_PROFILE
    const session = await createAuditPage(browser, currentPage.url(), {
      profile: otherProfile,
      settle: true,
    })
    try {
      rightBuf = Buffer.from(await session.page.screenshot({ type: 'png', fullPage: false }))
    } finally {
      const ctx = session.page.context()
      await session.page.close().catch(() => {})
      await ctx.close().catch(() => {})
    }
  } else if (mode === 'source-destination') {
    leftLabel = 'Source'
    rightLabel = 'Destination'
    // Destination may already be the current page after a flow click; capture a
    // second settle frame as the right panel so the stitch still communicates change.
    await new Promise((r) => setTimeout(r, 400))
    rightBuf = Buffer.from(await currentPage.screenshot({ type: 'png', fullPage: false }))
  } else {
    // before-after: emulate reduced motion for the "after" panel when relevant
    leftLabel = 'Default'
    rightLabel = 'Reduced motion'
    try {
      await currentPage.emulateMedia({ reducedMotion: 'reduce' })
      rightBuf = Buffer.from(await currentPage.screenshot({ type: 'png', fullPage: false }))
    } finally {
      await currentPage.emulateMedia({ reducedMotion: 'no-preference' }).catch(() => {})
    }
  }

  const stitched = await composeSideBySide(leftBuf, rightBuf, { leftLabel, rightLabel })
  const url = await uploadScreenshot(auditId, device, stitched, `visual-${checkId}`)
  return {
    checkId,
    device,
    gifUrl: null,
    overlayUrl: url,
    type: 'side-by-side',
  }
}

function enrichOverlayContext(
  ctx: OverlayContext,
  checkId: string,
  metrics?: VisualCaptureMetrics
): void {
  switch (checkId) {
    case 'perf-score-critical':
    case 'perf-score-poor':
      ctx.value = metrics?.perfScore ?? undefined
      ctx.label = 'PageSpeed Score'
      break
    case 'cta-below-fold-mobile':
      ctx.region = {
        x: 0.2,
        y: metrics?.mobilePrimaryCtaTopPx
          ? Math.min(0.95, metrics.mobilePrimaryCtaTopPx / (ctx.height || 800))
          : 0.88,
        width: 0.6,
        height: 0.07,
      }
      ctx.label = 'CTA below fold'
      break
    case 'mobile-cta-thumb-zone':
      ctx.region = { x: 0.3, y: 0.65, width: 0.4, height: 0.06 }
      ctx.label = 'Thumb zone issue'
      break
    case 'form-inputs-zoom-mobile':
    case 'mobile-input-zoom':
      ctx.label = 'iOS zoom triggers'
      break
    case 'loading-indicator-stuck':
    case 'loading-state-slow':
      ctx.region = { x: 0.1, y: 0.1, width: 0.8, height: 0.22 }
      ctx.label = 'Loading UI persists'
      break
    case 'friction-no-commitment-path':
      ctx.region = { x: 0.25, y: 0.45, width: 0.5, height: 0.06 }
      ctx.label = 'No CTA found'
      break
    case 'friction-form-too-many-fields':
      ctx.value = metrics?.formFieldCount ?? 6
      ctx.label = 'Too many fields'
      break
    case 'console-errors-critical':
    case 'console-errors-some':
      ctx.detail =
        metrics?.consoleErrorCount != null
          ? `${metrics.consoleErrorCount} console error(s)`
          : 'JavaScript errors in console'
      break
    case 'slow-3g-blank-screen':
      ctx.value = 5000
      ctx.label = 'Blank on slow 3G'
      break
    default:
      break
  }
}
