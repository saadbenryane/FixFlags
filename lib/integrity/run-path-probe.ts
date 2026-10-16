import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { Browser, Page, Frame, Response } from 'playwright'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { PageCaptureError } from '@/lib/audit/browser/page-capture'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { dismissConsentChrome, dismissOpenDialogs } from '@/lib/audit/browser/overlay-probe'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import {
  cartAppearsUpdated,
  discoverBuyControl,
  discoverCheckoutControl,
  isCheckoutUrl,
  pageLooksPasswordGated,
  pageShowsCheckoutError,
  selectFirstAvailableVariant,
} from './buy-controls'
import { classifyWalk, combineAttempts } from './classify'
import type {
  PathProbeAttempt,
  PathProbeResult,
  PathStepEvidence,
  WalkOutcome,
} from './types'
import { captureWalkStep, persistWalkVideo } from './video'
import { observeCheckoutFrame, checkoutFrameChanged } from './checkout-frame'

const CLICK_TIMEOUT_MS = 8_000
const AFTER_CLICK_MS = 1_200

export interface RunPathProbeOptions {
  runId?: string
  url: string
  allowLocalhost?: boolean
  browser?: Browser
  confirmRed?: boolean
  deadline?: number
}

export async function runPathProbe(options: RunPathProbeOptions): Promise<PathProbeResult> {
  options = { ...options, deadline: options.deadline ?? Date.now() + 60_000 }
  const runId = options.runId ?? `probe-${Date.now()}`
  const browser = options.browser ?? (await getAuditBrowser())
  const confirmRed = options.confirmRed !== false

  const first = await runAttempt(browser, runId, 1, options)
  const firstClass = classifyWalk(first.outcome)
  let second: PathProbeAttempt | null = null
  if (confirmRed && firstClass.health === 'RED') {
    second = await runAttempt(browser, runId, 2, options)
  }
  const combined = combineAttempts(firstClass, second ? classifyWalk(second.outcome) : null)
  const chosen = second && combined.health === 'RED' ? second : first

  return {
    health: combined.health,
    reason: combined.reason,
    confirmed: combined.confirmed,
    attempts: second ? [first, second] : [first],
    steps: chosen.steps,
    videoUrl: chosen.videoUrl,
    gifUrl: chosen.gifUrl,
    failedStep: chosen.outcome.failedStep,
    finalUrl: chosen.finalUrl,
  }
}

async function runAttempt(
  browser: Browser,
  runId: string,
  attempt: number,
  options: RunPathProbeOptions
): Promise<PathProbeAttempt> {
  const videoDir = await fs.mkdtemp(path.join(os.tmpdir(), `fixflags-integrity-${runId}-`))
  const stepPngs: Array<Buffer | null> = []
  const steps: PathStepEvidence[] = []
  const outcome: WalkOutcome = {
    reachedCheckout: false,
    httpStatus: null,
    buyControlFound: false,
    buyControlClicked: false,
    cartUpdated: false,
    checkoutErrorVisible: false,
    botWall: false,
    passwordGate: false,
    timedOut: false,
    pageUnavailable: false,
    failedStep: 'landing',
  }

  const navigationResponses = new Map<Frame, Response>()
  let page: Page | null = null
  let finalUrl = options.url

  try {
    const session = await createAuditPage(browser, options.url, {
      profile: MOBILE_CAPTURE_PROFILE,
      allowLocalhost: options.allowLocalhost,
      buyPath: true,
      journeySafe: true,
      recordVideoDir: videoDir,
      settle: true,
      deadline: options.deadline,
      onSafetyRefusal: () => { outcome.safetyRefused = true },
    })
    page = session.page
    finalUrl = page.url()
    outcome.httpStatus = session.httpStatus
    // The landing response cannot certify a later checkout navigation. Keep
    // the final main-frame response, excluding cart APIs and other resources.
    page.on('response', (response) => {
      if (response.request().isNavigationRequest()) {
        navigationResponses.set(response.frame(), response)
        if (navigationResponses.size > 100) navigationResponses.delete(navigationResponses.keys().next().value!)
        if (response.frame() === page!.mainFrame()) outcome.httpStatus = response.status()
      }
    })

    await dismissConsentChrome(page)
    await dismissOpenDialogs(page)

    if (await pageLooksPasswordGated(page)) {
      outcome.passwordGate = true
      await captureWalkStep(page, 'landing', steps, stepPngs)
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    await captureWalkStep(page, 'landing', steps, stepPngs)

    if (isCheckoutUrl(page.url())) {
      outcome.checkoutErrorVisible = await pageShowsCheckoutError(page)
      outcome.reachedCheckout = !outcome.checkoutErrorVisible && (outcome.httpStatus ?? 200) < 400
      outcome.failedStep = outcome.reachedCheckout ? null : 'checkout'
      await captureWalkStep(page, outcome.reachedCheckout ? 'checkout' : 'failure', steps, stepPngs)
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    const variantChanged = await selectFirstAvailableVariant(page)
    if (variantChanged) {
      await captureWalkStep(page, 'variant', steps, stepPngs)
    }

    const buy = await discoverBuyControl(page)
    outcome.buyControlFound = Boolean(buy)
    if (!buy) {
      outcome.failedStep = 'add_to_cart'
      await captureWalkStep(page, 'failure', steps, stepPngs)
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    const previousCheckoutFrame = await observeCheckoutFrame(page, navigationResponses)
    const clicked = await clickSelector(page, buy.selector)
    outcome.buyControlClicked = clicked
    if (!clicked) {
      outcome.failedStep = 'add_to_cart'
      await captureWalkStep(page, 'failure', steps, stepPngs)
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    await sleep(AFTER_CLICK_MS)
    await captureWalkStep(page, 'add_to_cart', steps, stepPngs)
    finalUrl = page.url()

    if (isCheckoutUrl(page.url())) {
      outcome.checkoutErrorVisible = await pageShowsCheckoutError(page)
      outcome.reachedCheckout = !outcome.checkoutErrorVisible && (outcome.httpStatus ?? 200) < 400
      outcome.cartUpdated = true
      outcome.failedStep = outcome.reachedCheckout ? null : 'checkout'
      await captureWalkStep(page, outcome.reachedCheckout ? 'checkout' : 'failure', steps, stepPngs)
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    outcome.cartUpdated = await cartAppearsUpdated(page)
    if (outcome.cartUpdated) {
      await captureWalkStep(page, 'cart', steps, stepPngs)
    }

    if (await pageShowsCheckoutError(page)) {
      outcome.checkoutErrorVisible = true
      outcome.failedStep = 'checkout'
      await captureWalkStep(page, 'failure', steps, stepPngs)
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    const checkout = await discoverCheckoutControl(page)
    if (checkout) {
      const checkoutClicked = await clickSelector(page, checkout.selector)
      if (checkoutClicked) {
        await sleep(AFTER_CLICK_MS)
      }
    }

    finalUrl = page.url()
    const embedded = isCheckoutUrl(page.url()) ? null : await observeCheckoutFrame(page, navigationResponses)
    if (isCheckoutUrl(page.url()) || embedded) {
      if (embedded && !isCheckoutUrl(page.url())) outcome.httpStatus = embedded.status
      outcome.checkoutErrorVisible = embedded?.error || await pageShowsCheckoutError(page)
      outcome.reachedCheckout = !outcome.checkoutErrorVisible && (outcome.httpStatus ?? 200) < 400 &&
        (isCheckoutUrl(page.url()) || Boolean(embedded?.usable && checkoutFrameChanged(previousCheckoutFrame, embedded)))
      outcome.cartUpdated = true
      outcome.failedStep = outcome.reachedCheckout ? null : 'checkout'
      await captureWalkStep(page, outcome.reachedCheckout ? 'checkout' : 'failure', steps, stepPngs)
      if (embedded) steps.at(-1)!.destinationUrl = embedded.url
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    if (await pageShowsCheckoutError(page)) {
      outcome.checkoutErrorVisible = true
      outcome.failedStep = 'checkout'
    } else if (!outcome.cartUpdated) {
      outcome.failedStep = 'add_to_cart'
    } else {
      outcome.failedStep = 'checkout'
    }
    await captureWalkStep(page, 'failure', steps, stepPngs)
    return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline, runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
  } catch (err) {
    applyCaptureError(outcome, err)
    logger.warn('Integrity path probe attempt failed', {
      runId,
      attempt,
      error: err instanceof Error ? err.message : String(err),
    })
    if (page) {
      await captureWalkStep(page, 'failure', steps, stepPngs).catch(() => {})
      return await finishAttempt({ recordingDir: videoDir, deadline: options.deadline,
        runId,
        attempt,
        page,
        steps,
        stepPngs,
        outcome,
        finalUrl: page.url(),
      })
    }
    await fs.rm(videoDir, { recursive: true, force: true }).catch(() => undefined)
    return {
      outcome,
      steps,
      videoUrl: null,
      gifUrl: null,
      finalUrl,
    }
  }
}

async function finishAttempt(input: {
  runId: string
  attempt: number
  page: Page
  steps: PathStepEvidence[]
  stepPngs: Array<Buffer | null>
  recordingDir: string
  deadline?: number
  outcome: WalkOutcome
  finalUrl: string
}): Promise<PathProbeAttempt> {
  const media = await persistWalkVideo({
    runId: input.runId,
    attempt: input.attempt,
    page: input.page,
    steps: input.steps,
    stepPngs: input.stepPngs,
    deadline: input.deadline,
    recordingDir: input.recordingDir,
  })
  return {
    outcome: input.outcome,
    steps: input.steps,
    videoUrl: media.videoUrl,
    gifUrl: media.gifUrl,
    finalUrl: input.finalUrl,
  }
}

async function clickSelector(page: Page, selector: string): Promise<boolean> {
  try {
    await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 2_000 })
    await page.locator(selector).first().click({ timeout: CLICK_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}

function applyCaptureError(outcome: WalkOutcome, err: unknown): void {
  if (err instanceof PageCaptureError) {
    outcome.httpStatus = err.httpStatus
    if (err.code === 'HTTP_FORBIDDEN') outcome.botWall = true
    else if (err.httpStatus === 404 || err.httpStatus === 410 || (err.httpStatus ?? 0) >= 500) {
      outcome.pageUnavailable = true
    } else {
      outcome.timedOut = err.code === 'HTTP_ERROR' ? false : true
    }
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  if (/timeout/i.test(message)) outcome.timedOut = true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
