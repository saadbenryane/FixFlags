import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { FREE_TOOLS_PAGE as C } from '@/lib/marketing/copy/free-tools'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from '@/components/marketing/public-site/AiBuilders.module.css'

export const metadata = buildPageMetadata('freeTools', '/tools')

export default function FreeToolsPage() {
  return <>
    <PublicPageIntro page="/tools" label={C.label} title={C.title} lines={C.titleLines} body={C.body} />
    <Section spacing="overview"><Container variant="marketing" className={s.stack}>
      <ul className={s.toolGrid} aria-label={C.label}>
        {C.tools.map(tool => <li key={tool.href}><Link href={tool.href as Route} className={s.toolCard} aria-label={C.open(tool.name)}>
          <span className={s.toolName}>{tool.name}</span>
          <span className={s.toolSummary}>{tool.summary}</span>
          <ArrowRight className={s.toolArrow} size={16} aria-hidden="true" />
        </Link></li>)}
      </ul>
      <section className={s.why} aria-labelledby="full-check-title">
        <h2 id="full-check-title" className={s.heading}>{C.fullCheck.title}</h2>
        <p>{C.fullCheck.body}</p>
        <PublicPageActions />
      </section>
    </Container></Section>
  </>
}
