import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions } from '@/components/marketing/public-site/PublicPage'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from './HowItWorksPage.module.css'

export const metadata = buildPageMetadata('howItWorks', '/how-it-works')
const C = PUBLIC_SITE_COPY.howItWorks

export default function HowItWorksPage() {
  return <>
    <PublicPageIntro page="/how-it-works" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Container variant="marketing">
      <p className={s.sample}>{C.example.label}<span>{C.example.scope}</span></p>
      <ol className={s.loop} aria-label={C.title}>
        {C.steps.map((step, index) => <li key={step.id} className={s.step}>
          <div className={s.stepLabel}><span>{String(index + 1).padStart(2, '0')}</span>{step.label}{index < 2 ? <ArrowRight aria-hidden size={18} /> : <RefreshCw aria-hidden size={18} />}</div>
          <h2>{step.title}</h2><p className={s.body}>{step.body}</p>
          <div className={s.visual}>
            {step.id === 'monitor' ? <>
              <p className={s.visualTitle}>{C.example.monitored}</p>
              <p className={s.meta}><RefreshCw aria-hidden size={14} />{C.example.schedule}</p>
              <figure className={s.recovery}>
                <Image src="/marketing/evidence/purchase-verified.png" alt={C.example.recoveryAlt} width={780} height={1520} sizes="(min-width: 1024px) 320px, 90vw" />
                <figcaption><span className={s.meta}><Check aria-hidden size={15} />{C.example.recoveryLabel}</span><strong>{C.example.recovered}</strong><p>{C.example.recovery}</p></figcaption>
              </figure>
            </> : step.id === 'flag' ? <>
              <span className={s.flagLabel}>{step.label}</span>
              <p className={s.visualTitle}>{C.example.problem}</p>
              <p className={s.meta}>{C.example.page}</p>
              <Image className={s.failure} src="/marketing/evidence/purchase-broken.png" alt={C.example.imageAlt} width={780} height={1520} sizes="(min-width: 1024px) 320px, 90vw" />
              <p className={s.observation}>{C.example.evidence}</p>
            </> : <>
              <p className={s.visualTitle}>{C.example.promptTitle}</p>
              <p className={s.meta}>{C.example.page}</p>
              <blockquote className={s.prompt}>{C.example.prompt}</blockquote>
              <div className={s.check}><RefreshCw aria-hidden size={16} />{C.example.checkAction}</div>
            </>}
          </div>
        </li>)}
      </ol>
      <div className={s.return}><RefreshCw aria-hidden size={20} /><div><h2>{C.example.returnLabel}</h2><p>{C.example.returnBody}</p></div></div>
    </Container>
    <Section spacing="tight" tint="subtle"><Container variant="marketing" className={s.setup}>
      <h2>{C.setupTitle}</h2>
      <p>{C.setupBody}</p>
      <Link href="/coverage">{C.setupLink}<ArrowRight aria-hidden size={16} /></Link>
    </Container></Section>
  </>
}
