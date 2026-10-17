import type { ProductContract } from '@/lib/audit/product-contract'
import { isProductPage, type PagePurpose } from '@/lib/audit/page-purpose'
import type { JourneyType } from './types'
import type { readJourneyContext } from '../checks/journey-evidence'

const SAAS_JOURNEY_TYPES: JourneyType[] = [
  'first-visit',
  'pricing-evaluation',
  'signup',
  'contact-support',
  'multi-step-funnel',
]

/** Contact-led / content sites: no pricing or signup funnel templates. */
const PERSONAL_JOURNEY_TYPES: JourneyType[] = [
  'first-visit',
  'contact-support',
  'multi-step-funnel',
]

/** Prefer journey templates that match the Product Contract first-value path. */
export function orderJourneysFromContract(
  contract: ProductContract | null,
  purpose: PagePurpose | null = null
): JourneyType[] {
  const base =
    purpose != null && !isProductPage(purpose) ? [...PERSONAL_JOURNEY_TYPES] : [...SAAS_JOURNEY_TYPES]
  if (!contract) return base

  const text =
    `${contract.firstValueJourney} ${contract.purpose} ${contract.criticalOutcomes.join(' ')}`.toLowerCase()
  const preferred: JourneyType[] = []
  if (base.includes('pricing-evaluation') && /pric|plan|checkout|buy|purchas/.test(text)) {
    preferred.push('pricing-evaluation')
  }
  if (base.includes('signup') && /sign.?up|register|trial|onboard|account/.test(text)) {
    preferred.push('signup')
  }
  if (/contact|support|help|demo|book|call|project/.test(text)) preferred.push('contact-support')

  const ordered: JourneyType[] = ['first-visit']
  for (const t of preferred) {
    if (base.includes(t) && !ordered.includes(t)) ordered.push(t)
  }
  for (const t of base) {
    if (!ordered.includes(t)) ordered.push(t)
  }
  return ordered
}

export type JourneyScopeOptions = {
  expectedJourneyConditions?: Array<NonNullable<ReturnType<typeof readJourneyContext>>>
  recordedJourneyConditions?: Array<NonNullable<ReturnType<typeof readJourneyContext>>>
  overlayPhases?: string[]
}

/** Frozen original routes stay distinguishable from ordinary discovery. */
export function selectJourneyRuns(contract: ProductContract | null, purpose: PagePurpose | null, options: JourneyScopeOptions) {
  const journeyTypes = options.expectedJourneyConditions
    ? [...new Set(options.expectedJourneyConditions.map(condition => condition.journeyType))]
    : options.overlayPhases
    ? (['first-visit', 'pricing-evaluation', 'checkout', 'signup', 'contact-support', 'multi-step-funnel'] as JourneyType[])
      .filter(type => options.overlayPhases!.some(phase => phase.startsWith('journey_' + type.replaceAll('-', '_') + '_')))
    : orderJourneysFromContract(contract, purpose)
  for (const condition of options.recordedJourneyConditions ?? []) if (!journeyTypes.includes(condition.journeyType)) journeyTypes.unshift(condition.journeyType)
  const recorded = options.expectedJourneyConditions ?? options.recordedJourneyConditions ?? []
  const routes = [...new Map(recorded.filter(condition => condition.phase === 'destination' ||
    !recorded.some(other => other.journeyType === condition.journeyType && other.phase === 'destination'))
    .map(condition => [JSON.stringify([condition.journeyType, condition.route]), { journeyType: condition.journeyType as JourneyType, route: condition.route }])).values()]
  return [...routes, ...journeyTypes.filter(type => !routes.some(item => item.journeyType === type))
    .map(journeyType => ({ journeyType, route: options.expectedJourneyConditions ? [] : undefined }))]

}
