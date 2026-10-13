import { requireAdminOrigin } from '@/lib/admin/http'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { previewAdminAction } from '@/lib/admin/action-service'
import { handleRouteError } from '@/lib/api/errors'

export async function POST(request: NextRequest) {
  try {
    requireAdminOrigin(request)
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    return NextResponse.json(await previewAdminAction(actor, await request.json()), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return handleRouteError(error, 'Could not prepare the action.')
  }
}
