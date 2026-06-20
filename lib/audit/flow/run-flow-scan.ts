import type { Browser, Page } from 'puppeteer'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { discoverFlowCtas, flowCtaSelector, rankCtaCandidate } from './discover-cta'
import { resolveSameOrigin } from './link-scoring'
import { urlsMeaningfullyChanged } from './flow-url'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'

export const FLOW_SCAN_TIMEOUT_MS = 20_000
export const FLOW_CLICK_TIMEOUT_MS = 8_000

export interface FlowScanStep {
  label: string
  screenshotUrl: string | null
  url: string
}

export type FlowScanStatus =
  | 'success'
  | 'no_cta'
  | 'unclickable'
  | 'error_response'
  | 'dead_end'
  | 'external_leave'
  | 'skipped'
  | 'timeout'

export interface FlowScanResult {
  status: FlowScanStatus
  steps: FlowScanStep[]
  finalUrl: string
  ctaText?: string
  httpStatus?: number
}

export interface RunFlowScanOptions {
  deadlineMs?: number
  /** Reuse desktop hero capture as step 0 instead of re-screenshotting. */
  landingStep?: FlowScanStep | null
}

async function captureFlowStep(
  page: Page,
  auditId: string,
  stepIndex: number,
  label: string
): Promise<FlowScanStep> {
  let screenshotUrl: string | null = null
  try {
    const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
    screenshotUrl = await uploadScreenshot(auditId, 'desktop', buffer, `flow-${stepIndex}`)
  } catch (err) {
    logger.error('Flow step screenshot failed', err)
  }
  return {
    label,
    screenshotUrl,
    url: page.url(),
  }
}

function isConversionPathUrl(origin: string, url: string): boolean {
  const resolved = resolveSameOrigin(origin, url)
  if (!resolved) return false
  return /pricing|plan|signup|sign-up|register|login|contact|demo|start/i.test(resolved)
}

export async function runFlowScan(
  page: Page,
  auditId: string,
  pageUrl: string,
  options: RunFlowScanOptions = {}
): Promise<FlowScanResult> {
  const deadlineMs = options.deadlineMs ?? FLOW_SCAN_TIMEOUT_MS
  const started = Date.now()
  const origin = new URL(pageUrl).origin
  const steps: FlowScanStep[] = []

  if (Date.now() - started > deadlineMs) {
    return { status: 'timeout', steps, finalUrl: page.url() }
  }

  if (options.landingStep) {
    steps.push(options.landingStep)
  } else {
    steps.push(await captureFlowStep(page, auditId, 0, 'Landing'))
  }

  const candidates = await discoverFlowCtas(page, pageUrl)
  const cta = rankCtaCandidate(candidates)
  if (!cta) {
    return { status: 'no_cta', steps, finalUrl: page.url() }
  }

  const landingUrl = page.url()
  const selector = flowCtaSelector(cta.flowIdx)
  let clicked = false
  let clickResponseStatus: number | undefined

  try {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'center' })
      }
    }, selector)

    const clickTarget = await page.$(selector)
    if (!clickTarget) {
      return {
        status: 'unclickable',
        steps,
        finalUrl: page.url(),
        ctaText: cta.text,
      }
    }

    const navigationPromise = page
      .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: FLOW_CLICK_TIMEOUT_MS })
      .catch(() => null)

    await Promise.race([
      (async () => {
        await clickTarget.click()
        clicked = true
        const response = await navigationPromise
        if (response) {
          clickResponseStatus = response.status()
        } else {
          await new Promise((r) => setTimeout(r, 1500))
        }
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('flow_click_timeout')), FLOW_CLICK_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    logger.error('Flow CTA click failed', err)
    return {
      status: clicked ? 'dead_end' : 'unclickable',
      steps,
      finalUrl: page.url(),
      ctaText: cta.text,
    }
  }

  if (Date.now() - started > deadlineMs) {
    return { status: 'timeout', steps, finalUrl: page.url(), ctaText: cta.text }
  }

  steps.push(await captureFlowStep(page, auditId, 1, 'After click'))

  const finalUrl = page.url()
  const httpStatus = clickResponseStatus

  if (httpStatus && httpStatus >= 400) {
    return {
      status: 'error_response',
      steps,
      finalUrl,
      ctaText: cta.text,
      httpStatus,
    }
  }

  const leftOrigin = new URL(finalUrl).origin !== origin
  if (leftOrigin && !isConversionPathUrl(origin, finalUrl)) {
    return {
      status: 'external_leave',
      steps,
      finalUrl,
      ctaText: cta.text,
    }
  }

  if (!urlsMeaningfullyChanged(landingUrl, finalUrl)) {
    return {
      status: 'dead_end',
      steps,
      finalUrl,
      ctaText: cta.text,
    }
  }

  return {
    status: 'success',
    steps,
    finalUrl,
    ctaText: cta.text,
  }
}

export async function runFlowScanStandalone(
  browser: Browser,
  auditId: string,
  pageUrl: string
): Promise<FlowScanResult> {
  let page: Page | null = null
  try {
    const session = await createAuditPage(browser, pageUrl, {
      profile: DESKTOP_CAPTURE_PROFILE,
    })
    page = session.page
    return await runFlowScan(page, auditId, pageUrl)
  } catch (err) {
    logger.error('Standalone flow scan failed', err)
    return {
      status: 'skipped',
      steps: [],
      finalUrl: pageUrl,
    }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}
