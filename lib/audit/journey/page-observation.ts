import type { Page } from 'playwright'
import { auditPageObservation } from '../browser/observation-scope'
import { observeViewport } from '../browser/viewport-observation'
import { isBotInterstitialPage } from '../browser/page-capture'
import { JOURNEY_TYPES, type JourneyObservation } from '../checks/journey-evidence'
import type { JourneyType } from './types'
import { observeRenderedCopy } from '../browser/rendered-copy'
import { observeJourneyControls, type JourneyControlObservation } from './discover'

export async function observeJourneyPage(page: Page, journeyType: JourneyType, phase: JourneyObservation['phase'],
  route: JourneyObservation['route'], conditions: Pick<JourneyObservation, 'headline' | 'primaryAction' | 'nextPath' | 'fieldCount'>,
  restricted: boolean, documentResponse: { status: number | null; cfMitigated?: string }, controlObservation?: JourneyControlObservation): Promise<JourneyObservation | undefined> {
  if (!(JOURNEY_TYPES as readonly string[]).includes(journeyType)) return undefined
  const capture = auditPageObservation(page)
  if (!capture) return undefined
  const [viewport, title, copy, controls] = await Promise.all([
    observeViewport(page, { profile: 'journey-page', includeActions: false, excludeLoading: true }),
    page.title(), observeRenderedCopy(page), controlObservation ?? observeJourneyControls(page, new URL(page.url()).origin),
  ])
  return { version: 1, journeyType: journeyType as JourneyObservation['journeyType'], phase, scope: capture.scope, route, ...conditions,
    headlineVersion: 2, headlineComplete: copy.complete && copy.pageUrl === capture.scope.finalUrl &&
      conditions.headline === ((copy.h1s[0]?.length ?? 0) >= 12),
    actionVersion: 6, actionComplete: controls.pageUrl === capture.scope.finalUrl && controls.primaryAction.complete &&
      controls.primaryAction.found === conditions.primaryAction,
    pathVersion: 5, fieldVersion: 2,
    available: !restricted && !capture.restricted && documentResponse.status !== null && documentResponse.status >= 200 && documentResponse.status < 400 && viewport.content && viewport.pageUrl === capture.scope.finalUrl && page.url() === capture.scope.finalUrl && !isBotInterstitialPage({ title, cfMitigated: documentResponse.cfMitigated }) && !isBotInterstitialPage({ title: copy.h1s[0] }),
    pathComplete: controls.pageUrl === capture.scope.finalUrl && controls.pathComplete && conditions.nextPath === (controls.links.length > 0) &&
      !(controls.primaryAction.found && controls.links.length === 0) }
}
