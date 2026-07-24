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
  formatOverlayEvidence,
} from '@/lib/audit/browser/overlay-probe'
import { createActionTimeline } from '@/lib/audit/action-timeline'
import { logger } from '@/lib/logger'
import {
  discoverJourneyLinks,
  pageHasClearHeadline,
  pageHasPrimaryCta,
  countVisibleFormFields,
  pickTargetForJourney,
  pickNextFunnelTarget,
  pageHasSubstantiveContent,
  pageIsLoading,
} from './discover'
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

async function shot(page: Page, auditId: string, key: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    return await uploadScreenshot(auditId, 'desktop', buffer, key)
  } catch (err) {
    logger.warn('Journey screenshot failed', { err: String(err), key })
    return null
  }
}

function finding(
  partial: Omit<JourneyFindingDraft, 'confidence'> & { confidence?: number }
): JourneyFindingDraft {
  return { confidence: 0.85, ...partial }
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
  }
): Promise<JourneyRunResult> {
  const started = Date.now()
  const maxSteps = options.maxSteps ?? JOURNEY_MAX_STEPS
  const deadline = options.deadlineMs ?? started + JOURNEY_TIMEOUT_MS
  const steps: JourneyStepDraft[] = []
  const findings: JourneyFindingDraft[] = []
  let goalAchieved = false
  let abandonedReason: string | null = null
  const timeline = createActionTimeline(started)
  const probeEmail = probeEmailForAudit(options.auditId)

  const session = await createAuditPage(browser, options.startUrl, {
    profile: DESKTOP_CAPTURE_PROFILE,
    journeySafe: true,
    scanAccess: options.scanAccess,
  })
  const page = session.page
  const origin = new URL(options.startUrl).origin
  timeline.push('journey', `Start ${options.journeyType}`, { url: options.startUrl })

  try {
    const a11y1 = await captureAccessibilityTree(page)
    const before1 = await shot(page, options.auditId, `journey-${options.journeyType}-01-land`)
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
    const cta = await pageHasPrimaryCta(page)
    if (!hasHeadline) {
      findings.push(
        finding({
          checkId: `journey-${options.journeyType}-unclear-value-prop`,
          stepNumber: 1,
          url: page.url(),
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          impactTag: 'CLARITY',
          problem: 'First-visit page lacks a clear primary headline',
          evidence: 'Reproduced at step 1. No H1 of at least 12 characters found on landing.',
          whyItMatters: 'Visitors decide in seconds whether they understand the product.',
          fix: '1. Add one clear H1 that states the product outcome\n2. Keep it under 12 words\n3. Match the H1 to your primary CTA promise',
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

    const links = await discoverJourneyLinks(page, origin)
    const target = pickTargetForJourney(options.journeyType, links)
    if (!target) {
      abandonedReason = 'No suitable same-origin navigation target'
      findings.push(
        finding({
          checkId: `journey-${options.journeyType}-dead-end`,
          stepNumber: 1,
          url: page.url(),
          rubric: 'EXPERIENCE',
          severity: 'IMPORTANT',
          impactTag: 'FRICTION',
          problem: 'Visitor cannot continue the intended journey from this page',
          evidence: `Reproduced at step 1. ${abandonedReason}`,
          whyItMatters: 'Funnel paths that dead-end lose conversions silently.',
          fix: '1. Add clear nav to pricing, signup, or contact\n2. Ensure links are same-origin and crawlable\n3. Surface the path in both header and hero',
          screenshotUrl: before1,
        })
      )
      return await finalize('ABANDONED')
    }

    if (Date.now() > deadline || steps.length >= maxSteps) {
      return await finalize('ABANDONED')
    }

    const beforeClick = await shot(page, options.auditId, `journey-${options.journeyType}-02-before`)
    let navigated = false
    const clickSelector = await page.evaluate((href) => {
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i]
        try {
          if (new URL(a.href, location.href).href === href || a.getAttribute('href') === href) {
            a.setAttribute('data-fixflags-journey-nav', String(i))
            return `[data-fixflags-journey-nav="${i}"]`
          }
        } catch {
          /* ignore */
        }
      }
      return null
    }, target.href)

    if (clickSelector) {
      try {
        await page.click(clickSelector, { timeout: 5_000 })
        await settleAuditPage(page)
        navigated = true
        timeline.push('click', `Click toward ${target.category}`, {
          url: page.url(),
          screenshot: beforeClick,
        })
      } catch {
        const overlay = await detectOverlayAtPoint(page, clickSelector)
        if (overlay) {
          timeline.push('overlay', 'Overlay blocked journey nav', { url: page.url() })
          findings.push(
            finding({
              checkId: 'overlay-blocks-nav',
              stepNumber: 2,
              url: page.url(),
              rubric: 'EXPERIENCE',
              severity: 'CRITICAL',
              impactTag: 'CONVERSION',
              problem: 'Overlay blocks primary navigation',
              evidence: `Reproduced at step 2. ${formatOverlayEvidence(overlay)} · target "${target.text || target.href}"`,
              whyItMatters: 'Visitors cannot continue the funnel when nav is covered.',
              fix: '1. Ensure modals and sticky ads do not cover primary navigation without a clear dismiss control.\n2. Lower z-index or relocate the overlay so nav stays clickable.\n3. Re-check the click path after the change.',
              screenshotUrl: beforeClick,
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
            problem: `Journey navigation to "${target.text || target.href}" failed`,
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
    const afterClick = await shot(page, options.auditId, `journey-${options.journeyType}-02-after`)
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
      elementRef: clickSelector,
      elementDescription: `click ${target.text || target.href}`,
      outcomeMatch: true,
      outcomeDetail: 'Navigated successfully',
      reasoning: `Navigate to ${target.category} target for ${options.journeyType}`,
    })

    if (options.journeyType === 'pricing-evaluation' || options.journeyType === 'first-visit') {
      const destHeadline = await pageHasClearHeadline(page)
      const destCta = await pageHasPrimaryCta(page)
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
      }
    }

    if (options.journeyType === 'signup') {
      const fields = await countVisibleFormFields(page)
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
              const overlay = await detectOverlayAtPoint(page, '[data-fixflags-journey-submit="1"]')
              if (overlay) {
                timeline.push('overlay', 'Overlay blocked form submit', { url: page.url() })
                findings.push(
                  finding({
                    checkId: 'overlay-blocks-form',
                    stepNumber: 3,
                    url: page.url(),
                    rubric: 'EXPERIENCE',
                    severity: 'CRITICAL',
                    impactTag: 'CONVERSION',
                    problem: 'Overlay blocks form controls',
                    evidence: `Reproduced at step 3. ${formatOverlayEvidence(overlay)}`,
                    whyItMatters: 'Users cannot submit when sticky ads or modals cover the form.',
                    fix: '1. Ensure modals and sticky ads do not cover form controls without a clear dismiss control.\n2. Lower z-index or relocate the overlay so primary actions stay clickable.\n3. Re-check the click path after the change.',
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
          screenshotAfterUrl: await shot(page, options.auditId, `journey-signup-03-fill`),
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
            problem: 'Contact/support journey did not reach a usable help surface',
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

      let target: { href: string; text: string; category: string } | null = null
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
            `journey-funnel-${String(currentStep + 1).padStart(2, '0')}-evaluate`
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
              if (resolved.startsWith(origin)) {
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
            stepNumber: currentStep,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'FRICTION',
            problem: 'Funnel reaches a dead end with no way forward',
            evidence: `Reproduced at step ${currentStep}. No unvisited same-origin links found on ${page.url()}.`,
            whyItMatters: 'Dead-end funnels lose visitors who intended to convert.',
            fix: '1. Add clear next-step CTAs on every funnel page\n2. Ensure navigation includes conversion paths\n3. Add contextual links within page content',
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
        `journey-funnel-${String(currentStep + 1).padStart(2, '0')}-before`
      )

      await captureAccessibilityTree(page)
      let navigated = false
      stepActionDetail = {
        href: target.href,
        text: target.text,
        category: target.category,
        ...(stepActionDetail as Record<string, unknown>),
      }

      const clickSelector = await page.evaluate((href) => {
        const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
        for (let i = 0; i < anchors.length; i++) {
          const a = anchors[i]
          try {
            if (new URL(a.href, location.href).href === href || a.getAttribute('href') === href) {
              a.setAttribute('data-fixflags-journey-nav', String(i))
              return `[data-fixflags-journey-nav="${i}"]`
            }
          } catch {
            /* ignore */
          }
        }
        return null
      }, target.href)

      if (clickSelector) {
        try {
          await page.click(clickSelector, { timeout: 5_000 })
          await settleAuditPage(page)
          navigated = true
          timeline.push('click', `Funnel step ${currentStep + 1}: click ${target.text || target.href}`, {
            url: page.url(),
            screenshot: beforeShot,
          })
        } catch {
          const overlay = await detectOverlayAtPoint(page, clickSelector)
          if (overlay) {
            timeline.push('overlay', 'Overlay blocked funnel nav', { url: page.url() })
            findings.push(
              finding({
                checkId: 'overlay-blocks-nav',
                stepNumber: currentStep + 1,
                url: page.url(),
                rubric: 'EXPERIENCE',
                severity: 'CRITICAL',
                impactTag: 'CONVERSION',
                problem: 'Overlay blocks funnel navigation',
                evidence: `Reproduced at step ${currentStep + 1}. ${formatOverlayEvidence(overlay)} · target "${target.text || target.href}"`,
                whyItMatters: 'Visitors cannot continue the funnel when navigation is covered.',
                fix: '1. Ensure modals and sticky ads do not cover primary navigation without a clear dismiss control.\n2. Lower z-index or relocate the overlay so nav stays clickable.\n3. Re-check the click path after the change.',
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
              whyItMatters: 'Broken funnel links stop the conversion path mid-journey.',
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
        `journey-funnel-${String(currentStep).padStart(2, '0')}-after`
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

      if (isLoading) {
        findings.push(
          finding({
            checkId: 'journey-funnel-timeout',
            stepNumber: currentStep,
            url: currentUrl,
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'FRICTION',
            problem: 'Funnel page is stuck in a loading state',
            evidence: `Reproduced at step ${currentStep}. Page at ${currentUrl} shows only loading content.`,
            whyItMatters: 'Loading states that never resolve cause visitors to abandon the funnel.',
            fix: '1. Add loading timeouts with fallback content\n2. Show a skeleton or progress indicator\n3. Ensure the server responds within 3 seconds',
            screenshotUrl: afterShot,
            accessibilityEvidence: a11yAfter.slice(0, 2000),
            findingType: 'friction',
          })
        )
      }

      if (!hasContent && !isLoading) {
        findings.push(
          finding({
            checkId: 'journey-funnel-dead-end',
            stepNumber: currentStep,
            url: currentUrl,
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'FRICTION',
            problem: 'Funnel page appears empty or broken',
            evidence: `Reproduced at step ${currentStep}. Page at ${currentUrl} lacks substantive content.`,
            whyItMatters: 'Empty pages in the funnel break the conversion path.',
            fix: '1. Ensure the page renders content on load\n2. Check for JavaScript errors preventing render\n3. Add a fallback message if content fails to load',
            screenshotUrl: afterShot,
            accessibilityEvidence: a11yAfter.slice(0, 2000),
            findingType: 'dead-end',
          })
        )
      }

      const destHeadline = await pageHasClearHeadline(page)
      if (!destHeadline && currentStep >= 2) {
        findings.push(
          finding({
            checkId: 'journey-funnel-unclear-progress',
            stepNumber: currentStep,
            url: currentUrl,
            rubric: 'MESSAGE',
            severity: 'POLISH',
            impactTag: 'CLARITY',
            problem: 'Funnel page lacks a clear headline to orient the visitor',
            evidence: `Reproduced at step ${currentStep}. No H1 found on ${currentUrl}.`,
            whyItMatters: 'Visitors lose context when funnel pages do not restate the value proposition.',
            fix: '1. Add a clear H1 that continues the narrative from the previous step\n2. Match the headline to the funnel goal\n3. Keep it under 12 words',
            screenshotUrl: afterShot,
            accessibilityEvidence: a11yAfter.slice(0, 2000),
            findingType: 'confusion',
          })
        )
      }

      const destCta = await pageHasPrimaryCta(page)
      if (!destCta.found && currentStep >= 2 && currentStep < maxSteps) {
        findings.push(
          finding({
            checkId: 'journey-funnel-missing-feedback',
            stepNumber: currentStep,
            url: currentUrl,
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: 'CONVERSION',
            problem: 'Funnel page has no clear next action',
            evidence: `Reproduced at step ${currentStep}. After navigating to ${currentUrl}, no primary CTA was detected.`,
            whyItMatters: 'Funnel pages without a next step cause drop-off.',
            fix: '1. Add a primary CTA matching the funnel stage\n2. For signup flows: show the form or a "Continue" button\n3. For pricing: highlight the recommended plan CTA',
            screenshotUrl: afterShot,
            accessibilityEvidence: a11yAfter.slice(0, 2000),
            findingType: 'friction',
          })
        )
      }

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
            problem: 'Funnel requires too many steps to complete',
            evidence: `Reproduced at step ${currentStep}. Journey reached ${maxSteps} steps without a clear resolution.`,
            whyItMatters: 'Long funnels have compounding drop-off at each step.',
            fix: '1. Reduce the number of steps in the funnel\n2. Combine steps where possible\n3. Show a progress indicator to set expectations',
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

    if (session.formProbe && session.formProbe.status >= 400) {
      const statusCode = session.formProbe.status
      const checkId =
        statusCode === 401 || statusCode === 403
          ? 'form-submit-api-unauthorized'
          : statusCode >= 500
            ? 'form-submit-api-server-error'
            : 'form-submit-api-unauthorized'
      if (!alreadyHas(checkId)) {
        timeline.push('network', `Form probe ${statusCode}`, {
          url: session.formProbe.url,
          status: statusCode,
        })
        findings.push(
          finding({
            checkId,
            stepNumber: step,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'CONVERSION',
            problem:
              statusCode === 401 || statusCode === 403
                ? 'Form submission API returned unauthorized'
                : 'Form submission API returned an error',
            evidence: `Reproduced at step ${step}. ${session.formProbe.method} ${session.formProbe.status} ${session.formProbe.url}`,
            whyItMatters:
              'Users who complete the form cannot finish signup, newsletter, or contact.',
            fix: '1. Fix auth or server errors on the engagement submit endpoint.\n2. Show a clear error to the user.\n3. Re-check the form after deploying.',
          })
        )
      }
    }

    if (session.formProbe && session.formProbe.status > 0 && !alreadyHas('form-submit-silent-failure')) {
      const showsSuccess = await pageShowsFormSuccess(page).catch(() => false)
      const okStatus = session.formProbe.status >= 200 && session.formProbe.status < 300
      if (okStatus && !showsSuccess) {
        timeline.push('form', 'Silent form failure (2xx, no success UI)', {
          url: session.formProbe.url,
          status: session.formProbe.status,
        })
        findings.push(
          finding({
            checkId: 'form-submit-silent-failure',
            stepNumber: step,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'CONVERSION',
            problem:
              'Form submit succeeds without a clear success state (or shows success after a failed API)',
            evidence: `Reproduced at step ${step}. ${session.formProbe.method} ${session.formProbe.status} ${session.formProbe.url} · API returned success but no thank-you or confirmation copy appeared`,
            whyItMatters: 'Users think nothing happened after submit and abandon or resubmit.',
            fix: '1. After a successful submit, show a thank-you or confirmation state.\n2. Never show success copy when the API failed.\n3. Re-check the form after deploying.',
          })
        )
      } else if (!okStatus && showsSuccess) {
        timeline.push('form', 'Misleading success UI after failed API', {
          url: session.formProbe.url,
          status: session.formProbe.status,
        })
        findings.push(
          finding({
            checkId: 'form-submit-silent-failure',
            stepNumber: step,
            url: page.url(),
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'CONVERSION',
            problem:
              'Form submit succeeds without a clear success state (or shows success after a failed API)',
            evidence: `Reproduced at step ${step}. ${session.formProbe.method} ${session.formProbe.status} ${session.formProbe.url} · Page showed success copy after a failed API response`,
            whyItMatters: 'Users trust a fake confirmation while the submission never completed.',
            fix: '1. After a successful submit, show a thank-you or confirmation state.\n2. Never show success copy when the API failed.\n3. Re-check the form after deploying.',
          })
        )
      }
    }

    timeline.push('journey', `End ${options.journeyType} (${status})`, { url: page.url() })

    return {
      journeyType: options.journeyType,
      startUrl: options.startUrl,
      status,
      goalAchieved,
      abandonedReason,
      steps,
      findings,
      durationMs: Date.now() - started,
      formProbe: session.formProbe,
      actionTimeline: timeline.snapshot(),
    }
  }
}
