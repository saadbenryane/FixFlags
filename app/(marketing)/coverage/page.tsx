import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions, PublicPageNextStep } from '@/components/marketing/public-site/PublicPage'
import { CheckPreview } from '@/components/marketing/homepage/HomepageCheckCoverage'
import { AREA_ICONS } from '@/components/marketing/homepage/check-area-icons'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { ADVERTISED_COVERAGE_REGISTRY } from '@/lib/audit/advertised-coverage'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from './CoveragePage.module.css'

export const metadata = buildPageMetadata('coverage', '/coverage')
const C = PUBLIC_SITE_COPY.coveragePage

function evidenceFor(id: string) {
  const evidence = ADVERTISED_COVERAGE_REGISTRY.get(id)
  if (!evidence) throw new Error(`Missing coverage contract: ${id}`)
  return evidence
}

/** Every area FixFlags checks: the question it answers, what a problem looks like, and a few examples of what we check. */
export default function CoveragePage() {
  return <>
    <PublicPageIntro page="/coverage" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing">
      <div className={s.areas}>
        {HOMEPAGE_CHECK_COVERAGE.areas.map(area => {
          const Icon = AREA_ICONS[area.id]
          return <section id={area.id} key={area.id} className={s.area} data-area={area.id} aria-labelledby={`${area.id}-title`}>
            <div className={s.head}>
              <span className={s.icon} aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>
              <h2 id={`${area.id}-title`}>{area.name}</h2>
            </div>
            <p className={s.question}>{CARD_CATALOG[area.id].question}</p>
            <p className={s.benefit}>{area.benefit}</p>
            <figure className={s.preview} aria-label={`${area.name}: ${C.previewLabel}`}><CheckPreview area={area.id} /></figure>
            <div className={s.examples}>
              <h3>{HOMEPAGE_CHECK_COVERAGE.examplesLabel}</h3>
              <ul>{area.examples.map(example => {
                const evidence = evidenceFor(example.id)
                const tags = [C.setupTags[evidence.configuration], C.extentTags[evidence.extent]].filter(Boolean)
                return <li key={example.id}>
                  <i aria-hidden="true"><Check size={12} strokeWidth={3} /></i>
                  <span>{example.label}</span>
                  {tags.length ? <span className={s.tags}>{tags.map(tag => <small key={tag}>{tag}</small>)}</span> : null}
                </li>
              })}</ul>
            </div>
          </section>
        })}
      </div>
    </Container></Section>
    <Section spacing="tight"><Container variant="marketing">
      <div className={s.limits}>
        <h2>{C.limitsTitle}</h2>
        <ul>{C.limits.map(limit => <li key={limit.title}><h3>{limit.title}</h3><p>{limit.body}</p></li>)}</ul>
        <Link href="/docs/site-care" className={s.guide}>{PUBLIC_SITE_COPY.guide}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </Container></Section>
    <PublicPageNextStep />
  </>
}
