import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { loadAdminEvidence } from '@/lib/admin/evidence'
import { adminPrivateHeaders } from '@/lib/admin/http'
import { handleRouteError } from '@/lib/api/errors'
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    return NextResponse.json(await loadAdminEvidence(actor, (await params).id), {
      headers: adminPrivateHeaders,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
