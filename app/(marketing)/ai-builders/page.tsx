import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { EditorMark } from '@/components/brand/EditorMarks'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { AI_BUILDERS_PAGE as C, AI_BUILDER_TOOLS, type AiBuilderTool } from '@/lib/marketing/copy/ai-builders'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import s from '@/components/marketing/public-site/AiBuilders.module.css'

export const metadata = buildIndexableMetadata({ title: C.seo.title, description: C.seo.description, path: '/ai-builders' })

function ToolCard({ tool }: { tool: AiBuilderTool }) {
  return <li><Link href={`/ai-builders/${tool.slug}` as Route} className={s.toolCard}>
    {tool.mark ? <EditorMark name={tool.mark} className={s.toolMark} /> : <Sparkles className={s.toolMark} aria-hidden="true" />}
    <span className={s.toolName}>{C.open(tool.name)}</span>
    <span className={s.toolSummary}>{tool.summary}</span>
    <ArrowRight className={s.toolArrow} size={16} aria-hidden="true" />
  </Link></li>
}

export default function AiBuildersPage() {
  const builders = AI_BUILDER_TOOLS.filter(tool => tool.kind === 'builder')
  const agents = AI_BUILDER_TOOLS.filter(tool => tool.kind === 'agent')
  return <>
    <MarketingPageViewTracker page="/ai-builders" />
    <PublicPageIntro page="/ai-builders" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing" className={s.stack}>
      <section aria-labelledby="ai-tools-title">
        <h2 id="ai-tools-title" className={s.heading}>{C.toolsTitle}</h2>
        <h3 className={s.groupTitle}>{C.builders}</h3>
        <ul className={s.toolGrid}>{builders.map(tool => <ToolCard key={tool.slug} tool={tool} />)}</ul>
        <h3 className={s.groupTitle}>{C.agents}</h3>
        <ul className={s.toolGrid}>{agents.map(tool => <ToolCard key={tool.slug} tool={tool} />)}</ul>
      </section>
      <section aria-labelledby="ai-loop-title">
        <h2 id="ai-loop-title" className={s.heading}>{C.loopTitle}</h2>
        <ol className={s.loop}>{C.loop.map((step, index) => <li key={step.label}><p className={s.loopHead}><span aria-hidden="true">{index + 1}</span>{step.label}</p><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
      </section>
      <section className={s.why} aria-labelledby="ai-why-title">
        <h2 id="ai-why-title" className={s.heading}>{C.why.title}</h2>
        <p>{C.why.body}</p>
      </section>
    </Container></Section>
  </>
}
