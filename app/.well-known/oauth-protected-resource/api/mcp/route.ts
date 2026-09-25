import { protectedResourceDocument } from '@/lib/mcp/oauth'

export function GET() {
  return Response.json(protectedResourceDocument(), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
  })
}
