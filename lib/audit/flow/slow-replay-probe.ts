import { captureScreenshot } from '../browser/capture-screenshot'
import type { Browser, Page, Response } from 'playwright'
import { setTimeout as pause } from 'node:timers/promises'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { observeViewport, readViewportDocument, sameViewportDocument, type ViewportDocument } from '../browser/viewport-observation'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { isBotInterstitialPage, observePublicSignInRedirect, PageCaptureError, PUBLIC_SIGN_IN_REDIRECT } from '@/lib/audit/browser/page-capture'
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
  let page: Page | null = null, work: Promise<void> | undefined, navigationStartedAt = Date.now()
  let disposeNetwork: (() => void) | undefined
  const controller = new AbortController()
  const deadline = options.deadline ?? Date.now() + 45_000
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))])
  const abortPage = () => { void page?.context().close().catch(() => undefined) }
  signal.addEventListener('abort', abortPage, { once: true })
  const emptyResult = (): SlowReplayResult => ({ timeToFirstTextMs: 30_000, timeToCtaMs: 30_000, screenshotUrls: [], complete: false,
    expectedActionCount: options.expectedActions?.length ?? 0,
    profile: SLOW_REPLAY_PROFILE, pageUrl, navigationComplete: false, observedForMs: 0, textBlankThroughMs: 0, ctaAbsentThroughMs: 0,
    timeToContentMs: 30_000, contentAbsentThroughMs: 0, captures: [], actions: expectedActions.map(action => ({ ...action, timeToVisibleMs: 30_000, absentThroughMs: 0 })) })
  let result = emptyResult(), sampledDocument: ViewportDocument | undefined
  const captures: NonNullable<SlowReplayResult['captures']> = []
  const screenshots = new Map<number, { buffer: Buffer; document: ViewportDocument }>()
  let latestResponse: { status: number; unavailable: boolean } | undefined
  let diverted = false
  const checkLanding = async (current: Page, status: number | null) => {
    if (!options.scanAccess && await observePublicSignInRedirect(current, pageUrl, status)) {
      diverted = true
      controller.abort()
    }
    return diverted
  }
  const unavailable = (): SlowReplayResult => ({ ...emptyResult(), reason: diverted ? PUBLIC_SIGN_IN_REDIRECT : 'navigation_unavailable' })
  const samplingSatisfied = () => result.timeToContentMs! < 30_000 && result.timeToCtaMs < 30_000 &&
    result.actions!.every(action => action.timeToVisibleMs < 30_000)
  try {
    const session = await createAuditPage(browser, pageUrl, {
      profile: MOBILE_CAPTURE_PROFILE, settle: false, deadline, scanAccess: options.scanAccess, journeySafe: true, readOnlyInteractions: true,
      requirePublicLanding: true,
      allowLocalhost: process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_LOCALHOST === 'true',
      configurePage: async initialPage => {
        const cdp = await initialPage.context().newCDPSession(initialPage)
        await cdp.send('Network.emulateNetworkConditions', SLOW_3G)
      },
      onNavigationStart: (current, started) => {
        page = current
        navigationStartedAt = started
        current.on('response', (response: Response) => {
          if (!response.request().isNavigationRequest() || response.frame() !== current.mainFrame()) return
          const status = response.status(), headers = response.headers()
          if (headers.location && [301, 302, 303, 307, 308].includes(status)) return
          latestResponse = { status, unavailable: status >= 400 || status === 206 || isBotInterstitialPage({ cfMitigated: headers['cf-mitigated'] }) }
        })
        let capturesDone = false
        const poll = async () => {
          while (!signal.aborted && Date.now() - started < OBSERVATION_MS) {
            try {
              // Fast pages only need a document identity check while the last
              // screenshot is pending. A new route starts full sampling again.
              if (sampledDocument && samplingSatisfied() && sameViewportDocument(sampledDocument, await readViewportDocument(current))) {
                if (capturesDone) break
                await pause(100, undefined, { signal })
                continue
              }
              const observed = await observeSlowViewport(current, expectedActions)
              if (await checkLanding(current, 200)) return
              const elapsed = Date.now() - started
              if (elapsed > OBSERVATION_MS || signal.aborted) break
              if (!sampledDocument || !sameViewportDocument(sampledDocument, observed)) {
                sampledDocument = observed
                result = emptyResult()
              }
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
              if (capturesDone && samplingSatisfied()) break
            } catch { /* Navigation may briefly replace the execution context. */ }
            await pause(100, undefined, { signal })
          }
        }
        const capture = async (targetMs: number) => {
          await pause(Math.max(0, targetMs - (Date.now() - started)), undefined, { signal })
          if (await checkLanding(current, 200)) return
          const startedAtMs = Date.now() - started
          let capturedAtMs: number | null = null
          try {
            const document = await readViewportDocument(current)
            const buffer = await captureScreenshot(current, { type: 'png', fullPage: false, timeout: 1500 }, deadline)
            const frameAt = Date.now() - started
            if (!signal.aborted && sameViewportDocument(document, await readViewportDocument(current))) {
              capturedAtMs = frameAt
              screenshots.set(targetMs, { buffer, document })
            }
          } catch (error) { if (!signal.aborted) logger.warn('Slow replay capture unavailable', { error }) }
          captures.push({ targetMs, startedAtMs, capturedAtMs, completedAtMs: Date.now() - started, url: null })
        }
        const captureWork = Promise.all([2000, 5000, 8000].map(capture)).then(() => { capturesDone = true })
        work = Promise.all([poll(), captureWork]).then(() => undefined)
        // Observe rejection immediately while navigation still owns the page.
        void work.catch(() => undefined)
      },
    })
    page = session.page
    disposeNetwork = session.disposeNetwork
    await work
    if (await checkLanding(page, latestResponse?.status ?? session.httpStatus)) return unavailable()
    const final = await readViewportDocument(page, true)
    if (latestResponse?.unavailable || isBotInterstitialPage({ title: final.title })) return unavailable()
    if (!sampledDocument || !sameViewportDocument(sampledDocument, final)) result = emptyResult()
    result.navigationComplete = true
    result.restricted = (session.safetyRestrictions?.length ?? 0) > 0
    result.pageUrl = final.pageUrl
    const scope = auditPageObservation(page)?.scope
    if (scope?.finalUrl === final.pageUrl) result.scope = scope
    result.complete = !signal.aborted && !result.restricted && (result.expectedActionCount ?? 0) <= expectedActions.length && (result.timeToContentMs! <= 5000 || result.contentAbsentThroughMs! > 5000)
      && (result.timeToCtaMs <= 8000 || result.ctaAbsentThroughMs! > 8000)
    if (!result.complete) result.reason = 'observation_incomplete'
    result.captures = captures.sort((a, b) => a.targetMs - b.targetMs)
    disposeNetwork()
    disposeNetwork = undefined
    await page.context().close().catch(() => undefined)
    page = null
    await Promise.all(result.captures.map(async capture => {
      const frame = screenshots.get(capture.targetMs)
      if (!frame || !sameViewportDocument(frame.document, final) || signal.aborted) return
      try {
        capture.url = await uploadScreenshot(auditId, 'mobile', frame.buffer,
          (options.pageKey ? options.pageKey + '-' : '') + 'flow-slow-' + capture.targetMs / 1000 + 's', { deadline, signal })
      } catch (error) { if (!signal.aborted) logger.warn('Slow replay upload unavailable', { error }) }
      finally { capture.completedAtMs = Date.now() - navigationStartedAt }
    }))
    result.screenshotUrls = result.captures!.flatMap(capture => capture.url ? [capture.url] : [])
    return result
  } catch (error) {
    if (error instanceof PageCaptureError && error.code === PUBLIC_SIGN_IN_REDIRECT) diverted = true
    if (diverted || latestResponse?.unavailable) return unavailable()
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
