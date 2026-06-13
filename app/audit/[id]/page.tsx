import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuditPageClient } from '@/components/audit/AuditPageClient'
import { AuditReport } from '@/components/audit/AuditReport'
import { AuditPageActions } from '@/components/audit/AuditPageActions'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AuditPage({ params }: Props) {
  const { id } = await params
  const result = await getGatedAuditForRequest(id)

  if (result.kind === 'not_found') {
    notFound()
  }

  if (result.kind === 'forbidden') {
    return (
      <AuditShell session={null}>
        <Container className="py-24 text-center space-y-4">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-muted-foreground text-sm">You do not have access to this audit.</p>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </Container>
      </AuditShell>
    )
  }

  const { audit, isPaid, isLoggedIn, session } = result

  if (audit.status === 'COMPLETED') {
    return (
      <AuditShell
        session={session}
        actions={
          <AuditPageActions
            auditId={id}
            isPaid={isPaid}
            isLoggedIn={isLoggedIn}
            isPublic={audit.isPublic}
            hasParent={!!audit.parentId}
          />
        }
      >
        <AuditReport audit={audit} isPaid={isPaid} isLoggedIn={isLoggedIn} />
      </AuditShell>
    )
  }

  return (
    <AuditPageClient
      id={id}
      initialAudit={audit}
      pollStatus
      session={session}
    />
  )
}
