'use client'

import Image from 'next/image'
import { ArrowRight, Clock3 } from 'lucide-react'
import { BoardCard, BoardGrid } from '@/components/sites/BoardCard'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S, type SampleCategory } from '@/lib/marketing/copy/care-homepage'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HOMEPAGE_EVIDENCE, HomepageIntro, HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export type HomepageDetailCard = SiteCardArea | 'coverage' | 'monitoring'

export function HomepageHero({ onOpen }: { onOpen: (card: HomepageDetailCard) => void }) {
  const attention = S.categories.filter(card => card.flagCount > 0)
  const checked = S.categories.filter(card => card.state === 'healthy')
  const uncertain = S.categories.filter(card => card.flagCount === 0 && card.state !== 'healthy')
  const renderCard = (card: SampleCategory) => <BoardCard key={card.id} name={card.name} status={card.status} state={card.state} answer={card.answer} detail={card.state === 'unknown' ? undefined : card.context} icon={card.id} flagCount={card.flagCount} onOpen={() => onOpen(card.id)} />
  return <>
    <section className={s.hero}>
      <div className={s.heroContent}>
        <h1><span className={s.headlineLead}>{C.headlineLines[0]}</span><br /><span className={s.headlineAccent}>{C.headlineLines[1]}</span></h1>
        <p className={s.heroBody}>{C.hero.body}</p>
        <HomepageUrlEntry />
        <a className={s.sampleLink} href="#product">{S.exploreAction}<ArrowRight size={16} aria-hidden="true" /></a>
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
          <p className={s.boardResult}>{S.summary}</p>
        </div>
        <div className={s.boardContext}>
          <p><span>{S.snapshotLabel}</span>{S.snapshot}</p>
          <button type="button" onClick={() => onOpen('coverage')}>{S.coverageAction}<ArrowRight size={14} aria-hidden="true" /></button>
        </div>
        <section className={s.resultGroup} aria-labelledby="sample-attention">
          <h3 id="sample-attention" className={s.groupHeading}>{S.groups.attention}</h3>
          <BoardGrid className={s.attentionGrid}>{attention.map(renderCard)}</BoardGrid>
        </section>
        <div className={s.supportingResults}>
          <section className={s.resultGroup} aria-labelledby="sample-checked">
            <h3 id="sample-checked" className={s.groupHeading}>{S.groups.checked}</h3>
            <BoardGrid className={s.checkedGrid}>{checked.map(renderCard)}</BoardGrid>
          </section>
          <section className={s.resultGroup} aria-labelledby="sample-uncertain">
            <h3 id="sample-uncertain" className={s.groupHeading}>{S.groups.uncertain}</h3>
            <BoardGrid className={s.uncertainGrid}>{uncertain.map(renderCard)}</BoardGrid>
          </section>
        </div>
        <div className={s.boardFooter}>
          <button type="button" className={s.boardMonitoring} id="monitoring" aria-label={C.monitoring.action} onClick={() => onOpen('monitoring')}>
            <Clock3 size={17} aria-hidden="true" /><span><strong>{C.monitoring.label}</strong><span>{C.monitoring.summary}</span></span><ArrowRight size={16} aria-hidden="true" />
          </button>
          <a href="#analyze">{S.analyzeAction}<ArrowRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
      <p className={s.sampleNote}>{S.note}</p>
    </section>
  </>
}
