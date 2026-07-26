import type { Prisma } from '@prisma/client'
import { getEntitlements } from '@/lib/auth/entitlements'
import { getCheckUsage, isAdminUser } from '@/lib/auth/permissions'

export const meUserSelect = {
  id: true,
  email: true,
  name: true,
  plan: true,
  role: true,
  auditsUsed: true,
  auditsLimit: true,
  subscriptionStatus: true,
  vibecodingLevel: true,
  preferredTools: true,
} satisfies Prisma.UserSelect

export type MeUserRecord = Prisma.UserGetPayload<{ select: typeof meUserSelect }>

export async function serializeMeUser(
  user: MeUserRecord,
  sessionUser?: { email?: string | null; name?: string | null }
) {
  const checks = await getCheckUsage(user)
  const entitlements = getEntitlements(user)

  return {
    id: user.id,
    email: user.email ?? sessionUser?.email ?? '',
    name: user.name ?? sessionUser?.name ?? null,
    plan: user.plan ?? 'FREE',
    role: user.role,
    isAdmin: isAdminUser(user),
    checks,
    entitlements,
    vibecodingLevel: user.vibecodingLevel,
    preferredTools: user.preferredTools,
  }
}
