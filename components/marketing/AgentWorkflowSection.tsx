import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { MCP_SECTION } from '@/lib/marketing/copy'

export function AgentWorkflowSection() {
  return (
    <Section spacing="default" className="bg-muted/35" id="agent-workflow">
      <Container>
        <PageGrid align="start">
          <PageGridCol span="intro" className="space-y-6">
            <SectionIntro
              align="left"
              headline={MCP_SECTION.headline}
              subhead={MCP_SECTION.body}
            />
            <Button variant="outline" asChild>
              <Link href="/docs/mcp">
                {MCP_SECTION.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </PageGridCol>
          <PageGridCol span="content" className="space-y-4">
            <p className="text-sm text-muted-foreground">{MCP_SECTION.intro}</p>
            <TerminalBlock label="Agent workflow">{MCP_SECTION.workflow}</TerminalBlock>
            <p className="text-sm font-medium text-foreground">{MCP_SECTION.closing}</p>
          </PageGridCol>
        </PageGrid>
      </Container>
    </Section>
  )
}
