'use client'

import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { BoardCard, BoardGrid } from '@/components/sites/BoardCard'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S } from '@/lib/marketing/copy/care-homepage'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HOMEPAGE_EVIDENCE, HomepageIntro, HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export type HomepageDetailCard = SiteCardArea | 'overview' | 'coverage'

export function HomepageHero({ onOpen }: { onOpen: (card: HomepageDetailCard) => void }) {
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
      <HomepageIntro title={S.title} body={S.body} />
      <div className={s.board} role="region" aria-label={C.boardAria}>
        <div className={s.boardHeader}>
          <div className={s.boardIdentity}>
            <Image src={HOMEPAGE_EVIDENCE.site} alt={S.identityAlt} width={76} height={54} />
            <div><strong>{C.boardHost}</strong><span>{C.boardLabel}</span></div>
          </div>
          <button type="button" className={s.boardResult} onClick={() => onOpen('overview')}>{S.summary}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className={s.boardContext}>
          <p><span>{S.snapshotLabel}</span>{S.snapshot}</p>
          <p><span>{S.watchLabel}</span>{S.watchValue}<a href="#monitoring">{S.watchAction}<ArrowRight size={14} aria-hidden="true" /></a></p>
        </div>
        <BoardGrid className={s.sampleGrid}>
          {S.categories.map(card => <BoardCard key={card.id} name={card.name} status={card.status} state={card.state} answer={card.answer} detail={card.context} icon={card.id} flagCount={card.flagCount} onOpen={() => onOpen(card.id)} />)}
        </BoardGrid>
        <div className={s.boardFooter}>
          <button type="button" onClick={() => onOpen('coverage')}>{S.coverageAction}<ArrowRight size={16} aria-hidden="true" /></button>
          <a href="#analyze">{S.analyzeAction}<ArrowRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
      <p className={s.sampleNote}>{S.note}</p>
    </section>
  </>
}
