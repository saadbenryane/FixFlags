import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { McpGuideContent } from '@/components/help/McpGuideContent'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { HELP_CENTER, SITE_URL } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = {
  ...buildPageMetadata('mcp', '/help/mcp'),
  alternates: { canonical: `${SITE_URL}/help/mcp` },
}

export default function HelpMcpPage() {
  return (
    <Section spacing="default">
      <Container variant="content" className="space-y-10">
        <Link
          href="/help"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          ← {HELP_CENTER.backToHelp}
        </Link>
        <McpGuideContent />
        <HelpChatEscalate className="rounded-card glass-surface shadow-card p-5" />
      </Container>
    </Section>
  )
}
