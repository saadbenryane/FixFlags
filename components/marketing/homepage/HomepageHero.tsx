import { Globe2 } from 'lucide-react'
import { AddBoardCard, BoardCard, BoardGrid, BoardStatus, BOARD_CARD_ICONS } from '@/components/sites/BoardCard'
import { CARE_HOME as C, SITE_BOARD_COPY } from '@/lib/marketing/copy'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HOMEPAGE_EVIDENCE, HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

type PreviewCard = (typeof C.cards)[number] | (typeof C.library)[keyof typeof C.library]
export type HomepageDetailCard = PreviewCard | 'site' | 'conversion'
export type HomepageExtraCardId = 'uptime' | 'accessibility'

export function HomepageHero({
  extraCards,
  onOpen,
  onOpenLibrary,
}: {
  extraCards: HomepageExtraCardId[]
  onOpen: (card: HomepageDetailCard) => void
  onOpenLibrary: () => void
}) {
  const extraCardViews = extraCards.map(id => C.library[id])

  return <section className={s.hero}>
    <div className={s.heroContent}>
      <h1>
        <span className={s.headlineLead}>{C.headlineLines[0]}</span>
        <br />
        <span className={s.headlineAccent}>{C.headlineLines[1]}</span>
      </h1>
      <p className={s.heroBody}>{C.hero.body}</p>
      <p className={s.heroProof}>{C.hero.proof}</p>
      <HomepageUrlEntry />
    </div>
    <div className={s.heroBoard} id="product">
      <div className={s.board} role="region" aria-label={C.boardAria}>
        <div className={s.boardHeader}>
          <span><Globe2 size={16} aria-hidden="true" />{C.boardHost}</span>
          <BoardStatus state="attention" label={C.boardSummary} count={4} onOpen={() => onOpen('site')} />
        </div>
        <div className={s.boardStage}>
          <BoardGrid>
            <BoardCard
              name={C.site.label}
              status={C.site.status}
              state="healthy"
              answer={C.site.answer}
              visual={{ src: HOMEPAGE_EVIDENCE.site, alt: C.site.imageAlt }}
              wide
              icon={BOARD_CARD_ICONS.site}
              sources={[SITE_BOARD_COPY.browserSource]}
              onOpen={() => onOpen('site')}
            />
            <BoardCard
              name={C.flag.name}
              status={C.flag.status}
              state="problem"
              answer={C.flag.title}
              detail={C.flag.body}
              outcome={C.flag.outcome}
              action={C.flag.action}
              icon={BOARD_CARD_ICONS.conversion}
              flags={[{ id: 'conversion-flag', title: C.flag.title, href: '#flag-example' }]}
              sources={[SITE_BOARD_COPY.browserSource]}
              onOpen={() => onOpen('conversion')}
            />
            {C.cards.map(card => <BoardCard
              key={card.id}
              name={card.name}
              status={card.status}
              state={card.tone === 'attention' ? 'attention' : 'healthy'}
              answer={card.value}
              detail={card.detail}
              chart={card.chart}
              metric
              icon={BOARD_CARD_ICONS[card.id]}
              flags={card.id === 'performance' ? [...C.performanceFlags] : undefined}
              sources={[SITE_BOARD_COPY.browserSource]}
              onOpen={() => onOpen(card)}
            />)}
            {extraCardViews.map(card => <BoardCard
              key={card.id}
              name={card.name}
              status={card.status}
              state="healthy"
              answer={card.value}
              detail={card.detail}
              metric
              icon={BOARD_CARD_ICONS[card.id as SiteCardArea]}
              sources={[SITE_BOARD_COPY.browserSource]}
              onOpen={() => onOpen(card)}
            />)}
            <AddBoardCard onOpen={onOpenLibrary} />
          </BoardGrid>
        </div>
      </div>
    </div>
  </section>
}
