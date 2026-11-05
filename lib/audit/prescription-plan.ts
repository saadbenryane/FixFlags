import { requiresPrescriptionPageContext } from './prescription-policy'
import { registeredRepairRecipe } from './check-registry'
import { canonicalHistoricalCheckId } from './check-compatibility'
import { readSupportingObservations } from './flag-observations'
import { isCustomerFlag, type CustomerFlagInput } from './attention'
import { resolveRepairDefinition, type RepairDefinition, type RepairGuidanceInput } from '@/lib/improvements/repair-guidance'

export type PrescriptionPlanningFlag = RepairGuidanceInput & CustomerFlagInput & { flagKey: string; source?: string | null }

/** Reuse complete native instructions only for their recorded executable contract. */
export function nativePrescriptionDefinitions(flags: readonly PrescriptionPlanningFlag[]): Map<string, RepairDefinition> | null {
  if (!flags.length) return null
  const definitions = new Map<string, RepairDefinition>()
  for (const flag of flags) {
    if (flag.source?.toUpperCase() !== 'DETERMINISTIC' || !isCustomerFlag(flag)) return null
    const recipe = registeredRepairRecipe(flag.checkId)
    const observations = readSupportingObservations(flag.supportingObservations)
    if (recipe?.kind !== 'repair' || !observations?.items.length || observations.items.some(item =>
      item.source?.toUpperCase() !== 'DETERMINISTIC' || !item.evidence.trim() || !item.provenance ||
      canonicalHistoricalCheckId(item.checkId) !== recipe.checkId || item.checkVersion !== recipe.checkVersion)) return null
    const definition = resolveRepairDefinition(flag)
    if (definition?.kind !== 'repair' || definition.source === 'evidence-recovery') return null
    const existing = definitions.get(flag.flagKey)
    if (existing && existing.guidance !== definition.guidance) return null
    definitions.set(flag.flagKey, definition)
  }
  return definitions
}

export const PRESCRIPTION_BATCH_SIZE = 12

/** Keep every occurrence of one Flag key in one batch. An empty review is one empty batch. */
export function prescriptionFlagBatches<T extends { flagKey: string }>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Prescription batch size must be positive')
  if (items.length === 0) return [[]]
  const occurrences = new Map<string, T[]>()
  for (const item of items) {
    const group = occurrences.get(item.flagKey) ?? []
    group.push(item)
    occurrences.set(item.flagKey, group)
  }
  const groups = [...occurrences.values()]
  const batches: T[][] = []
  for (let i = 0; i < groups.length; i += size) {
    batches.push(groups.slice(i, i + size).flat())
  }
  return batches
}

/** One unscoped task covers a single batch. Larger reviews get one task per batch. */
export function prescriptionTaskPlans(flags: readonly PrescriptionPlanningFlag[]): Array<{ index: number | null; flagKeys?: string[] }> {
  const groups = prescriptionFlagBatches(flags.filter(flag => flag.flagKey), 1).filter(group => group.length)
  // Keep exact key membership together while independent nonvisual work avoids image dependencies.
  const classified = groups.map(group => ({ group, kind: nativePrescriptionDefinitions(group) ? 'native'
    : requiresPrescriptionPageContext(group) ? 'visual' : 'text' }))
  const batches = ['native', 'text', 'visual'].flatMap(kind => {
    const selected = classified.filter(item => item.kind === kind).flatMap(item => item.group)
    return selected.length ? prescriptionFlagBatches(selected, PRESCRIPTION_BATCH_SIZE) : []
  })
  if (batches.length <= 1) return [{ index: null }]
  return batches.map((batch, index) => ({ index, flagKeys: [...new Set(batch.map(flag => flag.flagKey))] }))
}
