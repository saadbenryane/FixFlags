import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { loadAdminEvidence } from '@/lib/admin/evidence'
import { adminPrivateHeaders } from '@/lib/admin/http'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { readScreenshot } from '@/lib/storage/screenshots'
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; screenshotId: string }> },
) {
  try {
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const { id, screenshotId } = await params,
      { audit } = await loadAdminEvidence(actor, id)
    const screenshot = audit.screenshots.find((s) => s.id === screenshotId)
    if (!screenshot) return apiError('Capture not found', 404)
    const bytes = await readScreenshot(
      audit.id,
      screenshot.device.toLowerCase(),
      screenshot.pageKey,
    )
    if (!bytes) return apiError('Capture unavailable', 404)
    return new NextResponse(new Uint8Array(bytes), {
      headers: { ...adminPrivateHeaders, 'Content-Type': 'image/png' },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
