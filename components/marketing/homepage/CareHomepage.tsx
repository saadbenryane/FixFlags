'use client'

import { useRef, useState } from 'react'
import { ArrowRight, Copy } from 'lucide-react'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARE_HOME as C, SITE_BOARD_COPY } from '@/lib/marketing/copy'
import { HomepageHero, type HomepageDetailCard } from './HomepageHero'
import {
  HomepageCoverageSection,
  HomepageFinalSection,
  HomepageHandoffSection,
  HomepageIntegrationsSection,
  HomepageMonitoringSection,
  HomepageWorkflowSection,
  type HomepageCopyResult,
  type HomepageCopySource,
} from './HomepageSections'
import { HOMEPAGE_EVIDENCE } from './HomepagePrimitives'
import s from './CareHomepage.module.css'
import { MarketingCompareSection } from '@/components/marketing/MarketingCompareSection'

type PreviewCard = (typeof C.cards)[number] | (typeof C.library)[keyof typeof C.library]

export function CareHomepage() {
  const [selected, setSelected] = useState<HomepageDetailCard | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [copyResult, setCopyResult] = useState<HomepageCopyResult>(null)
  const dialogOpener = useRef<HTMLElement | null>(null)
  const selectedPreview = selected && selected !== 'site' && selected !== 'conversion' ? selected as PreviewCard : null

  const openCard = (card: HomepageDetailCard) => {
    dialogOpener.current = document.activeElement as HTMLElement
    setSelected(card)
  }
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    dialogOpener.current?.focus()
  }
  const copyFlag = async (source: HomepageCopySource) => {
    try {
      await navigator.clipboard.writeText(C.workflow.instructions)
      setCopyResult({ source, message: C.actions.copied })
    } catch {
      setCopyResult({ source, message: C.actions.copyFailed })
      setShowInstructions(true)
    }
  }

  return <div className={s.home}>
    <HomepageHero onOpen={openCard} />
    <HomepageWorkflowSection onViewFlag={() => openCard('conversion')} />
    <HomepageCoverageSection />
    <HomepageHandoffSection
      showInstructions={showInstructions}
      copyResult={copyResult}
      onToggleDetails={() => setShowInstructions(value => !value)}
      onCopy={source => void copyFlag(source)}
    />
    <MarketingCompareSection />
    <HomepageMonitoringSection />
    <HomepageIntegrationsSection />
    <HomepageFinalSection />

    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}>
      <DialogContent className={s.dialog} onCloseAutoFocus={restoreFocus}>
        <DialogTitle>{selected === 'site' ? C.site.label : selected === 'conversion' ? C.flag.name : selectedPreview?.name}</DialogTitle>
        <DialogDescription>{selected === 'site' ? C.site.question : selected === 'conversion' ? C.flag.question : selectedPreview?.question}</DialogDescription>
        {selected === 'site' ? <>
          <p className={s.detailAnswer}>{C.site.answer}</p>
          <BoardDetails image={{ src: HOMEPAGE_EVIDENCE.site, alt: C.site.imageAlt }} checkedAt={C.exampleCheckedAt} sources={[SITE_BOARD_COPY.browserSource]} facts={C.site.facts} coverage={C.site.coverage} />
        </> : selected === 'conversion' ? <>
          <p className={s.detailAnswer}>{C.flag.title}</p>
          <p className={s.scope}>{C.flag.body}</p>
          <BoardDetails image={{ src: HOMEPAGE_EVIDENCE.failed, alt: C.flag.cropAlt }} checkedAt={C.exampleCheckedAt} sources={[SITE_BOARD_COPY.browserSource]} facts={C.flag.facts} coverage={C.workflow.source} />
          <div className={s.mcpActions}>
            <button type="button" onClick={() => void copyFlag('ai')}><Copy size={15} aria-hidden="true" />{SITE_BOARD_COPY.copyPrompt}</button>
            <button type="button" onClick={() => void copyFlag('share')}><Copy size={15} aria-hidden="true" />{C.actions.choices[1].action}</button>
          </div>
          <p className={s.copyStatus} role="status">{copyResult?.source === 'ai' || copyResult?.source === 'share' ? copyResult.message : ''}</p>
          <a href="#flag-example" className={s.textLink} onClick={() => { dialogOpener.current = null; setSelected(null) }}>{C.flag.action}<ArrowRight size={17} aria-hidden="true" /></a>
        </> : selectedPreview ? <>
          <p className={s.detailAnswer}>{selectedPreview.answer}</p>
          <BoardDetails checkedAt={C.exampleCheckedAt} sources={[SITE_BOARD_COPY.browserSource]} facts={selectedPreview.facts} coverage={selectedPreview.coverage} />
        </> : null}
      </DialogContent>
    </Dialog>
  </div>
}
