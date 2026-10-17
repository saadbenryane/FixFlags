import { JOURNEY_ROUTE_COPY } from '@/lib/marketing/copy/verification-evidence'
import { assessFunnelDestination } from './funnel-findings'
import { assessFormProbeResponse, assessFormProbeConfirmation } from './form-probe-assessment'
import type { Browser, Page } from 'playwright'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { createAuditPage, settleAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import type { ScanAccessConfig } from '@/lib/audit/scan-access'
import {
  captureAccessibilityTree,
  probeEmailForAudit,
} from '@/lib/audit/browser/journey-safety'
import {
  detectOverlayAtPoint,
  dismissConsentChrome,
} from '@/lib/audit/browser/overlay-probe'
import { scopedOverlayResult, type OverlayTarget } from '@/lib/audit/checks/overlay-evidence'
import { createOverlayInteractionRecorder } from '@/lib/audit/browser/overlay-interaction'
import { createActionTimeline } from '@/lib/audit/action-timeline'
import { logger } from '@/lib/logger'
import {
  discoverJourneyLinks,
  observeJourneyControls,
  pageHasClearHeadline,
  pageHasPrimaryCta,
  countVisibleFormFields,
  pickTargetForJourney,
  pickNextFunnelTarget,
  pageHasSubstantiveContent,
  pageIsLoading,
} from './discover'
import type { JourneyLinkCandidate } from './discover'
import type {
  JourneyFindingDraft,
  JourneyRunResult,
  JourneyStepDraft,
  JourneyType,
} from './types'
import {
  JOURNEY_MAX_STEPS,
  JOURNEY_TIMEOUT_MS,
  JOURNEY_LOOP_THRESHOLD,
} from './types'
import type { JourneyPlan } from './planner-schema'
import { observeJourneyPage } from './page-observation'
import { scopedJourneyFinding, type JourneyObservation } from '../checks/journey-evidence'

async function shot(page: Page, auditId: string, key: string, deadline: number): Promise<string | null> {
  try {
    const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    return await uploadScreenshot(auditId, 'desktop', buffer, key, { deadline })
  } catch (err) {
    logger.warn('Journey screenshot failed', { err: String(err), key })
    return null
  }
}

async function journeyClickSelector(page: Page, target: Pick<JourneyLinkCandidate, 'href' | 'text' | 'category' | 'selector'>) {
  if (target.selector) return target.selector
  return (await discoverJourneyLinks(page, new URL(page.url()).origin)).find(link => link.href === target.href &&
    (link.text === target.text || target.category === 'planned'))?.selector ?? null
}

function finding(
  partial: Omit<JourneyFindingDraft, 'confidence'> & { confidence?: number }
): JourneyFindingDraft {
  return { confidence: 0.85, ...partial, source: 'JOURNEY',
    conditionId: partial.conditionId ?? (partial.checkId.startsWith('journey-funnel-') ? partial.checkId : undefined) }
}

/** Customer evidence when the page has no link to another page on the same site. */
export function pageHasNoNextStepEvidence(): string {
  return 'No link on this page continues to another page on the same site.'
}

/** Customer evidence when a walk keeps going without an ending. */
export function pathTookTooManyStepsEvidence(steps: number): string {
  return `This path took ${steps} steps without a clear ending.`
}

export function deadEndFix(journeyType: JourneyType): string {
  switch (journeyType) {
    case 'checkout':
      return [
        '1. Restore the product-to-cart path',
        '2. Confirm the selected item appears in the cart',
        '3. Confirm checkout opens without submitting a purchase',
      ].join('\n')
    case 'pricing-evaluation':
      return [
        '1. Add a visible link to pricing or plans on this site',
        '2. Put that link in the header or near the top of the page',
        '3. Keep the path consistent from the first page through pricing',
      ].join('\n')
    case 'signup':
      return [
        '1. Add a visible link to signup, a trial, or account creation on this site',
        '2. Put that link in the header or near the top of the page',
        '3. Keep the path consistent from the first page through registration',
      ].join('\n')
    case 'contact-support':
      return [
        '1. Add a visible link to contact, booking, or support on this site',
        '2. Put that link in the header or near the top of the page',
        '3. Land on a form or calendar with an obvious next action',
      ].join('\n')
    default:
      return [
        '1. Add a clear next step, such as contact, a product page, or a primary action',
        '2. Keep that link on this site',
        '3. Show the path in the header and near the top of the page',
      ].join('\n')
  }
}

async function pageShowsFormSuccess(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const text = document.body?.innerText?.toLowerCase() ?? ''
    return /thank you|thanks for|subscribed|you're all set|confirmation sent|check your (inbox|email)|successfully (submitted|sent|subscribed)|message sent|we'll be in touch|form submitted/.test(
      text
    )
  })
}

export async function runJourneyTemplate(
  browser: Browser,
  options: {
    auditId: string
    startUrl: string
    journeyType: JourneyType
    maxSteps?: number
    deadlineMs?: number
    scanAccess?: ScanAccessConfig | null
    /** Optional AI-generated plan for multi-step funnel journeys. */
    plan?: JourneyPlan | null
    /** Token usage from the planner when an AI plan was used. */
    plannerUsage?: JourneyRunResult['plannerUsage']
    overlayExpectedTargets?: OverlayTarget[]
    expectedJourneyRoute?: JourneyObservation['route']
    journeyPageOnly?: boolean
  }
): Promise<JourneyRunResult> {
  const started = Date.now()
  const maxSteps = options.maxSteps ?? JOURNEY_MAX_STEPS
  const deadline = options.deadlineMs ?? started + JOURNEY_TIMEOUT_MS
  const steps: JourneyStepDraft[] = []
  const findings: JourneyFindingDraft[] = []
  const pageObservations: JourneyObservation[] = [], route: JourneyObservation['route'] = []
  let goalAchieved = false
  let abandonedReason: string | null = null
  let blockedReason: string | null = null
  const timeline = createActionTimeline(started)
  const probeEmail = probeEmailForAudit(options.auditId)
  let refusedFromStep: number | null = null

  const session = await createAuditPage(browser, options.startUrl, {
    profile: DESKTOP_CAPTURE_PROFILE,
    journeySafe: true,
    scanAccess: options.scanAccess,
    deadline,
    onSafetyRefusal: reason => {
      if (reason === 'protected_action_requires_fixture') refusedFromStep ??= steps.length + 1
    },
  })
  const page = session.page
  let documentResponse = { status: session.httpStatus, cfMitigated: session.responseHeaders['cf-mitigated'] }
  page.on('response', response => {
    if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
      documentResponse = { status: response.status(), cfMitigated: response.headers()['cf-mitigated'] }
    }
  })
  const overlayRecorder = createOverlayInteractionRecorder(page, { deadline, expectedTargets: options.overlayExpectedTargets,
    restricted: () => refusedFromStep !== null })
  const journeyPhase = 'journey_' + options.journeyType.replaceAll('-', '_')
  const origin = new URL(options.startUrl).origin
  timeline.push('journey', `Start ${options.journeyType}`, { url: options.startUrl })

  try {
    const a11y1 = await captureAccessibilityTree(page)
    const before1 = await shot(page, options.auditId, `journey-${options.journeyType}-01-land`, deadline)
    timeline.push('navigate', 'Land on start URL', { url: page.url(), screenshot: before1 })
    steps.push({
      stepNumber: 1,
      actionType: 'navigate',
      actionDetail: { url: options.startUrl },
      url: page.url(),
      screenshotAfterUrl: before1,
      accessibilityTree: a11y1,
      consoleErrors: session.consoleErrors.map((e) => e.text),
      networkErrors: session.networkFailures
        .filter((f) => f.sameOrigin)
        .map((f) => `${f.method} ${f.status} ${f.url}`),
      reasoning: 'Land on start URL and capture accessibility tree',
    })

    const hasHeadline = await pageHasClearHeadline(page)
    const landingControls = await observeJourneyControls(page, origin)
    const cta = landingControls.primaryAction
    if (!hasHeadline) {
      findings.push(
        finding({
          checkId: `journey-${options.journeyType}-unclear-value-prop`,
          stepNumber: 1,
          url: page.url(),
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          impactTag: 'CLARITY',
          problem: 'Review the missing or short entry-page H1',
          evidence: 'Reproduced at step 1. No H1 of at least 12 characters found on landing.',
          whyItMatters: 'The sampled H1 did not meet the headline-length check. Review its supporting context; visitor understanding was not measured.',
          fix: '1. Review the recorded H1 and nearby supporting copy together\n2. Add or clarify the page heading where useful for its purpose and audience\n3. Keep verified product claims and the intended next action consistent',
          screenshotUrl: before1,
          accessibilityEvidence: a11y1.slice(0, 2000),
        })
      )
    }
    if (!cta.found) {
      findings.push(
        finding({
          checkId: `journey-${options.journeyType}-hidden-cta`,
          stepNumber: 1,
          url: page.url(),
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          impactTag: 'CONVERSION',
          problem: 'No obvious primary CTA on first visit',
          evidence:
            'Reproduced at step 1. No button or conversion link matched common CTA patterns above the fold.',
          whyItMatters: 'Without a clear next step, first-time visitors bounce.',
          fix: '1. Add one primary CTA above the fold\n2. Use action-oriented label (Start free, See pricing, Book demo)\n3. Remove competing equal-weight CTAs',
          screenshotUrl: before1,
        })
      )
    }

    const links = landingControls.links
    const target = pickTargetForJourney(options.journeyType, links)
    const landing = await observeJourneyPage(page, options.journeyType, 'landing', route,
      { headline: hasHeadline, primaryAction: cta.found, nextPath: Boolean(target), fieldCount: 0 }, refusedFromStep !== null, documentResponse, landingControls)
    if (landing) pageObservations.push(landing)
    if (!target && options.journeyType === 'contact-support') {
      blockedReason = 'contact_route_not_selected'
      abandonedReason = JOURNEY_ROUTE_COPY.contactRouteNotSelected
      return await finalize('ABANDONED')
    }
    if (!target) {
      blockedReason = 'continuation_route_not_selected'
      abandonedReason = JOURNEY_ROUTE_COPY.continuationRouteNotSelected
      return await finalize('ABANDONED')
    }
    if (options.journeyPageOnly && !options.expectedJourneyRoute?.length) return await finalize('ABANDONED')
    if (target.opensInNewTab && !options.expectedJourneyRoute?.length) return await finalize('ABANDONED')

    if (Date.now() > deadline || steps.length >= maxSteps) {
      return await finalize('ABANDONED')
    }

    const beforeClick = await shot(page, options.auditId, `journey-${options.journeyType}-02-before`, deadline)
    let navigated = false
    const clickSelector = options.expectedJourneyRoute?.[0]?.selector ?? await journeyClickSelector(page, target)

    if (clickSelector) {
      const phase = journeyPhase + '_nav'
      let inspected = await overlayRecorder.inspect(clickSelector, 'nav', phase)
      const control = inspected.observation?.controls[0]
      if (options.expectedJourneyRoute?.length && (!control || control.selector !== options.expectedJourneyRoute[0].selector || control.label !== options.expectedJourneyRoute[0].label)) return await finalize('ABANDONED')
      if (control) route.push({ selector: control.selector, label: control.label })
      if (!inspected.matchesExpected) return await finalize('ABANDONED')
      if (options.overlayExpectedTargets?.length && !overlayRecorder.activationRequired(phase) &&
        inspected.observation?.controls.every(control => control.disposition === 'passed') &&
        !options.overlayExpectedTargets.some(target => ![phase, phase + '_after'].includes(target.context.split(':')[3]))) return await finalize('ABANDONED')
      let attempted = false
      try {
        if (inspected.observation?.controls.some(control => control.disposition === 'failed')) throw new Error('Persistent cover on the selected journey control')
        attempted = true
        await page.click(clickSelector, { timeout: 5_000 })
        overlayRecorder.activated(inspected)
        await settleAuditPage(page)
        navigated = true
        timeline.push('click', `Click toward ${target.category}`, {
          url: page.url(),
          screenshot: beforeClick,
        })
      } catch {
        await dismissConsentChrome(page)
        if (attempted) inspected = await overlayRecorder.inspect(clickSelector, 'nav', phase + '_after')
        const overlay = inspected.blocker ?? await detectOverlayAtPoint(page, clickSelector)
        const overlayFlags = scopedOverlayResult(
          'nav',
          overlay,
          `target "${target.text || target.href}"`, inspected.observation
        )
        if (overlayFlags.length > 0) {
          const flag = overlayFlags[0]!
          timeline.push('overlay', 'Overlay blocked journey nav', { url: page.url() })
          findings.push(
            finding({
              checkId: flag.checkId,
              stepNumber: 2,
              url: page.url(),
              rubric: 'EXPERIENCE',
              severity: flag.severity as 'CRITICAL' | 'IMPORTANT' | 'POLISH',
              impactTag: 'CONVERSION',
              problem: flag.problem,
              evidence: `Reproduced at step 2. ${flag.evidence}`,
              whyItMatters: 'Visitors cannot continue the funnel when nav is covered.',
              fix: flag.fix,
              verificationRule: flag.verificationRule, evidenceTargets: flag.evidenceTargets, affectedPaths: [options.startUrl],
              screenshotUrl: beforeClick,
            })
          )
          return await finalize('FAILED')
        }
      }
    }

    if (!navigated) {
      if (options.expectedJourneyRoute?.length || clickSelector) return await finalize('ABANDONED')
      try {
        await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
        await settleAuditPage(page)
        timeline.push('navigate', `Goto ${target.category}`, { url: page.url() })
      } catch (err) {
        findings.push(
          finding({
            checkId: `journey-${options.journeyType}-nav-broken`,
            stepNumber: 2,
            url: target.href,
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'CONVERSION',
            problem: `The link "${target.text || target.href}" did not open`,
            evidence: `Reproduced at step 2. ${err instanceof Error ? err.message : String(err)}`,
            whyItMatters: 'Broken corridor links stop the conversion path.',
            fix: '1. Fix the broken link destination\n2. Re-check status codes for pricing/signup routes\n3. Add a fallback CTA to a working page',
            screenshotUrl: beforeClick,
          })
        )
        return await finalize('FAILED')
      }
    }

    const a11y2 = await captureAccessibilityTree(page)
    const afterClick = await shot(page, options.auditId, `journey-${options.journeyType}-02-after`, deadline)
    steps.push({
      stepNumber: 2,
      actionType: 'click',
      actionDetail: { href: target.href, text: target.text, category: target.category },
      url: page.url(),
      screenshotBeforeUrl: beforeClick,
      screenshotAfterUrl: afterClick,
      accessibilityTree: a11y2,
      consoleErrors: session.consoleErrors.map((e) => e.text),
      networkErrors: session.networkFailures
        .filter((f) => f.sameOrigin)
        .map((f) => `${f.method} ${f.status} ${f.url}`),
      elementRef: route[0]?.selector ?? clickSelector,
      elementDescription: `click ${target.text || target.href}`,
      outcomeMatch: true,
      outcomeDetail: 'Navigated successfully',
      reasoning: `Navigate to ${target.category} target for ${options.journeyType}`,
    })

    const destinationControls = await observeJourneyControls(page, origin)
    const destHeadline = await pageHasClearHeadline(page), destCta = destinationControls.primaryAction
    const destinationFieldCount = await countVisibleFormFields(page)
    const destination = await observeJourneyPage(page, options.journeyType, 'destination', route,
      { headline: destHeadline, primaryAction: destCta.found,
        nextPath: Boolean(pickTargetForJourney(options.journeyType, destinationControls.links)), fieldCount: destinationFieldCount }, refusedFromStep !== null, documentResponse, destinationControls)
    if (destination) pageObservations.push(destination)

    if (options.journeyType === 'pricing-evaluation' || options.journeyType === 'first-visit') {
      if (!destHeadline) {
        findings.push(
          finding({
            checkId: `journey-${options.journeyType}-destination-no-headline`,
            stepNumber: 2,
            url: page.url(),
            rubric: 'MESSAGE',
            severity: 'IMPORTANT',
            impactTag: 'CLARITY',
            problem: 'Destination page after corridor navigation lacks a clear headline',
            evidence: `Reproduced at step 2. Navigated via "${target.text}" to ${page.url()}`,
            whyItMatters: 'Cross-page narrative breaks when the next page does not restate value.',
            fix: '1. Add an H1 that continues the story from the previous CTA\n2. Align pricing/signup headlines with homepage promise',
            screenshotUrl: afterClick,
          })
        )
      }
      if (!destCta.found) {
        findings.push(
          finding({
            checkId: `journey-${options.journeyType}-destination-no-next-action`,
            stepNumber: 2,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'CONVERSION',
            problem: 'Destination offers no clear next action',
            evidence: `Reproduced at step 2. After opening "${target.text}", no primary CTA was detected.`,
            whyItMatters: 'Dead-end destinations waste the click that got the visitor there.',
            fix: '1. Add a primary CTA matching the page intent\n2. For pricing: highlight a recommended plan CTA\n3. For features: link to signup or demo',
            screenshotUrl: afterClick,
          })
        )
      } else {
        goalAchieved = true
        if (options.journeyPageOnly) return await finalize('ABANDONED')
      }
    }

    if (options.journeyType === 'signup') {
      const fields = destinationFieldCount
      if (fields === 0) {
        findings.push(
          finding({
            checkId: 'journey-signup-no-form',
            stepNumber: 2,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'CONVERSION',
            problem: 'Signup path has no visible form fields',
            evidence: `Reproduced at step 2. Navigated to ${page.url()} expecting a registration form.`,
            whyItMatters: 'Visitors who intend to sign up abandon when the form is missing or hidden.',
            fix: '1. Surface email/password or OAuth signup on this route\n2. Avoid multi-step gates without a visible first field\n3. Keep at least one clear signup control above the fold',
            screenshotUrl: afterClick,
          })
        )
      } else if (fields > 8) {
        findings.push(
          finding({
            checkId: 'journey-signup-too-many-fields',
            stepNumber: 2,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'FRICTION',
            problem: 'Signup form asks for too many fields at once',
            evidence: `Reproduced at step 2. Counted ${fields} visible form fields on ${page.url()}.`,
            whyItMatters: 'Long signup forms increase abandonment before the first success moment.',
            fix: '1. Reduce to email + password (or OAuth) for step one\n2. Defer company/role questions until after account creation\n3. Show progress if multi-step is required',
            screenshotUrl: afterClick,
          })
        )
      } else {
        goalAchieved = true
        if (options.journeyPageOnly) return await finalize('ABANDONED')
        try {
          const email = page.locator('input[type="email"], input[name*="email" i]').first()
          if (await email.count()) {
            await email.fill(probeEmail)
            timeline.push('form', 'Fill signup email probe', { url: page.url() })
          }
          const submit = page
            .locator('button[type="submit"], input[type="submit"], form button:not([type="button"])')
            .first()
          if (await submit.count()) {
            const submitHandle = await submit.elementHandle()
            if (submitHandle) {
              await page.evaluate((el) => {
                el.setAttribute('data-fixflags-journey-submit', '1')
              }, submitHandle)
              await dismissConsentChrome(page)
              const inspected = await overlayRecorder.inspect('[data-fixflags-journey-submit="1"]', 'form', journeyPhase + '_form')
              const overlay = inspected.blocker ?? await detectOverlayAtPoint(
                page,
                '[data-fixflags-journey-submit="1"]'
              )
              const overlayFlags = scopedOverlayResult('form', overlay, undefined, inspected.observation)
              for (const flag of overlayFlags) {
                timeline.push('overlay', 'Overlay blocked form submit', { url: page.url() })
                findings.push(
                  finding({
                    checkId: flag.checkId,
                    stepNumber: 3,
                    url: page.url(),
                    rubric: 'EXPERIENCE',
                    severity: flag.severity as 'CRITICAL' | 'IMPORTANT' | 'POLISH',
                    impactTag: 'CONVERSION',
                    problem: flag.problem,
                    evidence: `Reproduced at step 3. ${flag.evidence}`,
                    whyItMatters:
                      'Users cannot submit when sticky ads or modals cover the form.',
                    fix: flag.fix,
                    verificationRule: flag.verificationRule, evidenceTargets: flag.evidenceTargets, affectedPaths: [options.startUrl],
                    screenshotUrl: afterClick,
                  })
                )
              }
            }
          }
        } catch {
          // fill optional
        }
        steps.push({
          stepNumber: 3,
          actionType: 'type',
          actionDetail: { field: 'email', value: probeEmail, submitted: false },
          url: page.url(),
          accessibilityTree: await captureAccessibilityTree(page),
          screenshotAfterUrl: await shot(page, options.auditId, `journey-signup-03-fill`, deadline),
          reasoning: 'Fill signup email without submitting (safety)',
        })
      }
    }

    if (options.journeyType === 'contact-support') {
      const fields = await countVisibleFormFields(page)
      const hasContact = await page.evaluate(() => {
        const text = document.body?.innerText?.toLowerCase() ?? ''
        return /contact|support|help|email|@/.test(text)
      })
      if (!hasContact && fields === 0) {
        findings.push(
          finding({
            checkId: 'journey-contact-not-found',
            stepNumber: 2,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'TRUST',
            problem: 'Contact or support did not reach a usable help page',
            evidence: 'Reproduced at step 2. No contact copy or form fields detected on destination.',
            whyItMatters: 'Buyers who cannot find help stall before purchasing.',
            fix: '1. Add a Contact or Support link in primary nav\n2. Include email or form on the destination\n3. State expected response time',
            screenshotUrl: afterClick,
          })
        )
      } else {
        goalAchieved = true
      }
    }

    if (options.journeyType === 'multi-step-funnel') {
      return await runMultiStepFunnel()
    }

    return await finalize(goalAchieved ? 'COMPLETED' : findings.length > 0 ? 'COMPLETED' : 'ABANDONED')

  async function runMultiStepFunnel(): Promise<JourneyRunResult> {
    const visitedUrls = new Set<string>([options.startUrl, page.url()])
    const urlVisits = new Map<string, number>()
    urlVisits.set(options.startUrl, 1)
    urlVisits.set(page.url(), (urlVisits.get(page.url()) ?? 0) + 1)
    let currentStep = steps.length
    let funnelGoalAchieved = false
    const plan = options.plan
    let planStepIndex = 0

    const goalKeywords = [
      'signup', 'sign-up', 'register', 'trial', 'get-started', 'get_started',
      'pricing', 'plans', 'demo', 'contact', 'support', 'checkout',
      'onboard', 'welcome', 'dashboard', 'account',
    ]

    while (currentStep < maxSteps && Date.now() < deadline) {
      const loopCount = urlVisits.get(page.url()) ?? 0
      if (loopCount >= JOURNEY_LOOP_THRESHOLD) {
        findings.push(
          finding({
            checkId: 'journey-funnel-loop-detected',
            stepNumber: currentStep,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'FRICTION',
            problem: 'Visitor gets stuck in a navigation loop',
            evidence: `Reproduced at step ${currentStep}. URL ${page.url()} visited ${loopCount} times.`,
            whyItMatters: 'Navigation loops indicate confusing IA or broken routing that traps visitors.',
            fix: '1. Review navigation structure for circular references\n2. Ensure each page has a clear forward path\n3. Add breadcrumbs or progress indicators for multi-step flows',
            screenshotUrl: steps[steps.length - 1]?.screenshotAfterUrl,
          })
        )
        break
      }

      let target: Pick<JourneyLinkCandidate, 'href' | 'text' | 'category' | 'selector' | 'opensInNewTab'> | null = null
      let stepActionType = 'click'
      let stepActionDetail: Record<string, unknown> = {}

      if (plan && planStepIndex < plan.steps.length) {
        const planStep = plan.steps[planStepIndex]
        planStepIndex++

        if (planStep.action === 'evaluate') {
          const a11ySnap = await captureAccessibilityTree(page)
          const evalShot = await shot(
            page,
            options.auditId,
            `journey-funnel-${String(currentStep + 1).padStart(2, '0')}-evaluate`, deadline
          )
          steps.push({
            stepNumber: currentStep + 1,
            actionType: 'evaluate',
            actionDetail: { planTarget: planStep.target, expectedResult: planStep.expectedResult },
            url: page.url(),
            screenshotAfterUrl: evalShot,
            accessibilityTree: a11ySnap,
            reasoning: `AI plan step: ${planStep.target}`,
          })
          currentStep++
          continue
        }

        if (planStep.action === 'navigate') {
          const links = await discoverJourneyLinks(page, origin)
          const matched = links.find(
            (l) =>
              l.href.includes(planStep.target) ||
              planStep.target.toLowerCase().includes(l.text.toLowerCase()) ||
              l.text.toLowerCase().includes(planStep.target.toLowerCase())
          )
          if (matched) {
            target = matched
          } else {
            try {
              const resolved = new URL(planStep.target, origin).href
              if (new URL(resolved).origin === origin) {
                target = { href: resolved, text: planStep.target, category: 'planned' }
              }
            } catch {
              // Fall through to deterministic discovery
            }
          }
        } else if (planStep.action === 'click') {
          const links = await discoverJourneyLinks(page, origin)
          const matched = links.find(
            (l) =>
              l.text.toLowerCase().includes(planStep.target.toLowerCase()) ||
              planStep.target.toLowerCase().includes(l.text.toLowerCase()) ||
              l.href.toLowerCase().includes(planStep.target.toLowerCase())
          )
          if (matched) {
            target = matched
          }
        }
      }

      if (!target) {
        const links = await discoverJourneyLinks(page, origin)
        target = pickNextFunnelTarget(links, visitedUrls, goalKeywords)
        if (target) {
          stepActionDetail = { href: target.href, text: target.text, category: target.category }
        }
      }

      if (!target) {
        findings.push(
          finding({
            checkId: 'journey-funnel-dead-end',
            conditionId: 'missing-continuation',
            stepNumber: currentStep,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'FRICTION',
            problem: 'Review the recorded continuation of this path',
            evidence: 'This check found no eligible link to a page it had not already visited. The intended task may already be complete.',
            whyItMatters: 'Dead-end funnels lose visitors who intended to convert.',
            fix: '1. Review the recorded eligible routes and the pages already visited\n2. Confirm whether the intended task was already complete\n3. Add or correct a continuation only where the intended task requires one',
            screenshotUrl: steps[steps.length - 1]?.screenshotAfterUrl,
          })
        )
        break
      }

      if (Date.now() > deadline) break

      const stepStart = Date.now()
      const beforeShot = await shot(
        page,
        options.auditId,
        `journey-funnel-${String(currentStep + 1).padStart(2, '0')}-before`, deadline
      )

      await captureAccessibilityTree(page)
      let navigated = false
      stepActionDetail = {
        href: target.href,
        text: target.text,
        category: target.category,
        ...(stepActionDetail as Record<string, unknown>),
      }

      const clickSelector = await journeyClickSelector(page, target)

      if (clickSelector) {
        const phase = journeyPhase + '_nav_' + (currentStep + 1)
        let inspected = await overlayRecorder.inspect(clickSelector, 'nav', phase)
        if (!inspected.matchesExpected) return await finalize('ABANDONED')
        let attempted = false
        try {
          if (inspected.observation?.controls.some(control => control.disposition === 'failed')) throw new Error('Persistent cover on the selected funnel control')
          attempted = true
          await page.click(clickSelector, { timeout: 5_000 })
          overlayRecorder.activated(inspected)
          await settleAuditPage(page)
          navigated = true
          timeline.push('click', `Funnel step ${currentStep + 1}: click ${target.text || target.href}`, {
            url: page.url(),
            screenshot: beforeShot,
          })
        } catch {
          await dismissConsentChrome(page)
          if (attempted) inspected = await overlayRecorder.inspect(clickSelector, 'nav', phase + '_after')
          const overlay = inspected.blocker ?? await detectOverlayAtPoint(page, clickSelector)
          const overlayFlags = scopedOverlayResult(
            'nav',
            overlay,
            `target "${target.text || target.href}"`, inspected.observation
          )
          if (overlayFlags.length > 0) {
            const flag = overlayFlags[0]!
            timeline.push('overlay', 'Overlay blocked funnel nav', { url: page.url() })
            findings.push(
              finding({
                checkId: flag.checkId,
                stepNumber: currentStep + 1,
                url: page.url(),
                rubric: 'EXPERIENCE',
                severity: flag.severity as 'CRITICAL' | 'IMPORTANT' | 'POLISH',
                impactTag: 'CONVERSION',
                problem: flag.problem,
                evidence: `Reproduced at step ${currentStep + 1}. ${flag.evidence}`,
                whyItMatters:
                  'Visitors cannot continue the funnel when navigation is covered.',
                fix: flag.fix,
                verificationRule: flag.verificationRule, evidenceTargets: flag.evidenceTargets, affectedPaths: [options.startUrl],
                screenshotUrl: beforeShot,
              })
            )
            return await finalize('FAILED')
          }
        }
      }

      if (!navigated) {
        try {
          await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
          await settleAuditPage(page)
          stepActionType = 'navigate'
          stepActionDetail = { href: target.href, text: target.text, category: target.category }
          timeline.push('navigate', `Funnel step ${currentStep + 1}: goto ${target.text || target.href}`, {
            url: page.url(),
          })
        } catch (err) {
          findings.push(
            finding({
              checkId: 'journey-funnel-step-failed',
              stepNumber: currentStep + 1,
              url: target.href,
              rubric: 'EXPERIENCE',
              severity: 'CRITICAL',
              impactTag: 'CONVERSION',
              problem: `Funnel navigation to "${target.text || target.href}" failed`,
              evidence: `Reproduced at step ${currentStep + 1}. ${err instanceof Error ? err.message : String(err)}`,
              whyItMatters: 'A broken link stops people before they can continue.',
              fix: '1. Fix the broken link destination\n2. Re-check status codes for all funnel routes\n3. Add a fallback CTA to a working page',
              screenshotUrl: beforeShot,
            })
          )
          return await finalize('FAILED')
        }
      }

      const currentUrl = page.url()
      visitedUrls.add(currentUrl)
      urlVisits.set(currentUrl, (urlVisits.get(currentUrl) ?? 0) + 1)
      currentStep++

      const loadTimeMs = Date.now() - stepStart
      const a11yAfter = await captureAccessibilityTree(page)
      const afterShot = await shot(
        page,
        options.auditId,
        `journey-funnel-${String(currentStep).padStart(2, '0')}-after`, deadline
      )

      const hasContent = await pageHasSubstantiveContent(page)
      const isLoading = await pageIsLoading(page)
      const outcomeMatch = hasContent && !isLoading

      steps.push({
        stepNumber: currentStep,
        actionType: stepActionType,
        actionDetail: stepActionDetail,
        url: currentUrl,
        screenshotBeforeUrl: beforeShot,
        screenshotAfterUrl: afterShot,
        accessibilityTree: a11yAfter,
        consoleErrors: session.consoleErrors.map((e) => e.text),
        networkErrors: session.networkFailures
          .filter((f) => f.sameOrigin)
          .map((f) => `${f.method} ${f.status} ${f.url}`),
        loadTimeMs,
        elementRef: clickSelector,
        elementDescription: `${stepActionType} ${target.text || target.href}`,
        outcomeMatch,
        outcomeDetail: outcomeMatch
          ? 'Page loaded with substantive content'
          : isLoading
            ? 'Page still loading when evaluated'
            : 'Page lacks substantive content after navigation',
        reasoning: plan
          ? `AI plan step ${planStepIndex}: ${plan.steps[planStepIndex - 1]?.target ?? stepActionType}`
          : `Funnel step ${currentStep}: ${stepActionType} toward ${target.category}`,
      })

      const destHeadline = await pageHasClearHeadline(page)
      const destCta = await pageHasPrimaryCta(page)
      findings.push(...assessFunnelDestination({ currentStep, currentUrl, maxSteps,
        isLoading, hasContent, headlinePassed: destHeadline, primaryActionFound: destCta.found,
        screenshotUrl: afterShot, accessibilityEvidence: a11yAfter.slice(0, 2000) }))

      if (destCta.found && currentStep >= 2) {
        funnelGoalAchieved = true
      }

      if (steps.length >= maxSteps) {
        findings.push(
          finding({
            checkId: 'journey-funnel-too-many-steps',
            stepNumber: currentStep,
            url: currentUrl,
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'FRICTION',
            problem: 'Review the path at the recorded walk step limit',
            evidence: pathTookTooManyStepsEvidence(maxSteps),
            whyItMatters: 'Long funnels have compounding drop-off at each step.',
            fix: '1. Inspect the recorded route and the walk step limit\n2. Review which steps are required for the intended task\n3. Simplify only steps shown to be unnecessary',
            screenshotUrl: afterShot,
            accessibilityEvidence: a11yAfter.slice(0, 2000),
            findingType: 'friction',
          })
        )
        break
      }
    }

    goalAchieved = funnelGoalAchieved
    const result = await finalize(goalAchieved ? 'COMPLETED' : findings.length > 0 ? 'COMPLETED' : 'ABANDONED')
    if (options.plannerUsage) {
      result.plannerUsage = options.plannerUsage
    }
    return result
  }
  } catch (err) {
    logger.error('Journey template failed', err)
    abandonedReason = err instanceof Error ? err.message : String(err)
    return await finalize('FAILED')
  } finally {
    session.disposeNetwork()
    await page.context().close().catch(() => {})
  }

  async function finalize(status: JourneyRunResult['status']): Promise<JourneyRunResult> {
    const step = steps.length || 1
    const alreadyHas = (id: string) => findings.some((f) => f.checkId === id)

    function applyAssessment(assessment: ReturnType<typeof assessFormProbeResponse>) {
      for (const { kind, label, ...detail } of assessment.events) timeline.push(kind, label, detail)
      findings.push(...assessment.findings)
    }
    if (session.formProbe) {
      const input = () => ({ probe: session.formProbe!, stepNumber: step, pageUrl: page.url(), existingCheckIds: new Set(findings.map(item => item.checkId)) })
      applyAssessment(assessFormProbeResponse(input()))
      if (session.formProbe.status > 0 && !alreadyHas('form-submit-silent-failure')) {
        const showsSuccess = await pageShowsFormSuccess(page).catch(() => false)
        applyAssessment(assessFormProbeConfirmation({ ...input(), showsSuccess }))
      }
    }

    timeline.push('journey', `End ${options.journeyType} (${status})`, { url: page.url() })

    return {
      journeyType: options.journeyType,
      startUrl: options.startUrl,
      status: refusedFromStep === null ? status : 'ABANDONED',
      goalAchieved: refusedFromStep === null && goalAchieved,
      ...(refusedFromStep !== null ? { blockedReason: 'protected_action_requires_fixture' } : blockedReason ? { blockedReason } : {}),
      abandonedReason,
      steps,
      findings: (refusedFromStep === null ? findings : findings.filter(item => item.stepNumber < refusedFromStep!)).flatMap(item => {
        const scoped = scopedJourneyFinding(item, pageObservations)
        return scoped ? [scoped] : []
      }),
      pageObservations,
      durationMs: Date.now() - started,
      formProbe: session.formProbe,
      actionTimeline: timeline.snapshot(),
      overlayObservations: overlayRecorder.observations(),
    }
  }
}
