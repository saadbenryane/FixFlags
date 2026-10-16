'use client'

import Link from 'next/link'
import { Bot, Flag, Route } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S, type SampleCategory, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HomepageIntro, HomepageUrlEntry } from './HomepagePrimitives'
import { HomepageEditorTools } from './HomepageSections'
import { HomepageDashboardPreview } from './HomepageDashboardPreview'
import s from './CareHomepage.module.css'

export type HomepageDetailCard = SiteCardArea

const BENEFIT_ICONS = [Route, Flag, Bot] as const

export function HomepageHero({ onOpen, onOpenFlag, onCopyFlag }: { onOpen: (card: HomepageDetailCard) => void; onOpenFlag: (card: SampleCategory, flag: SampleFlagId) => void; onCopyFlag: (card: SampleCategory, flag: SampleFlagId) => void }) {
  return <>
    <section className={s.hero}>
      <div className={s.heroContent}>
        <p className={s.heroEyebrow}>{C.hero.eyebrow}</p>
        <h1><span className={s.headlineLead}><span className={s.headlineAccent}>{C.headlineAccent}</span>{' '}{C.headlineLines[0]}</span><br /><span className={s.headlineLead}>{C.headlineLines[1]}<span className={s.headlineAccent}>{C.headlinePunctuation}</span></span></h1>
        <p className={s.heroBody}>{C.hero.body}</p>
        <HomepageUrlEntry />
        <p className="mt-3 text-sm text-muted-foreground">{C.hero.setup}</p>
        <HomepageEditorTools />
      </div>
    </section>
    <section className={`${s.section} ${s.sampleSection}`} id="product" tabIndex={-1}>
      <HomepageIntro title={S.title} body={<>{S.subtitle} <Link className={s.introMcpLink} href="/docs/fix-with-ai">{C.workflow.action}</Link></>} />
      <ul className={s.heroBenefits} aria-label="What FixFlags does">
        {C.hero.benefits.map((benefit, index) => {
          const Icon = BENEFIT_ICONS[index]
          return <li key={benefit.title}><Icon size={20} aria-hidden="true" /><strong>{benefit.title}</strong></li>
        })}
      </ul>
      <HomepageDashboardPreview onOpen={onOpen} onOpenFlag={onOpenFlag} onCopyFlag={onCopyFlag} />
    </section>
  </>
}
