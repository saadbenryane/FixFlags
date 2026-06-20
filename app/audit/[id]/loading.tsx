import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportProgressiveShell } from '@/components/audit/AuditReportProgressive'

export default function AuditLoading() {
  return (
    <AuditShell>
      <AuditReportProgressiveShell />
    </AuditShell>
  )
}
