import type { Page } from 'playwright'

export type ViewportActionIdentity = { selector: string; label: string; context: string }
export type ViewportDocument = { pageUrl: string; timeOrigin: number }

export function sameViewportDocument(first: ViewportDocument, second: ViewportDocument): boolean {
  return first.timeOrigin === second.timeOrigin && first.pageUrl === second.pageUrl
}

export function readViewportDocument(page: Page, includeTitle = false) {
  return page.evaluate(includeTitle => ({ pageUrl: location.href, timeOrigin: performance.timeOrigin,
    title: includeTitle ? document.title.slice(0, 256) : undefined }), includeTitle)
}

/** One read of top-level viewport content. Hidden and offscreen controls are not visible. */
export async function observeViewport(page: Page, options: { profile: string; expectedActions?: ViewportActionIdentity[]; includeActions?: boolean }) {
  const { profile, expectedActions = [], includeActions = true } = options
  return page.evaluate(({ profile, expectedActions, includeActions }) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
    const inViewport = (rect: DOMRect) => rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0
    const visible = (element: Element, rect = element.getBoundingClientRect()) => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
      }
      return inViewport(rect)
    }
    const excludedContent = 'nav, header, [role="navigation"], [role="status"], [role="progressbar"], progress, [aria-busy="true"]'
    const loadingCandidates = '[data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]'
    const skeletonOrSpinner = /(?:^|[-_])(?:skeleton|spinner)(?:$|[-_])/i
    const loading = /(?:^|[-_])loading(?:$|[-_])/i
    const inactive = /(?:^|[-_])(?:lazy|complete|loaded|ready|finished|inactive|false)(?:$|[-_])/i
    const excluded = (element: Element) => {
      if (element.closest(excludedContent)) return true
      for (let marker = element.closest(loadingCandidates); marker; marker = marker.parentElement?.closest(loadingCandidates) ?? null) {
        const state = marker.getAttribute('data-loading')
        if (state !== null) {
          if (state.trim().toLowerCase() !== 'false') return true
          continue
        }
        if ([...marker.classList].some(name => skeletonOrSpinner.test(name) || loading.test(name) && !inactive.test(name))) return true
      }
      return false
    }
    let textLength = 0, textComplete = true
    const root = document.querySelector('main') ?? document.body
    if (root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode(), count = 0
      for (; node && count < 2000 && textLength <= 20; node = walker.nextNode(), count++) {
        const parent = node.parentElement
        if (parent && !parent.closest('script, style, template, noscript') && !excluded(parent)) {
          const range = document.createRange()
          range.selectNodeContents(node)
          if (visible(parent, range.getBoundingClientRect())) textLength += node.textContent?.trim().length ?? 0
        }
      }
      textComplete = !node || textLength > 20
    }
    const media = root ? [...root.querySelectorAll('img')] : []
    const image = media.slice(0, 200).some(element => {
      const box = element.getBoundingClientRect()
      return element.complete && element.naturalWidth >= 64 && element.naturalHeight >= 64 && box.width >= 64 && box.height >= 64 &&
        !excluded(element) && visible(element, box)
    })
    const graphics = root ? [...root.querySelectorAll('canvas, iframe, video, svg')] : []
    const opaque = graphics.length > 200 || graphics.slice(0, 200).some(element => {
      const box = element.getBoundingClientRect()
      return box.width >= 64 && box.height >= 64 && !excluded(element) && visible(element, box)
    })
    const controls = includeActions ? [...document.querySelectorAll('a[href], button, [role="button"]')] : []
    const selector = (element: Element) => {
      if (element.id && document.querySelectorAll('#' + CSS.escape(element.id)).length === 1) return '#' + CSS.escape(element.id)
      const parts: string[] = []
      for (let current: Element | null = element; current && parts.length < 6; current = current.parentElement) {
        const siblings = current.parentElement ? [...current.parentElement.children].filter(child => child.tagName === current!.tagName) : [current]
        parts.unshift(current.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')')
        if (current.tagName === 'BODY') break
      }
      return parts.join(' > ')
    }
    const expectedElements = expectedActions.flatMap(action => {
      try { const element = document.querySelector(action.selector); return element ? [element] : [] } catch { return [] }
    })
    const actions = [...new Set([...expectedElements, ...controls.slice(0, 500)])].flatMap(element => {
      if (excluded(element) || !visible(element)) return []
      const href = element.tagName === 'A' ? (element as HTMLAnchorElement).href : null
      const text = (element.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 160)
      if (!/get started|sign up|signup|start free|try|register|contact|pricing|book (?:a )?call|schedule/i.test(`${href ?? ''} ${text}`)) return []
      const context = JSON.stringify({ profile, pageUrl: location.href, href }), path = selector(element)
      return context.length <= 4200 && path.length <= 2000 ? [{ selector: path, label: text || 'Recognized action', context }] : []
    }).slice(0, 20)
    return { pageUrl: location.href, timeOrigin: performance.timeOrigin, text: textLength > 20, content: textLength > 20 || image, contentComplete: textComplete && media.length <= 200 && !opaque,
      cta: actions.length > 0, textComplete, ctaComplete: actions.length > 0 || controls.length <= 500, actions }
  }, { profile, expectedActions: expectedActions.slice(0, 20), includeActions })
}

