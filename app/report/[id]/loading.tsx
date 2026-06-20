import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportLoadingShell } from '@/components/audit/AuditReportLoading'

export default function ReportLoading() {
  return (
    <AuditShell>
      <AuditReportLoadingShell />
    </AuditShell>
  )
}
