import { prisma } from '@/lib/db'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import type { SiteCapture } from '@/lib/sites/captures'

export async function loadSiteCaptures(auditId: string | null, priorId: string | null, active: boolean, startedAt: Date | null = null): Promise<SiteCapture[]> {
  const captures: SiteCapture[] = []
  for (const device of ['DESKTOP', 'MOBILE'] as const) {
    for (const sourceId of [...new Set([auditId, priorId].filter((id): id is string => Boolean(id)))]) {
      const shot = await prisma.screenshot.findFirst({
        where: { auditId: sourceId, device, OR: [{ pageId: null }, { page: { position: 0 } }] },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        select: { url: true, width: true, height: true, recordedAt: true,
          audit: { select: { url: true } }, page: { select: { url: true } } },
      })
      if (!shot?.url) continue
      captures.push({ url: normalizeInternalScreenshotUrl(shot.url), auditId: sourceId,
        device: device === 'DESKTOP' ? 'desktop' : 'mobile', previous: active && (sourceId !== auditId || !shot.recordedAt || Boolean(startedAt && shot.recordedAt < startedAt)),
        pageUrl: shot.page?.url ?? shot.audit.url, viewport: `${shot.width} × ${shot.height}`,
        recordedAt: shot.recordedAt?.toISOString() ?? null })
      break
    }
  }
  return captures
}

