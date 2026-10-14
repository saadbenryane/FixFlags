import { createHash } from 'node:crypto'
import { z } from 'zod'
import { watchEmailPayloadSchema, watchEmailSelectionSchema, watchEmailSnapshotSchema } from './watch-payload'
import { notificationEmailBody } from './notification-delivery'

type Selection = z.infer<typeof watchEmailSelectionSchema>
type Snapshot = z.infer<typeof watchEmailSnapshotSchema>
type Finding = { id?: string; checkId?: string | null; problem?: string; rubric?: string; severity?: string }

export function watchEmailSelection(projectId: string, regressions: Finding[], recoveries: Finding[]): Selection {
  const keys = (items: Finding[]) => [...new Set(items.map(item => item.id ? 'id:' + item.id :
    'finding:' + createHash('sha256').update(JSON.stringify([item.checkId, item.problem, item.rubric, item.severity])).digest('hex')))].sort()
  return watchEmailSelectionSchema.parse({ projectId, regressions: keys(regressions), recoveries: keys(recoveries) })
}
const selectionIdentity = (selection: Selection) => JSON.stringify({ projectId: selection.projectId,
  regressions: [...new Set(selection.regressions)].sort(), recoveries: [...new Set(selection.recoveries)].sort() })

/** One permitted selection owns one immutable provider body and delivery key.
 * A changed selection is a new intent; earlier uncertain deliveries stay recorded. */
export function selectWatchEmailDelivery(input: {
  auditId: string; fresh: Snapshot; recorded: unknown; broadLegacyPermission: boolean;
}) {
  const baseKey = `fixflags-watch-${input.auditId}-v1`
  const fresh = watchEmailSnapshotSchema.parse(input.fresh)
  if (!fresh.selection) throw new Error('Notification selection is required')
  if (input.recorded == null) return watchEmailPayloadSchema.parse({ ...fresh, deliveryKey: baseKey })
  const recorded = watchEmailPayloadSchema.parse(input.recorded)
  if (recorded.to !== fresh.to || !recorded.tags.some(tag => tag.name === 'audit_id' && tag.value === input.auditId))
    throw new Error('Recorded notification no longer matches its recipient or Audit')
  const { previous = [], ...current } = recorded
  const snapshots = [current, ...previous]
  const permitted = (snapshot: Snapshot) => snapshot.to === fresh.to && snapshot.tags.some(tag => tag.name === 'audit_id' && tag.value === input.auditId)
  const matched = snapshots.find(snapshot => permitted(snapshot) && snapshot.selection && selectionIdentity(snapshot.selection) === selectionIdentity(fresh.selection!))
  if (matched) {
    const retained = snapshots.filter(snapshot => snapshot !== matched)
    return watchEmailPayloadSchema.parse({ ...matched, deliveryKey: matched.deliveryKey ?? baseKey,
      ...(retained.length ? { previous: retained } : {}) })
  }
  if (!current.selection) {
    // Unscoped historical bodies retain their broad-policy compatibility. A
    // restrictive policy needs the exact current body or a new scoped intent.
    if (input.broadLegacyPermission || JSON.stringify(notificationEmailBody(current)) === JSON.stringify(notificationEmailBody(fresh)))
      return watchEmailPayloadSchema.parse({ ...recorded, deliveryKey: current.deliveryKey ?? baseKey })
  }
  const digest = createHash('sha256').update(selectionIdentity(fresh.selection)).digest('hex')
  return watchEmailPayloadSchema.parse({ ...fresh, deliveryKey: baseKey + '-' + digest, previous: snapshots })
}

export { notificationEmailBody as watchEmailProviderBody }
