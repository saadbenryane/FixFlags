import { PAGE_CHECK_DEFINITIONS } from '../checks/definitions'
import { taskInputSchema } from './contracts'

type Consumer = { workKind: string | null; workInput: unknown }
const complete = { collectMobile: true, collectAccessibility: true }

/** Read the admitted consumers, not the broader check catalog in ExecutionSpec.
 * Unknown or historical consumers retain complete collection. */
export function browserCollectionRequirements(consumers: readonly Consumer[], checks?: Readonly<Record<string, number>>) {
  if (!consumers.length) return { ...complete }
  const result = { collectMobile: false, collectAccessibility: false }
  for (const consumer of consumers) {
    if (consumer.workKind === 'motion') { result.collectMobile = true; continue }
    if (['judge', 'finalize', 'flow', 'journeys', 'search', 'discovery', 'cross-page'].includes(consumer.workKind ?? '')) continue
    if (consumer.workKind !== 'check') return { ...complete }
    const input = taskInputSchema.safeParse(consumer.workInput)
    const definition = input.success && input.data.module ? PAGE_CHECK_DEFINITIONS[input.data.module] : null
    if (!definition) return { ...complete }
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
