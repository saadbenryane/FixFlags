import type { DeterministicFlag } from './flag-types'
import { collapseFlagsWithAffectedPaths } from './flag-identity'
import { preserveUnscopedOverlayFailures } from './checks/overlay-evidence'
import { suppressOverlappingFlags } from './suppression'

/** Source receipts retain every observation; reports show the actionable union. */
export function projectDeterministicFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  return collapseFlagsWithAffectedPaths(suppressOverlappingFlags(preserveUnscopedOverlayFailures(flags)))
}
