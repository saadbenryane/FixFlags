import type { Page } from 'playwright'

export interface PostClickMetrics {
  timeToFirstContentMs: number
  stuckLoading: boolean
  blankScreenMs: number
  stuckLoadingLabel: string | null
}
import { sleep } from '@/lib/utils/sleep'
import { LOADING_SELECTOR } from '@/lib/audit/flow/constants'

/** After CTA navigation, measure how long until meaningful content appears and loading UI clears. */
export async function measurePostClickLoading(
  page: Page,
  deadlineMs = 8_000
): Promise<PostClickMetrics> {
  const started = Date.now()
  let timeToFirstContentMs = deadlineMs
  let blankScreenMs = deadlineMs
  let stuckLoading = false
  let stuckLoadingLabel: string | null = null
  let stuckLoadingSinceMs: number | null = null
  let elapsed = Date.now() - started

  while (elapsed < deadlineMs) {
    const snapshot = await page.evaluate((loadingSel) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const main = document.querySelector('main')
      const bodyText = document.body ? document.body.innerText : ''
      const text = ((main?.innerText ?? bodyText) ?? '').replace(/\s+/g, ' ').trim()
      const hasContent = text.length > 20

      let stuck = false
      let label: string | null = null
      for (const el of document.querySelectorAll(loadingSel)) {
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        const style = window.getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
        stuck = true
        label =
          el.getAttribute('aria-label') ||
          el.className.toString().split(/\s+/).find((c) => /skeleton|spinner|loading/i.test(c)) ||
          el.tagName.toLowerCase()
        break
      }

      return { hasContent, stuck, label }
    }, LOADING_SELECTOR)

    if (snapshot.hasContent && timeToFirstContentMs === deadlineMs) {
      timeToFirstContentMs = elapsed
      blankScreenMs = elapsed
    }

    if (snapshot.stuck) {
      if (stuckLoadingSinceMs === null) stuckLoadingSinceMs = elapsed
      stuckLoadingLabel = snapshot.label
      if (elapsed - stuckLoadingSinceMs >= 2_000) {
        stuckLoading = true
      }
    } else {
      stuckLoadingSinceMs = null
    }

    if (snapshot.hasContent && !snapshot.stuck) {
      break
    }

    await sleep(100)
    elapsed = Date.now() - started
  }

  return {
    timeToFirstContentMs,
    blankScreenMs,
    stuckLoading,
    stuckLoadingLabel,
  }
}
