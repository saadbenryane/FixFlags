'use client'

import Link from 'next/link'
import { ArrowRight, Bot, Flag, Route } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { HOMEPAGE_SAMPLE as S, type SampleCategory, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HomepageIntro, HomepageUrlEntry } from './HomepagePrimitives'
import { HomepageEditorTools } from './HomepageSections'
import { HomepageDashboardPreview } from './HomepageDashboardPreview'
import s from './CareHomepage.module.css'

export type HomepageDetailCard = SiteCardArea

const BENEFIT_ICONS = [Route, Flag, Bot] as const

export function HomepageHero({ onOpen, onOpenFlag, onCopyFlag, onCopyAll, onViewAll, onCopySelection }: { onCopySelection: (prompt: string) => void; onOpen: (card: HomepageDetailCard, trigger?: HTMLElement) => void; onOpenFlag: (card: SampleCategory, flag: SampleFlagId, trigger?: HTMLElement) => void; onCopyFlag: (card: SampleCategory, flag: SampleFlagId) => void; onCopyAll: () => void; onViewAll: () => string }) {
  return <>
    <section className={s.hero}>
      <div className={s.heroContent}>
        <h1><span className={s.headlineLead}>{C.hero.headline[0]}</span><br /><span className={s.headlineAccent}>{C.hero.headline[1]}</span></h1>
        <p className={s.heroBody}>{C.hero.body}</p>
        <HomepageUrlEntry />
        <p className={s.heroNote}>{C.hero.setup}<Link href="#product">{C.hero.sampleAction}<ArrowRight size={14} aria-hidden="true" /></Link></p>
        <HomepageEditorTools />
      </div>
    </section>
    <section className={`${s.section} ${s.sampleSection}`} id="product" tabIndex={-1}>
      <HomepageIntro title={S.title} body={<>{S.subtitle} <Link className={s.introMcpLink} href="/how-it-works">{C.workflow.action}<ArrowRight size={14} aria-hidden="true" /></Link></>} />
      <ul className={s.heroBenefits} aria-label="What FixFlags does">
        {C.hero.benefits.map((benefit, index) => {
          const Icon = BENEFIT_ICONS[index]
          return <li key={benefit.title}><Icon size={20} aria-hidden="true" /><strong>{benefit.title}</strong></li>
        })}
      </ul>
      <HomepageDashboardPreview accountRail onOpen={onOpen} onOpenFlag={onOpenFlag} onCopyFlag={onCopyFlag} onCopyAll={onCopyAll} onViewAll={onViewAll} onCopySelection={onCopySelection} />
    </section>
  </>
}
