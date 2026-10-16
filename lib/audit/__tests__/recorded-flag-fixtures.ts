import { collapseFlagsWithAffectedPaths } from '../flag-identity'
import { observationsForFlag } from '../flag-observations'

/** Explicit synthetic source receipts for recovery tests. Production gets these
 * from admitted execution scope and its committed task, never from this helper. */
export function collapseRecordedFixtureFlags<T extends Parameters<typeof collapseFlagsWithAffectedPaths>[0][number]>(flags: T[]) {
  return collapseFlagsWithAffectedPaths(flags.map((flag, index) => ({ ...flag,
    supportingObservations: observationsForFlag(flag, { auditId: 'before', taskId: 'original-task-' + index,
      checkVersion: 1, collectedAt: '2026-10-12T12:00:00.000Z' }),
  })))
}
