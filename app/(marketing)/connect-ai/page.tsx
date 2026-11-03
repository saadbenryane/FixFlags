import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageNextStep } from '@/components/marketing/public-site/PublicPage'
import { AgentConnectionPrompt } from '@/components/marketing/public-site/AgentConnectionPrompt'
import { AI_CONNECTION_COPY as C, AI_CONNECTION_PATH } from '@/lib/marketing/copy/ai-connection'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'
import { buildEditorSetupPath } from '@/lib/integrations/editor-config'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('connectAi', AI_CONNECTION_PATH)

export default function ConnectAiPage() {
  return <>
    <PublicPageIntro page={AI_CONNECTION_PATH} label={C.label} title={C.title} body={C.description} />
    <Section spacing="overview">
      <Container variant="marketing">
        <div className="grid gap-10 md:grid-cols-3">
          {C.benefits.map(benefit => <section key={benefit.title} className="min-w-0">
            <h2 className="font-display text-2xl font-semibold tracking-heading">{benefit.title}</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{benefit.body}</p>
          </section>)}
        </div>
      </Container>
    </Section>
    <Section spacing="overview" tint="subtle">
      <Container variant="marketing">
        <section className="mx-auto max-w-3xl space-y-6" aria-labelledby="connection-title">
          {MCP_IS_DISCOVERABLE ? <>
            <h2 id="connection-title" className="font-display text-3xl font-semibold tracking-display">{C.connection.available.title}</h2>
            <p className="leading-relaxed text-muted-foreground">{C.connection.available.body}</p>
            <ol className="list-decimal space-y-3 pl-5 leading-relaxed">{C.connection.available.steps.map(step => <li key={step}>{step}</li>)}</ol>
            <Link href={buildEditorSetupPath('cursor')} className="inline-flex min-h-11 items-center gap-2 font-medium text-link">{C.connection.available.action}<ArrowRight aria-hidden size={16} /></Link>
            <AgentConnectionPrompt />
            <p className="text-sm leading-relaxed text-muted-foreground">{C.connection.privacy}</p>
            <h3 className="font-display text-2xl font-semibold tracking-heading">{C.connection.workTitle}</h3>
            <p className="leading-relaxed text-muted-foreground">{C.connection.workBody}</p>
          </> : <>
            <h2 id="connection-title" className="font-display text-3xl font-semibold tracking-display">{C.connection.unavailable.title}</h2>
            <p className="leading-relaxed text-muted-foreground">{C.connection.unavailable.body}</p>
            <Link href="/docs/fix-with-ai" className="inline-flex min-h-11 items-center gap-2 font-medium text-link">{C.connection.unavailable.action}<ArrowRight aria-hidden size={16} /></Link>
            <details className="pt-4">
              <summary className="min-h-11 cursor-pointer rounded-control text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{C.connection.unavailable.existing}</summary>
              <p className="mb-5 mt-3 text-sm leading-relaxed text-muted-foreground">{C.connection.unavailable.existingBody}</p>
              <AgentConnectionPrompt />
            </details>
          </>}
        </section>
      </Container>
    </Section>
    <Section spacing="overview">
      <Container variant="marketing">
        <h2 className="font-display text-3xl font-semibold tracking-display">{C.current.title}</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">{C.current.steps.map(step => <li key={step.title} className="min-w-0">
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="mt-3 leading-relaxed text-muted-foreground">{step.body}</p>
        </li>)}</ol>
      </Container>
    </Section>
    <PublicPageNextStep />
  </>
}
