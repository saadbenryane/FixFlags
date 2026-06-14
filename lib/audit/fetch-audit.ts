import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveReportTierForAudit } from '@/lib/auth/entitlements'
import {
  deriveScreenshotCaptureStatus,
  parseScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'

function parsePageSpeedErrors(performanceData: unknown): {
  desktopError?: string
  mobileError?: string
  pageSpeedPartial?: boolean
} {
  if (!performanceData || typeof performanceData !== 'object') return {}
  const data = performanceData as Record<string, unknown>
  const desktopError =
    typeof data.desktopError === 'string' ? data.desktopError : undefined
  const mobileError =
    typeof data.mobileError === 'string' ? data.mobileError : undefined
  const pageSpeedPartial =
    Boolean(desktopError || mobileError) ||
    data.desktop === null ||
    data.mobile === null
  return { desktopError, mobileError, pageSpeedPartial }
}

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

export async function resolveIsPaidForAudit(
  audit: { userId: string | null; isPublic: boolean },
  sessionUser?: { id: string } | null
): Promise<boolean> {
  const tier = await resolveReportTierForAudit(audit, sessionUser)
  return tier === 'paid'
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

  const isPaid = await resolveIsPaidForAudit(audit, session?.user)
  const stripped = stripInternalAuditFields(audit)
  const launchReadiness = parseLaunchReadiness(audit.launchReadiness)
  const pageSpeed = parsePageSpeedErrors(audit.performanceData)

  const storedCapture = parseScreenshotCaptureStatus(audit.performanceData)
  const screenshotCapture = deriveScreenshotCaptureStatus(
    audit.status,
    audit.screenshots,
    storedCapture
  )

  return {
    kind: 'ok' as const,
    audit: {
      ...stripped,
      screenshotCapture,
      launchReadiness,
      pageSpeedErrors: pageSpeed,
    },
    isPaid,
    isLoggedIn: !!session?.user,
    session,
  }
}
