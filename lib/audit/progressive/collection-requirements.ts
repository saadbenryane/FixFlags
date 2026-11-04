import { ACTION_CHECK_DEFINITIONS, PAGE_CHECK_DEFINITIONS } from '../checks/definitions'
import { taskInputSchema } from './contracts'
import { SEARCH_DEFINITIONS } from '../search/definitions'
import type { PublicSignalCollection } from '../browser/public-page-signals'

type Consumer = { workKind: string | null; workInput: unknown }
const complete = { collectMobile: true, collectAccessibility: true, collectPublicSignals: 'all' as const }

/** Response-only consumers own the collected document, not parsed metadata.
 * Discovery still needs its document-link fallback if browser collection fails. */
export function httpCollectionRequirements(consumers: readonly Consumer[]) {
  if (!consumers.length) return { collectMetadata: true }
  for (const consumer of consumers) {
    if (consumer.workKind === 'finalize') continue
    const input = taskInputSchema.safeParse(consumer.workInput)
    const checkModule = input.success ? input.data.module : undefined
    const definition = checkModule ? PAGE_CHECK_DEFINITIONS[checkModule] : undefined
    if (consumer.workKind === 'check' && (definition?.input === 'headers' || checkModule === 'page-response' || checkModule === 'security')) continue
    if (consumer.workKind === 'search' && (checkModule === 'summary' || SEARCH_DEFINITIONS.some(definition => checkModule === 'search-' + definition.evaluator))) continue
    return { collectMetadata: true }
  }
  return { collectMetadata: false }
}

/** These are observation dependencies, not a new detector or capture profile. */
export function browserDevicesForCheck(module: string, checks: Readonly<Record<string, number>>): Array<'desktop' | 'mobile'> {
  const definition = PAGE_CHECK_DEFINITIONS[module]
  // Standalone observations declare their own task dependencies. They do not
  // request a paired page capture merely by appearing in the check inventory.
  if (ACTION_CHECK_DEFINITIONS[module] || module === 'search') return []
  if (!definition) return ['desktop', 'mobile']
  if (definition.input === 'accessibility') {
    const mobile = Boolean(checks['axe-target-size'])
    const desktop = Object.values(definition.assertions).some(assertion => assertion.verifies.some(id => id !== 'axe-target-size' && checks[id]))
    return [...(desktop || !mobile ? ['desktop' as const] : []), ...(mobile ? ['mobile' as const] : [])]
  }
  const mobileChecks = module === 'mobile-ux-quality' ? ['mobile-input-zoom', 'mobile-load-delay-content']
    : module === 'interaction' ? ['motion-ignores-reduced-preference', 'loading-indicator-stuck'] : null
  if (mobileChecks) {
    const admitted = Object.values(definition.assertions).flatMap(assertion => assertion.verifies).filter(id => checks[id])
    // These native observations already own a mobile comparison scope. Other
    // checks retain desktop page purpose or their original paired conditions.
    if (admitted.length && admitted.every(id => mobileChecks.includes(id))) return ['mobile']
  }
  if (definition.input === 'browser' || definition.input === 'console') return ['desktop', 'mobile']
  return definition.input === 'metadata' ? ['desktop'] : []
}

export function isBrowserEvidenceKey(key: string) { return key.endsWith(':browser') || key.endsWith(':browser-mobile') }

/** Read the admitted consumers, not the broader check catalog in ExecutionSpec.
 * Unknown or historical consumers retain complete collection. */
export function browserCollectionRequirements(consumers: readonly Consumer[], checks?: Readonly<Record<string, number>>) {
  if (!consumers.length) return { ...complete }
  const result: { collectMobile: boolean; collectAccessibility: boolean; collectPublicSignals: PublicSignalCollection | false } =
    { collectMobile: false, collectAccessibility: false, collectPublicSignals: false }
  for (const consumer of consumers) {
    if (consumer.workKind === 'motion') { result.collectMobile = true; continue }
    if (['judge', 'finalize', 'flow', 'journeys', 'search', 'discovery', 'cross-page'].includes(consumer.workKind ?? '')) continue
    if (consumer.workKind !== 'check') return { ...complete }
    const input = taskInputSchema.safeParse(consumer.workInput)
    const definition = input.success && input.data.module ? PAGE_CHECK_DEFINITIONS[input.data.module] : null
    if (!definition) return { ...complete }
    if (input.success && input.data.module === 'trust') result.collectPublicSignals = 'all'
    if (input.success && input.data.module === 'measurement' && result.collectPublicSignals !== 'all') result.collectPublicSignals = 'analytics'
    if (definition.input === 'accessibility') {
      result.collectAccessibility = true
      if (!checks || checks['axe-target-size']) result.collectMobile = true
    }
    else if (definition.input === 'console') {
      // Its original desktop error window includes axe execution. Removing that
      // instrumentation cannot independently establish a console repair.
      result.collectMobile = true
      result.collectAccessibility = true
    }
    else if (definition.input === 'browser') result.collectMobile = true
    else if (definition.input !== 'metadata') return { ...complete }
  }
  return result
}
