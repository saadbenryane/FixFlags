import { z } from 'zod'
import { notificationEmailSnapshotSchema } from './notification-delivery'

export const watchEmailSelectionSchema = z.object({
  projectId: z.string().min(1),
  regressions: z.array(z.string().min(1).max(250)).max(5000),
  recoveries: z.array(z.string().min(1).max(250)).max(5000),
}).strict()
/** The complete provider body stays stable for one permitted selection. */
export const watchEmailSnapshotSchema = notificationEmailSnapshotSchema.extend({
  selection: watchEmailSelectionSchema.optional(),
  deliveryKey: z.string().min(1).max(250).optional(),
}).strict()
export const watchEmailPayloadSchema = watchEmailSnapshotSchema.extend({
  previous: z.array(watchEmailSnapshotSchema).max(32).optional(),
}).strict()
