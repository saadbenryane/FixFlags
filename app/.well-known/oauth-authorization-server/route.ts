import { authorizationServerDocument } from '@/lib/mcp/oauth'

export function GET() {
  return Response.json(authorizationServerDocument(), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
  })
}
