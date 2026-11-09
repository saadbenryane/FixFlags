import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const tagName = 'fixflags_receipt'
const token = z.string().regex(/^[a-f0-9]{32}$/)
const sourceId = z.string().min(1).max(200)

export const notificationReceiptTags = z.discriminatedUnion('purpose', [
  z.object({ purpose: z.literal('watch'), audit_id: sourceId, [tagName]: token }),
  z.object({ purpose: z.literal('uptime'), notification_id: sourceId, [tagName]: token }),
])

/** Generate once for each newly frozen provider body. */
export function notificationReceiptTag() {
  return { name: tagName, value: randomBytes(16).toString('hex') }
}

export function hasNotificationReceiptTag(tags: Array<{ name: string; value: string }>, receipt: z.infer<typeof notificationReceiptTags>) {
  return tags.some(tag => tag.name === tagName && tag.value === receipt[tagName])
}
