import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { Browser, Page } from 'playwright'
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
import { uploadIntegrityArtifact } from './storage'
import type {
  PathProbeAttempt,
  PathProbeResult,
  PathStepEvidence,
  PathStepLabel,
  WalkOutcome,
} from './types'
import { persistWalkVideo } from './video'

const CLICK_TIMEOUT_MS = 8_000
const AFTER_CLICK_MS = 1_200

export interface RunPathProbeOptions {
  runId?: string
  url: string
  allowLocalhost?: boolean
  browser?: Browser
  confirmRed?: boolean
}

export async function runPathProbe(options: RunPathProbeOptions): Promise<PathProbeResult> {
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
  const stepPngs: Buffer[] = []
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
    })
    page = session.page
    finalUrl = page.url()
    outcome.httpStatus = session.httpStatus

    await dismissConsentChrome(page)
    await dismissOpenDialogs(page)

    if (await pageLooksPasswordGated(page)) {
      outcome.passwordGate = true
      await captureStep(page, runId, attempt, 'landing', steps, stepPngs)
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    await captureStep(page, runId, attempt, 'landing', steps, stepPngs)

    if (isCheckoutUrl(page.url())) {
      outcome.reachedCheckout = true
      outcome.failedStep = null
      await captureStep(page, runId, attempt, 'checkout', steps, stepPngs)
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    const variantChanged = await selectFirstAvailableVariant(page)
    if (variantChanged) {
      await captureStep(page, runId, attempt, 'variant', steps, stepPngs)
    }

    const buy = await discoverBuyControl(page)
    outcome.buyControlFound = Boolean(buy)
    if (!buy) {
      outcome.failedStep = 'add_to_cart'
      await captureStep(page, runId, attempt, 'failure', steps, stepPngs)
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    const clicked = await clickSelector(page, buy.selector)
    outcome.buyControlClicked = clicked
    if (!clicked) {
      outcome.failedStep = 'add_to_cart'
      await captureStep(page, runId, attempt, 'failure', steps, stepPngs)
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    await sleep(AFTER_CLICK_MS)
    await captureStep(page, runId, attempt, 'add_to_cart', steps, stepPngs)
    finalUrl = page.url()

    if (isCheckoutUrl(page.url())) {
      outcome.reachedCheckout = true
      outcome.cartUpdated = true
      outcome.failedStep = null
      await captureStep(page, runId, attempt, 'checkout', steps, stepPngs)
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    outcome.cartUpdated = await cartAppearsUpdated(page)
    if (outcome.cartUpdated) {
      await captureStep(page, runId, attempt, 'cart', steps, stepPngs)
    }

    if (await pageShowsCheckoutError(page)) {
      outcome.checkoutErrorVisible = true
      outcome.failedStep = 'checkout'
      await captureStep(page, runId, attempt, 'failure', steps, stepPngs)
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    const checkout = await discoverCheckoutControl(page)
    if (checkout) {
      const checkoutClicked = await clickSelector(page, checkout.selector)
      if (checkoutClicked) {
        await sleep(AFTER_CLICK_MS)
      }
    }

    finalUrl = page.url()
    if (isCheckoutUrl(page.url()) || (await shopPayVisible(page))) {
      outcome.reachedCheckout = true
      outcome.cartUpdated = true
      outcome.failedStep = null
      await captureStep(page, runId, attempt, 'checkout', steps, stepPngs)
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
    }

    if (await pageShowsCheckoutError(page)) {
      outcome.checkoutErrorVisible = true
      outcome.failedStep = 'checkout'
    } else if (!outcome.cartUpdated) {
      outcome.failedStep = 'add_to_cart'
    } else {
      outcome.failedStep = 'checkout'
    }
    await captureStep(page, runId, attempt, 'failure', steps, stepPngs)
    return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url() })
  } catch (err) {
    applyCaptureError(outcome, err)
    logger.warn('Integrity path probe attempt failed', {
      runId,
      attempt,
      error: err instanceof Error ? err.message : String(err),
    })
    if (page) {
      await captureStep(page, runId, attempt, 'failure', steps, stepPngs).catch(() => {})
      return await finishAttempt({
        runId,
        attempt,
        page,
        steps,
        stepPngs,
        outcome,
        finalUrl: page.url(),
      })
    }
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
  stepPngs: Buffer[]
  outcome: WalkOutcome
  finalUrl: string
}): Promise<PathProbeAttempt> {
  const media = await persistWalkVideo({
    runId: input.runId,
    attempt: input.attempt,
    page: input.page,
    stepPngs: input.stepPngs,
  })
  return {
    outcome: input.outcome,
    steps: input.steps,
    videoUrl: media.videoUrl,
    gifUrl: media.gifUrl,
    finalUrl: input.finalUrl,
  }
}

async function captureStep(
  page: Page,
  runId: string,
  attempt: number,
  label: PathStepLabel,
  steps: PathStepEvidence[],
  stepPngs: Buffer[]
): Promise<void> {
  try {
    const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
    stepPngs.push(buffer)
    const uploaded = await uploadIntegrityArtifact(
      runId,
      `attempt-${attempt}-${steps.length}-${label}.png`,
      buffer,
      'image/png'
    )
    steps.push({ label, url: page.url(), screenshotUrl: uploaded.url })
  } catch {
    steps.push({ label, url: page.url(), screenshotUrl: null })
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

async function shopPayVisible(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const iframe = Array.from(document.querySelectorAll('iframe')).some((frame) =>
        /shop\.app|shop-pay|shopify/i.test(frame.src)
      )
      const text = (document.body?.innerText ?? '').slice(0, 1500)
      return iframe || /shop pay/i.test(text)
    })
    .catch(() => false)
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
