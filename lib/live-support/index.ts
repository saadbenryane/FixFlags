export * from '@/lib/live-support/types'
export { getDefaultSupportTenant } from '@/lib/live-support/tenant'
export {
  resumeOrCreateSession,
  getSessionForVisitor,
  listAdminSessions,
  countOpenConversations,
  closeOrphanSupportSessions,
  getAdminUnreadCount,
  updateSessionStatus,
} from '@/lib/live-support/sessions'
export {
  listMessages,
  sendVisitorMessage,
  sendAgentMessage,
  markReadByVisitor,
  markReadByAgent,
  serializeMessage,
  serializeSession,
} from '@/lib/live-support/messages'
export { resolveLeadIdForSession } from '@/lib/live-support/resolve-lead-context'
export { extractAuditIdFromPath, extractAuditIdFromPageUrl } from '@/lib/live-support/extract-audit-id'
export { SupportError, isSupportError } from '@/lib/live-support/errors'
