import type { Page } from 'playwright'
import { auditPageObservation } from '../browser/observation-scope'
import { observeViewport } from '../browser/viewport-observation'
import { isBotInterstitialPage } from '../browser/page-capture'
import { JOURNEY_TYPES, type JourneyObservation } from '../checks/journey-evidence'
import type { JourneyType } from './types'

export async function observeJourneyPage(page: Page, journeyType: JourneyType, phase: JourneyObservation['phase'],
  route: JourneyObservation['route'], conditions: Pick<JourneyObservation, 'headline' | 'primaryAction' | 'nextPath' | 'fieldCount'>,
  restricted: boolean, documentResponse: { status: number | null; cfMitigated?: string }): Promise<JourneyObservation | undefined> {
  if (!(JOURNEY_TYPES as readonly string[]).includes(journeyType)) return undefined
  const capture = auditPageObservation(page)
  if (!capture) return undefined
  const [viewport, title, headline, anchors] = await Promise.all([
    observeViewport(page, { profile: 'journey-page', includeActions: false, excludeLoading: true }),
    page.title(), page.evaluate(() => document.querySelector('h1')?.textContent ?? ''), page.locator('a[href]').count(),
  ])
  return { version: 1, journeyType: journeyType as JourneyObservation['journeyType'], phase, scope: capture.scope, route, ...conditions,
    available: !restricted && !capture.restricted && documentResponse.status !== null && documentResponse.status >= 200 && documentResponse.status < 400 && viewport.content && viewport.pageUrl === capture.scope.finalUrl && page.url() === capture.scope.finalUrl && !isBotInterstitialPage({ title, cfMitigated: documentResponse.cfMitigated }) && !isBotInterstitialPage({ title: headline }),
    pathComplete: anchors <= 80 }
}
