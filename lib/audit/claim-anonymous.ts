import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { ANON_AUDIT_IDS_COOKIE } from '@/lib/audit/usage'
import { hasUnlimitedScans } from '@/lib/auth/permissions'

function readAnonAuditIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export async function claimAnonymousAudits(userId: string): Promise<number> {
  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)
  if (ids.length === 0) return 0

  const audits = await prisma.audit.findMany({
    where: {
      id: { in: ids },
      userId: null,
    },
    select: { id: true, status: true },
  })

  if (audits.length === 0) {
    cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
    return 0
  }

  const completedCount = audits.filter((a) => a.status === 'COMPLETED').length

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  const shouldIncrement = completedCount > 0 && user && !hasUnlimitedScans(user)

  await prisma.$transaction([
    prisma.audit.updateMany({
      where: { id: { in: audits.map((a) => a.id) } },
      data: { userId },
    }),
    ...(shouldIncrement
      ? [
          prisma.user.update({
            where: { id: userId },
            data: { auditsUsed: { increment: completedCount } },
          }),
        ]
      : []),
  ])

  cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
  return audits.length
}
