import { cookies } from 'next/headers'
import { User } from '@prisma/client'
import { prisma } from '@/lib/db'

const ANON_COOKIE = 'qos_anon_audits'
export const ANON_AUDIT_LIMIT = 1

export async function checkAnonymousAuditAllowed(): Promise<{ allowed: boolean; error?: string }> {
  const cookieStore = await cookies()
  const used = parseInt(cookieStore.get(ANON_COOKIE)?.value ?? '0', 10)
  if (used >= ANON_AUDIT_LIMIT) {
    return {
      allowed: false,
      error: 'Free audit limit reached. Sign up for 3 free audits per month.',
    }
  }
  return { allowed: true }
}

export async function markAnonymousAuditCreated(): Promise<void> {
  const cookieStore = await cookies()
  const used = parseInt(cookieStore.get(ANON_COOKIE)?.value ?? '0', 10)
  cookieStore.set(ANON_COOKIE, String(used + 1), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  })
}

export async function checkUserAuditAllowed(
  user: Pick<User, 'id' | 'auditsUsed' | 'auditsLimit'>
): Promise<{ allowed: boolean; error?: string }> {
  const pending = await prisma.audit.count({
    where: {
      userId: user.id,
      status: { notIn: ['COMPLETED', 'FAILED'] },
    },
  })

  if (user.auditsUsed + pending >= user.auditsLimit) {
    return {
      allowed: false,
      error: 'Audit limit reached. Upgrade to continue.',
    }
  }
  return { allowed: true }
}

export async function incrementUsageOnComplete(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { auditsUsed: { increment: 1 } },
  })
}

export async function resetUsageIfNewPeriod(
  userId: string,
  stripeCurrentPeriodEnd: Date | null
): Promise<void> {
  if (!stripeCurrentPeriodEnd) return
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCurrentPeriodEnd: true, auditsUsed: true },
  })
  if (!user?.stripeCurrentPeriodEnd) return
  if (stripeCurrentPeriodEnd > user.stripeCurrentPeriodEnd) {
    await prisma.user.update({
      where: { id: userId },
      data: { auditsUsed: 0, stripeCurrentPeriodEnd },
    })
  }
}
