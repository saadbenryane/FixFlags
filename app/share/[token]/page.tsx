import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ShareLinkPageClient } from '@/components/audit/ShareLinkPageClient'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { displayHostname } from '@/lib/utils/url-helpers'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params

  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      revoked: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      password: true,
      audit: {
        select: {
          url: true,
          score: true,
          verdict: true,
          flags: {
            select: { severity: true, problem: true },
            orderBy: { position: 'asc' },
            take: 3,
          },
        },
      },
    },
  })

  if (!link || link.revoked) {
    return { title: 'Link not found' }
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return { title: 'Link expired' }
  }

  if (link.maxViews && link.viewCount >= link.maxViews) {
    return { title: 'Link expired' }
  }

  const hostname = link.audit.url ? displayHostname(link.audit.url) : 'FixFlags report'

  const score = link.audit.score
  const topIssue = link.audit.flags.find(f => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT')?.problem
  const title = score != null ? `${hostname} - ${score}/100` : `${hostname} review`
  const description = topIssue ?? link.audit.verdict?.slice(0, 140) ?? 'Automated QA report from FixFlags'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/share/${token}`,
      siteName: BRAND.name,
      images: [{ url: `/share/${token}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/share/${token}/opengraph-image`],
    },
  }
}

export default async function ShareLinkPage({ params }: Props) {
  const { token } = await params

  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      revoked: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      password: true,
      auditId: true,
      audit: {
        select: { id: true, isPublic: true },
      },
    },
  })

  if (!link || link.revoked) notFound()
  if (link.expiresAt && link.expiresAt < new Date()) notFound()
  if (link.maxViews && link.viewCount >= link.maxViews) notFound()

  if (!link.audit.isPublic) {
    await prisma.audit.update({
      where: { id: link.auditId },
      data: { isPublic: true },
    })
  }

  await prisma.shareLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  })

  if (!link.password) {
    redirect(`/report/${link.auditId}`)
  }

  return <ShareLinkPageClient token={token} auditId={link.auditId} />
}
