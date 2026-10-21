import type { Page } from 'playwright'
import { AuditDeadlineError } from '../pipeline-errors'

const SCREENSHOT_TIMEOUT_MS = 5_000

/** Bound the physical browser operation, without abandoning a pending capture. */
export async function captureScreenshot(
  page: Page,
  options: NonNullable<Parameters<Page['screenshot']>[0]>,
  deadline = Infinity,
): Promise<Buffer> {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new AuditDeadlineError('screenshot')
  const requested = options.timeout && Number.isFinite(options.timeout) && options.timeout > 0
    ? options.timeout : SCREENSHOT_TIMEOUT_MS
  return page.screenshot({ ...options, timeout: Math.max(1, Math.min(SCREENSHOT_TIMEOUT_MS, requested, remaining)) })
}
