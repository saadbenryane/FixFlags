import { DocsPageFrame } from '@/components/docs/DocsPageFrame'
import { buildDocsMetadata, getDocsPage } from '@/lib/docs/catalog'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

const page = getDocsPage('mcp-tools')
export const metadata = buildDocsMetadata(page)

export default function McpToolReferencePage() {
  return (
    <DocsPageFrame page={page}>
      <section id="tools" className="scroll-mt-32">
        <p className="mb-8 leading-8 text-muted-foreground">
          This page is generated from the same canonical manifest used by the MCP server. Tool
          names and descriptions cannot drift from registered behavior.
        </p>
        <div className="space-y-4">
          {MCP_TOOL_DEFINITIONS.map((tool) => (
            <article
              key={tool.name}
              id={tool.name}
              className="scroll-mt-32 rounded-[var(--radius-card)] border border-border/60 p-5"
            >
              <h2 className="break-all font-mono text-base font-semibold text-foreground">
                {tool.name}
              </h2>
              <p className="mt-2 leading-7 text-muted-foreground">{tool.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </DocsPageFrame>
  )
}
