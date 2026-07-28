import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { resolveAuditAccess } from '@/lib/audit/access'
import { SHARE_GRANT_COOKIE } from '@/lib/security/share-grant'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { readScreenshot } from '@/lib/storage/screenshots'

const VALID_DEVICES = new Set(['desktop', 'mobile'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ auditId: string; device: string }> }
) {
  try {
    const { auditId, device } = await params
    if (!VALID_DEVICES.has(device)) {
      return apiError('Invalid device', 400)
    }

    const session = await resolveSessionUser()
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { id: true, userId: true, isPublic: true },
    })

    if (!audit) {
      return apiError('Audit not found', 404)
    }

    const access = await resolveAuditAccess(
      audit,
      session?.user,
      (await cookies()).get(SHARE_GRANT_COOKIE)?.value
    )
    if (access === 'denied') {
      return apiError('You do not have access to this report', 403)
    }

    const pageKey = req.nextUrl.searchParams.get('page')
    if (pageKey && !/^[a-zA-Z0-9_-]{1,80}$/.test(pageKey)) {
      return apiError('Invalid page key', 400)
    }

    // Backing store differs by env (bucket in prod, disk in dev); both stream
    // through this access-controlled route since the store is not public.
    const buffer = await readScreenshot(auditId, device, pageKey)
    if (!buffer) {
      return apiError('Screenshot not found', 404)
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
