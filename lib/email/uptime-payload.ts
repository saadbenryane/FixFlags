import { z } from 'zod'
import { notificationEmailSnapshotSchema } from './notification-delivery'

export const uptimeEmailSchema = notificationEmailSnapshotSchema.extend({
  ownerId: z.string().min(1), projectId: z.string().min(1), incidentId: z.string().min(1),
  kind: z.enum(['DOWN', 'RECOVERED']), targetVersion: z.number().int().positive(),
}).strict()
