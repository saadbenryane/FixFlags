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
export function prescriptionTaskPlans(flags: readonly { flagKey: string }[]): Array<{ index: number | null; flagKeys?: string[] }> {
  const batches = prescriptionFlagBatches(flags.filter(flag => flag.flagKey), PRESCRIPTION_BATCH_SIZE)
  if (batches.length <= 1) return [{ index: null }]
  return batches.map((batch, index) => ({ index, flagKeys: [...new Set(batch.map(flag => flag.flagKey))] }))
}
