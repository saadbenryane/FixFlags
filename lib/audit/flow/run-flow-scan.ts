import type { Browser, Page } from 'puppeteer'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { discoverFlowCtas, rankCtaCandidate } from './discover-cta'
import { resolveSameOrigin } from './link-scoring'

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
  deadlineMs: number = FLOW_SCAN_TIMEOUT_MS
): Promise<FlowScanResult> {
  const started = Date.now()
  const origin = new URL(pageUrl).origin
  const steps: FlowScanStep[] = []

  if (Date.now() - started > deadlineMs) {
    return { status: 'timeout', steps, finalUrl: page.url() }
  }

  steps.push(await captureFlowStep(page, auditId, 0, 'Landing'))

  const candidates = await discoverFlowCtas(page, pageUrl)
  const cta = rankCtaCandidate(candidates)
  if (!cta) {
    return { status: 'no_cta', steps, finalUrl: page.url() }
  }

  const landingUrl = page.url()
  let clicked = false

  try {
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'center' })
      }
    }, cta.selector)

    const clickTarget = await page.$(cta.selector)
    if (!clickTarget) {
      return {
        status: 'unclickable',
        steps,
        finalUrl: page.url(),
        ctaText: cta.text,
      }
    }

    await Promise.race([
      (async () => {
        await clickTarget.click()
        clicked = true
        try {
          await page.waitForNavigation({
            waitUntil: 'domcontentloaded',
            timeout: FLOW_CLICK_TIMEOUT_MS,
          })
        } catch {
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
  let httpStatus: number | undefined
  try {
    const response = await page.goto(finalUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 5000,
    })
    httpStatus = response?.status()
  } catch {
    httpStatus = undefined
  }

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

  if (finalUrl === landingUrl || finalUrl === `${landingUrl}#`) {
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
    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await new Promise((r) => setTimeout(r, 1500))
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
