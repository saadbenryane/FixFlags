import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { EditorMark } from '@/components/brand/EditorMarks'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { MarketingSectionHeader } from '@/components/marketing/MarketingSectionHeader'
import { AI_BUILDERS_PAGE as C, AI_BUILDER_TOOLS, type AiBuilderTool } from '@/lib/marketing/copy/ai-builders'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import s from '@/components/marketing/public-site/AiBuilders.module.css'

export const metadata = buildIndexableMetadata({ title: C.seo.title, description: C.seo.description, path: '/ai-builders' })

function ToolCard({ tool }: { tool: AiBuilderTool }) {
  return <li><Link href={`/ai-builders/${tool.slug}` as Route} className={s.toolCard}>
    <span className={s.toolTop}>{tool.mark ? <EditorMark name={tool.mark} className={s.toolMark} /> : <Sparkles className={s.toolMark} aria-hidden="true" />}<span className={s.toolKind}>{C.kinds[tool.kind]}</span></span>
    <span className={s.toolName}>{C.open(tool.name)}</span>
    <span className={s.toolSummary}>{tool.summary}</span>
    <ArrowRight className={s.toolArrow} size={16} aria-hidden="true" />
  </Link></li>
}

export default function AiBuildersPage() {
  return <>
    <MarketingPageViewTracker page="/ai-builders" />
    <PublicPageIntro page="/ai-builders" label={C.label} title={C.title} lines={C.titleLines} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing" className={s.stack}>
      <section aria-labelledby="ai-tools-title">
        <MarketingSectionHeader id="ai-tools-title" index={C.tools.index} label={C.tools.label} lines={C.tools.lines} />
        <ul className={s.toolGrid}>{AI_BUILDER_TOOLS.map(tool => <ToolCard key={tool.slug} tool={tool} />)}</ul>
      </section>
      <section aria-labelledby="ai-loop-title">
        <MarketingSectionHeader id="ai-loop-title" index={C.loopHeader.index} label={C.loopHeader.label} lines={C.loopHeader.lines} />
        <ol className={s.loop}>{C.loop.map((step, index) => <li key={step.label}><p className={s.loopHead}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{step.label}</p><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
      </section>
      <section aria-labelledby="ai-why-title">
        <MarketingSectionHeader id="ai-why-title" index={C.why.index} label={C.why.label} lines={C.why.lines} lede={C.why.body} align="split" />
      </section>
    </Container></Section>
  </>
}
