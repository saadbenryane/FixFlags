import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { getLocalScreenshotPath } from '@/lib/storage/screenshots'

const VALID_DEVICES = new Set(['desktop', 'mobile'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ auditId: string; device: string }> }
) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return apiError('Not found', 404)
    }

    const { auditId, device } = await params
    if (!VALID_DEVICES.has(device)) {
      return apiError('Invalid device', 400)
    }

    const session = await resolveSessionUser()
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { userId: true, isPublic: true },
    })

    if (!audit) {
      return apiError('Audit not found', 404)
    }

    if (!canAccessAudit(audit, session?.user)) {
      return apiError('You do not have access to this audit', 403)
    }

    const pageKey = req.nextUrl.searchParams.get('page')
    if (pageKey && !/^[a-zA-Z0-9_-]{1,80}$/.test(pageKey)) {
      return apiError('Invalid page key', 400)
    }
    const filePath = getLocalScreenshotPath(auditId, device, pageKey)
    try {
      const buffer = await fs.readFile(filePath)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'private, max-age=3600',
        },
      })
    } catch {
      return apiError('Screenshot not found', 404)
    }
  } catch (err) {
    return handleRouteError(err)
  }
}
