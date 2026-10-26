'use client'

import Link from 'next/link'
import { ArrowRight, Bot, Flag, Route } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { HOMEPAGE_SAMPLE as S, type SampleCategory, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HomepageUrlEntry } from './HomepagePrimitives'
import { GlassHeroMark } from './GlassHeroMark'
import { HomepageDashboardPreview, type SampleFlagOpener } from './HomepageDashboardPreview'
import s from './HomepageHero.module.css'

export type HomepageDetailCard = SiteCardArea

const BENEFIT_ICONS = [Route, Flag, Bot] as const

export function HomepageHero({ onOpen, onOpenFlag, onCopyFlag, onCopyAll, onViewAll, onCopySelection }: { onCopySelection: (prompt: string) => void; onOpen: (card: HomepageDetailCard, trigger?: HTMLElement) => void; onOpenFlag: SampleFlagOpener; onCopyFlag: (card: SampleCategory, flag: SampleFlagId) => void; onCopyAll: () => void; onViewAll: () => string }) {
  return <>
    <section className={s.hero}>
      <GlassHeroMark />
      <div className={s.layout}>
        <div className={s.copy}>
          <h1><span>{C.hero.headline[0]}</span><span>{C.hero.headline[1].slice(0, -1)}<span className={s.period}>{C.hero.headline[1].slice(-1)}</span></span></h1>
          <p className={s.description}>{C.hero.body}</p>
          <HomepageUrlEntry className={s.entry} />
          <p className={s.note}>{C.hero.setup}<Link href="#product">{C.hero.sampleAction}<ArrowRight size={14} aria-hidden="true" /></Link></p>
        </div>
      </div>
    </section>
    <section className={s.product} id="product" tabIndex={-1}>
      <div className={s.productIntro}><h2>{S.title}</h2><p>{S.subtitle}</p><Link href="/how-it-works">{C.workflow.action}<ArrowRight size={16} aria-hidden="true" /></Link></div>
      <ul className={s.benefits} aria-label="What FixFlags does">
        {C.hero.benefits.map((benefit, index) => {
          const Icon = BENEFIT_ICONS[index]
          return <li key={benefit.title}><Icon size={20} aria-hidden="true" /><strong>{benefit.title}</strong></li>
        })}
      </ul>
      <HomepageDashboardPreview onOpen={onOpen} onOpenFlag={onOpenFlag} onCopyFlag={onCopyFlag} onCopyAll={onCopyAll} onViewAll={onViewAll} onCopySelection={onCopySelection} />
    </section>
  </>
}
