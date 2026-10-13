import { prisma } from '@/lib/db'
import { readScreenshot } from '@/lib/storage/screenshots'

/** Read recorded captures from worker-owned storage, without a viewer session. */
export async function loadAuditScreenshotBase64(
  auditId: string
): Promise<{ desktopBase64: string | null; mobileBase64: string | null }> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      screenshots: { select: { device: true, url: true } },
    },
  })
  if (!audit) return { desktopBase64: null, mobileBase64: null }

  const desktop = audit.screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = audit.screenshots.find((s) => s.device === 'MOBILE')

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
    mobileBase64: await storedBase64(mobile?.url, 'mobile'),
  }
}
