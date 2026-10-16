import type { Frame, Response, Page } from 'playwright'
import { isCheckoutUrl } from './buy-controls'

export type CheckoutFrame = { frame: Frame; response: Response; url: string; status: number; usable: boolean; error: boolean }

/** A provider logo or hidden wallet frame cannot certify checkout entry. */
export async function observeCheckoutFrame(page: Page, responses: Map<Frame, Response>): Promise<CheckoutFrame | null> {
  let pending: CheckoutFrame | null = null
  for (const frame of page.frames().slice(0, 20)) {
    if (!frame.parentFrame() || !isCheckoutUrl(frame.url())) continue
    const response = responses.get(frame), url = frame.url()
    if (!response || response.url() !== url) continue
    try {
      // Visibility must hold through every enclosing frame, not just the leaf.
      let current: Frame | null = frame, visible = true, depth = 0
      while (current?.parentFrame() && visible && depth++ < 8) {
        const element = await current.frameElement()
        try {
          visible = await element.isVisible() && await element.evaluate(el => {
            if (!(el instanceof Element)) return false
            for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
              const style = getComputedStyle(ancestor)
              if (Number(style.opacity) === 0 || style.contentVisibility === 'hidden' || ancestor.hasAttribute('inert')) return false
            }
            return true
          })
        } finally { await element.dispose() }
        current = current.parentFrame()
      }
      if (!visible || current?.parentFrame()) continue
      const observation = await frame.evaluate(() => {
        ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
        const visible = (el: Element) => {
          const rect = el.getBoundingClientRect()
          if (rect.width < 8 || rect.height < 8 || getComputedStyle(el).visibility !== 'visible') return false
          for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor)
            if (style.display === 'none' || Number(style.opacity) === 0 || style.contentVisibility === 'hidden' || ancestor.hasAttribute('inert')) return false
          }
          return true
        }
        const text = (document.body?.innerText ?? '').slice(0, 3000)
        const error = /something went wrong|checkout is unavailable|unable to process|payment error|could not complete/i.test(text)
        const restricted = /verify you are human|checking your browser|enter store password|this shop is password/i.test(text)
        const usable = !restricted && Array.from(document.querySelectorAll('input, select, textarea')).slice(0, 100)
          .some(el => visible(el) && !el.matches(':disabled, [readonly]') && /email|address|shipping|billing|postal|country|cc-|card|phone|tel/i
            .test([el.getAttribute('type'), el.getAttribute('autocomplete'), el.getAttribute('name'), el.getAttribute('aria-label')].join(' ')))
        return { usable, error }
      })
      if (frame.url() !== url || responses.get(frame) !== response) continue
      const observed = { frame, response, url, status: response.status(), ...observation }
      if (observed.usable || observed.error || observed.status >= 400) return observed
      pending ??= observed
    } catch { /* A detached or unavailable frame cannot certify checkout. */ }
  }
  return pending
}

export function checkoutFrameChanged(before: CheckoutFrame | null, after: CheckoutFrame): boolean {
  return !before || before.frame !== after.frame || before.response !== after.response || before.url !== after.url ||
    !before.usable && after.usable
}
