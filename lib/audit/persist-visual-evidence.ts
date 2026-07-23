import { prisma } from '@/lib/db'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { MOBILE_CAPTURE_PROFILE, DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import {
  captureVisualEvidence,
  type VisualEvidence,
  type VisualCaptureMetrics,
} from '@/lib/audit/capture/visual-capture'
import { getVisualDescriptor } from '@/lib/audit/capture/visual-types'
import { resolveAuditScanAccess } from '@/lib/audit/scan-access-store'

export type FlagVisualEvidenceMap = Record<
  string,
  {
    gifUrl?: string | null
    overlayUrl?: string | null
    device: 'desktop' | 'mobile'
    type: VisualEvidence['type']
  }
>

export async function persistFlagVisualEvidence(
  auditId: string,
  visuals: FlagVisualEvidenceMap
): Promise<void> {
  if (Object.keys(visuals).length === 0) return

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { performanceData: true },
  })
  if (!audit) return

  const existing =
    audit.performanceData && typeof audit.performanceData === 'object'
      ? (audit.performanceData as Record<string, unknown>)
      : {}

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      performanceData: {
        ...existing,
        flagVisualEvidence: visuals,
      } as never,
    },
  })
}

export function parseFlagVisualEvidence(
  performanceData: unknown
): FlagVisualEvidenceMap {
  if (!performanceData || typeof performanceData !== 'object') return {}
  const data = performanceData as Record<string, unknown>
  const raw = data.flagVisualEvidence
  if (!raw || typeof raw !== 'object') return {}
  return raw as FlagVisualEvidenceMap
}

export async function tryCaptureVisualEvidenceForAudit(
  auditId: string,
  url: string,
  flags: Array<{ checkId: string; severity: string; rubric: string }>,
  metrics?: VisualCaptureMetrics
): Promise<void> {
  const candidates = flags.filter((f) => {
    const d = getVisualDescriptor(f.checkId)
    if (d.type === 'none') return false
    const sev = f.severity.toUpperCase()
    return sev === 'CRITICAL' || sev === 'IMPORTANT'
  })
  if (candidates.length === 0) return

  try {
    const browser = await getAuditBrowser()
    const map: FlagVisualEvidenceMap = {}
    const scanAccess = await resolveAuditScanAccess(auditId)

    // Prefer mobile: most animated/overlay checks target mobile UX.
    const mobileSession = await createAuditPage(browser, url, {
      profile: MOBILE_CAPTURE_PROFILE,
      settle: true,
      scanAccess,
    })
    try {
      const mobileResult = await captureVisualEvidence(
        browser,
        mobileSession.page,
        auditId,
        candidates,
        'mobile',
        metrics,
        scanAccess
      )
      for (const v of mobileResult.visuals) {
        map[v.checkId] = {
          gifUrl: v.gifUrl,
          overlayUrl: v.overlayUrl,
          device: v.device,
          type: v.type,
        }
      }
    } finally {
      const ctx = mobileSession.page.context()
      await mobileSession.page.close().catch(() => {})
      await ctx.close().catch(() => {})
    }

    const remaining = candidates.filter((f) => !map[f.checkId])
    const needsDesktop = remaining.some((f) => {
      const d = getVisualDescriptor(f.checkId)
      return d.device === 'desktop' || d.device === 'both' || !d.device
    })

    if (needsDesktop && remaining.length > 0) {
      const desktopSession = await createAuditPage(browser, url, {
        profile: DESKTOP_CAPTURE_PROFILE,
        settle: true,
        scanAccess,
      })
      try {
        const desktopResult = await captureVisualEvidence(
          browser,
          desktopSession.page,
          auditId,
          remaining,
          'desktop',
          metrics,
          scanAccess
        )
        for (const v of desktopResult.visuals) {
          if (!map[v.checkId]) {
            map[v.checkId] = {
              gifUrl: v.gifUrl,
              overlayUrl: v.overlayUrl,
              device: v.device,
              type: v.type,
            }
          }
        }
      } finally {
        const ctx = desktopSession.page.context()
        await desktopSession.page.close().catch(() => {})
        await ctx.close().catch(() => {})
      }
    }

    await persistFlagVisualEvidence(auditId, map)
  } catch (error) {
    logger.warn('Visual evidence capture skipped', { auditId, error })
  }
}
