import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { McpGuideContent } from '@/components/help/McpGuideContent'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { SITE_URL } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

/** Legacy URL: same content as /help/mcp; canonical points there. */
export const metadata = {
  ...buildPageMetadata('mcp', '/docs/mcp'),
  alternates: { canonical: `${SITE_URL}/help/mcp` },
}

export default function McpDocsPage() {
  return (
    <Section spacing="default">
      <Container variant="content" className="space-y-10">
        <McpGuideContent />
        <HelpChatEscalate className="rounded-card glass-surface shadow-card p-5" />
      </Container>
    </Section>
  )
}
