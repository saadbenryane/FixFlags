'use client'

import Image from 'next/image'
import { ArrowRight, Bot, Clock3, Flag, RefreshCw, Route } from 'lucide-react'
import { BoardCard, BoardGrid, BoardSummaryStrip } from '@/components/sites/BoardCard'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S, type SampleCategory } from '@/lib/marketing/copy/care-homepage'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HOMEPAGE_EVIDENCE, HomepageIntro, HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export type HomepageDetailCard = SiteCardArea | 'monitoring'

const BENEFIT_ICONS = [Route, Flag, Bot] as const

export function HomepageHero({ onOpen }: { onOpen: (card: HomepageDetailCard) => void }) {
  const attention = S.categories.filter(card => card.flagCount > 0)
  const other = S.categories.filter(card => card.flagCount === 0).sort((a, b) => Number(a.state === 'unknown') - Number(b.state === 'unknown'))
  const ordered = [...attention, ...other]
  const renderCard = (card: SampleCategory) => <BoardCard key={card.id} name={card.name} status={card.status} state={card.state} answer={card.answer} detail={card.state === 'unknown' ? undefined : card.context} icon={card.id} flagCount={card.flagCount} onOpen={() => onOpen(card.id)} layout="row" />
  return <>
    <section className={s.hero}>
      <div className={s.heroContent}>
        <p className={s.heroEyebrow}>{C.hero.eyebrow}</p>
        <h1><span className={s.headlineLead}>{C.headlineLines[0]}</span><br /><span className={s.headlineAccent}>{C.headlineLines[1]}</span></h1>
        <p className={s.heroBody}>{C.hero.body}</p>
        <HomepageUrlEntry />
        <ul className={s.heroBenefits} aria-label="What FixFlags does">
          {C.hero.benefits.map((benefit, index) => {
            const Icon = BENEFIT_ICONS[index]
            return <li key={benefit.title}><span><Icon size={19} aria-hidden="true" /></span><div><strong>{benefit.title}</strong><p>{benefit.body}</p></div></li>
          })}
        </ul>
      </div>
    </section>
    <section className={`${s.section} ${s.sampleSection}`} id="product" tabIndex={-1}>
      <HomepageIntro title={S.title} />
      <div className={s.board} role="region" aria-label={C.boardAria}>
        <div className={s.boardHeader}>
          <div className={s.boardIdentity}>
            <Image src={HOMEPAGE_EVIDENCE.site} alt={S.identityAlt} width={76} height={54} />
            <div><strong>{C.boardHost}</strong><span>{C.boardLabel}</span></div>
          </div>
          <div className={s.boardSummary}>
            <span>{S.freshness}</span>
            <a href="#analyze"><RefreshCw size={14} aria-hidden="true" />{S.boardAction}</a>
          </div>
        </div>
        <BoardSummaryStrip items={S.summaryItems} label={S.summaryLabel} />
        <BoardGrid className={s.resultRows} layout="rows">{ordered.map(renderCard)}</BoardGrid>
        <div className={s.boardFooter}>
          <button type="button" className={s.boardMonitoring} id="monitoring" aria-label={C.monitoring.action} onClick={() => onOpen('monitoring')}>
            <Clock3 size={17} aria-hidden="true" /><span><strong>{C.monitoring.label}</strong><span>{C.monitoring.summary}</span></span><ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className={s.sampleNote}>{S.note}</p>
    </section>
  </>
}
