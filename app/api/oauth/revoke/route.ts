import { NextRequest, NextResponse } from 'next/server'
import { revokeCredential } from '@/lib/mcp/oauth'

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  const token = body ? String(body.get('token') ?? '') : ''
  if (token) await revokeCredential(token)
  return new NextResponse(null, { status: 200 })
}
