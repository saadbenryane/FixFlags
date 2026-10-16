/**
 * Visual capture orchestrator. Decides what visual evidence to capture
 * for a given set of flags and composes the final outputs.
 */
import type { Page } from 'playwright'
import { readScreenshot, uploadScreenshot } from '@/lib/storage/screenshots'
import { getAppUrl } from '@/lib/get-app-url'
import { flowCheckIdForStatus } from '../flow/flow-evidence'
import type { FlowScanResult } from '../flow/run-flow-scan'
import { logger } from '@/lib/logger'
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
  sourceFrames?: { source: string; destination: string }
}

export interface VisualCaptureResult {
  visuals: VisualEvidence[]
  additionalFrames: FrameSet[]
}

export interface VisualCaptureMetrics {
  perfScore?: number | null
  mobilePrimaryCtaTopPx?: number | null
  mobileScrollY?: number | null
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
  page: Page,
  auditId: string,
  flags: Array<{ checkId: string; severity: string; rubric: string }>,
  device: 'desktop' | 'mobile' = 'mobile',
  metrics?: VisualCaptureMetrics,
  deadline = Infinity
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
      return d.type === 'side-by-side' && !['desktop-mobile', 'source-destination'].includes(d.sideBySideMode ?? '') && matchesDevice(d, device)
    })
    .slice(0, MAX_SIDE_BY_SIDE)

  for (const flag of gifFlags) {
    if (Date.now() >= deadline) break
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
          const url = await uploadScreenshot(auditId, device, gif.buffer, `visual-${flag.checkId}`, { deadline })
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

  if (overlayFlags.length > 0 && Date.now() < deadline) {
    const buf = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    const meta = await import('sharp').then((s) => s.default(buf).metadata())
    const w = meta.width ?? 1280
    const h = meta.height ?? 900

    for (const flag of overlayFlags) {
      if (Date.now() >= deadline) break
      const desc = getVisualDescriptor(flag.checkId)
      if (desc.type !== 'static-overlay' || !desc.overlay) continue
      try {
        const ctx: OverlayContext = { screenshotBuffer: buf, width: w, height: h }
        enrichOverlayContext(ctx, flag.checkId, metrics)
        const res = await renderOverlay(desc.overlay, ctx)
        const url = await uploadScreenshot(auditId, device, res.buffer, `visual-${flag.checkId}`, { deadline })
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
    if (Date.now() >= deadline) break
    const desc = getVisualDescriptor(flag.checkId)
    if (desc.type !== 'side-by-side') continue
    try {
      const evidence = await captureSideBySide(
        page,
        auditId,
        flag.checkId,
        desc,
        device,
        deadline
      )
      if (evidence) result.visuals.push(evidence)
    } catch (err) {
      logger.error(`Failed to capture side-by-side for ${flag.checkId}`, err)
    }
  }

  return result
}

/** Compose only after both independent device sessions have released capacity. */
export async function captureDeviceComparisonEvidence(
  auditId: string,
  flags: Array<{ checkId: string }>,
  frames: { desktop?: Buffer; mobile?: Buffer },
  deadline = Infinity,
): Promise<VisualEvidence[]> {
  if (!frames.desktop || !frames.mobile) return []
  const visuals: VisualEvidence[] = []
  const comparisons = flags.filter(flag => getVisualDescriptor(flag.checkId).sideBySideMode === 'desktop-mobile').slice(0, MAX_SIDE_BY_SIDE)
  for (const flag of comparisons) {
    if (Date.now() >= deadline) break
    try {
      visuals.push(await uploadComparison(auditId, flag.checkId, 'mobile', frames.desktop, frames.mobile, 'Desktop', 'Mobile', deadline))
    } catch (error) { logger.error(`Failed to compose device comparison for ${flag.checkId}`, error) }
  }
  return visuals
}

function ownedDesktopFrame(auditId: string, reference: string | null) {
  if (!reference || !/^[a-zA-Z0-9_-]{1,128}$/.test(auditId)) return undefined
  try {
    const app = new URL(getAppUrl()), url = new URL(reference, app)
    if (url.origin !== app.origin || url.username || url.password || url.hash ||
      url.pathname !== '/api/screenshots/' + auditId + '/desktop' ||
      [...url.searchParams.keys()].some(key => key !== 'page') || url.searchParams.getAll('page').length > 1) return undefined
    const pageKey = url.searchParams.get('page')
    return pageKey === null || /^[a-zA-Z0-9_-]{1,80}$/.test(pageKey) ? { pageKey } : undefined
  } catch { return undefined }
}

/** Stored flow frames retain the actual two states, without another navigation. */
export async function captureRecordedFlowComparisonEvidence(auditId: string, flags: Array<{ checkId: string }>,
  flows: readonly FlowScanResult[], deadline = Infinity): Promise<VisualEvidence[]> {
  const visuals: VisualEvidence[] = []
  const comparisons = flags.filter(flag => getVisualDescriptor(flag.checkId).sideBySideMode === 'source-destination').slice(0, MAX_SIDE_BY_SIDE)
  for (const flag of comparisons) {
    for (const flow of flows.filter(flow => flowCheckIdForStatus(flow.status) === flag.checkId).slice(0, MAX_SIDE_BY_SIDE)) {
      if (Date.now() >= deadline) return visuals
      if (!Array.isArray(flow.steps) || flow.steps.length < 2) continue
      const first = flow.steps[0], last = flow.steps.at(-1)
      if (!first || !last || first.label !== 'Landing' || last.label !== 'After click' || last.url !== flow.finalUrl) continue
      const source = ownedDesktopFrame(auditId, first.screenshotUrl), destination = ownedDesktopFrame(auditId, last.screenshotUrl)
      // Old deterministic flow-1 assets could be overwritten by a sibling walk.
      if (!source || !destination || !destination.pageKey ||
        !/^[a-zA-Z0-9_-]{1,30}-[a-f0-9]{32}-flow-1$/.test(destination.pageKey) || source.pageKey === destination.pageKey) continue
      const sourceWalk = source.pageKey?.match(/^(.*)-flow-0$/)?.[1]
      if (sourceWalk && sourceWalk !== destination.pageKey.slice(0, -7)) continue
      try {
        const [left, right] = await Promise.all([readScreenshot(auditId, 'desktop', source.pageKey, { deadline }),
          readScreenshot(auditId, 'desktop', destination.pageKey, { deadline })])
        if (!left || !right) continue
        visuals.push({ ...await uploadComparison(auditId, flag.checkId, 'desktop', left, right, 'Source', 'Destination', deadline),
          sourceFrames: { source: first.screenshotUrl!, destination: last.screenshotUrl! } })
        break
      } catch (error) { logger.warn('Recorded flow comparison unavailable', { auditId, checkId: flag.checkId, error }) }
    }
  }
  return visuals
}

function matchesDevice(desc: VisualDescriptor, device: 'desktop' | 'mobile'): boolean {
  return desc.device === device || desc.device === 'both' || !desc.device
}

async function captureSideBySide(
  currentPage: Page,
  auditId: string,
  checkId: string,
  desc: VisualDescriptor,
  device: 'desktop' | 'mobile',
  deadline: number
): Promise<VisualEvidence | null> {
  const mode = desc.sideBySideMode ?? 'before-after'
  if (mode !== 'before-after') return null
  const leftBuf = Buffer.from(await currentPage.screenshot({ type: 'png', fullPage: false }))
  let rightBuf: Buffer
  try {
    await currentPage.emulateMedia({ reducedMotion: 'reduce' })
    rightBuf = Buffer.from(await currentPage.screenshot({ type: 'png', fullPage: false }))
  } finally {
    await currentPage.emulateMedia({ reducedMotion: 'no-preference' }).catch(() => {})
  }

  return uploadComparison(auditId, checkId, device, leftBuf, rightBuf, 'Default', 'Reduced motion', deadline)
}

async function uploadComparison(auditId: string, checkId: string, device: 'desktop' | 'mobile', left: Buffer, right: Buffer,
  leftLabel: string, rightLabel: string, deadline: number): Promise<VisualEvidence> {
  const stitched = await composeSideBySide(left, right, { leftLabel, rightLabel })
  const url = await uploadScreenshot(auditId, device, stitched, `visual-${checkId}`, { deadline })
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
    case 'cta-below-fold-mobile': {
      // The metric is an absolute document scroll depth; the overlay draws on
      // the viewport screenshot, so convert back to viewport-relative.
      const viewportTop =
        metrics?.mobilePrimaryCtaTopPx != null && metrics.mobileScrollY != null
          ? Math.max(0, metrics.mobilePrimaryCtaTopPx - metrics.mobileScrollY)
          : null
      ctx.region = {
        x: 0.2,
        y: viewportTop ? Math.min(0.95, viewportTop / (ctx.height || 800)) : 0.88,
        width: 0.6,
        height: 0.07,
      }
      ctx.label = 'CTA below fold'
      break
    }
    case 'mobile-cta-thumb-zone':
      ctx.region = { x: 0.3, y: 0.65, width: 0.4, height: 0.06 }
      ctx.label = 'Thumb zone issue'
      break
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
