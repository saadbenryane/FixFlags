import { renderMcpToolReference } from '@/lib/docs/mcp-tool-reference'
import { PUBLIC_OFFER } from '@/lib/marketing/copy/public-offer'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'
import { SITE_URL } from '@/lib/marketing/copy/brand'

/**
 * Facts a document must state from the code that owns them, not from a copy.
 *
 * A marker in a source file is replaced with the live rendering. An unknown marker
 * throws rather than shipping a page with a silent hole in it, because a page that
 * quietly lost its content reads as deliberate.
 */
const GENERATED_BLOCKS: Record<string, () => string> = {
  'mcp-connection': () => [
    `The remote endpoint is \`${SITE_URL.replace(/\/$/, '')}/api/mcp\`, using Streamable HTTP. Send an authorized credential in the \`Authorization: Bearer <credential>\` header on every request. Never put a credential in a URL.`,
    '',
    'Clients can discover the OAuth authorization server from the endpoint\'s unauthenticated `401` response and its `WWW-Authenticate` resource metadata URL. Connection setup and consent require the account owner; subsequent tool calls do not require the dashboard to remain open.',
  ].join('\n'),
  'mcp-guide-link': () => MCP_IS_DISCOVERABLE
    ? '- [MCP for coding agents](/docs/mcp) for independent verification after a change.'
    : '',
  'mcp-availability': () => MCP_IS_DISCOVERABLE
    ? 'You can connect a coding agent to FixFlags with MCP. It reads the problems on your saved website and asks FixFlags to check again after a change. See [MCP for coding agents](/docs/mcp) to set it up. You can also copy and paste fix instructions without setting up a connection.'
    : 'New FixFlags MCP connections are not available yet. You can copy and paste fix instructions now, without setting up a connection.',
  'mcp-tools': renderMcpToolReference,
  'public-offer': () => [PUBLIC_OFFER.free, PUBLIC_OFFER.availability, PUBLIC_OFFER.usage, '[See pricing](/pricing).'].join(' '),
}

export function applyGeneratedBlocks(markdown: string, source: string): string {
  return markdown.replace(/<!--\s*generated:([a-z0-9-]+)\s*-->/g, (_match, key: string) => {
    const render = GENERATED_BLOCKS[key]
    if (!render) throw new Error(`Unknown generated docs block "${key}" in ${source}`)
    return render()
  })
}
