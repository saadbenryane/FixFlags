import type { Browser, Page } from 'playwright'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { createAuditPage, settleAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { captureAccessibilityTree } from '@/lib/audit/browser/journey-safety'
import { logger } from '@/lib/logger'
import {
  discoverJourneyLinks,
  pageHasClearHeadline,
  pageHasPrimaryCta,
  countVisibleFormFields,
  pickTargetForJourney,
} from './discover'
import type {
  JourneyFindingDraft,
  JourneyRunResult,
  JourneyStepDraft,
  JourneyType,
} from './types'
import { JOURNEY_MAX_STEPS, JOURNEY_TIMEOUT_MS } from './types'

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

export async function runJourneyTemplate(
  browser: Browser,
  options: {
    auditId: string
    startUrl: string
    journeyType: JourneyType
    maxSteps?: number
    deadlineMs?: number
  }
): Promise<JourneyRunResult> {
  const started = Date.now()
  const maxSteps = options.maxSteps ?? JOURNEY_MAX_STEPS
  const deadline = options.deadlineMs ?? started + JOURNEY_TIMEOUT_MS
  const steps: JourneyStepDraft[] = []
  const findings: JourneyFindingDraft[] = []
  let goalAchieved = false
  let abandonedReason: string | null = null

  const session = await createAuditPage(browser, options.startUrl, {
    profile: DESKTOP_CAPTURE_PROFILE,
    journeySafe: true,
  })
  const page = session.page
  const origin = new URL(options.startUrl).origin

  try {
    // Step 1: land
    const a11y1 = await captureAccessibilityTree(page)
    const before1 = await shot(page, options.auditId, `journey-${options.journeyType}-01-land`)
    steps.push({
      stepNumber: 1,
      actionType: 'navigate',
      actionDetail: { url: options.startUrl },
      url: page.url(),
      screenshotAfterUrl: before1,
      accessibilityTree: a11y1,
      consoleErrors: session.consoleErrors.map((e) => e.text),
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
          evidence: 'No H1 of at least 12 characters found on landing.',
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
          evidence: 'No button or conversion link matched common CTA patterns above the fold.',
          whyItMatters: 'Without a clear next step, first-time visitors bounce.',
          fix: '1. Add one primary CTA above the fold\n2. Use action-oriented label (Start free, See pricing, Book demo)\n3. Remove competing equal-weight CTAs',
          screenshotUrl: before1,
        })
      )
    }

    // Step 2: navigate toward journey goal
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
          evidence: abandonedReason,
          whyItMatters: 'Funnel paths that dead-end lose conversions silently.',
          fix: '1. Add clear nav to pricing, signup, or contact\n2. Ensure links are same-origin and crawlable\n3. Surface the path in both header and hero',
          screenshotUrl: before1,
        })
      )
      return finish('ABANDONED')
    }

    if (Date.now() > deadline || steps.length >= maxSteps) {
      return finish('ABANDONED')
    }

    const beforeClick = await shot(page, options.auditId, `journey-${options.journeyType}-02-before`)
    try {
      await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      await settleAuditPage(page)
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
          evidence: err instanceof Error ? err.message : String(err),
          whyItMatters: 'Broken corridor links stop the conversion path.',
          fix: '1. Fix the broken link destination\n2. Re-check status codes for pricing/signup routes\n3. Add a fallback CTA to a working page',
          screenshotUrl: beforeClick,
        })
      )
      return finish('FAILED')
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
      reasoning: `Navigate to ${target.category} target for ${options.journeyType}`,
    })

    // Destination assessments by journey type
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
            evidence: `Navigated via "${target.text}" to ${page.url()}`,
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
            evidence: `After opening "${target.text}", no primary CTA was detected.`,
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
            evidence: `Navigated to ${page.url()} expecting a registration form.`,
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
            evidence: `Counted ${fields} visible form fields on ${page.url()}.`,
            whyItMatters: 'Long signup forms increase abandonment before the first success moment.',
            fix: '1. Reduce to email + password (or OAuth) for step one\n2. Defer company/role questions until after account creation\n3. Show progress if multi-step is required',
            screenshotUrl: afterClick,
          })
        )
      } else {
        goalAchieved = true
        // Fill probe without submit (submits are blocked)
        try {
          const email = page.locator('input[type="email"], input[name*="email" i]').first()
          if (await email.count()) {
            await email.fill('journey-probe@example.com')
          }
        } catch {
          // fill optional
        }
        steps.push({
          stepNumber: 3,
          actionType: 'type',
          actionDetail: { field: 'email', value: 'journey-probe@example.com', submitted: false },
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
            evidence: 'No contact copy or form fields detected on destination.',
            whyItMatters: 'Buyers who cannot find help stall before purchasing.',
            fix: '1. Add a Contact or Support link in primary nav\n2. Include email or form on the destination\n3. State expected response time',
            screenshotUrl: afterClick,
          })
        )
      } else {
        goalAchieved = true
      }
    }

    return finish(goalAchieved ? 'COMPLETED' : findings.length > 0 ? 'COMPLETED' : 'ABANDONED')
  } catch (err) {
    logger.error('Journey template failed', err)
    abandonedReason = err instanceof Error ? err.message : String(err)
    return finish('FAILED')
  } finally {
    await page.context().close().catch(() => {})
  }

  function finish(status: JourneyRunResult['status']): JourneyRunResult {
    return {
      journeyType: options.journeyType,
      startUrl: options.startUrl,
      status,
      goalAchieved,
      abandonedReason,
      steps,
      findings,
      durationMs: Date.now() - started,
    }
  }
}
