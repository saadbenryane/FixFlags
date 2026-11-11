import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageNextStep } from '@/components/marketing/public-site/PublicPage'
import { AgentConnectionPrompt } from '@/components/marketing/public-site/AgentConnectionPrompt'
import { AI_CONNECTION_COPY as C, AI_CONNECTION_PATH } from '@/lib/marketing/copy/ai-connection'
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
          <h2 id="connection-title" className="font-display text-3xl font-semibold tracking-display">{C.connection.title}</h2>
          <p className="leading-relaxed text-muted-foreground">{C.connection.body}</p>
          <ol className="list-decimal space-y-3 pl-5 leading-relaxed">{C.connection.steps.map(step => <li key={step}>{step}</li>)}</ol>
          <Link href={buildEditorSetupPath('cursor')} className="inline-flex min-h-11 items-center gap-2 font-medium text-link">{C.connection.action}<ArrowRight aria-hidden size={16} /></Link>
          <AgentConnectionPrompt />
          <p className="text-sm leading-relaxed text-muted-foreground">{C.connection.privacy}</p>
          <h3 className="font-display text-2xl font-semibold tracking-heading">{C.connection.workTitle}</h3>
          <p className="leading-relaxed text-muted-foreground">{C.connection.workBody}</p>
        </section>
      </Container>
    </Section>
    <PublicPageNextStep />
  </>
}
