import type { Page } from 'playwright'
import { z } from 'zod'
import { readOnlyInteraction } from './read-only-interaction'
import { auditPageObservation, captureObservationScopeSchema } from './observation-scope'

export const KEYBOARD_STEP_LIMIT = 40
export const KEYBOARD_INTERACTION_LIMIT = 4
const INTERACTION_STEP_LIMIT = 16
const targetSchema = z.object({
  id: z.number().int().positive(), selector: z.string().min(1).max(2000), label: z.string().max(160),
  domOrder: z.number().int().nonnegative(), tabIndex: z.number().int(),
  indicator: z.enum(['styled', 'missing', 'unknown']),
  rect: z.object({ x: z.number().finite(), y: z.number().finite(), width: z.number().finite(), height: z.number().finite() }).strict(),
}).strict()
const identitySchema = targetSchema.pick({ selector: true, label: true, rect: true })
export const keyboardInteractionSchema = z.object({
  kind: z.enum(['menu', 'dialog', 'disclosure']), trigger: identitySchema, popup: identitySchema.nullable(),
  openedBy: z.enum(['enter', 'space', 'pointer', 'none']), reason: z.string().min(1).max(160),
  entry: z.enum(['inside', 'outside', 'unknown', 'not_applicable']),
  arrows: z.enum(['moved', 'stuck', 'unknown', 'not_applicable']),
  containment: z.enum(['contained', 'escaped', 'unknown', 'not_applicable']),
  escape: z.enum(['closed', 'remained', 'unknown', 'not_applicable']),
  restoration: z.enum(['trigger', 'lost', 'other', 'removed', 'unknown']),
  complete: z.boolean(), steps: z.array(targetSchema).max(INTERACTION_STEP_LIMIT),
}).strict()
export type KeyboardInteraction = z.infer<typeof keyboardInteractionSchema>
export const keyboardEvidenceSchema = z.object({
  version: z.literal(1), pageUrl: z.string().url(), collectedAt: z.string().datetime(),
  focusPolicy: z.literal('painted-properties-v2').optional(),
  scope: captureObservationScopeSchema.optional(),
  complete: z.boolean(), reason: z.string().min(1).max(160), candidateCount: z.number().int().nonnegative(),
  steps: z.array(targetSchema).max(KEYBOARD_STEP_LIMIT),
  trap: z.enum(['not_observed', 'blocked', 'escaped', 'unknown']),
  limitations: z.array(z.string().min(1).max(160)).max(12),
  navigationComplete: z.boolean().optional(), interactionCount: z.number().int().nonnegative().optional(),
  interactions: z.array(keyboardInteractionSchema).max(KEYBOARD_INTERACTION_LIMIT).optional(),
}).strict()
export type KeyboardEvidence = z.infer<typeof keyboardEvidenceSchema>

/** Only declared local UI openers are activated. Mutation requests, subsequent
 * navigations and popup windows are refused through the existing route boundary. */
export async function collectKeyboardEvidence(page: Page, deadline: number,
  options: { refusalCount?: () => number } = {}): Promise<KeyboardEvidence> {
  const pageUrl = page.url(), collectedAt = new Date().toISOString()
  const priorRefusals = options.refusalCount?.() ?? 0
  let boundary: Awaited<ReturnType<typeof readOnlyInteraction>> | undefined
  const refusalCount = () => (boundary?.refusals() ?? 0) + Math.max(0, (options.refusalCount?.() ?? 0) - priorRefusals)
  let disposeState: (() => Promise<void>) | undefined
  try {
    boundary = await readOnlyInteraction(page, pageUrl)
    const state = await page.evaluateHandle(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= fn => fn
      const focusableSelector = 'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"],iframe'
      const limitations: string[] = []
      function parent(el: Element): Element | null {
        const root = el.getRootNode()
        return el.assignedSlot ?? el.parentElement ?? (root instanceof ShadowRoot ? root.host : null)
      }
      function closest(el: Element | null, selectors: string): Element | null {
        for (let current = el; current; current = parent(current)) if (current.matches(selectors)) return current
        return null
      }
      function contains(root: Element, el: Element) {
        for (let current: Element | null = el; current; current = parent(current)) if (current === root) return true
        return false
      }
      function activeElement(): HTMLElement | null {
        let active = document.activeElement
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
        return active as HTMLElement | null
      }
      function opaque(el: Element) { return el.tagName === 'IFRAME' || el.tagName.includes('-') && !el.shadowRoot }
      function byId(el: Element, id: string) {
        const root = el.getRootNode()
        return root instanceof Document || root instanceof ShadowRoot ? root.getElementById(id) : null
      }
      function elements(root: Element | Document | ShadowRoot = document, limit = 20_000) {
        const pending: Array<{ children: ArrayLike<Element>; index: number }> = [{ children: root instanceof Element ? [root] : root.children, index: 0 }]
        const nodes: HTMLElement[] = [], seen = new Set<Element>()
        while (pending.length && nodes.length < limit) {
          const branch = pending[pending.length - 1]
          if (branch.index >= branch.children.length) { pending.pop(); continue }
          const current = branch.children[branch.index++]
          if (seen.has(current)) continue
          seen.add(current); nodes.push(current as HTMLElement)
          const assigned = current instanceof HTMLSlotElement ? current.assignedElements({ flatten: true }) : []
          const children = current.shadowRoot ? current.shadowRoot.children : assigned.length ? assigned : current.children
          if (children.length) pending.push({ children, index: 0 })
        }
        return { nodes, truncated: pending.some(branch => branch.index < branch.children.length) }
      }
      function sequential(el: HTMLElement) {
        if (el.tabIndex < 0 || !el.matches(focusableSelector) || el.matches(':disabled,[hidden],input[type="hidden"]') || closest(el, '[inert]')) return false
        if (el.shadowRoot?.delegatesFocus) return false
        for (let ancestor = parent(el); ancestor; ancestor = parent(ancestor)) {
          if ((ancestor.shadowRoot || ancestor instanceof HTMLSlotElement) && ancestor.hasAttribute('tabindex') && (ancestor as HTMLElement).tabIndex < 0) return false
        }
        return el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible'
      }
      function tabTargets(nodes: HTMLElement[]) {
        const eligible = nodes.filter(sequential)
        // Native radio groups contribute one forward Tab stop. Their grouping
        // follows tree, form owner and name, independently of component labels.
        const groups = new Map<Node, Map<HTMLFormElement | null, Map<string, HTMLInputElement>>>()
        const groupFor = (radio: HTMLInputElement) => {
          const root = radio.getRootNode()
          if (!groups.has(root)) groups.set(root, new Map())
          const forms = groups.get(root)!
          if (!forms.has(radio.form)) forms.set(radio.form, new Map())
          return forms.get(radio.form)!
        }
        for (const el of eligible) {
          if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) continue
          const group = groupFor(el), previous = group.get(el.name)
          if (!previous || el.checked || !previous.checked && el.tabIndex > 0 && (previous.tabIndex === 0 || el.tabIndex < previous.tabIndex))
            group.set(el.name, el)
        }
        return eligible.filter(el => !(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name || groupFor(el).get(el.name) === el)
      }
      function candidatesNow() {
        const inventory = elements()
        if (inventory.truncated && !limitations.includes('document_tree_limit')) limitations.push('document_tree_limit')
        return tabTargets(inventory.nodes)
      }
      const candidates = candidatesNow()
      if (elements().nodes.some(el => el.matches('iframe,frame'))) limitations.push('embedded_frame_uninspected')
      if (candidates.length > 200) limitations.push('candidate_limit')
      const inspected = candidates.slice(0, 200)
      const properties = ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow',
        'backgroundColor', 'color', 'textDecoration', 'opacity', 'transform'] as const
      const colorCanvas = document.createElement('canvas')
      colorCanvas.width = colorCanvas.height = 1
      const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true })
      const colorSamples = new Map<string, number[] | null>()
      function sampleColor(color: string): number[] | null {
        if (colorSamples.has(color)) return colorSamples.get(color)!
        let sampled: number[] | null = null
        if (colorContext && CSS.supports('color', color)) {
          colorContext.clearRect(0, 0, 1, 1)
          colorContext.fillStyle = color
          colorContext.fillRect(0, 0, 1, 1)
          sampled = [...colorContext.getImageData(0, 0, 1, 1).data]
        }
        colorSamples.set(color, sampled)
        return sampled
      }
      function paintedColor(color: string): boolean | null {
        const sampled = sampleColor(color)
        return sampled ? sampled[3] > 0 : null
      }
      function paintedInDocument(el: Element) {
        if (!el.isConnected || !el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') return false
        for (let node: Element | null = el; node; node = parent(node)) {
          const style = getComputedStyle(node)
          if (style.display === 'none' || parseFloat(style.opacity) === 0 || style.contentVisibility === 'hidden') return false
        }
        return true
      }
      function paintedOutline(style: CSSStyleDeclaration, node: Element): boolean | null {
        if (['none', 'hidden'].includes(style.outlineStyle) || !(parseFloat(style.outlineWidth) > 0)) return false
        const color = sampleColor(style.outlineColor)
        if (!color) return null
        if (color[3] === 0) return false
        if (color[3] !== 255 || parseFloat(style.outlineOffset) < 0 || parseFloat(style.opacity) !== 1 ||
          style.filter !== 'none' || style.mixBlendMode !== 'normal') return null
        const rect = node.getBoundingClientRect(), outset = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset))
        let backdrop: number[] | null = null
        for (let ancestor = parent(node); ancestor; ancestor = parent(ancestor)) {
          const surrounding = getComputedStyle(ancestor)
          if (parseFloat(surrounding.opacity) !== 1 || surrounding.filter !== 'none' || surrounding.backdropFilter !== 'none' ||
            surrounding.mixBlendMode !== 'normal') return null
          const bounds = ancestor.getBoundingClientRect()
          if (surrounding.overflowX !== 'visible' && (bounds.left > rect.left - outset || bounds.right < rect.right + outset) ||
            surrounding.overflowY !== 'visible' && (bounds.top > rect.top - outset || bounds.bottom < rect.bottom + outset)) return null
          if (backdrop) continue
          if (surrounding.backgroundImage !== 'none' || surrounding.boxShadow !== 'none') return null
          const background = sampleColor(surrounding.backgroundColor)
          if (!background || background[3] !== 0 && background[3] !== 255) return null
          if (background[3] === 255) {
            if (bounds.left > rect.left - outset || bounds.top > rect.top - outset ||
              bounds.right < rect.right + outset || bounds.bottom < rect.bottom + outset) return null
            backdrop = background
          }
        }
        if (!backdrop && (matchMedia('(prefers-color-scheme: dark)').matches ||
          getComputedStyle(document.documentElement).colorScheme.includes('dark') || getComputedStyle(document.body).colorScheme.includes('dark'))) return null
        // The default light browser canvas is white when ancestors are transparent.
        backdrop ??= [255, 255, 255, 255]
        if (color.slice(0, 3).every((channel, index) => channel === backdrop![index]))
          return style.boxShadow === 'none' ? false : null
        return true
      }
      function profile(el: Element) {
        const descendants = elements(el, 13)
        const nodes = descendants.nodes.filter(paintedInDocument)
        const styles = nodes.flatMap(node => [{ style: getComputedStyle(node), node, pseudo: false },
          ...['::before', '::after'].map(pseudo => ({ style: getComputedStyle(node, pseudo), node, pseudo: true }))
            .filter(({ style }) => !['none', 'normal'].includes(style.content) && style.display !== 'none' && style.visibility === 'visible' && parseFloat(style.opacity) !== 0)])
        let uncertainPaint = false
        function signature({ style, node, pseudo }: { style: CSSStyleDeclaration; node: Element; pseudo: boolean }) {
          const outline = paintedOutline(style, node)
          if (outline === null) uncertainPaint = true
          const borders = (['Top', 'Right', 'Bottom', 'Left'] as const).map(side => {
            const line = style[`border${side}Style`], width = style[`border${side}Width`], color = style[`border${side}Color`]
            if (['none', 'hidden'].includes(line) || !(parseFloat(width) > 0)) return 'none'
            const painted = paintedColor(color)
            if (painted === null) uncertainPaint = true
            return painted === false ? 'none' : [line, width, color].join(':')
          })
          // Declared colors do not paint an absent border, decoration or box.
          // Pseudo-elements use their own resolved dimensions, not the parent's.
          const rect = node.getBoundingClientRect()
          const emptyBackground = pseudo ? style.display !== 'inline' && (
            [style.width, style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth].every(value => parseFloat(value) === 0) ||
            [style.height, style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth].every(value => parseFloat(value) === 0)
          ) : rect.width === 0 || rect.height === 0
          return [...borders, ...properties.map(key => {
            if (key.startsWith('outline')) {
              return outline ? style[key] : 'none'
            }
            if (key === 'boxShadow' && style.boxShadow !== 'none') {
              const colors = style.boxShadow.match(/(?:rgba?|hsla?|color|lab|lch|oklab|oklch)\([^)]*\)/g)
              if (!colors || colors.some(color => paintedColor(color) === null)) uncertainPaint = true
              else if (colors.every(color => paintedColor(color) === false)) return 'none'
            }
            if (key === 'backgroundColor' || key === 'color') {
              if (key === 'backgroundColor' && emptyBackground) return 'transparent'
              const painted = paintedColor(style[key])
              if (painted === null) uncertainPaint = true
              if (painted === false) return 'transparent'
            }
            if (key === 'textDecoration' && style.textDecorationLine === 'none') return 'none'
            return style[key]
          })].join('|')
        }
        const recorded = styles.map(signature).join(';')
        return { signature: recorded, uncertainPaint,
          unstable: styles.some(({ style }) => style.animationName !== 'none' || style.transitionDuration.split(',').some(duration => parseFloat(duration) > 0)),
          truncated: descendants.truncated }
      }
      function selector(el: Element): string {
        const parts: string[] = []
        const root = el.getRootNode()
        for (let current: Element | null = el; current && current !== document.documentElement; current = current.parentElement) {
          if (current.id && (root as Document | ShadowRoot).querySelectorAll('#' + CSS.escape(current.id)).length === 1) {
            parts.unshift('#' + CSS.escape(current.id)); break
          }
          const siblings = [...(current.parentElement ?? root as ShadowRoot).children].filter(sibling => sibling.tagName === current!.tagName)
          parts.unshift(current.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')')
        }
        const local = parts.join(' > ')
        return root instanceof ShadowRoot ? selector(root.host) + ' >>> ' + local : local
      }
      function visible(el: Element) {
        const style = getComputedStyle(el)
        return paintedInDocument(el) && style.display !== 'none' && !closest(el, '[hidden],[aria-hidden="true"]')
      }
      function identity(el: Element) {
        const rect = el.getBoundingClientRect()
        const name = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).slice(0, 8)
          .map(id => byId(el, id)?.textContent ?? '').join(' ').trim() ||
          ('labels' in el ? (el as HTMLInputElement).labels?.[0]?.textContent : null) ||
          (el.matches('input,textarea,select,[contenteditable],dialog,[role="dialog"],[role="menu"]') ? el.tagName.toLowerCase() : el.textContent) || el.tagName.toLowerCase()
        return { selector: selector(el), label: name.trim().replace(/\s+/g, ' ').slice(0, 160),
          rect: { x: Math.max(0, Math.min(1, rect.x / innerWidth)), y: Math.max(0, Math.min(1, rect.y / innerHeight)),
            width: Math.max(0, Math.min(1, (Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) / innerWidth)),
            height: Math.max(0, Math.min(1, (Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) / innerHeight)) } }
      }
      const baseline = new Map(inspected.map((el, index) => [el, { id: index + 1, domOrder: index,
        focusedAtRegistration: el === activeElement(), ...profile(el) }]))
      let nextId = baseline.size + 1
      const initialDialog = closest(activeElement(), 'dialog[open],[role="dialog"],[role="alertdialog"]')
      function sample() {
        const active = activeElement()
        if (!active || active === document.body || active === document.documentElement) return null
        if (opaque(active)) return { unknown: true as const }
        const before = baseline.get(active)
        if (!before) return { unknown: true as const }
        const identity = selector(active)
        if (identity.length > 2000) return { unknown: true as const }
        const after = profile(active), style = getComputedStyle(active), rect = active.getBoundingClientRect()
        const inViewport = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
        const changed = before.signature !== after.signature
        const uncertain = before.unstable || after.unstable || before.truncated || after.truncated ||
          before.uncertainPaint || after.uncertainPaint || !paintedInDocument(active) || !inViewport ||
          opaque(active) || !active.matches(':focus-visible') || parseFloat(style.opacity) === 0 ||
          before.focusedAtRegistration ||
          (!changed && active.matches('textarea,[contenteditable="true"],input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"])'))
        return { id: before.id, ...describe(active), domOrder: before.domOrder, tabIndex: active.tabIndex,
          indicator: uncertain ? 'unknown' as const : changed ? 'styled' as const : 'missing' as const,
        }
      }
      const describe = identity
      function dialogState() {
        const dialog = closest(activeElement(), 'dialog[open],[role="dialog"],[role="alertdialog"]') ??
          elements().nodes.filter(el => el.matches('dialog[open],[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]'))
            .find(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible')
        // Activation may dismiss a dialog regardless of its label language. A
        // navigation-only probe cannot establish that outcome by clicking it.
        return dialog ? { selector: selector(dialog), dismissControl: elements(dialog).nodes.filter(el => el.matches('button,[role="button"]'))
          .some(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0) } : null
      }
      function safeTrigger(el: HTMLElement) {
        const ids = (el.getAttribute('aria-controls') || el.getAttribute('popovertarget') || '').trim().split(/\s+/).filter(Boolean)
        const controlled = ids.length === 1 ? byId(el, ids[0]) : null
        return (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && el.tagName !== 'A' &&
          !(el instanceof HTMLButtonElement && (el.form !== null && el.type !== 'button' || el.type === 'reset')) &&
          !closest(el, '[role="menu"],[role="menubar"],[role="toolbar"],[role="dialog"],dialog') && !el.matches(':disabled,[aria-disabled="true"]') &&
          !/\b(delete|remove|purchase|pay|checkout|submit|send|confirm|accept|agree|consent|upload|download|logout)\b|sign\s*out|log\s*out/i.test(describe(el).label) &&
          ids.length <= 1 && !controlled?.matches('form,input,select,textarea,iframe,[role="alertdialog"]')
      }
      const openers = elements().nodes.filter(el => el.matches('button,[role="button"],[aria-haspopup],[popovertarget],[aria-expanded][aria-controls]'))
        .filter(visible).slice(0, 200).flatMap(el => {
        const popup = el.getAttribute('aria-haspopup')?.toLowerCase()
        const ids = (el.getAttribute('aria-controls') || el.getAttribute('popovertarget') || '').trim().split(/\s+/).filter(Boolean)
        const controlled = ids.length === 1 ? byId(el, ids[0]) : null
        const role = controlled?.getAttribute('role')
        const kind = popup === 'dialog' || controlled?.tagName === 'DIALOG' || role === 'dialog' ? 'dialog' as const
          : popup === 'menu' || popup === 'true' || role === 'menu' ? 'menu' as const
            : (el.hasAttribute('aria-expanded') || el.hasAttribute('popovertarget')) && controlled ? 'disclosure' as const : null
        if (!kind) return []
        const safe = safeTrigger(el)
        return [{ el, kind, controlledId: ids[0] ?? null, safe }]
      })
      function trigger(index: number) { return openers[index]?.el }
      function popupFor(index: number) {
        const opener = openers[index]
        const related = opener?.controlledId ? byId(opener.el, opener.controlledId) : null
        if (related) return visible(related) ? related : null
        const candidates = elements(opener.el.getRootNode() as Document | ShadowRoot).nodes.filter(el => el.matches(opener.kind === 'dialog' ? 'dialog[open],[role="dialog"]' : '[role="menu"]')).filter(visible)
        return candidates.length === 1 ? candidates[0] : null
      }
      function registerPopup(index: number) {
        const root = popupFor(index)
        if (!root) return
        for (const [order, el] of elements(root).nodes.filter(el => el === root || el.matches(focusableSelector + ',[role^="menuitem"]')).slice(0, 200).entries()) {
          if (!baseline.has(el as HTMLElement)) baseline.set(el as HTMLElement, { id: nextId++, domOrder: order,
            focusedAtRegistration: el === activeElement(), ...profile(el) })
        }
      }
      function popupState(index: number) {
        const root = popupFor(index), opener = trigger(index)
        const active = activeElement()
        const descendantId = active?.getAttribute('aria-activedescendant')
        const descendant = active && descendantId ? byId(active, descendantId) : null
        const effective = descendant && active && root && contains(root, active) && contains(root, descendant) && visible(descendant) ? descendant : active
        const inventory = root ? elements(root) : { nodes: [], truncated: false }
        const contents = inventory.nodes
        const items = contents.filter(el => el.matches('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]'))
          .filter(el => visible(el) && closest(el, '[role="menu"]') === root)
        const tabbable = tabTargets(contents.filter(visible))
        return { popup: root ? describe(root) : null, truncated: inventory.truncated,
          opaqueFocus: Boolean(active && opaque(active)),
          supported: Boolean(root && (openers[index].kind === 'disclosure' || openers[index].kind === 'menu' && root.getAttribute('role') === 'menu' ||
            openers[index].kind === 'dialog' && (root.tagName === 'DIALOG' || root.getAttribute('role') === 'dialog'))),
          modal: Boolean(root && (root.getAttribute('aria-modal') === 'true' || root.matches(':modal'))),
          inside: Boolean(root && effective && contains(root, effective)),
          item: effective && items.includes(effective as HTMLElement) ? describe(effective).selector : null,
          itemCount: items.length, orientation: root?.getAttribute('aria-orientation') ?? 'vertical',
          externalOwnership: Boolean(root?.getAttribute('aria-owns')), tabCount: tabbable.length, tabSelectors: tabbable.slice(0, 200).map(el => selector(el)),
          target: sample(), activeSelector: active && active !== document.body ? describe(active).selector : null,
          triggerConnected: Boolean(opener?.isConnected && visible(opener)), restored: active === opener,
          focusLost: !active || active === document.body || active === document.documentElement || !visible(active) }
      }
      return { count: candidates.length, limitations, sample, dialogState, openers, trigger,
        opener: (index: number) => ({ ...describe(trigger(index)), kind: openers[index].kind, safe: openers[index].safe && safeTrigger(trigger(index)),
          visible: visible(trigger(index)), open: Boolean(popupFor(index)) }),
        registerPopup, popupState,
        inventoryUnchanged: () => {
          const current = candidatesNow()
          return candidates.length === current.length && inspected.every((el, index) => el === current[index]) && !initialDialog
        } }
    })
    disposeState = () => state.dispose()
    const initial = await state.evaluate(value => ({ count: value.count, limitations: value.limitations }))
    if (priorRefusals) initial.limitations.push('initial_resources_unavailable')
    const steps: KeyboardEvidence['steps'] = []
    let complete = false, reason = 'step_limit', trap: KeyboardEvidence['trap'] = 'not_observed'
    const interactions: KeyboardInteraction[] = []
    const visited = new Set<number>()
    async function inspectExit() {
      const dialog = await state.evaluate(value => value.dialogState())
      await page.keyboard.press('Shift+Tab')
      const reverse = await state.evaluate(value => value.sample())
      await page.keyboard.press('Escape')
      const afterEscape = await state.evaluate(value => ({ target: value.sample(), dialog: value.dialogState() }))
      const exited = dialog && afterEscape.dialog?.selector !== dialog.selector
      if (exited) { trap = 'escaped'; reason = 'dialog_dismissed' }
      else if (reverse && !('unknown' in reverse) && visited.has(reverse.id) && afterEscape.target && !('unknown' in afterEscape.target) &&
        visited.has(afterEscape.target.id) && visited.size < initial.count && !dialog?.dismissControl) {
        trap = 'blocked'; reason = 'focus_cycle_persisted'
      } else { trap = 'unknown'; reason = dialog?.dismissControl ? 'dialog_requires_activation' : 'focus_cycle_unresolved' }
    }
    for (let index = 0; index < KEYBOARD_STEP_LIMIT; index++) {
      if (Date.now() >= deadline) { reason = 'deadline_exhausted'; break }
      await page.keyboard.press('Tab')
      const target = await state.evaluate(value => value.sample())
      if (!target) {
        if (await state.evaluate(value => value.dialogState())) { await inspectExit(); break }
        complete = visited.size === initial.count && await state.evaluate(value => value.inventoryUnchanged())
        reason = complete ? 'document_boundary_observed' : 'unvisited_controls'
        break
      }
      if ('unknown' in target) { reason = 'focus_scope_changed'; break }
      if (visited.has(target.id)) {
        await inspectExit()
        break
      }
      visited.add(target.id)
      steps.push(target)
    }
    const navigationComplete = complete && refusalCount() === 0
    const initiallyRefused = refusalCount() > 0
    if (initiallyRefused) { complete = false; reason = 'scanner_boundary_refused'; initial.limitations.push('protected_action_refused') }
    if (initial.limitations.length) complete = false
    if (complete && steps.some(step => step.indicator === 'unknown')) {
      complete = false; reason = 'focus_indicator_unresolved'
    }
    const openerCount = await state.evaluate(value => value.openers.length)
    async function settle() {
      if (Date.now() < deadline) await page.waitForTimeout(Math.min(40, deadline - Date.now()))
    }
    async function observe(index: number) {
      await settle()
      return state.evaluate((value, i) => value.popupState(i), index)
    }
    async function waitForPopup(index: number, open: boolean) {
      const until = Math.min(deadline, Date.now() + 600)
      let observed = await observe(index)
      while (Boolean(observed.popup) !== open && Date.now() < until) observed = await observe(index)
      return observed
    }
    for (let index = 0; index < Math.min(openerCount, KEYBOARD_INTERACTION_LIMIT); index++) {
      const opener = await state.evaluate((value, i) => value.opener(i), index)
      if (opener.selector.length > 2000) continue
      const result: KeyboardInteraction = { kind: opener.kind, trigger: { selector: opener.selector, label: opener.label, rect: opener.rect }, popup: null,
        openedBy: 'none', reason: 'not_exercised', entry: 'unknown', arrows: 'not_applicable', containment: 'not_applicable',
        escape: 'unknown', restoration: 'unknown', complete: false, steps: [] }
      interactions.push(result)
      if (initiallyRefused) { result.reason = 'scanner_boundary_refused'; break }
      if (!opener.safe || !opener.visible || opener.open) {
        result.reason = opener.open ? 'popup_already_open' : 'unsafe_or_unsupported_trigger'; continue
      }
      if (Date.now() >= deadline) { result.reason = 'deadline_exhausted'; break }
      if (!navigationComplete && !steps.some(step => step.selector === opener.selector)) {
        result.reason = 'trigger_not_exercised'; continue
      }
      const refusedBefore = refusalCount()
      let disposeTrigger: (() => Promise<void>) | undefined
      try {
        const handle = await state.evaluateHandle((value, i) => value.trigger(i), index)
        disposeTrigger = () => handle.dispose()
        const locator = handle.asElement()
        if (!locator) { result.reason = 'trigger_removed'; break }
        const timeout = () => Math.max(1, Math.min(600, deadline - Date.now()))
        const wasReached = steps.some(step => step.selector === opener.selector)
        if (wasReached) {
          await locator.focus()
          await locator.press('Enter', { timeout: timeout() })
          if ((await waitForPopup(index, true)).popup) result.openedBy = 'enter'
          else if (Date.now() < deadline && refusalCount() === refusedBefore) {
            await locator.press('Space', { timeout: timeout() })
            if ((await waitForPopup(index, true)).popup) result.openedBy = 'space'
          }
        }
        if (result.openedBy === 'none' && Date.now() < deadline && refusalCount() === refusedBefore) {
          await locator.click({ timeout: timeout() })
          if ((await waitForPopup(index, true)).popup) result.openedBy = 'pointer'
        }
        if (result.openedBy === 'none') {
          result.reason = refusalCount() !== refusedBefore ? 'scanner_boundary_refused' : 'opening_not_observed'
          if (result.reason === 'scanner_boundary_refused') break
          continue
        }
        await state.evaluate((value, i) => value.registerPopup(i), index)
        let opened = await observe(index)
        if (!opened.popup || opened.popup.selector.length > 2000 || !opened.supported || opened.externalOwnership || opened.truncated) {
          result.reason = 'popup_scope_unresolved'; break
        }
        result.popup = opened.popup
        const popupSelector = opened.popup.selector
        let focusScopeUnresolved = false, menuScopeComplete = true
        const record = (sample: typeof opened) => {
          const target = sample.target
          if (sample.inside && target && 'unknown' in target) focusScopeUnresolved = true
          if (target && !('unknown' in target) && sample.inside && result.steps.length < INTERACTION_STEP_LIMIT &&
            !result.steps.some(step => step.selector === target.selector)) result.steps.push(target)
        }
        record(opened)
        if (result.kind === 'menu') {
          result.entry = opened.item ? 'inside' : 'outside'
          if (opened.itemCount > 1 && opened.item) {
            const visited = new Set([opened.item])
            let current = opened, unresolved = false
            for (let step = 0; step < Math.min(INTERACTION_STEP_LIMIT - 2, opened.itemCount - 1) && Date.now() < deadline; step++) {
              await page.keyboard.press(opened.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown')
              const next = await observe(index); record(next)
              if (!next.item || next.popup?.selector !== popupSelector) { unresolved = true; break }
              current = next
              if (visited.has(next.item)) break
              visited.add(next.item)
            }
            await page.keyboard.press(opened.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp')
            const previous = await observe(index); record(previous)
            result.arrows = unresolved || !previous.item || previous.popup?.selector !== popupSelector ? 'unknown'
              : visited.size === 1 && previous.item === opened.item ? 'stuck'
                : visited.size > 1 && previous.item !== current.item ? 'moved' : 'unknown'
            menuScopeComplete = visited.size === opened.itemCount
          }
        } else if (result.kind === 'dialog') {
          result.entry = opened.inside ? 'inside' : 'outside'
          if (opened.modal) {
            result.containment = 'unknown'
            const visited = new Set<string>()
            for (let step = 0; step < Math.min(INTERACTION_STEP_LIMIT - 2, opened.tabCount + 2) && Date.now() < deadline; step++) {
              await page.keyboard.press('Tab')
              const sampled = await observe(index); record(sampled)
              if (sampled.popup?.selector !== popupSelector || sampled.opaqueFocus) break
              if (!sampled.inside && sampled.activeSelector) { result.containment = 'escaped'; break }
              if (sampled.inside && sampled.activeSelector) {
                if (visited.has(sampled.activeSelector)) break
                visited.add(sampled.activeSelector)
              }
            }
            await page.keyboard.press('Shift+Tab')
            let reverse = await observe(index); record(reverse)
            if (!reverse.activeSelector && reverse.popup) {
              await page.keyboard.press('Shift+Tab'); reverse = await observe(index); record(reverse)
            }
            if (reverse.popup?.selector === popupSelector && reverse.activeSelector && !reverse.inside) result.containment = 'escaped'
            else if (result.containment !== 'escaped' && !reverse.opaqueFocus && reverse.inside && opened.tabCount > 0 &&
              opened.tabSelectors.every(selector => visited.has(selector))) result.containment = 'contained'
          }
        } else {
          result.entry = 'unknown'
          for (let step = 0; step < 3 && Date.now() < deadline; step++) {
            await page.keyboard.press('Tab'); const sampled = await observe(index); record(sampled)
            if (sampled.inside) { result.entry = 'inside'; break }
          }
        }
        if (Date.now() >= deadline) { result.reason = 'deadline_exhausted'; break }
        await page.keyboard.press('Escape')
        const closed = await waitForPopup(index, false)
        result.escape = closed.popup ? 'remained' : 'closed'
        result.restoration = closed.popup ? 'unknown' : !closed.triggerConnected ? 'removed' : closed.restored ? 'trigger' : closed.focusLost ? 'lost' : 'other'
        result.reason = refusalCount() !== refusedBefore ? 'scanner_boundary_refused' : result.restoration === 'other' || result.restoration === 'removed' ? 'restoration_requires_review' : 'interaction_observed'
        if (result.kind === 'disclosure' && closed.popup && result.reason !== 'scanner_boundary_refused') {
          // Cleanup uses only the same declared toggle. This happens after the
          // Escape/focus observation and cannot establish focus restoration.
          await locator.focus(); await locator.press('Enter', { timeout: timeout() })
          opened = await waitForPopup(index, false)
          result.reason = opened.popup ? 'popup_remained_open' : 'disclosure_toggled_closed'
        }
        if (refusalCount() !== refusedBefore) result.reason = 'scanner_boundary_refused'
        result.complete = !focusScopeUnresolved && menuScopeComplete && refusalCount() === refusedBefore && result.openedBy !== 'pointer' && result.entry === 'inside' &&
          !['unknown'].includes(result.arrows) && result.containment !== 'unknown' &&
          (result.kind === 'disclosure' ? !opened.popup || result.escape === 'closed' : result.escape === 'closed' && result.restoration === 'trigger')
        if (closed.popup && result.kind !== 'disclosure' || result.reason === 'popup_remained_open' || result.reason === 'scanner_boundary_refused') break
      } catch {
        result.reason = refusalCount() !== refusedBefore ? 'scanner_boundary_refused' : Date.now() >= deadline ? 'deadline_exhausted' : 'interaction_interrupted'
        break
      } finally {
        await disposeTrigger?.().catch(() => undefined)
      }
    }
    if (refusalCount() > 0 && interactions.length === 0 && !initiallyRefused) {
      complete = false; reason = 'scanner_boundary_refused'; initial.limitations.push('protected_action_refused')
    }
    if (openerCount > interactions.length || interactions.some(interaction => !interaction.complete)) {
      complete = false
      if (reason === 'document_boundary_observed') reason = 'interaction_scope_incomplete'
    }
    if (interactions.some(interaction => interaction.steps.some(step => step.indicator === 'unknown'))) {
      complete = false
      if (reason === 'document_boundary_observed') reason = 'focus_indicator_unresolved'
    }
    const capture = auditPageObservation(page)
    return keyboardEvidenceSchema.parse({ version: 1, focusPolicy: 'painted-properties-v2', pageUrl, collectedAt, complete, reason, navigationComplete,
      ...(capture && !capture.restricted && capture.scope.finalUrl === pageUrl ? { scope: capture.scope } : {}),
      candidateCount: initial.count, steps, trap, limitations: initial.limitations,
      interactionCount: openerCount, interactions })
  } finally {
    await disposeState?.().catch(() => undefined)
    await boundary?.dispose()
  }
}
