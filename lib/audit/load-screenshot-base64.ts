import { prisma } from '@/lib/db'

/** Load stored desktop/mobile screenshot URLs as base64 for AI prescription. */
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

  async function fetchBase64(url: string | undefined): Promise<string | null> {
    if (!url) return null
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      return buf.toString('base64')
    } catch {
      return null
    }
  }

  return {
    desktopBase64: await fetchBase64(desktop?.url),
    mobileBase64: await fetchBase64(mobile?.url),
  }
}
