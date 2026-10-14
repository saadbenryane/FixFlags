import { createHash } from 'node:crypto'
import type { Page } from 'playwright'
export type ActionPanelObservation = { key: string; nodeKey: string; fingerprint: string; actionable: boolean }

/** Bounded semantic next steps only. Field values and form submission are excluded. */
export async function visibleActionPanels(page: Page): Promise<ActionPanelObservation[] | null> {
  try {
    const panels = await page.evaluate(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const realm = globalThis as typeof globalThis & { __fixflagsActionPanels?: { prefix: string; next: number; nodes: WeakMap<Element, string> } }
      const identities = realm.__fixflagsActionPanels ??= { prefix: Date.now() + ':' + Math.random(), next: 0, nodes: new WeakMap() }
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect()
        if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return false
        for (let node: Element | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node)
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0 ||
            node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return false
        }
        return true
      }
      const candidates = [...document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"],form,[role="form"]')]
      if (candidates.length > 30) return null
      const observed = []
      for (const panel of candidates) {
        if (!visible(panel)) continue
        const controls = [...panel.querySelectorAll('input,textarea,select,button,a[href],[role="button"]')]
        if (controls.length > 200) return null
        const usable = controls.filter(control => {
          if (!visible(control) || control.matches(':disabled,[aria-disabled="true"],[readonly],button[type="reset"]')) return false
          const rect = control.getBoundingClientRect()
          const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          if (!top || top !== control && !control.contains(top) && !(top instanceof HTMLLabelElement && top.control === control)) return false
          if (control instanceof HTMLInputElement) return !['hidden', 'reset'].includes(control.type)
          if (control instanceof HTMLAnchorElement) return /^(https?:|mailto:|tel:)/.test(control.href)
          const name = (control.getAttribute('aria-label') ?? control.textContent ?? '').trim()
          return !/^(close|dismiss|cancel|back|×|✕|x)$/i.test(name)
        })
        let nodeKey = identities.nodes.get(panel)
        if (!nodeKey) { nodeKey = identities.prefix + ':' + identities.next++; identities.nodes.set(panel, nodeKey) }
        // Logical identity survives layout moves and framework DOM replacement.
        // No control values, raw markup or destination queries are retained.
        observed.push({ nodeKey, actionable: usable.length > 0, tag: panel.tagName, id: panel.id, role: panel.getAttribute('role'),
          parentId: panel.id ? null : panel.parentElement?.closest('[id]')?.id ?? null,
          label: (panel.getAttribute('aria-label') ?? '').slice(0, 160),
          headings: [...panel.querySelectorAll('h1,h2,h3')].slice(0, 3).map(heading => (heading.textContent ?? '').trim().slice(0, 160)),
          controls: usable.slice(0, 20).map(control => ({ tag: control.tagName, id: control.id,
            type: control.getAttribute('type'), name: control.getAttribute('name'), label: (control.getAttribute('aria-label') ??
              (control.matches('button,a,[role="button"]') ? control.textContent : '') ?? '').trim().slice(0, 160) }))
            .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) })
      }
      return observed
    })
    const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
    return panels === null ? null : panels.map(({ nodeKey, ...panel }) => ({ nodeKey, actionable: panel.actionable,
      key: hash([panel.tag, panel.id, panel.role, panel.parentId, ...(panel.id ? [] : [panel.controls.map(control => [control.tag, control.type, control.name])])]),
      fingerprint: hash(panel) }))
  } catch { return null }
}

export function actionPanelOpened(before: ActionPanelObservation[] | null, after: ActionPanelObservation[] | null): boolean | null {
  if (before === null || after === null) return null
  let uncertain = before.some(prior => !after.some(panel => panel.nodeKey === prior.nodeKey))
  for (const panel of after) {
    const existing = before.find(prior => prior.nodeKey === panel.nodeKey)
    if (existing) { uncertain ||= existing.fingerprint !== panel.fingerprint; continue }
    if (before.some(prior => prior.key === panel.key)) { uncertain = true; continue }
    if (panel.actionable) return true
    uncertain = true
  }
  return uncertain ? null : false
}
