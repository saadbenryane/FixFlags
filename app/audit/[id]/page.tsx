import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuditPageClient } from '@/components/audit/AuditPageClient'
import { AuditReport } from '@/components/audit/AuditReport'
import { AuditPageActions } from '@/components/audit/AuditPageActions'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'
import { prisma } from '@/lib/db'
import { getEntitlements } from '@/lib/auth/entitlements'
import { isAdminUser } from '@/lib/auth/permissions'

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

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true, role: true, freeRecheckUsedAt: true },
      })
    : null

  const entitlements = user
    ? getEntitlements({
        id: session!.user.id,
        role: user.role,
        plan: user.plan,
        freeRecheckUsedAt: user.freeRecheckUsedAt,
      })
    : null

  const latestRecheck =
    session?.user && !audit.parentId
      ? await prisma.audit.findFirst({
          where: {
            parentId: id,
            userId: session.user.id,
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      : null

  if (audit.status === 'COMPLETED') {
    return (
      <AuditShell
        session={session}
        showAdmin={user ? isAdminUser({ id: session!.user.id, role: user.role }) : false}
        actions={
          <AuditPageActions
            auditId={id}
            isPaid={isPaid}
            isLoggedIn={isLoggedIn}
            isPublic={audit.isPublic}
            hasParent={!!audit.parentId}
            compareAuditId={audit.parentId ? id : latestRecheck?.id ?? null}
            plan={user?.plan ?? 'FREE'}
            projectId={audit.projectId}
            canUseFreeRecheck={entitlements?.canUseFreeRecheck ?? false}
            canSharePublicly={entitlements?.canSharePublicly ?? false}
            hasUsedFreeRecheck={entitlements?.hasUsedFreeRecheck ?? false}
          />
        }
      >
        <AuditReport
          audit={audit}
          auditId={id}
          isPaid={isPaid}
          isLoggedIn={isLoggedIn}
          showRecheckHint={isPaid || (entitlements?.canUseFreeRecheck ?? false)}
          canUseFreeRecheck={entitlements?.canUseFreeRecheck ?? false}
          hasUsedFreeRecheck={entitlements?.hasUsedFreeRecheck ?? false}
          canSharePublicly={entitlements?.canSharePublicly ?? false}
          screenshotLimited={
            audit.status === 'COMPLETED' && (audit.screenshots?.length ?? 0) === 0
          }
        />
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
