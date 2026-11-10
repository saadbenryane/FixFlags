import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { AuditInput } from '@/components/audit/AuditInput'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { PublicPageIntro } from '@/components/marketing/public-site/PublicPage'
import { AiBuilderExample } from '@/components/marketing/public-site/AiBuilderExample'
import { AI_BUILDERS_PAGE as C, AI_BUILDER_TOOLS, aiBuilderExamplePrompt, getAiBuilderTool } from '@/lib/marketing/copy/ai-builders'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import s from '@/components/marketing/public-site/AiBuilders.module.css'

type Props = { params: Promise<{ tool: string }> }

export function generateStaticParams() {
  return AI_BUILDER_TOOLS.map(tool => ({ tool: tool.slug }))
}

export async function generateMetadata({ params }: Props) {
  const tool = getAiBuilderTool((await params).tool)
  if (!tool) notFound()
  const seo = C.seo.tool(tool.name)
  return buildIndexableMetadata({ title: seo.title, description: seo.description, path: `/ai-builders/${tool.slug}` })
}

export default async function AiBuilderToolPage({ params }: Props) {
  const tool = getAiBuilderTool((await params).tool)
  if (!tool) notFound()
  const others = AI_BUILDER_TOOLS.filter(other => other.slug !== tool.slug)
  return <>
    <MarketingPageViewTracker page={`/ai-builders/${tool.slug}`} />
    <PublicPageIntro page={`/ai-builders/${tool.slug}`} label={C.tool.label(tool.name)} title={C.tool.title(tool.name)} body={tool.summary}>
      <div className={s.entry}><AuditInput variant="landing" idSuffix={`-ai-${tool.slug}`} ctaPlacement="hero" showLandingExtras={false} submitLabel={C.tool.cta} /></div>
    </PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing" className={s.stack}>
      <Link href={'/ai-builders' as Route} className={s.back}><ArrowLeft size={16} aria-hidden="true" />{C.tool.back}</Link>
      <section aria-labelledby="tool-steps-title">
        <h2 id="tool-steps-title" className={s.heading}>{C.tool.stepsTitle}</h2>
        <ol className={s.loop}>{C.tool.steps(tool).map((step, index) => <li key={step.title}><span aria-hidden="true">{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
      </section>
      <AiBuilderExample toolName={tool.name} flag={tool.example.flag} prompt={aiBuilderExamplePrompt(tool)} />
      <aside className={s.tip} aria-label={C.tool.tipTitle}><Lightbulb size={18} aria-hidden="true" /><p><strong>{C.tool.tipTitle}.</strong> {tool.tip}</p></aside>
      <nav aria-labelledby="other-tools-title">
        <h2 id="other-tools-title" className={s.heading}>{C.tool.other}</h2>
        <ul className={s.otherTools}>{others.map(other => <li key={other.slug}><Link href={`/ai-builders/${other.slug}` as Route}>{other.name}<ArrowRight size={14} aria-hidden="true" /></Link></li>)}</ul>
      </nav>
    </Container></Section>
  </>
}
