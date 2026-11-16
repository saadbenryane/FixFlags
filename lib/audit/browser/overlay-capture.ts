import type { Page } from 'playwright'
import { randomUUID } from 'node:crypto'
import { renderOverlay } from '../capture/overlays'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { overlayControlContext, type OverlayObservation } from '../checks/overlay-evidence'
import { probeCoverAtPoint } from './overlay-probe'
import { readOverlayControls } from './overlay-observation'

/** A Flag image is captured in its own observation, never borrowed from a later page view. */
export async function captureOverlayFailure(page: Page, control: OverlayObservation['controls'][number], input: {
  auditId: string; device: 'desktop' | 'mobile'; deadline: number; scope: OverlayObservation['scope'];
}): Promise<OverlayObservation['capture'] | undefined> {
  if (control.disposition !== 'failed' || !control.blocker || Date.now() >= input.deadline) return
  const target = page.locator(control.selector), viewport = page.viewportSize()
  const matchesControl = async () => {
    const frame = await readOverlayControls(page, [control.selector], [control.selector], control.kind)
    return frame.complete && frame.pageUrl === input.scope.finalUrl && frame.controls.some(current =>
      overlayControlContext(input.scope, control.kind, current.identity) === control.context)
  }
  if (!await matchesControl()) return
  const rect = await target.boundingBox()
  if (!rect || !viewport || rect.width <= 0 || rect.height <= 0) return
  const recordedAt = new Date().toISOString()
  const bytes = await page.screenshot({ type: 'png', fullPage: false, scale: 'css', timeout: Math.max(1, input.deadline - Date.now()) })
  const after = await target.boundingBox(), blocker = await probeCoverAtPoint(page, control.selector, true)
  const samePosition = after && (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(rect[key] - after[key]) < 1)
  const sameCover = blocker && (['tag', 'id', 'className', 'role', 'zIndex'] as const).every(key => blocker[key] === control.blocker![key])
  if (!samePosition || !sameCover || !await matchesControl() || Date.now() >= input.deadline) return
  const x = Math.max(0, rect.x), y = Math.max(0, rect.y)
  const width = Math.min(viewport.width, rect.x + rect.width) - x, height = Math.min(viewport.height, rect.y + rect.height) - y
  if (width <= 0 || height <= 0) return
  const image = await renderOverlay('highlight', { screenshotBuffer: bytes, width: viewport.width, height: viewport.height,
    region: { x: x / viewport.width, y: y / viewport.height, width: width / viewport.width, height: height / viewport.height }, label: control.label })
  const url = await uploadScreenshot(input.auditId, input.device, image.buffer, `overlay-${randomUUID()}`, { deadline: input.deadline })
  return { url, recordedAt, context: control.context }
}
