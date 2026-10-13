import { AdminActionButton } from './AdminActionButton'
export function RetryAuditButton({ auditId }: { auditId: string }) {
  return <AdminActionButton action="AUDIT_RETRY" targetId={auditId} />
}
