import { NextRequest, NextResponse } from 'next/server'

export function redirectLegacyAuditApi(req: NextRequest, targetPath: string): NextResponse {
  const target = new URL(targetPath, req.url)
  return NextResponse.redirect(target, 308)
}
