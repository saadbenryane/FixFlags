import { prisma } from '@/lib/db'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import type { SiteCapture } from '@/lib/sites/captures'

export async function loadSiteCheckedPages(auditId: string) {
  const pages = await prisma.auditPage.findMany({
    where: { auditId }, orderBy: { position: 'asc' },
    select: { url: true, title: true, status: true, updatedAt: true,
      screenshots: { where: { auditId }, orderBy: [{ device: 'asc' }, { recordedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], take: 1,
        select: { url: true, width: true, height: true, recordedAt: true } },
    },
  })
  return pages.map(({ screenshots, ...page }) => {
    const shot = screenshots[0]
    const url = shot ? normalizeInternalScreenshotUrl(shot.url) : null
    return { ...page, capture: shot && url?.startsWith(`/api/screenshots/${auditId}/`) ? {
      url, viewport: `${shot.width} × ${shot.height}`, recordedAt: shot.recordedAt?.toISOString() ?? null,
    } : null }
  })
}

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
        device: device === 'DESKTOP' ? 'desktop' : 'mobile', previous: sourceId !== auditId || active && (!shot.recordedAt || Boolean(startedAt && shot.recordedAt < startedAt)),
        pageUrl: shot.page?.url ?? shot.audit.url, viewport: `${shot.width} × ${shot.height}`,
        recordedAt: shot.recordedAt?.toISOString() ?? null })
      break
    }
  }
  return captures
}

