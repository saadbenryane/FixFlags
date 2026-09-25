'use client'

import { useState } from 'react'
import { Globe2, Plus } from 'lucide-react'
import { AddBoardCard, AddCardLibrary, BoardCard, BoardGrid, BoardStatus, BOARD_CARD_ICONS } from '@/components/sites/BoardCard'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARE_HOME as C, INTEGRATIONS_PAGE, SITE_BOARD_COPY } from '@/lib/marketing/copy'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HOMEPAGE_EVIDENCE, HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

type PreviewCard = (typeof C.cards)[number] | (typeof C.library)[keyof typeof C.library]
export type HomepageDetailCard = PreviewCard | 'site' | 'conversion'
export type HomepageExtraCardId = 'uptime' | 'accessibility'

const STARTER_AREAS: SiteCardArea[] = ['site', 'conversion', 'security', 'search', 'performance', 'tracking']

export function HomepageHero({
  onOpen,
}: {
  onOpen: (card: HomepageDetailCard) => void
}) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [extra, setExtra] = useState<HomepageExtraCardId[]>([])
  const [connected, setConnected] = useState<Array<(typeof INTEGRATIONS_PAGE.items)[number]['id']>>([])
  const present: SiteCardArea[] = [...STARTER_AREAS, ...extra]

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
        {connected.length > 0 ? <ul className={s.connectionRow} aria-label="Sample connections">
          {INTEGRATIONS_PAGE.items.filter(item => connected.includes(item.id)).map(item => (
            <li key={item.id}><strong>{item.title}</strong><span>{item.limit}</span></li>
          ))}
        </ul> : null}
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
            {extra.map(id => {
              const card = C.library[id]
              return <BoardCard
                key={card.id}
                name={card.name}
                status={card.status}
                state="healthy"
                answer={card.value}
                detail={card.detail}
                icon={BOARD_CARD_ICONS[id]}
                sources={[SITE_BOARD_COPY.browserSource]}
                onOpen={() => onOpen(card)}
              />
            })}
            <AddBoardCard onOpen={() => setLibraryOpen(true)} />
            <button type="button" className={s.boardAdd} onClick={() => setIntegrationsOpen(true)}>
              <span className={s.boardAddSymbol} aria-hidden="true"><Plus size={22} /></span>
              <strong>{C.integrations.add}</strong>
            </button>
          </BoardGrid>
        </div>
      </div>
    </div>
    <AddCardLibrary
      open={libraryOpen}
      onOpenChange={setLibraryOpen}
      present={present}
      onAdd={id => {
        if (id === 'uptime' || id === 'accessibility') setExtra(current => current.includes(id) ? current : [...current, id])
        setLibraryOpen(false)
      }}
      exampleNote={C.integrations.sampleNote}
    />
    <Dialog open={integrationsOpen} onOpenChange={setIntegrationsOpen}>
      <DialogContent className={s.dialog}>
        <DialogTitle>{C.integrations.addTitle}</DialogTitle>
        <DialogDescription>{C.integrations.addBody}</DialogDescription>
        <ul className={s.integrationPicker}>
          {INTEGRATIONS_PAGE.items.map(item => {
            const added = connected.includes(item.id)
            return <li key={item.id}>
              <button
                type="button"
                disabled={added}
                onClick={() => setConnected(current => current.includes(item.id) ? current : [...current, item.id])}
              >
                <span><strong>{item.title}</strong><small>{item.body}</small></span>
                <em>{added ? C.integrations.added : C.integrations.addAction}</em>
              </button>
            </li>
          })}
        </ul>
        <p className={s.sampleNote}>{C.integrations.sampleNote}</p>
      </DialogContent>
    </Dialog>
  </section>
}
