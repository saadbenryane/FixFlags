import { prisma } from '@/lib/db'
import { readScreenshot } from '@/lib/storage/screenshots'

/** Read recorded captures from worker-owned storage, without a viewer session. */
export async function loadAuditScreenshotBase64(
  auditId: string
): Promise<{ desktopBase64: string | null; mobileBase64: string | null }> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      url: true,
      screenshots: {
        where: { OR: [{ page: { position: 0 } }, { pageId: null }] },
        orderBy: [{ recordedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        select: { device: true, url: true, page: { select: { url: true, position: true } } },
      },
    },
  })
  if (!audit) return { desktopBase64: null, mobileBase64: null }

  const primaryCaptures = audit.screenshots.filter(capture => {
    try {
      if (capture.page) return capture.page.position === 0 && new URL(capture.page.url).toString() === new URL(audit.url).toString()
      // Historical root captures lack a page relation. Only their root names
      // establish primary scope; a linked or journey capture cannot substitute.
      const key = new URL(capture.url).searchParams.get('page')
      return key === null || /^(?:capture-)?p0(?:-g[0-9]+)?$/.test(key)
    } catch { return false }
  })
  const desktop = primaryCaptures.find((s) => s.device === 'DESKTOP')
  const mobile = primaryCaptures.find((s) => s.device === 'MOBILE')
  let matchingMobile = false
  try {
    matchingMobile = Boolean(desktop && mobile && new URL(desktop.url).searchParams.get('page') === new URL(mobile.url).searchParams.get('page'))
  } catch { /* An invalid reference cannot identify the same capture generation. */ }

  async function storedBase64(url: string | undefined, device: 'desktop' | 'mobile'): Promise<string | null> {
    if (!url) return null
    try {
      const reference = new URL(url)
      if (reference.pathname !== `/api/screenshots/${auditId}/${device}`) return null
      const pageKey = reference.searchParams.get('page')
      if (pageKey && !/^[a-zA-Z0-9_-]{1,80}$/.test(pageKey)) return null
      const bytes = await readScreenshot(auditId, device, pageKey)
      return bytes?.toString('base64') ?? null
    } catch {
      return null
    }
  }

  return {
    desktopBase64: await storedBase64(desktop?.url, 'desktop'),
    mobileBase64: matchingMobile ? await storedBase64(mobile?.url, 'mobile') : null,
  }
}
