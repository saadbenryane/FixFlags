import type { Page } from 'playwright'
import type { CaptureObservationScope } from './observation-scope'

export type LoadingObservation = {
  version: 1; device: 'desktop' | 'mobile'; scope: CaptureObservationScope
  contentVisible: boolean; ready: boolean; restricted: boolean
}

export type LoadingUiSnapshot = {
  readyState: string
  title: string | null
  loadingVisible: boolean
  loadingLabel: string | null
}

/** Shared browser predicate for capture, layout and loading-clearance observation. */
export function loadingUiInDocument(waitForClear: boolean): LoadingUiSnapshot | false | number {
  ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
  let loadingLabel: string | null = null
  for (const element of document.querySelectorAll('[aria-busy="true"], [data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]')) {
    if (element.getAttribute('data-loading') === 'false' && !element.matches('[aria-busy="true"], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]')) continue
    const box = element.getBoundingClientRect()
    const width = Math.min(box.right, innerWidth) - Math.max(box.left, 0)
    const height = Math.min(box.bottom, innerHeight) - Math.max(box.top, 0)
    if (width <= 0 || height <= 0) continue
    let hidden = false
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor)
      if (style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0) { hidden = true; break }
    }
    if (hidden || !element.closest('main, [role="main"], [class*="hero" i]') && width * height < innerWidth * innerHeight * 0.12) continue
    loadingLabel = (element.getAttribute('aria-label') || String(element.className).split(/\s+/).find(name => /skeleton|spinner|loading/i.test(name)) || element.tagName.toLowerCase()).slice(0, 160)
    break
  }
  const loadingVisible = loadingLabel !== null
  return waitForClear ? loadingVisible ? false : Date.now() : { readyState: document.readyState, title: document.title.trim() || null, loadingVisible, loadingLabel }
}

export async function readLoadingUi(page: Page): Promise<LoadingUiSnapshot> {
  const snapshot = await page.evaluate(loadingUiInDocument, false)
  if (typeof snapshot !== 'object') throw new Error('Loading snapshot was not returned')
  return snapshot
}
