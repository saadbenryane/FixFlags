import { randomUUID } from 'node:crypto'
import type { ElementHandle, Page } from 'playwright'

export interface ObservedControl {
  id: string
  kind: 'click' | 'select'
  role: string
  label: string
  context: string
  href: string | null
  formAction: string | null
  value: string | null
  options: Array<{ value: string; label: string }>
}

export interface BrowserObservation {
  token: string
  url: string
  controls: ObservedControl[]
}

/** One page read retains actual nodes, visible labels, values and nearby context. */
export async function observeControls(page: Page): Promise<BrowserObservation> {
  const token = randomUUID()
  const observation = await page.evaluate((nextToken) => {
    type Registry = { token: string; url: string; nodes: Map<string, Element>; signatures: Map<string, string> }
    const global = window as typeof window & { __fixflagsObserved?: Registry }
    const nodes = new Map<string, Element>()
    const signatures = new Map<string, string>()
    const text = (value: string | null | undefined, limit: number) =>
      (value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
    const visible = (element: Element) => {
      if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      const rect = element.getBoundingClientRect()
      return rect.width >= 5 && rect.height >= 5 && rect.bottom > 0 && rect.right > 0 &&
        rect.top < innerHeight && rect.left < innerWidth
    }
    const name = (element: Element) => {
      const labelledBy = element.getAttribute('aria-labelledby')
      const referenced = labelledBy?.split(/\s+/).map((id) => document.getElementById(id)?.textContent).join(' ')
      const form = element as HTMLInputElement
      return text(referenced || element.getAttribute('aria-label') ||
        (form.labels ? Array.from(form.labels).map((label) => label.textContent).join(' ') : '') ||
        (element as HTMLElement).innerText || form.value || element.getAttribute('title') ||
        element.getAttribute('placeholder'), 120)
    }
    const context = (element: Element) => text(
      (element.closest('form,dialog,article,li,tr,[role="dialog"]') ?? element.parentElement)?.textContent,
      220,
    )
    const signature = (element: Element) => JSON.stringify({
      name: name(element),
      context: context(element),
      href: element.getAttribute('href'),
      formAction: (element as HTMLButtonElement).form?.action ?? null,
      disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
    })
    const controls: Array<{
      id: string; kind: 'click' | 'select'; role: string; label: string; context: string;
      href: string | null; formAction: string | null; value: string | null; options: Array<{ value: string; label: string }>
    }> = []
    const candidates = document.querySelectorAll('button,a[href],input[type="button"],input[type="submit"],select,[role="button"]')
    for (const element of candidates) {
      if (controls.length >= 64) break
      if (!visible(element) || element.matches(':disabled') || element.closest('[aria-disabled="true"]')) continue
      const label = name(element)
      if (!label || /ignore (?:all |previous |prior )?instructions|system prompt|developer message|you are (?:chatgpt|an ai|an assistant)|execute (?:javascript|code|shell)/i.test(label)) continue
      const select = element instanceof HTMLSelectElement
      const options = select ? Array.from(element.options)
        .filter((option) => option.value && !option.disabled && !option.closest('optgroup[disabled]'))
        .slice(0, 24).map((option) => ({ value: option.value, label: text(option.label, 100) })) : []
      const id = `c${controls.length + 1}`
      nodes.set(id, element)
      signatures.set(id, signature(element))
      controls.push({
        id,
        kind: select ? 'select' : 'click',
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        label,
        context: context(element),
        href: element.getAttribute('href'),
        formAction: (element as HTMLButtonElement).form?.action ?? null,
        value: select ? element.value : null,
        options,
      })
    }
    global.__fixflagsObserved = { token: nextToken, url: location.href, nodes, signatures }
    return { url: location.href, controls }
  }, token)
  return { token, ...observation }
}

async function resolveObserved(
  page: Page,
  observation: BrowserObservation,
  control: ObservedControl,
): Promise<ElementHandle<Element>> {
  if (page.url() !== observation.url || !observation.controls.some((item) => item.id === control.id))
    throw new Error('Browser observation is stale')
  const handle = await page.evaluateHandle(({ token, id, expectedUrl }) => {
    type Registry = { token: string; url: string; nodes: Map<string, Element>; signatures: Map<string, string> }
    const global = window as typeof window & { __fixflagsObserved?: Registry }
    const registry = global.__fixflagsObserved
    const element = registry?.nodes.get(id)
    if (!registry || registry.token !== token || registry.url !== expectedUrl ||
      location.href !== expectedUrl || !element?.isConnected || element.ownerDocument !== document ||
      element.matches(':disabled') || element.closest('[inert],[hidden],[aria-hidden="true"],[aria-disabled="true"]')) return null
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    if (rect.width < 5 || rect.height < 5 || x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null
    const hit = document.elementFromPoint(x, y)
    if (!hit || (hit !== element && !element.contains(hit))) return null
    const text = (value: string | null | undefined, limit: number) =>
      (value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
    const labelledBy = element.getAttribute('aria-labelledby')
    const referenced = labelledBy?.split(/\s+/).map((ref) => document.getElementById(ref)?.textContent).join(' ')
    const form = element as HTMLInputElement
    const name = text(referenced || element.getAttribute('aria-label') ||
      (form.labels ? Array.from(form.labels).map((label) => label.textContent).join(' ') : '') ||
      (element as HTMLElement).innerText || form.value || element.getAttribute('title') ||
      element.getAttribute('placeholder'), 120)
    const context = text((element.closest('form,dialog,article,li,tr,[role="dialog"]') ?? element.parentElement)?.textContent, 220)
    const current = JSON.stringify({
      name, context, href: element.getAttribute('href'),
      formAction: (element as HTMLButtonElement).form?.action ?? null,
      disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
    })
    return current === registry.signatures.get(id) ? element : null
  }, { token: observation.token, id: control.id, expectedUrl: observation.url })
  const element = handle.asElement()
  if (!element) { await handle.dispose(); throw new Error('Observed browser control changed') }
  return element
}

/** Playwright executes only a validated observed node. Failed/uncertain mutations are never retried. */
export async function clickObserved(page: Page, observation: BrowserObservation, control: ObservedControl) {
  if (control.kind !== 'click') throw new Error('Control cannot be clicked')
  const handle = await resolveObserved(page, observation, control)
  try { await handle.click({ timeout: 8_000 }) } finally { await handle.dispose() }
}

export async function selectObserved(
  page: Page,
  observation: BrowserObservation,
  control: ObservedControl,
  value: string,
) {
  if (control.kind !== 'select' || !control.options.some((option) => option.value === value))
    throw new Error('Option was not observed')
  const handle = await resolveObserved(page, observation, control)
  try { await handle.selectOption({ value }, { timeout: 8_000 }) } finally { await handle.dispose() }
}
