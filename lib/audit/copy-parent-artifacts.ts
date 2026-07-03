import { prisma } from '@/lib/db'

/** Copy parent screenshots and performance metadata for summary-only monitoring. */
export async function copyParentArtifacts(
  auditId: string,
  parentId: string
): Promise<{ desktopScreenshot: boolean; mobileScreenshot: boolean }> {
  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: {
      htmlMetadata: true,
      performanceData: true,
      consoleErrors: true,
      screenshots: {
        select: { device: true, url: true, width: true, height: true, pageId: true },
      },
      pages: {
        select: { id: true, url: true, normalizedUrl: true, position: true, role: true },
        orderBy: { position: 'asc' },
      },
    },
  })
  if (!parent) throw new Error(`Parent audit ${parentId} not found`)

  const primaryPage = await prisma.auditPage.create({
    data: {
      auditId,
      url: parent.pages[0]?.url ?? '',
      normalizedUrl: parent.pages[0]?.normalizedUrl ?? '',
      position: 0,
      role: 'primary',
      status: 'CHECKING',
      htmlMetadata: parent.htmlMetadata ?? undefined,
      performanceData: parent.performanceData ?? undefined,
      consoleErrors: parent.consoleErrors ?? undefined,
    },
  })

  let desktopScreenshot = false
  let mobileScreenshot = false

  for (const shot of parent.screenshots) {
    await prisma.screenshot.create({
      data: {
        auditId,
        pageId: primaryPage.id,
        device: shot.device,
        url: shot.url,
        width: shot.width,
        height: shot.height,
      },
    })
    if (shot.device === 'DESKTOP') desktopScreenshot = true
    if (shot.device === 'MOBILE') mobileScreenshot = true
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      htmlMetadata: parent.htmlMetadata ?? undefined,
      performanceData: parent.performanceData ?? undefined,
      consoleErrors: parent.consoleErrors ?? undefined,
      status: 'CHECKING',
      progress: 38,
    },
  })

  return { desktopScreenshot, mobileScreenshot }
}

export async function loadParentScreenshotBase64(
  parentId: string
): Promise<{ desktopBase64: string | null; mobileBase64: string | null }> {
  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: {
      screenshots: { select: { device: true, url: true } },
    },
  })
  if (!parent) return { desktopBase64: null, mobileBase64: null }

  const desktop = parent.screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = parent.screenshots.find((s) => s.device === 'MOBILE')

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
