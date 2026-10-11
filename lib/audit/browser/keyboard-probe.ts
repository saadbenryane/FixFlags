import type { Page } from 'playwright'
import { z } from 'zod'

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
  let refused = 0
  const priorRefusals = options.refusalCount?.() ?? 0
  const refusalCount = () => refused + Math.max(0, (options.refusalCount?.() ?? 0) - priorRefusals)
  const boundary: Parameters<Page['route']>[1] = async route => {
    const request = route.request()
    let ownPage = false
    try { ownPage = request.frame().page() === page } catch { /* Requests without an owning frame are outside this probe. */ }
    if (!ownPage || request.isNavigationRequest() || !['GET', 'HEAD', 'OPTIONS'].includes(request.method().toUpperCase())) {
      refused++; await route.abort('blockedbyclient')
    } else await route.fallback()
  }
  const closePopup = (popup: Page) => { if (popup !== page) { refused++; void popup.close().catch(() => undefined) } }
  let disposeState: (() => Promise<void>) | undefined
  try {
    await page.context().route('**', boundary)
    await page.route('**', boundary)
    page.context().on('page', closePopup)
    const state = await page.evaluateHandle(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= fn => fn
      const focusableSelector = 'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"],iframe'
      function candidatesNow() {
        return [...document.querySelectorAll<HTMLElement>(focusableSelector)]
          .filter(el => el.tabIndex >= 0 && !el.matches(':disabled,[hidden],input[type="hidden"]') && !el.closest('[inert]') &&
            el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible')
      }
      const candidates = candidatesNow()
      const limitations: string[] = []
      if (document.querySelector('iframe,frame')) limitations.push('embedded_frame_uninspected')
      if ([...document.querySelectorAll('*')].some(el => el.shadowRoot)) limitations.push('shadow_controls_uninspected')
      if (candidates.length > 200) limitations.push('candidate_limit')
      const inspected = candidates.slice(0, 200)
      const properties = ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow', 'borderColor', 'borderWidth',
        'backgroundColor', 'color', 'textDecoration', 'opacity', 'transform'] as const
      function profile(el: Element) {
        const nodes = [el, ...[...el.querySelectorAll('*')].slice(0, 12)]
        const styles = nodes.flatMap(node => [getComputedStyle(node), getComputedStyle(node, '::before'), getComputedStyle(node, '::after')])
        return { signature: styles.map(style => properties.map(key => style[key]).join('|')).join(';'),
          unstable: styles.some(style => style.animationName !== 'none' || style.transitionDuration.split(',').some(duration => parseFloat(duration) > 0)),
          truncated: el.querySelectorAll('*').length > 12 }
      }
      function selector(el: Element) {
        const parts: string[] = []
        for (let current: Element | null = el; current && current !== document.documentElement; current = current.parentElement) {
          if (current.id && document.querySelectorAll('#' + CSS.escape(current.id)).length === 1) {
            parts.unshift('#' + CSS.escape(current.id)); break
          }
          const siblings = current.parentElement ? [...current.parentElement.children].filter(sibling => sibling.tagName === current!.tagName) : [current]
          parts.unshift(current.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')')
        }
        return parts.join(' > ')
      }
      function visible(el: Element) {
        const style = getComputedStyle(el)
        return el.isConnected && el.getClientRects().length > 0 && style.visibility === 'visible' && style.display !== 'none' && style.opacity !== '0' && !el.closest('[hidden],[aria-hidden="true"]')
      }
      function identity(el: Element) {
        const rect = el.getBoundingClientRect()
        const name = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).slice(0, 8)
          .map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim() ||
          ('labels' in el ? (el as HTMLInputElement).labels?.[0]?.textContent : null) ||
          (el.matches('input,textarea,select,[contenteditable],dialog,[role="dialog"],[role="menu"]') ? el.tagName.toLowerCase() : el.textContent) || el.tagName.toLowerCase()
        return { selector: selector(el), label: name.trim().replace(/\s+/g, ' ').slice(0, 160),
          rect: { x: Math.max(0, Math.min(1, rect.x / innerWidth)), y: Math.max(0, Math.min(1, rect.y / innerHeight)),
            width: Math.max(0, Math.min(1, (Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) / innerWidth)),
            height: Math.max(0, Math.min(1, (Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) / innerHeight)) } }
      }
      const baseline = new Map(inspected.map((el, index) => [el, { id: index + 1, domOrder: index,
        focusedAtRegistration: el === document.activeElement, ...profile(el) }]))
      let nextId = baseline.size + 1
      const initialDialog = document.activeElement?.closest('dialog[open],[role="dialog"],[role="alertdialog"]') ?? null
      function sample() {
        const active = document.activeElement as HTMLElement | null
        if (!active || active === document.body || active === document.documentElement) return null
        if (active.tagName === 'IFRAME' || active.shadowRoot || active.tagName.includes('-')) return { unknown: true as const }
        const before = baseline.get(active)
        if (!before) return { unknown: true as const }
        const identity = selector(active)
        if (identity.length > 2000) return { unknown: true as const }
        const after = profile(active), style = getComputedStyle(active), rect = active.getBoundingClientRect()
        const inViewport = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
        const outlined = !['none', 'hidden'].includes(style.outlineStyle) && parseFloat(style.outlineWidth) > 0 &&
          !/^(transparent|rgba\([^)]*,\s*0\))$/.test(style.outlineColor)
        const uncertain = before.unstable || after.unstable || before.truncated || after.truncated || !inViewport ||
          active.tagName === 'IFRAME' || Boolean(active.shadowRoot) || !active.matches(':focus-visible') || parseFloat(style.opacity) === 0 ||
          (!outlined && before.focusedAtRegistration) ||
          (!outlined && before.signature === after.signature && active.matches('textarea,[contenteditable="true"],input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"])'))
        return { id: before.id, ...describe(active), domOrder: before.domOrder, tabIndex: active.tabIndex,
          indicator: uncertain ? 'unknown' as const : outlined || before.signature !== after.signature ? 'styled' as const : 'missing' as const,
        }
      }
      const describe = identity
      function dialogState() {
        const dialog = document.activeElement?.closest('dialog[open],[role="dialog"],[role="alertdialog"]') ??
          [...document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]')]
            .find(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible')
        // Activation may dismiss a dialog regardless of its label language. A
        // navigation-only probe cannot establish that outcome by clicking it.
        return dialog ? { selector: selector(dialog), dismissControl: [...dialog.querySelectorAll<HTMLElement>('button,[role="button"]')]
          .some(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0) } : null
      }
      function safeTrigger(el: HTMLElement) {
        const ids = (el.getAttribute('aria-controls') || el.getAttribute('popovertarget') || '').trim().split(/\s+/).filter(Boolean)
        const controlled = ids.length === 1 ? document.getElementById(ids[0]) : null
        return (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && el.tagName !== 'A' &&
          !(el instanceof HTMLButtonElement && (el.form !== null && el.type !== 'button' || el.type === 'reset')) &&
          !el.closest('[role="menu"],[role="menubar"],[role="toolbar"],[role="dialog"],dialog') && !el.matches(':disabled,[aria-disabled="true"]') &&
          !/\b(delete|remove|purchase|pay|checkout|submit|send|confirm|accept|agree|consent|upload|download|logout)\b|sign\s*out|log\s*out/i.test(describe(el).label) &&
          ids.length <= 1 && !controlled?.matches('form,input,select,textarea,iframe,[role="alertdialog"]')
      }
      const openers = [...document.querySelectorAll<HTMLElement>('button,[role="button"],[aria-haspopup],[popovertarget],[aria-expanded][aria-controls]')]
        .filter(visible).slice(0, 200).flatMap(el => {
        const popup = el.getAttribute('aria-haspopup')?.toLowerCase()
        const ids = (el.getAttribute('aria-controls') || el.getAttribute('popovertarget') || '').trim().split(/\s+/).filter(Boolean)
        const controlled = ids.length === 1 ? document.getElementById(ids[0]) : null
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
        const related = opener?.controlledId ? document.getElementById(opener.controlledId) : null
        if (related) return visible(related) ? related : null
        const candidates = [...document.querySelectorAll(opener.kind === 'dialog' ? 'dialog[open],[role="dialog"]' : '[role="menu"]')].filter(visible)
        return candidates.length === 1 ? candidates[0] : null
      }
      function registerPopup(index: number) {
        const root = popupFor(index)
        if (!root) return
        for (const [order, el] of [root, ...root.querySelectorAll<HTMLElement>(focusableSelector + ',[role^="menuitem"]')].slice(0, 200).entries()) {
          if (!baseline.has(el as HTMLElement)) baseline.set(el as HTMLElement, { id: nextId++, domOrder: order,
            focusedAtRegistration: el === document.activeElement, ...profile(el) })
        }
      }
      function popupState(index: number) {
        const root = popupFor(index), opener = trigger(index)
        const active = document.activeElement
        const descendantId = active?.getAttribute('aria-activedescendant')
        const descendant = descendantId ? document.getElementById(descendantId) : null
        const effective = descendant && active && root?.contains(active) && root.contains(descendant) && visible(descendant) ? descendant : active
        const items = root ? [...root.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]')]
          .filter(el => visible(el) && el.closest('[role="menu"]') === root) : []
        const tabTargets = root ? [...root.querySelectorAll<HTMLElement>(focusableSelector)]
          .filter(el => visible(el) && el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]')) : []
        return { popup: root ? describe(root) : null,
          opaqueFocus: Boolean(active && (active.tagName === 'IFRAME' || active.shadowRoot || active.tagName.includes('-'))),
          supported: Boolean(root && (openers[index].kind === 'disclosure' || openers[index].kind === 'menu' && root.getAttribute('role') === 'menu' ||
            openers[index].kind === 'dialog' && (root.tagName === 'DIALOG' || root.getAttribute('role') === 'dialog'))),
          modal: Boolean(root && (root.getAttribute('aria-modal') === 'true' || root.matches(':modal'))),
          inside: Boolean(root && effective && root.contains(effective)),
          item: effective && items.includes(effective as HTMLElement) ? describe(effective).selector : null,
          itemCount: items.length, orientation: root?.getAttribute('aria-orientation') ?? 'vertical',
          externalOwnership: Boolean(root?.getAttribute('aria-owns')), tabCount: tabTargets.length, tabSelectors: tabTargets.slice(0, 200).map(el => selector(el)),
          target: sample(), activeSelector: active && active !== document.body ? describe(active).selector : null,
          triggerConnected: Boolean(opener?.isConnected && visible(opener)), restored: active === opener,
          focusLost: !active || active === document.body || active === document.documentElement || !visible(active) }
      }
      return { count: candidates.length, limitations, sample, dialogState, openers,
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
      try {
        const locator = page.locator(opener.selector)
        const timeout = () => Math.max(1, Math.min(600, deadline - Date.now()))
        const wasReached = steps.some(step => step.selector === opener.selector)
        if (wasReached) {
          await locator.focus({ timeout: timeout() })
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
        if (!opened.popup || opened.popup.selector.length > 2000 || !opened.supported || opened.externalOwnership) {
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
          await locator.focus({ timeout: timeout() }); await locator.press('Enter', { timeout: timeout() })
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
    return keyboardEvidenceSchema.parse({ version: 1, pageUrl, collectedAt, complete, reason, navigationComplete,
      candidateCount: initial.count, steps, trap, limitations: initial.limitations,
      interactionCount: openerCount, interactions })
  } finally {
    await disposeState?.().catch(() => undefined)
    await page.unroute('**', boundary).catch(() => undefined)
    await page.context().unroute('**', boundary).catch(() => undefined)
    page.context().off('page', closePopup)
  }
}
