import type { Browser, Page } from 'playwright'
import { setTimeout as pause } from 'node:timers/promises'
import { createAuditPage } from './page-session'
import { MOBILE_CAPTURE_PROFILE } from './capture-profile'
import { observeViewport } from './viewport-observation'
import type { ScanAccessConfig } from '../scan-access'
import { MOTION_FAMILIES } from '../checks/motion-evidence'
import { PageCaptureError } from './page-capture'

export const MOTION_WINDOW_MS = 2000
export type MotionFamily = typeof MOTION_FAMILIES[number]
export type MotionTarget = { family: MotionFamily; selector: string; label: string; sample: string }
export type MotionWindow = {
  version: 1; pageUrl: string; reduced: boolean; targets: MotionTarget[]
  complete: boolean; windowMs: number; observedMs: number; restricted: boolean; contentVisible: boolean
}

/** Read native active effects once. Styles alone cannot establish running motion. */
export async function readMotionFrame(page: Page) {
  return page.evaluate(() => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
    const targets: Array<{ family: 'css' | 'transition' | 'script'; selector: string; label: string; sample: string }> = []
    const pending: typeof targets = []
    let complete = true
    if (typeof document.getAnimations !== 'function' || typeof matchMedia !== 'function')
      return { pageUrl: location.href, reduced: false, targets, pending, complete: false }
    const animations = document.getAnimations()
    if (animations.length > 1000) complete = false
    const seen = new Map<Element, Set<string>>()
    for (const animation of animations.slice(0, 1000)) {
      if (animation.playState !== 'running') continue
      const effect = animation.effect as KeyframeEffect | null
      if (!effect || !(effect.target instanceof Element)) { complete = false; continue }
      const element = effect.target
      try {
        const timing = effect.getComputedTiming()
        if (!(typeof timing.duration === 'number' && timing.duration >= 500) && timing.iterations !== Infinity) continue
        const frames = effect.getKeyframes()
        const properties = [...new Set(frames.flatMap(frame => Object.keys(frame)))].filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key))
        if (!properties.some(key => new Set(frames.map(frame => frame[key])).size > 1)) continue
        const box = element.getBoundingClientRect()
        if (box.width <= 0 || box.height <= 0) continue
        let hidden = false
        for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor)
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) { hidden = true; break }
        }
        if (hidden) continue
        if (element.getRootNode() !== document) { complete = false; continue }
        const family = 'animationName' in animation ? 'css' : 'transitionProperty' in animation ? 'transition' : 'script'
        if (seen.get(element)?.has(family)) continue
        let selector = ''
        if (element.id && document.querySelectorAll('#' + CSS.escape(element.id)).length === 1) selector = '#' + CSS.escape(element.id)
        else {
          const parts: string[] = []
          for (let node: Element | null = element; node && parts.length < 30; node = node.parentElement) {
            const siblings = node.parentElement ? [...node.parentElement.children].filter(child => child.tagName === node!.tagName) : [node]
            parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')')
            if (node.tagName === 'BODY') break
          }
          selector = parts.join(' > ')
        }
        if (selector.length > 2000 || document.querySelectorAll(selector).length !== 1) { complete = false; continue }
        const list = animation.pending || timing.progress === null || timing.currentIteration === null ||
          typeof timing.localTime === 'number' && timing.localTime < (timing.delay ?? 0) ? pending : targets
        const target: typeof targets[number] = { family, selector, label: (element.id || element.tagName.toLowerCase()).slice(0, 160),
          sample: (element.getAttribute('aria-label') || String(element.className).split(/\s+/).find(name => /animate|motion|fade|slide|moving/i.test(name)) || element.tagName.toLowerCase()).slice(0, 160) }
        if (list === targets) {
          const families = seen.get(element) ?? new Set<string>(); families.add(family); seen.set(element, families)
          const previous = pending.findIndex(item => item.family === family && item.selector === selector)
          if (previous >= 0) pending.splice(previous, 1)
          targets.push(target)
        } else if (!pending.some(item => item.family === family && item.selector === selector)) pending.push(target)
        if (targets.length + pending.length > 100) { complete = false; break }
      } catch { complete = false }
    }
    return { pageUrl: location.href, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, targets: targets.slice(0, 100), pending, complete }
  })
}

/** Startup sampling is independent of uploads, metadata and later interactions. */
export async function observeMotionWindow(page: Page, startedAt: number, deadline = Date.now() + 30_000): Promise<MotionWindow> {
  let loadedAt: number | null = null, complete = true, reduced: boolean | undefined, pageUrl = '', observedMs = 0
  const targets = new Map<string, MotionTarget>()
  let unresolved = 0
  const controller = new AbortController()
  const loaded = () => { loadedAt ??= Date.now() }
  const closed = () => controller.abort()
  const sample = async () => {
    const frame = await readMotionFrame(page)
    if (frame.pageUrl === 'about:blank') return
    if (pageUrl && pageUrl !== frame.pageUrl || reduced !== undefined && reduced !== frame.reduced) complete = false
    pageUrl = frame.pageUrl; reduced = frame.reduced; complete &&= frame.complete
    observedMs = Date.now() - startedAt
    for (const target of frame.targets) targets.set(JSON.stringify([target.family, target.selector]), target)
    unresolved = frame.pending.filter(target => !targets.has(JSON.stringify([target.family, target.selector]))).length
    if (targets.size > 100) complete = false
  }
  page.on('domcontentloaded', loaded); page.on('close', closed)
  try {
    while (!controller.signal.aborted && Date.now() < deadline && (loadedAt === null || Date.now() < loadedAt + MOTION_WINDOW_MS)) {
      // Navigation replaces the initial empty document. Retry until the new
      // document loads; losing its context afterward leaves partial evidence.
      try { await sample() } catch { if (loadedAt !== null) complete = false }
      if (targets.size > 100) break
      await pause(100, undefined, { signal: controller.signal })
    }
    if (!controller.signal.aborted && Date.now() < deadline && targets.size <= 100) await sample()
  } catch { complete = false }
  finally { page.off('domcontentloaded', loaded); page.off('close', closed) }
  return { version: 1, pageUrl, reduced: reduced ?? false, targets: [...targets.values()].slice(0, 100),
    complete: complete && !unresolved && loadedAt !== null && Date.now() >= loadedAt + MOTION_WINDOW_MS && !controller.signal.aborted && Boolean(pageUrl),
    windowMs: MOTION_WINDOW_MS, observedMs, restricted: false, contentVisible: false }
}

export async function collectReducedMotionWindow(browser: Browser, pageUrl: string, options: { deadline: number; scanAccess?: ScanAccessConfig | null }): Promise<MotionWindow> {
  let observation: Promise<MotionWindow> | undefined, page: Page | undefined
  try {
    const session = await createAuditPage(browser, pageUrl, { profile: MOBILE_CAPTURE_PROFILE, settle: false, journeySafe: true,
      scanAccess: options.scanAccess, deadline: options.deadline,
      configurePage: current => current.emulateMedia({ reducedMotion: 'reduce' }),
      onNavigationStart: (current, started) => { page = current; observation = observeMotionWindow(current, started, options.deadline); void observation.catch(() => undefined) },
    })
    page = session.page
    try {
      const result = await observation!
      const content = await observeViewport(page, { profile: 'motion', includeActions: false, excludeLoading: true })
      return { ...result, restricted: session.safetyRestrictions.length > 0, contentVisible: content.content,
        complete: result.complete && result.pageUrl === content.pageUrl }
    } finally { session.disposeNetwork() }
  } catch (error) {
    if (!(error instanceof PageCaptureError)) throw error
    return { version: 1, pageUrl, reduced: true, targets: [], complete: false, windowMs: MOTION_WINDOW_MS,
      observedMs: 0, restricted: true, contentVisible: false }
  } finally {
    await page?.context().close().catch(() => undefined)
    await observation?.catch(() => undefined)
  }
}

/** Compatibility observation of current state, sharing the native reader. */
export async function measureCurrentMotion(page: Page) {
  let emulated = false
  const settledFrame = async () => {
    let frame = await readMotionFrame(page)
    const deadline = Date.now() + 500
    while (frame.pending.length && Date.now() < deadline) {
      await pause(50)
      frame = await readMotionFrame(page)
    }
    return frame
  }
  try {
    const before = await settledFrame()
    emulated = true; await page.emulateMedia({ reducedMotion: 'reduce' })
    const after = await settledFrame()
    const complete = before.complete && after.complete && !before.pending.length && !after.pending.length && !before.reduced && after.reduced
    const failed = complete && MOTION_FAMILIES.some(family => {
      const normal = before.targets.filter(target => target.family === family).length
      const reduced = after.targets.filter(target => target.family === family).length
      return reduced > 0 && reduced >= Math.ceil(normal * 0.5)
    })
    return { motionIgnoresReducedPreference: failed, motionSampleLabel: failed ? after.targets[0]?.sample ?? null : null, motionComplete: complete }
  } catch { return { motionIgnoresReducedPreference: false, motionSampleLabel: null, motionComplete: false } }
  finally { if (emulated) await page.emulateMedia({ reducedMotion: 'no-preference' }) }
}
