import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportProgressive } from '@/components/audit/AuditReportProgressive'

export default function ReportLoading() {
  return (
    <AuditShell immersive>
      <AuditReportProgressive status="QUEUED" />
    </AuditShell>
  )
}
