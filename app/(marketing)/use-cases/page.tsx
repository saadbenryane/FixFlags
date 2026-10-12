import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Code2, Megaphone, PanelsTopLeft, ShoppingBag } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { AuditInput } from '@/components/audit/AuditInput'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from './UseCasesPage.module.css'

export const metadata = buildPageMetadata('useCases', '/use-cases')
const C = PUBLIC_SITE_COPY.useCasesPage
const CASE_ICONS = { founders: Code2, ecommerce: ShoppingBag, agencies: PanelsTopLeft, marketing: Megaphone }

export default function UseCasesPage() {
  return <div className={s.page}>
    <PublicPageIntro page="/use-cases" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing">
      <nav aria-label={C.label} className={s.navigation}>
        {C.cases.map(item => {
          const Icon = CASE_ICONS[item.id]
          return <Link href={`#${item.id}`} key={item.id} className={s.jumpLink}>
            <Icon aria-hidden size={18} strokeWidth={1.75} />
            <span>{item.title}</span>
          </Link>
        })}
      </nav>
      <div className={s.cases}>
        {C.cases.map(item => {
          const Icon = CASE_ICONS[item.id]
          return <section id={item.id} key={item.id} aria-labelledby={`${item.id}-title`} className={s.case}>
            <div className={s.cardTop} aria-hidden>
              <span className={s.icon}><Icon size={28} strokeWidth={1.5} /></span>
              <Icon className={s.watermark} size={112} strokeWidth={.75} />
            </div>
            <div className={s.scenario}>
              <h2 id={`${item.id}-title`}>{item.title}</h2>
              <p>{item.situation}</p>
            </div>
            <dl className={s.details}>
              <div><dt>{C.checksLabel}</dt><dd>{item.checks}</dd></div>
              <div className={s.evidence}><dt>{C.evidenceLabel}</dt><dd>{item.evidence}</dd></div>
              <div className={s.limits}><dt>{C.limitsLabel}</dt><dd>{item.limits}</dd></div>
            </dl>
            <Link href={item.href as Route} className={s.guideLink}><span>{item.link}</span><span className={s.linkArrow}><ArrowRight aria-hidden size={18} /></span></Link>
          </section>
        })}
      </div>
    </Container></Section>
    <Section spacing="marketing" tint="subtle" className={s.close}><Container variant="marketing">
      <h2>{PUBLIC_SITE_COPY.nextTitle}</h2>
      <p className={s.closeBody}>{PUBLIC_SITE_COPY.nextBody}</p>
      <div className={s.entry}><AuditInput variant="landing" idSuffix="-use-cases" ctaPlacement="final" showLandingExtras={false} submitLabel={PUBLIC_SITE_COPY.analyze} /></div>
    </Container></Section>
  </div>
}
