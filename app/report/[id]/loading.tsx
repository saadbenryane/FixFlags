import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportProgressiveShell } from '@/components/audit/AuditReportProgressive'

export default function ReportLoading() {
  return (
    <AuditShell>
      <AuditReportProgressiveShell />
    </AuditShell>
  )
}
