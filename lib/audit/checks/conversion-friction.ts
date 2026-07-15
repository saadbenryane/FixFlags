import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

const FREE_TRIAL_MARKERS = /(free trial|try free|start free|no credit card|no cc|free plan|get started free|14.day trial|7.day trial|30.day trial)/i

const DEMO_MARKERS = /(book demo|request demo|schedule demo|see it in action|watch demo)/i

const PRICING_MARKERS = /\b(pricing|plans|see pricing|view pricing|compare plans)\b/i

const BOOKING_MARKERS = /\b(book now|book online|book appointment|schedule|make a reservation|schedule visit|request appointment|request quote|get quote|find near you|search by|browse|explore)\b/i

const GUARANTEE_MARKERS = /(money.back|guarantee|satisfied guaranteed|refund|risk.free|cancel anytime)/i

// Text signals of social proof. Broadened because logo walls ("trusted by" +
// customer logos) are the most common form of proof on strong sites, and the
// old pattern required a number, so it missed them and produced false "no social
// proof" flags on sites like Stripe and Vercel.
const SOCIAL_MARKERS =
  /(github\s+stars|\d[\d,.]*\+?\s*(users|customers|teams|stars|downloads|companies|businesses|developers|creators|brands|sites|websites|members)|rated\s+\d|\d(\.\d)?\s*(\/\s*5|out of 5|stars)|g2\b|capterra|trustpilot|product hunt|reviewed\s+by|reviews?\b|case stud(y|ies)|customer stor(y|ies)|testimonial|trusted by|backed by|as seen (in|on)|loved by|powering|join (thousands|millions|over|\d)|our (customers|clients|users)|wall of love)/i

// A customer/partner logo wall is social proof even with no matching text. Treat
// several brand-name-like image alts as a logo wall.
function hasLogoWall(images: Array<{ alt: string | null }>): boolean {
  const brandLike = images.filter((img) => {
    const alt = (img.alt ?? '').trim()
    if (/logo/i.test(alt)) return true
    // 1-3 capitalized words, brand-length (e.g. "Notion", "Y Combinator")
    return /^[A-Z][A-Za-z0-9.&' ]{1,24}$/.test(alt) && alt.split(/\s+/).length <= 3 && alt.length >= 2
  }).length
  return brandLike >= 4
}

export function runConversionFrictionChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const bodyText = (meta.pageText ?? '').slice(0, 6000)
  const ctaTexts = meta.ctaTexts ?? []
  const links = meta.links ?? []
  const h1s = meta.h1s ?? []
  const combinedAboveFold = [...h1s, ...ctaTexts].filter(Boolean).join(' ')

  const hasFreeTrial = FREE_TRIAL_MARKERS.test(bodyText) || FREE_TRIAL_MARKERS.test(combinedAboveFold)
  const hasDemo = DEMO_MARKERS.test(bodyText)
  const hasPricing = PRICING_MARKERS.test(bodyText) || PRICING_MARKERS.test(combinedAboveFold)
  const hasBooking = BOOKING_MARKERS.test(bodyText) || BOOKING_MARKERS.test(combinedAboveFold)
  const hasGuarantee = GUARANTEE_MARKERS.test(bodyText)
  const hasSocialProof = SOCIAL_MARKERS.test(bodyText) || hasLogoWall(meta.images ?? [])
  const hasPricingLinks = links.some((l) => PRICING_MARKERS.test(l.href) || PRICING_MARKERS.test(l.text))

  if (!hasFreeTrial && !hasDemo && !hasPricing && !hasPricingLinks && !hasBooking) {
    findings.push({
      checkId: 'friction-no-commitment-path',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'No clear low-commitment conversion path found',
      evidence: 'Page has no free trial, demo request, or pricing link. Visitors have no clear first step to engage with the product.',
      fix: '1. Add a free trial CTA ("Start free trial - no credit card required")\n2. OR add a demo booking option ("Book a demo")\n3. OR add a visible pricing link so visitors can evaluate cost before committing\n4. Position the low-friction option as the primary CTA above the fold',
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

  const formFields = meta.totalFormInputs ?? 0
  if (formFields > 0 && (ctaTexts.length > 0 || hasFreeTrial || hasDemo)) {
    if (formFields > 5) {
      findings.push({
        checkId: 'friction-form-too-many-fields',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: `Conversion form has ${formFields} fields - high friction for first contact`,
        evidence: `${formFields} form input fields detected on the page. Each additional field reduces conversion rate.`,
        fix: '1. Reduce the form to the few fields needed for this first step\n2. Collect additional info progressively after conversion\n3. Consider multi-step forms if many fields are truly needed\n4. Test by removing every field that is not strictly necessary for the first interaction',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
    }
  }

  const hasRiskReversal = hasGuarantee || bodyText.includes('cancel anytime') || FREE_TRIAL_MARKERS.test(bodyText)
  if (ctaTexts.some((c) => /sign ?up|register|create account/i.test(c)) && !hasRiskReversal) {
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

  if (!hasSocialProof && ctaTexts.length > 0) {
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
