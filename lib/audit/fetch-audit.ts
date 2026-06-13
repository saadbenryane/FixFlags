import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { canAccessAudit, gateAuditResponse, isPaidUser } from '@/lib/audit/access'

export const auditFullInclude = {
  areas: {
    include: {
      findings: {
        orderBy: { position: 'asc' as const },
      },
    },
    orderBy: { name: 'asc' as const },
  },
  screenshots: true,
} as const

async function fetchAuditRow(id: string) {
  return prisma.audit.findUnique({
    where: { id },
    include: auditFullInclude,
  })
}

/** Remove large JSON blobs not used by the audit UI. */
export function stripInternalAuditFields<T extends Record<string, unknown>>(audit: T) {
  const { htmlMetadata, performanceData, consoleErrors, ...rest } = audit
  void htmlMetadata
  void performanceData
  void consoleErrors
  return rest
}

export async function resolveSessionUser() {
  return auth.api.getSession({ headers: await headers() }).catch(() => null)
}

export async function resolveIsPaid(userId: string | undefined) {
  if (!userId) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  return isPaidUser(user)
}

export async function getGatedAuditForRequest(id: string) {
  const session = await resolveSessionUser()
  const audit = await fetchAuditRow(id)

  if (!audit) {
    return { kind: 'not_found' as const }
  }

  if (!canAccessAudit(audit, session?.user)) {
    return { kind: 'forbidden' as const }
  }

  const isPaid = await resolveIsPaid(session?.user?.id)
  const gated = gateAuditResponse(stripInternalAuditFields(audit), isPaid)

  return {
    kind: 'ok' as const,
    audit: gated,
    isPaid,
    isLoggedIn: !!session?.user,
    session,
  }
}
