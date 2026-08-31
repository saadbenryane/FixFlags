import { PageMetadata } from '../metadata'
import { CHECK_TEXT_LIMIT } from '../page-text-limits'
import {
  type OfferType,
  type PagePurposeResult,
  detectOfferType,
  isProductPage,
  needsFirstStep,
} from '../page-purpose'
import type { DeterministicFlag } from '../flag-types'
import { hasLogoWall } from './utils'

const FREE_TRIAL_MARKERS = /(free trial|try free|start free|no credit card|no cc|free plan|get started free|14.day trial|7.day trial|30.day trial)/i

const DEMO_MARKERS = /(book demo|request demo|schedule demo|see it in action|watch demo)/i

const PRICING_MARKERS = /\b(pricing|plans|see pricing|view pricing|compare plans)\b/i

const BOOKING_MARKERS = /\b(book (?:a )?call|book now|book online|book appointment|schedule|make a reservation|schedule visit|request appointment|request quote|get quote|find near you|search by|browse|explore)\b/i

const CONTACT_PATH_MARKERS =
  /\b(start a project|get in touch|contact (us|me)|work with me|hire me|talk to (us|me)|send a message)\b/i

const GUARANTEE_MARKERS = /(money.back|guarantee|satisfied guaranteed|refund|risk.free|cancel anytime)/i

// Text signals of social proof. Broadened because logo walls ("trusted by" +
// customer logos) are the most common form of proof on strong sites, and the
// old pattern required a number, so it missed them and produced false "no social
// proof" flags on sites like Stripe and Vercel.
const SOCIAL_MARKERS =
  /(github\s+stars|\d[\d,.]*\+?\s*(users|customers|teams|stars|downloads|companies|businesses|developers|creators|brands|sites|websites|members)|rated\s+\d|\d(\.\d)?\s*(\/\s*5|out of 5|stars)|g2\b|capterra|trustpilot|product hunt|reviewed\s+by|reviews?\b|case stud(y|ies)|customer stor(y|ies)|testimonial|trusted by|backed by|as seen (in|on)|loved by|powering|join (thousands|millions|over|\d)|our (customers|clients|users)|wall of love|in numbers|community|showcase)/i

const COMMERCE_MARKERS = /\b(add to cart|buy now|shop now|checkout)\b/i

type FirstStepKind = 'trial' | 'demo' | 'pricing' | 'booking' | 'contact' | 'commerce'

function detectFirstSteps(input: {
  bodyText: string
  combinedAboveFold: string
  ctaTexts: string[]
  links: Array<{ href: string; text: string }>
}): Set<FirstStepKind> {
  const steps = new Set<FirstStepKind>()
  if (FREE_TRIAL_MARKERS.test(input.bodyText) || FREE_TRIAL_MARKERS.test(input.combinedAboveFold)) {
    steps.add('trial')
  }
  if (DEMO_MARKERS.test(input.bodyText)) steps.add('demo')
  if (
    PRICING_MARKERS.test(input.bodyText) ||
    PRICING_MARKERS.test(input.combinedAboveFold) ||
    input.links.some((link) => PRICING_MARKERS.test(link.href) || PRICING_MARKERS.test(link.text))
  ) {
    steps.add('pricing')
  }
  if (BOOKING_MARKERS.test(input.bodyText) || BOOKING_MARKERS.test(input.combinedAboveFold)) {
    steps.add('booking')
  }
  if (
    CONTACT_PATH_MARKERS.test(input.bodyText) ||
    CONTACT_PATH_MARKERS.test(input.combinedAboveFold) ||
    input.ctaTexts.some((cta) => CONTACT_PATH_MARKERS.test(cta))
  ) {
    steps.add('contact')
  }
  if (
    COMMERCE_MARKERS.test(input.bodyText) ||
    COMMERCE_MARKERS.test(input.combinedAboveFold) ||
    input.ctaTexts.some((cta) => COMMERCE_MARKERS.test(cta))
  ) {
    steps.add('commerce')
  }
  return steps
}

function missingFirstStepCopy(offer: OfferType): { evidence: string; fix: string } {
  if (offer === 'studio') {
    return {
      evidence:
        'Page has no contact, booking, or start-a-project path. Visitors have no clear first step to engage.',
      fix: '1. Add a next step that matches the offer: start a project, book a call, or get in touch\n2. Do not add a fake free trial if you do not offer one\n3. Keep the current visual and put that action next to the primary CTA or on the first screen',
    }
  }
  return {
    evidence:
      'Page has no free trial, demo, pricing, booking, or contact path. Visitors have no clear first step to engage.',
    fix: '1. Add a low-commitment next step that matches the offer: request a demo, view pricing, start a trial, book a call, or get in touch\n2. Do not add a fake free trial if you do not offer one\n3. Keep the current visual and put that action next to the primary CTA or on the first screen',
  }
}

export function runConversionFrictionChecks(
  meta: PageMetadata,
  purpose: PagePurposeResult = { purpose: 'marketing', reasons: [] }
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const productPage = isProductPage(purpose.purpose)
  const offer = detectOfferType(purpose.purpose)
  const bodyText = (meta.pageText ?? '').slice(0, CHECK_TEXT_LIMIT)
  const ctaTexts = meta.ctaTexts ?? []
  const links = meta.links ?? []
  const h1s = meta.h1s ?? []
  const combinedAboveFold = [...h1s, ...ctaTexts].filter(Boolean).join(' ')
  const firstSteps = detectFirstSteps({
    bodyText,
    combinedAboveFold,
    ctaTexts,
    links,
  })
  const hasFreeTrial = firstSteps.has('trial')
  const hasGuarantee = GUARANTEE_MARKERS.test(bodyText)
  const hasSocialProof = SOCIAL_MARKERS.test(bodyText) || hasLogoWall(meta.images ?? [])
  const hasPricingLinks = firstSteps.has('pricing')

  // First-step checks run on marketing and studio pages. Content pages
  // legitimately have no conversion path. Any matching first step is enough;
  // offer type only changes the missing-path prescription.
  if (needsFirstStep(purpose.purpose) && firstSteps.size === 0) {
    const copy = missingFirstStepCopy(offer)
    findings.push({
      checkId: 'friction-no-commitment-path',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'No clear low-commitment conversion path found',
      evidence: copy.evidence,
      fix: copy.fix,
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const hasCreditCardClarity = /no credit card|without credit card|credit card (required|needed)/i.test(bodyText)
  if (hasFreeTrial && !hasCreditCardClarity) {
    findings.push({
      checkId: 'friction-trial-commitment-unclear',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Free trial mention does not clarify if a credit card is required',
      evidence: `Found trial mention but no "no credit card required" or payment commitment signal nearby. Visitors may hesitate to start.`,
      fix: '1. State the actual payment requirement directly next to the free trial CTA\n2. If no card is required, say "No credit card required"\n3. If a card is required, say that plainly and add cancellation timing\n4. Place the reassurance on the button or in the CTA subtext',
      confidence: 0.75,
      source: 'DETERMINISTIC',
    })
  }

  // Only flag the largest form that contains a conversion CTA (sign up, start
  // free, etc.). Search bars, cookie forms, and login forms legitimately have
  // many fields but are not conversion friction.
  const formFields = meta.maxConversionFormInputs ?? meta.totalFormInputs ?? 0
  if (formFields > 5) {
    findings.push({
      checkId: 'friction-form-too-many-fields',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `Conversion form has ${formFields} fields - high friction for first contact`,
      evidence: `${formFields} form input fields detected in a conversion form. Each additional field reduces conversion rate.`,
      fix: '1. Reduce the form to the few fields needed for this first step\n2. Collect additional info progressively after conversion\n3. Consider multi-step forms if many fields are truly needed\n4. Test by removing every field that is not strictly necessary for the first interaction',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  const hasRiskReversal = hasGuarantee || bodyText.includes('cancel anytime') || FREE_TRIAL_MARKERS.test(bodyText)
  // Risk reversal only matters when the signup CTA itself implies a financial
  // commitment. A "Sign up" or "Get started" button on a free product does not
  // need "cancel anytime" messaging. Payment signals must appear in the CTA
  // text itself (e.g. "Buy Pro", "Subscribe", "Start free trial") or in a
  // direct pricing link, not just anywhere on the page.
  const hasPaymentCta = ctaTexts.some((c) => /\b(buy|subscribe|purchase|upgrade|pro|premium|enterprise|paid|pricing)\b/i.test(c))
  const hasPaymentLink = hasPricingLinks
  if (productPage && (hasPaymentCta || hasPaymentLink) && ctaTexts.some((c) => /sign ?up|register|create account/i.test(c)) && !hasRiskReversal) {
    findings.push({
      checkId: 'friction-no-risk-reversal',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Sign-up CTA lacks risk reversal elements',
      evidence: `CTA action "${ctaTexts.find((c) => /sign ?up|register|create account/i.test(c))}" found but no guarantee, free trial mention, or "cancel anytime" signal.`,
      fix: '1. Add the strongest true commitment detail near the CTA: free plan, trial length, cancellation window, or guarantee\n2. Include a money-back guarantee only if you actually offer one\n3. Use lower-commitment CTA copy when accurate, such as "Start free"\n4. Add a one-line reassurance under the CTA button',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  if (productPage && !hasSocialProof && ctaTexts.length > 0) {
    findings.push({
      checkId: 'friction-no-social-proof',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'No social proof signals found alongside conversion CTAs',
      evidence: 'Page has CTAs but no verifiable customer counts, testimonials, reviews, case studies, or trust badges visible.',
      fix: '1. Add the strongest proof you can substantiate near the CTA: named testimonial, case study, review badge, customer logo, or real usage metric\n2. If you do not have proof yet, add a founder note or product evidence instead of inventing numbers\n3. Link proof to its source when possible\n4. Place the strongest proof closest to the primary CTA',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
