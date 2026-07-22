import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ReportRoute } from '@/app/report/[id]/page'
import { SHARE_GRANT_COOKIE, verifyShareGrant } from '@/lib/security/share-grant'
import { canSharePublicly } from '@/lib/auth/entitlements'

export default async function SharedReportDetailsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      auditId: true,
      revoked: true,
      expiresAt: true,
      version: true,
      audit: {
        select: {
          status: true,
          user: { select: { id: true, role: true, plan: true, subscriptionStatus: true } },
        },
      },
    },
  })
  if (!link || link.revoked || link.audit.status !== 'COMPLETED' || !link.audit.user ||
    !canSharePublicly(link.audit.user) || (link.expiresAt && link.expiresAt < new Date())) {
    notFound()
  }
  const grant = verifyShareGrant((await cookies()).get(SHARE_GRANT_COOKIE)?.value)
  if (
    !grant ||
    grant.linkId !== link.id ||
    grant.auditId !== link.auditId ||
    grant.linkVersion !== link.version
  ) notFound()
  return (
    <ReportRoute
      params={Promise.resolve({ id: link.auditId })}
      mode="details"
      accessMode="share"
      shareToken={token}
    />
  )
}
