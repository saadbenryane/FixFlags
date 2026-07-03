import { prisma } from '@/lib/db'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import {
  resolveEvidenceAnchorsWithBrowser,
  type EvidenceAnchorTarget,
  type EvidenceAnchorMap,
} from '@/lib/marketing/resolve-evidence-anchors'
import { flowCheckIdForStatus } from '@/lib/audit/flow/flow-evidence'
import type { FlowScanResult } from '@/lib/audit/flow/run-flow-scan'

export async function persistEvidenceAnchors(
  auditId: string,
  anchors: EvidenceAnchorMap
): Promise<void> {
  if (Object.keys(anchors).length === 0) return

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
        evidenceAnchors: anchors,
      } as never,
    },
  })

  const pages = await prisma.auditPage.findMany({
    where: { auditId },
    select: { id: true, performanceData: true },
  })

  for (const page of pages) {
    const pageExisting =
      page.performanceData && typeof page.performanceData === 'object'
        ? (page.performanceData as Record<string, unknown>)
        : {}

    await prisma.auditPage.update({
      where: { id: page.id },
      data: {
        performanceData: {
          ...pageExisting,
          evidenceAnchors: anchors,
        } as never,
      },
    })
  }
}

export async function mergeFlowCtaEvidenceAnchors(
  auditId: string,
  flowResult: FlowScanResult
): Promise<void> {
  if (!flowResult.ctaAnchor) return
  const checkId = flowCheckIdForStatus(flowResult.status)
  if (!checkId) return

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { performanceData: true },
  })
  if (!audit) return

  const existing =
    audit.performanceData && typeof audit.performanceData === 'object'
      ? (audit.performanceData as Record<string, unknown>)
      : {}
  const existingAnchors =
    existing.evidenceAnchors && typeof existing.evidenceAnchors === 'object'
      ? (existing.evidenceAnchors as EvidenceAnchorMap)
      : {}

  await persistEvidenceAnchors(auditId, {
    ...existingAnchors,
    [checkId]: {
      desktop: flowResult.ctaAnchor,
      mobile: flowResult.ctaAnchor,
    },
  })
}

export async function tryResolveEvidenceAnchorsForAudit(
  auditId: string,
  url: string,
  targets: Array<string | EvidenceAnchorTarget | null | undefined>
): Promise<void> {
  const normalizedTargets = targets
    .map((target) => {
      if (!target) return null
      return typeof target === 'string' ? { checkId: target } : target
    })
    .filter((target): target is EvidenceAnchorTarget => Boolean(target?.checkId))

  if (normalizedTargets.length === 0) return

  try {
    const browser = await getAuditBrowser()
    const anchors = await resolveEvidenceAnchorsWithBrowser(browser, {
      url,
      targets: normalizedTargets,
    })
    await persistEvidenceAnchors(auditId, anchors)
  } catch (error) {
    logger.warn('Evidence anchor resolution skipped', { auditId, error })
  }
}
