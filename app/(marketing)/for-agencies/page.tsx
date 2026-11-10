import Link from 'next/link'
import type { Route } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { AGENCIES_PAGE as C } from '@/lib/marketing/copy/agencies'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from '@/components/marketing/public-site/AiBuilders.module.css'

export const metadata = buildPageMetadata('agencies', '/for-agencies')

export default function ForAgenciesPage() {
  return <>
    <PublicPageIntro page="/for-agencies" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing" className={s.stack}>
      <section aria-labelledby="agency-steps-title">
        <h2 id="agency-steps-title" className={s.heading}>{C.stepsTitle}</h2>
        <ol className={s.loop}>{C.steps.map((step, index) => <li key={step.title}>
          <p className={s.loopHead}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{step.title}</p>
          <p>{step.body}</p>
        </li>)}</ol>
      </section>
      <section className={s.why} aria-labelledby="agency-limits-title">
        <h2 id="agency-limits-title" className={s.heading}>{C.limits.title}</h2>
        <p>{C.limits.body}</p>
        <Link href={C.limits.href as Route} className={s.back}>{C.limits.action}</Link>
      </section>
    </Container></Section>
  </>
}
