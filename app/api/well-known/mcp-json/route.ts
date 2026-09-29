import { NextResponse } from 'next/server'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

/**
 * The one machine-readable description of the MCP server.
 *
 * It used to be a hand-maintained file in `public/.well-known/` that named eighteen
 * tools FixFlags does not serve, described a product framing that has since been
 * replaced, and advertised four repository-scan tools that are explicitly parked.
 * A client that reads a discovery document trusts it, so a wrong one is worse than
 * none. Both the tool list and the product description are therefore derived from the
 * code that owns them, which means this document cannot describe a different product
 * or a tool that does not exist.
 *
 * Reachability is decided by `lib/mcp/discoverability.ts`, not here. This route stays
 * correct for whoever reaches it; whether anyone should is a separate decision.
 */
const MCP_ENDPOINT = `${SITE_URL.replace(/\/$/, '')}/api/mcp`

export async function GET() {
  return NextResponse.json(
    {
      schemaVersion: 1,
      mcpServers: {
        [BRAND.mcpServerKey]: {
          name: BRAND.name,
          description: BRAND.oneLiner,
          url: MCP_ENDPOINT,
          transport: 'streamable-http',
          tools: MCP_TOOL_DEFINITIONS.map((tool) => ({
            name: tool.name,
            description: tool.desc,
            scope: tool.scope,
            readOnly: tool.readOnly,
          })),
        },
      },
    },
    { headers: { 'cache-control': 'public, max-age=300' } }
  )
}
