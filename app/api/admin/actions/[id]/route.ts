import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { loadAdminOperation } from '@/lib/admin/action-service'
import { handleRouteError } from '@/lib/api/errors'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    return NextResponse.json(await loadAdminOperation(actor, (await params).id), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load the action.')
  }
}
