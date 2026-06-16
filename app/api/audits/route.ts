import { NextRequest } from 'next/server'
import { redirectLegacyAuditApi } from '@/lib/api/redirect-legacy-audit'

export async function POST(req: NextRequest) {
  return redirectLegacyAuditApi(req, '/api/checks')
}
