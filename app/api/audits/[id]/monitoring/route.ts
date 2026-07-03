import { NextRequest } from 'next/server'
import { redirectLegacyAuditApi } from '@/lib/api/redirect-legacy-audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return redirectLegacyAuditApi(req, `/api/reports/${id}/monitoring`)
}
