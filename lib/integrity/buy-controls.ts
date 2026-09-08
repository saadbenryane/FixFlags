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
  text: string
  href: string | null
}

export async function discoverBuyControl(page: Page): Promise<BuyControl | null> {
  return findControl(page, BUY_SELECTORS, (text, href) => {
    if (BUY_CONTROL_TEXT.test(text)) return true
    if (href && /\/cart\/add/i.test(href)) return true
    return false
  })
}

export async function discoverCheckoutControl(page: Page): Promise<BuyControl | null> {
  return findControl(page, CHECKOUT_SELECTORS, (text, href) => {
    if (CHECKOUT_CONTROL_TEXT.test(text)) return true
    if (href && /\/checkouts?(?:\/|$|\?)/i.test(href)) return true
    return false
  })
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
      const url = window.location.pathname
      if (/\/cart(?:\/|$)/i.test(url)) return true
      if (document.querySelector('[data-cart-drawer], #CartDrawer, .cart-drawer, #cart')) return true
      const count = document.querySelector('[data-cart-count], .cart-count, #cart-icon-bubble')
      if (count) {
        const value = Number((count.textContent ?? '').replace(/[^\d]/g, ''))
        if (value > 0) return true
      }
      const text = (document.body?.innerText ?? '').slice(0, 2500)
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
  match: (text: string, href: string | null) => boolean
): Promise<BuyControl | null> {
  const marked = await page
    .evaluate(
      ({ selectors: sel, attr }: { selectors: string; attr: string }) => {
        document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr))
        const elements = Array.from(document.querySelectorAll(sel))
        const hits: Array<{ index: number; text: string; href: string | null }> = []
        for (const [index, el] of elements.entries()) {
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
          el.setAttribute(attr, String(index))
          hits.push({ index, text, href })
        }
        return hits
      },
      { selectors, attr: 'data-fixflags-buy' }
    )
    .catch(() => [])

  const hit = (marked ?? []).find((entry) => match(entry.text, entry.href))
  if (!hit) return null
  return {
    selector: `[data-fixflags-buy="${hit.index}"]`,
    text: hit.text,
    href: hit.href,
  }
}
