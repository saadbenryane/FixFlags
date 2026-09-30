import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { Browser, Page, Locator } from 'playwright'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { PageCaptureError } from '@/lib/audit/browser/page-capture'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { dismissConsentChrome, dismissOpenDialogs } from '@/lib/audit/browser/overlay-probe'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import { classifyWalk, combineAttempts, goalProbeReason } from './classify'
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
const STEP_TIMEOUT_MS = 15_000

export interface GoalStep {
  action: 'click' | 'fill' | 'wait' | 'navigate'
  role?: 'button' | 'link' | 'textbox' | 'combobox' | 'checkbox' | 'radio' | 'tab' | 'menuitem'
  name?: string
  label?: string
  placeholder?: string
  selector?: string
  value?: string
  url?: string
  waitMs?: number
}

export interface GoalDefinition {
  type: 'url_pattern' | 'text_present' | 'selector_present'
  pattern?: string
  text?: string
  selector?: string
  description?: string
}

export interface BrowserJourneyConfig {
  startUrl: string
  steps: GoalStep[]
  goal: GoalDefinition
  safety?: 'none' | 'stop-at-checkout' | 'reversible'
  /** One-based step count. Do not evaluate an action-dependent goal before this step. */
  goalAfterStep?: number
  allowLocalhost?: boolean
}

interface RunGoalProbeOptions {
  runId?: string
  config: BrowserJourneyConfig
  browser?: Browser
  confirmRed?: boolean
}

async function runGoalAttempt(
  browser: Browser,
  runId: string,
  attempt: number,
  options: RunGoalProbeOptions
): Promise<PathProbeAttempt> {
  const videoDir = await fs.mkdtemp(path.join(os.tmpdir(), `fixflags-goal-${runId}-`))
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
  let finalUrl = options.config.startUrl
  let goalAchieved = false

  try {
    const session = await createAuditPage(browser, options.config.startUrl, {
      profile: MOBILE_CAPTURE_PROFILE,
      allowLocalhost: options.config.allowLocalhost ?? false,
      buyPath: false,
      journeySafe: true,
      recordVideoDir: videoDir,
      settle: true,
    })
    page = session.page
    finalUrl = page.url()
    outcome.httpStatus = session.httpStatus

    await dismissConsentChrome(page)
    await dismissOpenDialogs(page)

    await captureStep(page, runId, attempt, 'landing', steps, stepPngs)

    if (session.httpStatus && (session.httpStatus >= 400 && session.httpStatus < 500)) {
      outcome.pageUnavailable = true
      outcome.failedStep = 'landing'
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url(), goalAchieved: false, stepCount: steps.length })
    }

    const botWall = await page
      .evaluate(() => {
        const text = (document.body?.innerText ?? '').slice(0, 20_000)
        return /(?:captcha|cloudflare|checking your browser|access denied|verify you are human)/i.test(text)
      })
      .catch(() => false)
    if (botWall) {
      outcome.botWall = true
      outcome.failedStep = 'landing'
      return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url(), goalAchieved: false, stepCount: steps.length })
    }

    for (let i = 0; i < options.config.steps.length; i++) {
      const step = options.config.steps[i]
      const stepLabel: PathStepLabel = step.action === 'navigate' ? 'landing' : `step_${i + 1}`
      
      try {
        await executeStep(page, step, steps, stepPngs, runId, attempt, stepLabel)
        finalUrl = page.url()
        
        const completedSteps = i + 1
        const goalMayBeChecked = completedSteps >= (options.config.goalAfterStep ?? 1)
        if (goalMayBeChecked && await checkGoal(page, options.config.goal)) {
          goalAchieved = true
          outcome.reachedCheckout = true
          outcome.failedStep = null
          await captureStep(page, runId, attempt, stepLabel, steps, stepPngs)
          break
        }
      } catch (stepErr) {
        outcome.failedStep = stepLabel
        await captureStep(page, runId, attempt, 'failure', steps, stepPngs)
        logger.warn('Goal probe step failed', { runId, attempt, step: i, error: String(stepErr) })
        return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url(), goalAchieved: false, stepCount: steps.length })
      }
    }

    if (!goalAchieved) {
      const finalCheck = await checkGoal(page, options.config.goal)
      if (finalCheck) {
        goalAchieved = true
        outcome.reachedCheckout = true
        outcome.failedStep = null
      } else {
        outcome.failedStep = outcome.failedStep ?? (`step_${options.config.steps.length + 1}` as PathStepLabel)
      }
    }

    return await finishAttempt({ runId, attempt, page, steps, stepPngs, outcome, finalUrl: page.url(), goalAchieved, stepCount: steps.length })
  } catch (err) {
    applyCaptureError(outcome, err)
    logger.warn('Goal probe attempt failed', {
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
        goalAchieved: false,
        stepCount: steps.length,
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

async function executeStep(
  page: Page,
  step: GoalStep,
  steps: PathStepEvidence[],
  stepPngs: Buffer[],
  runId: string,
  attempt: number,
  stepLabel: PathStepLabel
): Promise<void> {
  switch (step.action) {
    case 'navigate': {
      if (step.url) {
        await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS })
        await dismissConsentChrome(page)
        await dismissOpenDialogs(page)
      }
      break
    }
    case 'click': {
      const locator = await findElement(page, step)
      await locator.first().scrollIntoViewIfNeeded({ timeout: 2_000 })
      await locator.first().click({ timeout: CLICK_TIMEOUT_MS })
      await sleep(AFTER_CLICK_MS)
      await dismissConsentChrome(page)
      await dismissOpenDialogs(page)
      break
    }
    case 'fill': {
      const locator = await findElement(page, step)
      await locator.first().scrollIntoViewIfNeeded({ timeout: 2_000 })
      if (step.value !== undefined) {
        await locator.first().fill(step.value, { timeout: CLICK_TIMEOUT_MS })
      }
      break
    }
    case 'wait': {
      await sleep(step.waitMs ?? 1_000)
      break
    }
  }
  await captureStep(page, runId, attempt, stepLabel, steps, stepPngs)
}

async function findElement(page: Page, step: GoalStep): Promise<Locator> {
  if (step.selector) {
    return page.locator(step.selector)
  }
  if (step.role && step.name) {
    return page.getByRole(step.role, { name: step.name, exact: false })
  }
  if (step.role && step.label) {
    return page.getByLabel(step.label, { exact: false })
  }
  if (step.role && step.placeholder) {
    return page.getByPlaceholder(step.placeholder, { exact: false })
  }
  throw new Error(`Cannot find element: step missing selector/role+name/label/placeholder: ${JSON.stringify(step)}`)
}

async function checkGoal(page: Page, goal: GoalDefinition): Promise<boolean> {
  switch (goal.type) {
    case 'url_pattern': {
      if (!goal.pattern) return false
      const url = page.url()
      return new RegExp(goal.pattern, 'i').test(url)
    }
    case 'text_present': {
      if (!goal.text) return false
      const text = await page.evaluate(() => (document.body?.innerText ?? '').slice(0, 10_000))
      return text.toLowerCase().includes(goal.text.toLowerCase())
    }
    case 'selector_present': {
      if (!goal.selector) return false
      const count = await page.locator(goal.selector).count().catch(() => 0)
      return count > 0
    }
    default:
      return false
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
  goalAchieved: boolean
  stepCount: number
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

export async function runGoalProbe(options: RunGoalProbeOptions): Promise<PathProbeResult> {
  const runId = options.runId ?? `goal-${Date.now()}`
  const browser = options.browser ?? (await getAuditBrowser())
  const confirmRed = options.confirmRed !== false

  const first = await runGoalAttempt(browser, runId, 1, options)
  const firstClass = classifyWalk(first.outcome)
  let second: PathProbeAttempt | null = null
  if (confirmRed && firstClass.health === 'RED') {
    second = await runGoalAttempt(browser, runId, 2, options)
  }
  const combined = combineAttempts(firstClass, second ? classifyWalk(second.outcome) : null)
  const chosen = second && combined.health === 'RED' ? second : first
  const reason = goalProbeReason(combined, options.config.safety)

  return {
    health: combined.health,
    reason,
    confirmed: combined.confirmed,
    attempts: second ? [first, second] : [first],
    steps: chosen.steps,
    videoUrl: chosen.videoUrl,
    gifUrl: chosen.gifUrl,
    failedStep: chosen.outcome.failedStep,
    finalUrl: chosen.finalUrl,
  }
}
