import { renderMcpToolReference } from '@/lib/docs/mcp-tool-reference'

/**
 * Facts a document must state from the code that owns them, not from a copy.
 *
 * A marker in a source file is replaced with the live rendering. An unknown marker
 * throws rather than shipping a page with a silent hole in it, because a page that
 * quietly lost its content reads as deliberate.
 */
const GENERATED_BLOCKS: Record<string, () => string> = {
  'mcp-tools': renderMcpToolReference,
}

export function applyGeneratedBlocks(markdown: string, source: string): string {
  return markdown.replace(/<!--\s*generated:([a-z0-9-]+)\s*-->/g, (_match, key: string) => {
    const render = GENERATED_BLOCKS[key]
    if (!render) throw new Error(`Unknown generated docs block "${key}" in ${source}`)
    return render()
  })
}
