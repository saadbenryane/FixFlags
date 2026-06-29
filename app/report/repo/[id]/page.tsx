import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AuditShell } from '@/components/layout/audit-shell'
import { ReportAccessDeniedStatus } from '@/components/ui/status-page'
import { RepoScanReport } from '@/components/repo-scan/RepoScanReport'
import type { RepoScan } from '@/hooks/useRepoScanPolling'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: 'Codebase scan · FixFlags',
  robots: { index: false, follow: false },
}

export default async function RepoScanReportPage({ params }: Props) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return (
      <AuditShell session={null}>
        <ReportAccessDeniedStatus />
      </AuditShell>
    )
  }

  const scan = await prisma.repoScan.findUnique({
    where: { id },
    include: { findings: { orderBy: [{ severity: 'asc' }, { filePath: 'asc' }] } },
  })

  if (!scan) notFound()

  if (scan.userId !== session.user.id) {
    return (
      <AuditShell session={session}>
        <ReportAccessDeniedStatus />
      </AuditShell>
    )
  }

  const initialScan: RepoScan = {
    id: scan.id,
    repoFullName: scan.repoFullName,
    commitSha: scan.commitSha,
    status: scan.status,
    errorMsg: scan.errorMsg,
    startedAt: scan.startedAt?.toISOString() ?? null,
    completedAt: scan.completedAt?.toISOString() ?? null,
    createdAt: scan.createdAt.toISOString(),
    findings: scan.findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      category: f.category,
      filePath: f.filePath,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      problem: f.problem,
      evidence: f.evidence,
      fix: f.fix,
      agentPrompt: f.agentPrompt,
    })),
  }

  return (
    <AuditShell session={session}>
      <RepoScanReport initialScan={initialScan} />
    </AuditShell>
  )
}
