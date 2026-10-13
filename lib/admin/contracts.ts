import { z } from 'zod'

export const adminActionSchema = z.enum([
  'OPERATION_RECONCILE',
  'SITE_SET_MONITORING',
  'SITE_CHECK',
  'AUDIT_RETRY',
  'SITE_RECONCILE',
  'WATCH_NOTIFICATION_RETRY',
  'UPTIME_NOTIFICATION_RETRY',
  'SITE_ACCOUNT_RECONCILE',
  'SITE_ACCOUNT_CLEANUP',
  'SITE_SET_SETTINGS',
  'SITE_REMOVE',
  'USER_SUSPEND',
  'USER_REACTIVATE',
  'USER_REVOKE_SESSIONS',
  'USER_REMOVE',
  'ENTITLEMENT_GRANT',
  'ENTITLEMENT_REVOKE',
  'BILLING_CHANGE_SUBSCRIPTION',
  'BILLING_CANCEL_SUBSCRIPTION',
  'BILLING_RESUME_SUBSCRIPTION',
  'BILLING_RECONCILE',
  'BILLING_REFUND',
  'SHOP_RECHECK',
  'SHOP_DISCONNECT',
  'SUPPORT_REPLY',
  'SUPPORT_STATUS',
  'SUPPORT_ASSIGN',
  'LEAD_UPDATE',
  'WAITLIST_BATCH',
  'WAITLIST_GRANT',
  'WAITLIST_INVITE',
  'EVIDENCE_ACCESS',
  'DATA_EXPORT',
])
export type AdminAction = z.infer<typeof adminActionSchema>
export const adminPreviewRequestSchema = z
  .object({
    action: adminActionSchema,
    targetId: z.string().trim().min(1).max(255),
    reason: z.string().trim().min(5, 'Explain why this action is needed.').max(1000),
    input: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
export type AdminActionRequest = z.infer<typeof adminPreviewRequestSchema>

export const adminIntentSchema = adminPreviewRequestSchema
  .extend({
    version: z.literal(1),
    actorId: z.string(),
    sessionId: z.string(),
    revision: z.string().length(64),
    ownerId: z.string().nullable(),
    targetType: z.string(),
    providerRevision: z.string().length(64).optional(),
    expiresAt: z.number().int(),
  })
  .strict()
export const adminExecuteRequestSchema = z
  .object({ intent: z.string().min(1).max(24_000), idempotencyKey: z.string().uuid() })
  .strict()

export type AdminActionPreview = {
  action: AdminAction
  title: string
  targetLabel: string
  effects: string[]
  recentAuthenticationRequired: boolean
  destructive: boolean
  intent: string
  expiresAt: string
}

export type AdminOperationReceipt = {
  id: string
  action: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'INDETERMINATE' | 'SUPERSEDED'
  result: unknown
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}
