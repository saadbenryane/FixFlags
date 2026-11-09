import type { Page } from 'playwright'

export const BUY_CONTROL_TEXT =
  /add to cart|add to bag|add to basket|buy now|buy it now|shop now|add to trolley/i

export const CHECKOUT_CONTROL_TEXT =
  /check\s*out|shop pay|buy it now|proceed to (payment|checkout)|continue to (shipping|payment)/i

const BUY_SELECTORS = [
  'button[name="add"]',
  'input[name="add"]',
  '[data-add-to-cart]',
  'form[action*="/cart/add"] button',
  'form[action*="/cart/add"] input[type="submit"]',
  'button',
  'a[href]',
  '[role="button"]',
].join(', ')

const CHECKOUT_SELECTORS = [
  'a[href*="/checkout"]',
  'a[href*="/checkouts"]',
  'button[name="checkout"]',
  '[name="checkout"]',
  'button',
  'a[href]',
  '[role="button"]',
].join(', ')

export interface BuyControl {
  selector: string
  identity: [page: string, path: string[], name: string | null] | null
}

export async function discoverBuyControl(page: Page, matchesIdentity?: (identity: NonNullable<BuyControl['identity']>) => boolean): Promise<BuyControl | null> {
  return findControl(page, BUY_SELECTORS, BUY_CONTROL_TEXT, /\/cart\/add/i, matchesIdentity)
}

export async function discoverCheckoutControl(page: Page): Promise<BuyControl | null> {
  return findControl(page, CHECKOUT_SELECTORS, CHECKOUT_CONTROL_TEXT, /\/checkouts?(?:\/|$|\?)/i)
}

export function isCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (/(^|\.)shop\.app$/i.test(parsed.hostname)) return true
    return /\/checkouts?(?:\/|$|\?)/i.test(parsed.pathname)
  } catch {
    return /\/checkouts?/i.test(url)
  }
}

export async function pageLooksPasswordGated(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const body = (document.body?.innerText ?? '').slice(0, 2000)
      if (/enter store password|this shop is password/i.test(body)) return true
      const password = document.querySelector('#password, input[type="password"][name="password"]')
      return Boolean(password && /password/i.test(body))
    })
    .catch(() => false)
}

export async function pageShowsCheckoutError(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const text = (document.body?.innerText ?? '').slice(0, 3000)
      return /something went wrong|checkout is unavailable|unable to process|payment error|could not complete/i.test(
        text
      )
    })
    .catch(() => false)
}

export async function cartAppearsUpdated(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
      const url = window.location.pathname
      if (/\/cart(?:\/|$)/i.test(url)) return true
      const visible = (el: Element) => {
        const rect = el.getBoundingClientRect()
        if (rect.width < 8 || rect.height < 8 || getComputedStyle(el).visibility !== 'visible') return false
        for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor)
          if (style.display === 'none' || Number(style.opacity) === 0 || style.contentVisibility === 'hidden' || ancestor.hasAttribute('inert')) return false
        }
        return true
      }
      if (Array.from(document.querySelectorAll('[data-cart-drawer], #CartDrawer, .cart-drawer, #cart')).some(visible)) return true
      const count = document.querySelector('[data-cart-count], .cart-count, #cart-icon-bubble')
      if (count && visible(count)) {
        const value = Number((count.textContent ?? '').replace(/[^\d]/g, ''))
        if (value > 0) return true
      }
      const parts: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null, length = 0, visited = 0
      while ((node = walker.nextNode()) && ++visited <= 5000 && length < 2500) {
        const element = node.parentElement
        if (!element || element.closest('script,style,noscript,template') || !visible(element)) continue
        const text = (node.textContent ?? '').slice(0, 2500 - length)
        parts.push(text); length += text.length
      }
      const text = parts.join(' ')
      return /item added|added to cart|your cart|check\s*out/i.test(text)
    })
    .catch(() => false)
}

export async function selectFirstAvailableVariant(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'))
      let changed = false
      for (const select of selects) {
        if (!(select instanceof HTMLSelectElement)) continue
        const name = `${select.name} ${select.id} ${select.getAttribute('aria-label') ?? ''}`
        if (!/id|option|variant|size|color|style/i.test(name) && selects.length > 3) continue
        const option = Array.from(select.options).find(
          (entry) => entry.value && !entry.disabled && !/sold out|unavailable/i.test(entry.text)
        )
        if (option && select.value !== option.value) {
          select.value = option.value
          select.dispatchEvent(new Event('change', { bubbles: true }))
          changed = true
        }
      }
      return changed
    })
    .catch(() => false)
}

async function findControl(
  page: Page,
  selectors: string,
  textPattern: RegExp,
  hrefPattern: RegExp,
  matchesIdentity?: (identity: NonNullable<BuyControl['identity']>) => boolean
): Promise<BuyControl | null> {
  const candidates = await page
    .evaluate(
      ({ selectors, attr, textPattern, hrefPattern, targeted }): BuyControl[] => {
        document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr))
        const labelMatches = new RegExp(textPattern, 'i')
        const hrefMatches = new RegExp(hrefPattern, 'i')
        const candidates: BuyControl[] = []
        let scanned = 0
        for (const el of document.querySelectorAll(selectors)) {
          if (targeted && ++scanned > 2_000) break
          if (el.closest('nav, header, [role="navigation"], footer')) continue
          const rect = el.getBoundingClientRect()
          if (rect.width < 8 || rect.height < 8) continue
          const text =
            (el.textContent ?? '').trim() ||
            el.getAttribute('aria-label')?.trim() ||
            el.getAttribute('value')?.trim() ||
            ''
          const href =
            el instanceof HTMLAnchorElement
              ? el.getAttribute('href')
              : el.closest('a')?.getAttribute('href') ?? null
          if (!labelMatches.test(text) && !(href && hrefMatches.test(href))) continue

          const path: string[] = []
          let node: Element | null = el
          while (node && path.length < 40) {
            if (node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) {
              path.unshift(node.tagName.toLowerCase() + '#' + CSS.escape(node.id))
              node = null
              break
            }
            let position = 1
            for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
              if (sibling.localName === node.localName) position++
            }
            path.unshift(node.localName + ':nth-of-type(' + position + ')')
            node = node.parentElement
          }
          // A unique control ID survives copy and layout repairs. Anonymous
          // controls need a structural address and matching purchase label.
          const name = path.length === 1 && el.id ? null : text.trim().replace(/\s+/g, ' ')
          const index = candidates.length
          el.setAttribute(attr, String(index))
          candidates.push({ selector: `[${attr}="${index}"]`, identity: node ? null : [location.href, path, name] })
          if (!targeted || candidates.length === 100) break
        }
        return candidates
      },
      { selectors, attr: 'data-fixflags-buy', textPattern: textPattern.source, hrefPattern: hrefPattern.source, targeted: Boolean(matchesIdentity) }
    )
    .catch(() => [])
  return (matchesIdentity ? candidates.find(control => control.identity && matchesIdentity(control.identity)) : candidates[0]) ?? null
}
