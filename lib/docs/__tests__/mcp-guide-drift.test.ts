import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyGeneratedBlocks } from '@/lib/docs/generated-blocks'
import { mcpToolNames } from '@/lib/docs/mcp-tool-reference'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'

/**
 * The published MCP guide is the contract an agent configures itself from. A tool
 * name that no longer exists is not a cosmetic error: a client that follows the
 * guide calls a name FixFlags will not answer, and the customer concludes FixFlags
 * is broken. So the guide is generated from the registry, and these tests exist to
 * fail the moment the two could disagree again.
 */
function renderedMcpGuide() {
  const source = path.join(process.cwd(), 'content', 'docs', 'mcp.md')
  return applyGeneratedBlocks(readFileSync(source, 'utf8'), 'mcp.md')
}

function renderedDocsIndex() {
  const source = path.join(process.cwd(), 'content', 'docs', 'index.md')
  return applyGeneratedBlocks(readFileSync(source, 'utf8'), 'index.md')
}

describe('published MCP guide', () => {
  it('shows the public guide link only when MCP discovery is open', () => {
    expect(renderedDocsIndex().includes('/docs/mcp')).toBe(MCP_IS_DISCOVERABLE)
  })

  it('names every tool FixFlags serves', () => {
    const guide = renderedMcpGuide()
    for (const name of mcpToolNames()) {
      expect(guide, `guide is missing the live tool ${name}`).toContain(`\`${name}\``)
    }
  })

  it('names no tool that FixFlags does not serve', () => {
    const guide = renderedMcpGuide()
    const named = [...guide.matchAll(/`([a-z]+[_.][a-z_]+)`/g)].map((match) => match[1])
    const known = new Set(mcpToolNames())
    const unknown = named.filter((token) => !known.has(token) && !token.startsWith('fixflags.'))
    expect(unknown, 'guide names a tool FixFlags does not serve').toEqual([])
  })

  it('ships no unresolved generated marker', () => {
    expect(renderedMcpGuide()).not.toMatch(/<!--\s*generated:/)
  })

  it('rejects a marker with no renderer instead of shipping a hole', () => {
    expect(() => applyGeneratedBlocks('<!-- generated:not-a-real-block -->', 'test.md')).toThrow(
      /not-a-real-block/,
    )
  })
})
