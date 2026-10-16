import type { Browser, Page } from 'playwright'
import { setTimeout as pause } from 'node:timers/promises'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { observeViewport } from '../browser/viewport-observation'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { PageCaptureError } from '@/lib/audit/browser/page-capture'
import { sameSlowActionIdentity, slowActionForObservation, SLOW_3G, SLOW_REPLAY_PROFILE, type SlowReplayResult, type SlowActionIdentity } from './slow-replay-contract'
import { auditPageObservation } from '../browser/observation-scope'
export type { SlowReplayResult } from './slow-replay-contract'

const OBSERVATION_MS = 10_000

export async function observeSlowViewport(page: Page, expectedActions: SlowActionIdentity[] = []) {
  return observeViewport(page, { profile: SLOW_REPLAY_PROFILE, expectedActions })
}

export async function runSlowReplay(browser: Browser, auditId: string, pageUrl: string,
  options: { deadline?: number; pageKey?: string; expectedActions?: SlowActionIdentity[]; scanAccess?: import('../scan-access').ScanAccessConfig | null } = {},
): Promise<SlowReplayResult> {
  const expectedActions = (options.expectedActions ?? []).slice(0, 20).map(slowActionForObservation)
  let page: Page | null = null, work: Promise<void> | undefined
  let disposeNetwork: (() => void) | undefined
  const controller = new AbortController()
  const deadline = options.deadline ?? Date.now() + 45_000
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))])
  const abortPage = () => { void page?.context().close().catch(() => undefined) }
  signal.addEventListener('abort', abortPage, { once: true })
  const result: SlowReplayResult = { timeToFirstTextMs: 30_000, timeToCtaMs: 30_000, screenshotUrls: [], complete: false,
    profile: SLOW_REPLAY_PROFILE, pageUrl, navigationComplete: false, observedForMs: 0, textBlankThroughMs: 0, ctaAbsentThroughMs: 0,
    timeToContentMs: 30_000, contentAbsentThroughMs: 0, captures: [], actions: expectedActions.map(action => ({ ...action, timeToVisibleMs: 30_000, absentThroughMs: 0 })) }
  try {
    const session = await createAuditPage(browser, pageUrl, {
      profile: MOBILE_CAPTURE_PROFILE, settle: false, deadline, scanAccess: options.scanAccess, journeySafe: true, readOnlyInteractions: true,
      allowLocalhost: process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_LOCALHOST === 'true',
      configurePage: async initialPage => {
        const cdp = await initialPage.context().newCDPSession(initialPage)
        await cdp.send('Network.emulateNetworkConditions', SLOW_3G)
      },
      onNavigationStart: (current, started) => {
        page = current
        const poll = async () => {
          while (!signal.aborted && Date.now() - started < OBSERVATION_MS) {
            try {
              const observed = await observeSlowViewport(current, expectedActions), elapsed = Date.now() - started
              if (elapsed > OBSERVATION_MS || signal.aborted) break
              result.observedForMs = elapsed
              if (observed.text && result.timeToFirstTextMs === 30_000) result.timeToFirstTextMs = elapsed
              if (observed.content && result.timeToContentMs === 30_000) result.timeToContentMs = elapsed
              if (observed.cta && result.timeToCtaMs === 30_000) {
                result.timeToCtaMs = elapsed
                const action = observed.actions[0]
                if (!result.actions!.some(item => sameSlowActionIdentity(item, action)) && result.actions!.length < 20)
                  result.actions!.push({ ...action, timeToVisibleMs: elapsed, absentThroughMs: result.ctaAbsentThroughMs ?? 0 })
              }
              for (const action of result.actions!) {
                if (action.timeToVisibleMs < 30_000) continue
                const found = observed.actions.find(item => sameSlowActionIdentity(item, action))
                if (found) { action.timeToVisibleMs = elapsed; action.selector = found.selector }
                else if (observed.ctaComplete) action.absentThroughMs = elapsed
              }
              if (!observed.text && observed.textComplete && result.timeToFirstTextMs === 30_000) result.textBlankThroughMs = elapsed
              if (!observed.content && observed.contentComplete && result.timeToContentMs === 30_000) result.contentAbsentThroughMs = elapsed
              if (!observed.cta && observed.ctaComplete && result.timeToCtaMs === 30_000) result.ctaAbsentThroughMs = elapsed
              if (result.timeToContentMs! < 30_000 && result.timeToCtaMs < 30_000 && result.actions!.every(action => action.timeToVisibleMs < 30_000)) break
            } catch { /* Navigation may briefly replace the execution context. */ }
            await pause(100, undefined, { signal })
          }
        }
        const capture = async (targetMs: number) => {
          await pause(Math.max(0, targetMs - (Date.now() - started)), undefined, { signal })
          const startedAtMs = Date.now() - started
          let url: string | null = null, capturedAtMs: number | null = null
          try {
            const buffer = Buffer.from(await current.screenshot({ type: 'png', fullPage: false, timeout: Math.max(1, Math.min(1500, deadline - Date.now())) }))
            capturedAtMs = Date.now() - started
            if (!signal.aborted) url = await uploadScreenshot(auditId, 'mobile', buffer, (options.pageKey ? options.pageKey + '-' : '') + 'flow-slow-' + targetMs / 1000 + 's', { deadline, signal })
          } catch (error) { if (!signal.aborted) logger.warn('Slow replay capture unavailable', { error }) }
          result.captures!.push({ targetMs, startedAtMs, capturedAtMs, completedAtMs: Date.now() - started, url })
        }
        work = Promise.all([poll(), ...[2000, 5000, 8000].map(capture)]).then(() => undefined)
        // Observe rejection immediately while navigation still owns the page.
        void work.catch(() => undefined)
      },
    })
    page = session.page
    disposeNetwork = session.disposeNetwork
    result.navigationComplete = true
    await work
    result.restricted = (session.safetyRestrictions?.length ?? 0) > 0
    result.pageUrl = page.url()
    result.scope = auditPageObservation(page)?.scope
    result.captures!.sort((a, b) => a.targetMs - b.targetMs)
    result.screenshotUrls = result.captures!.flatMap(capture => capture.url ? [capture.url] : [])
    result.complete = !signal.aborted && !result.restricted && (result.timeToContentMs! <= 5000 || result.contentAbsentThroughMs! > 5000)
      && (result.timeToCtaMs <= 8000 || result.ctaAbsentThroughMs! > 8000)
    if (!result.complete) result.reason = 'observation_incomplete'
    return result
  } catch (error) {
    result.reason = error instanceof PageCaptureError ? 'navigation_unavailable' : 'interrupted'
    logger.warn('Slow replay observation incomplete', { error })
    return result
  } finally {
    controller.abort()
    if (page) await page.context().close().catch(() => undefined)
    await work?.catch(() => undefined)
    disposeNetwork?.()
    signal.removeEventListener('abort', abortPage)
  }
}
