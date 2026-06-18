import { NextResponse } from 'next/server'
import { SITE_URL, BRAND } from '@/lib/marketing/copy'

const MCP_ENDPOINT = `${SITE_URL.replace(/\/$/, '')}/api/mcp`

export async function GET() {
  return NextResponse.json({
    mcpServers: {
      [BRAND.mcpServerKey]: {
        url: MCP_ENDPOINT,
        headers: {
          'x-api-key': 'ff_live_your_key_here',
        },
      },
    },
  })
}
