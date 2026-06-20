import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportLoadingShell } from '@/components/audit/AuditReportLoading'

export default function AuditLoading() {
  return (
    <AuditShell>
      <AuditReportLoadingShell />
    </AuditShell>
  )
}
