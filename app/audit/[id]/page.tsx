import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AuditPageClient } from '@/components/audit/AuditPageClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AuditPage({ params }: Props) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  let isPaid = false
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } })
    isPaid = user?.plan !== 'FREE' && user?.plan != null
  }

  return (
    <AuditPageClient
      id={id}
      isPaid={isPaid}
      isLoggedIn={!!session?.user}
      session={session}
    />
  )
}
