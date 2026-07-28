import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { ShareLinkPageClient } from '@/components/audit/ShareLinkPageClient'
import { BRAND, REPORT_COPY, SITE_URL } from '@/lib/marketing/copy'
import { displayHostname } from '@/lib/utils/url-helpers'
import { SHARE_GRANT_COOKIE, verifyShareGrant } from '@/lib/security/share-grant'
import { ReportRoute } from '@/app/report/[id]/page'
import { canSharePublicly } from '@/lib/auth/entitlements'
import { AuditShell } from '@/components/layout/audit-shell'
import { ReportWorkspaceState } from '@/components/report/ReportWorkspaceState'

interface Props { params: Promise<{ token: string }> }

async function loadLink(token: string) {
  return prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      auditId: true,
      revoked: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      passwordHash: true,
      version: true,
      audit: {
        select: {
          url: true,
          score: true,
          verdict: true,
          status: true,
          user: { select: { id: true, role: true, plan: true, subscriptionStatus: true } },
        },
      },
    },
  })
}

function isUnavailable(link: Awaited<ReturnType<typeof loadLink>>): boolean {
  return !link || link.revoked || link.audit.status !== 'COMPLETED' ||
    !link.audit.user || !canSharePublicly(link.audit.user) ||
    Boolean(link.expiresAt && link.expiresAt < new Date())
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const link = await loadLink(token)
  if (isUnavailable(link)) return { title: 'Shared report unavailable', robots: { index: false, follow: false } }
  if (link!.passwordHash) {
    return {
      title: `Protected report · ${BRAND.name}`,
      description: 'A password-protected FixFlags report.',
      robots: { index: false, follow: false },
    }
  }
  const hostname = displayHostname(link!.audit.url)
  const title = `${hostname} review · ${BRAND.name}`
  return {
    title,
    description: 'A shared FixFlags report with ranked fixes and evidence.',
    robots: { index: false, follow: false },
    openGraph: { title, description: 'A shared FixFlags report with ranked fixes and evidence.', url: `${SITE_URL}/share/${token}`, siteName: BRAND.name },
  }
}

export default async function ShareLinkPage({ params }: Props) {
  const { token } = await params
  const link = await loadLink(token)
  if (isUnavailable(link)) {
    return (
      <AuditShell session={null}>
        <ReportWorkspaceState
          title={REPORT_COPY.workspace.unavailableState.sharedTitle}
          description={REPORT_COPY.workspace.unavailableState.sharedBody}
          actionLabel={REPORT_COPY.workspace.unavailableState.reviewSite}
          actionHref="/"
        />
      </AuditShell>
    )
  }

  const cookieStore = await cookies()
  const grant = verifyShareGrant(cookieStore.get(SHARE_GRANT_COOKIE)?.value)
  if (
    !grant ||
    grant.linkId !== link!.id ||
    grant.auditId !== link!.auditId ||
    grant.linkVersion !== link!.version
  ) {
    return <ShareLinkPageClient token={token} requiresPassword={Boolean(link!.passwordHash)} />
  }

  return (
    <ReportRoute
      params={Promise.resolve({ id: link!.auditId })}
      shareToken={token}
    />
  )
}
