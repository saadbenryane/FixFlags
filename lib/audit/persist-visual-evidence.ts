import { captureScreenshot } from './browser/capture-screenshot'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { MOBILE_CAPTURE_PROFILE, DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import {
  captureVisualEvidence,
  captureDeviceComparisonEvidence,
  captureRecordedFlowComparisonEvidence,
  type VisualEvidence,
  type VisualCaptureMetrics,
} from '@/lib/audit/capture/visual-capture'
import { getVisualDescriptor } from '@/lib/audit/capture/visual-types'
import { resolveAuditScanAccess } from '@/lib/audit/scan-access-store'
import type { FlowScanResult } from './flow/run-flow-scan'

export type FlagVisualEvidenceMap = Record<
  string,
  {
    gifUrl?: string | null
    overlayUrl?: string | null
    device: 'desktop' | 'mobile'
    type: VisualEvidence['type']
    sourceFrames?: VisualEvidence['sourceFrames']
  }
>

export async function persistFlagVisualEvidence(
  auditId: string,
  visuals: FlagVisualEvidenceMap
): Promise<void> {
  if (Object.keys(visuals).length === 0) return
  await executionTransaction(async tx => {

  const audit = await tx.audit.findUnique({
    where: { id: auditId },
    select: { performanceData: true },
  })
  if (!audit) return

  const existing =
    audit.performanceData && typeof audit.performanceData === 'object'
      ? (audit.performanceData as Record<string, unknown>)
      : {}

  await tx.audit.update({
    where: { id: auditId },
    data: {
      performanceData: {
        ...existing,
        flagVisualEvidence: visuals,
      } as never,
    },
  })
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
  metrics?: VisualCaptureMetrics,
  deadline?: number,
  flows: readonly FlowScanResult[] = [],
): Promise<void> {
  const captureDeadline = Math.min(deadline ?? Infinity, Date.now() + 60_000)
  if (Date.now() >= captureDeadline) return
  const candidates = [...new Map(flags.filter((f) => {
    const d = getVisualDescriptor(f.checkId)
    if (d.type === 'none') return false
    const sev = f.severity.toUpperCase()
    return sev === 'CRITICAL' || sev === 'IMPORTANT'
  }).map(flag => [flag.checkId, flag])).values()]
  if (candidates.length === 0) return

  try {
    const map: FlagVisualEvidenceMap = {}
    const frames: { desktop?: Buffer; mobile?: Buffer } = {}
    const needsComparison = candidates.some(flag => getVisualDescriptor(flag.checkId).sideBySideMode === 'desktop-mobile')
    const retain = (visuals: VisualEvidence[]) => {
      for (const visual of visuals) map[visual.checkId] = { gifUrl: visual.gifUrl, overlayUrl: visual.overlayUrl,
        device: visual.device, type: visual.type, ...(visual.sourceFrames ? { sourceFrames: visual.sourceFrames } : {}) }
    }
    retain(await captureRecordedFlowComparisonEvidence(auditId, candidates, flows, captureDeadline))
    const liveCandidates = candidates.filter(flag => getVisualDescriptor(flag.checkId).sideBySideMode !== 'source-destination')
    const browser = liveCandidates.length ? await getAuditBrowser() : null
    const scanAccess = browser ? await resolveAuditScanAccess(auditId) : null

    // Prefer mobile: most animated/overlay checks target mobile UX.
    for (const device of ['mobile', 'desktop'] as const) {
      if (Date.now() >= captureDeadline) break
      const selected = liveCandidates.filter(flag => {
        const descriptor = getVisualDescriptor(flag.checkId)
        return !map[flag.checkId] && (!descriptor.device || descriptor.device === 'both' || descriptor.device === device)
      })
      if (!browser || !selected.length) continue
      try {
        const session = await createAuditPage(browser, url, {
          profile: device === 'mobile' ? MOBILE_CAPTURE_PROFILE : DESKTOP_CAPTURE_PROFILE,
          settle: true, scanAccess, deadline: captureDeadline,
        })
        try {
          if (needsComparison) {
            try { frames[device] = await captureScreenshot(session.page, { type: 'png', fullPage: false }, captureDeadline) }
            catch (error) { logger.warn('Device comparison frame unavailable', { auditId, device, error }) }
          }
          const captured = await captureVisualEvidence(session.page, auditId, selected, device, metrics, captureDeadline)
          retain(captured.visuals)
        } finally {
          const context = session.page.context()
          await session.page.close().catch(() => {})
          await context.close().catch(() => {})
        }
      } catch (error) { logger.warn('Device visual evidence unavailable', { auditId, device, error }) }
    }

    retain(await captureDeviceComparisonEvidence(auditId, candidates, frames, captureDeadline))
    await persistFlagVisualEvidence(auditId, map)
  } catch (error) {
    logger.warn('Visual evidence capture skipped', { auditId, error })
  }
}
