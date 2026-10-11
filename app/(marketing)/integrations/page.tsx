import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Check } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { CARE_HOME, INTEGRATIONS_PAGE as C } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from './IntegrationsPage.module.css'

export const metadata = buildPageMetadata('integrations', '/integrations')

type Integration = typeof C.items[number]

function IntegrationCard({ item }: { item: Integration }) {
  return <article id={item.id} className={s.card} data-status={item.status}>
    <div className={s.cardTop}>
      <span className={s.logoPlate}><Image src={item.logo} alt="" width={42} height={42} /></span>
      <span className={s.status}>{item.status === 'available' ? C.availableLabel : C.proposedLabel}</span>
    </div>
    <p className={s.purpose}>{item.purpose}</p>
    <h2>{item.title}</h2>
    <p className={s.summary}>{item.summary}</p>
    <div className={s.checks}>
      <h3>{item.status === 'available' ? C.currentListTitle : C.futureListTitle}</h3>
      <ul>{item.checks.map(check => <li key={check}>{item.status === 'available' ? <Check size={15} aria-hidden="true" /> : <span className={s.proposedBullet} aria-hidden="true" />}<span>{check}</span></li>)}</ul>
    </div>
    {item.status === 'available' ? <Link href={item.href as Route} className={s.cardAction}>{item.action}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
  </article>
}

export default function IntegrationsPage() {
  return <div className={s.page}>
    <MarketingPageViewTracker page="/integrations" />
    <section className={s.hero} aria-labelledby="integrations-heading">
      <p className={s.eyebrow}>{C.hero.label}</p>
      <h1 id="integrations-heading">{C.hero.title}</h1>
      <p>{C.hero.body}</p>
    </section>

    <section className={s.group} aria-label="Integrations">
      <div className={s.grid}>{C.items.map(item => <IntegrationCard key={item.id} item={item} />)}</div>
    </section>

    <section className={s.close} aria-labelledby="integrations-close-heading">
      <div><h2 id="integrations-close-heading">{CARE_HOME.close.title}</h2><p>{CARE_HOME.close.body}</p>
        <div className={s.urlEntry}><AuditInput variant="landing" idSuffix="-integrations" ctaPlacement="hero" showLandingExtras={false} submitLabel={CARE_HOME.hero.cta} urlPlaceholder={CARE_HOME.hero.placeholder} /></div>
        <Link href="/pricing" className={s.pricingLink}>{CARE_HOME.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  </div>
}
