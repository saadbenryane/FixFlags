import Link from 'next/link'
import { ArrowRight, Check, Code2, RefreshCw } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { HowItWorksWalkthrough } from '@/components/marketing/public-site/HowItWorksWalkthrough'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from './HowItWorksPage.module.css'

export const metadata = buildPageMetadata('howItWorks', '/how-it-works')
const C = PUBLIC_SITE_COPY.howItWorks
const REPEAT_ICONS = [Code2, Check, RefreshCw]

export default function HowItWorksPage() {
  return <>
    <PublicPageIntro page="/how-it-works" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing" className={s.content}>
      <HowItWorksWalkthrough areas={HOMEPAGE_CHECK_COVERAGE.areas.map(({ id, name }) => ({ id, name }))} />
      <section className={s.repeat} aria-labelledby="repeat-title">
        <span className={s.returnIcon}><RefreshCw aria-hidden size={28} strokeWidth={1.5} /></span>
        <h2 id="repeat-title">{C.repeat.title}</h2>
        <p className={s.repeatBody}>{C.repeat.body}</p>
        <div className={s.repeatSteps}>{C.repeat.steps.map((step, index) => {
          const Icon = REPEAT_ICONS[index]
          return <div key={step.title}><Icon aria-hidden size={22} strokeWidth={1.5} /><h3>{step.title}</h3><p>{step.body}</p></div>
        })}</div>
        <p className={s.uncertainty}>{C.repeat.uncertainty}</p>
      </section>
    </Container></Section>
    <Section spacing="marketing" tint="subtle"><Container variant="marketing" className={s.setup}>
      <h2>{C.setupTitle}</h2>
      <p>{C.setupBody}</p>
      <div className={s.entry}><AuditInput variant="landing" idSuffix="-how-it-works" ctaPlacement="final" showLandingExtras={false} submitLabel={PUBLIC_SITE_COPY.analyze} /></div>
      <Link href="/coverage">{C.setupLink}<span className={s.linkArrow}><ArrowRight aria-hidden size={18} /></span></Link>
    </Container></Section>
  </>
}
