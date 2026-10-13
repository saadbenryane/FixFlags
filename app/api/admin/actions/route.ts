import { requireAdminOrigin } from '@/lib/admin/http'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { admitAdminAction } from '@/lib/admin/action-service'
import { handleRouteError } from '@/lib/api/errors'

export async function POST(request: NextRequest) {
  try {
    requireAdminOrigin(request)
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const operation = await admitAdminAction(actor, await request.json())
    return NextResponse.json(operation, {
      status: operation.status === 'QUEUED' || operation.status === 'RUNNING' ? 202 : 200,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return handleRouteError(error, 'Could not admit the action.')
  }
}
