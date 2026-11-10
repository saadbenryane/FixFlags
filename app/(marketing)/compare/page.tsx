import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { COMPARE_PAGE as C } from '@/lib/marketing/copy/compare'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from '@/components/marketing/public-site/AiBuilders.module.css'
import c from './ComparePage.module.css'

export const metadata = buildPageMetadata('compare', '/compare')

export default function ComparePage() {
  return <>
    <PublicPageIntro page="/compare" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing" className={s.stack}>
      <section className={s.why} aria-labelledby="fixflags-line-title">
        <h2 id="fixflags-line-title" className={s.heading}>{C.fixflags.title}</h2>
        <p>{C.fixflags.body}</p>
      </section>
      {C.entries.map(entry => <section key={entry.id} id={entry.id} className={c.entry} aria-labelledby={`${entry.id}-title`}>
        <h2 id={`${entry.id}-title`} className={s.heading}>{C.entryTitle(entry.name)}</h2>
        <dl className={c.facts}>
          <div><dt>{C.labels.theyDo}</dt><dd>{entry.theyDo}</dd></div>
          <div><dt>{C.labels.difference}</dt><dd>{entry.difference}</dd></div>
        </dl>
        <p className={c.choose}>{entry.choose}</p>
        <p className={c.source}>{C.labels.source}: <a href={entry.source.href} rel="noopener noreferrer" target="_blank">{entry.source.label}</a></p>
      </section>)}
      <p className={c.source}>{C.checkedOn}</p>
    </Container></Section>
  </>
}
