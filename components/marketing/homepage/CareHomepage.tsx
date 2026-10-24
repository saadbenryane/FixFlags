'use client'

import { InteractiveButton, InteractiveTextarea } from '@/components/ui/interactive-controls'
import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Flag } from 'lucide-react'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { FixPromptCard } from '@/components/sites/FixPromptCard'
import { SampleFlagSelection, sampleFixPrompt } from './SampleFlagSelection'
import { SiteFlagSelectionCheckbox } from '@/components/sites/SiteFlagSelection'
import { SitePageResults } from '@/components/sites/SitePageResults'
import { samplePages } from './sample-pages'
import { showFixPromptCopied } from '@/components/sites/FixPromptToast'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FlagEvidenceDetails } from '@/components/sites/FlagEvidenceDetails'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import { SITE_DASHBOARD_COPY as Dashboard } from '@/lib/marketing/copy/site-dashboard'
import { HomepageHero, type HomepageDetailCard } from './HomepageHero'
import { HomepageDashboardPreview, type SampleFlagOpener } from './HomepageDashboardPreview'
import { SITE_ROUTES, type SiteRoute } from '@/components/sites/SiteWorkspaceNavigation'
import { HomepageCheckCoverage } from './HomepageCheckCoverage'
import { HomepageFinalSection, HomepageHandoffSection, HomepageIntegrationsSection, HomepageLoopSection, type HomepageCopyResult, type HomepageCopySource } from './HomepageSections'
import s from './CareHomepage.module.css'

export function CareHomepage({ dashboardOnly = false }: { dashboardOnly?: boolean } = {}) {
  const [selected, setSelected] = useState<HomepageDetailCard | null>(null)
  const [flag, setFlag] = useState<SampleFlagId | null>(null)
  const [flagOrigin, setFlagOrigin] = useState<SiteRoute | null>(null)
  const [copyResult, setCopyResult] = useState<HomepageCopyResult>(null)
  const [manualPrompt, setManualPrompt] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const resultId = useId()
  const flagOpener = useRef<string | null>(null)
  const categoryScroll = useRef(0)
  const selectedCard = S.categories.find(card => card.id === selected)
  const selectedFlag = flag ? SAMPLE_FLAGS[flag] : null
  const prompt = selectedFlag?.prompt ?? C.workflow.instructions
  const openCard = (card: HomepageDetailCard, trigger?: HTMLElement) => {
    opener.current = trigger ?? document.activeElement as HTMLElement
    flagOpener.current = null; categoryScroll.current = 0
    setSelected(card); setFlag(null); setFlagOrigin(null); setManualPrompt(null); setCopyResult(null)
  }
  const focusHeading = () => {
    const dialog = heading.current?.closest<HTMLElement>('[role="dialog"]')?.querySelector<HTMLElement>('[data-dialog-scroll]')
    if (dialog) dialog.scrollTop = 0
    heading.current?.focus({ preventScroll: true })
  }
  const openFlag = (id: SampleFlagId, trigger: HTMLButtonElement) => {
    flagOpener.current = trigger.id
    const scrollBody = trigger.closest<HTMLElement>('[data-dialog-scroll]')
    categoryScroll.current = scrollBody?.scrollTop ?? 0
    if (scrollBody) scrollBody.scrollTop = 0
    setFlag(id); setCopyResult(null)
    requestAnimationFrame(focusHeading)
  }
  const openSampleFlag: SampleFlagOpener = (card, id, trigger, origin) => {
    opener.current = trigger ?? document.activeElement as HTMLElement
    flagOpener.current = null; categoryScroll.current = 0
    setSelected(card.id); setFlag(id); setFlagOrigin(origin ?? null); setManualPrompt(null); setCopyResult(null)
  }
  const returnFromFlag = () => {
    setFlag(null); setManualPrompt(null); setCopyResult(null)
    if (flagOrigin) {
      setSelected(null)
      setFlagOrigin(null)
      return
    }
    requestAnimationFrame(() => {
      const trigger = flagOpener.current ? document.getElementById(flagOpener.current) : null
      if (!trigger) { focusHeading(); return }
      const dialog = trigger.closest<HTMLElement>('[data-dialog-scroll]')
      if (dialog) dialog.scrollTop = categoryScroll.current
      trigger.focus({ preventScroll: true })
    })
  }
  const copyFlag = async (source: HomepageCopySource, text: string = C.workflow.instructions, card?: typeof S.categories[number], id?: SampleFlagId) => {
    try {
      await navigator.clipboard.writeText(text)
      setManualPrompt(null)
      showFixPromptCopied()
      setCopyResult({ source, message: source === 'share' ? C.story.copied : S.guidanceCopied })
    } catch {
      if (selected === null && source !== 'share' && source !== 'all') {
        if (card && id) openSampleFlag(card, id)
        else { openCard('conversion'); setFlag('checkout') }
      }
      setManualPrompt(text)
      setCopyResult({ source, message: S.copyFailed })
    }
  }
  const restoreFocus = (event: Event) => { event.preventDefault(); opener.current?.focus() }
  const sampleBundle = sampleFixPrompt
  const previewActions = { onOpen: openCard, onOpenFlag: openSampleFlag,
    onCopyFlag: (card: typeof S.categories[number], id: SampleFlagId) => void copyFlag('read', SAMPLE_FLAGS[id].prompt, card, id),
    onCopySelection: (text: string) => { opener.current = document.activeElement as HTMLElement; void copyFlag('all', text) },
    onViewAll: () => sampleBundle(Object.keys(SAMPLE_FLAGS) as SampleFlagId[]),
    onCopyAll: () => { opener.current = document.activeElement as HTMLElement; void copyFlag('all', sampleBundle(Object.keys(SAMPLE_FLAGS) as SampleFlagId[])) } }
  const manualBundle = Boolean(manualPrompt && copyResult?.source === 'all')
  const title = selectedFlag?.title ?? selectedCard?.name ?? (manualBundle ? Dashboard.bundleManual : '')
  const returnLabel = flagOrigin ? SITE_ROUTES.find(([id]) => id === flagOrigin)?.[1] : selectedCard?.name ?? 'area'

  return <div className={s.home}>
    {dashboardOnly ? <HomepageDashboardPreview accountRail {...previewActions} /> : <HomepageHero {...previewActions} />}
    {!dashboardOnly ? <>
    <HomepageCheckCoverage />
    <HomepageLoopSection onOpenFlag={trigger => { openCard('site'); setFlag('availability'); opener.current = trigger }} />
    <HomepageHandoffSection onCopy={(source, prompt) => void copyFlag(source, prompt)} copyResult={copyResult} manualPrompt={selected === null ? manualPrompt : null} />
    <HomepageIntegrationsSection />
    <HomepageFinalSection />
    </> : null}
    <ResponsiveDepth header={<>
      {flag ? <InteractiveButton type="button" className={s.backButton} onClick={returnFromFlag}><ArrowLeft size={16} aria-hidden="true" />Back to {returnLabel}</InteractiveButton> : null}
      <div className={s.modalHeading}><DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle>{!selectedFlag && selectedCard?.id === 'site' ? <span>{selectedCard.context}</span> : null}</div>
    </>} open={selected !== null || manualBundle} onOpenChange={open => { if (!open) { setSelected(null); if (manualBundle) setManualPrompt(null) } }} onCloseAutoFocus={restoreFocus} className={s.dialog}>
      <DialogDescription className={selectedFlag || manualBundle ? undefined : 'sr-only'}>{selectedFlag?.scope ?? (selectedCard ? Dashboard.categoryDescription : undefined) ?? (manualBundle ? Dashboard.bundleBody : '')}</DialogDescription>
      {selectedFlag ? <>
        <FlagEvidenceDetails observed={selectedFlag.observed} expected={selectedFlag.expected}
          observedLabel={S.observedLabel} expectedLabel={S.expectedLabel} factsClassName={s.flagFacts} />
        <section className={s.flagSource} aria-label="Affected page">
          {selectedFlag.image ? <Image src={selectedFlag.image} alt={selectedFlag.imageAlt ?? ''} width={1280} height={720} /> : null}
          <a href={selectedFlag.url}>{selectedFlag.page}</a>
        </section>
        <FixPromptCard prompt={prompt} onCopy={() => void copyFlag('read', prompt)} copied={copyResult?.source === 'read' && !manualPrompt} copyLabel={S.sampleCopy} />
        <details className={s.modalDetails}><summary>{Dashboard.checkDetails}<ChevronDown size={15} aria-hidden /></summary><Link href="/docs/fix-with-ai">{S.guidanceAction}<ArrowRight size={15} aria-hidden /></Link></details>
      </> : selectedCard ? <SampleFlagSelection key={selectedCard.id} ids={selectedCard.flags ?? (selectedCard.flag ? [selectedCard.flag] : [])} onCopy={text => void copyFlag('read', text)}>
        {selectedCard.id === 'site' ? <SitePageResults pages={samplePages(['availability', 'contact'], openFlag)} /> : <>
          <h3 className={s.categoryAnswer}>{selectedCard.answer}</h3>
          <ul className={`${s.resultList} ${s.compactResults}`}>{selectedCard.results.map((result, index) => <li key={result.label}>
            {result.status === 'Flag' && (result.flag ?? selectedCard.flag) ? <SiteFlagSelectionCheckbox flagId={(result.flag ?? selectedCard.flag)!} title={SAMPLE_FLAGS[(result.flag ?? selectedCard.flag)!].title} /> : null}
            {result.status === 'Flag' && (result.flag ?? selectedCard.flag) ? <InteractiveButton id={`${resultId}-${index}`} type="button" aria-label={`View Flag for ${result.label}`} onClick={event => openFlag((result.flag ?? selectedCard.flag)!, event.currentTarget)}><Flag size={16} className={s.resultFlag} aria-hidden /><strong>{result.label}</strong><ArrowRight size={15} aria-hidden /></InteractiveButton>
              : <details className={s.resultDisclosure}><summary className={s.compactResult}>{result.status === 'Checked' ? <Check size={16} aria-hidden /> : <CircleHelp size={16} aria-hidden />}<strong>{result.label}</strong><span>{result.status}</span><ChevronDown size={14} aria-hidden /></summary><p>{result.detail}</p></details>}
          </li>)}</ul>
        </>}
        {selectedCard.flagCount ? <FixPromptCard prompt={sampleBundle([...(selectedCard.flags ?? (selectedCard.flag ? [selectedCard.flag] : []))])} onCopy={() => void copyFlag('read', sampleBundle([...(selectedCard.flags ?? (selectedCard.flag ? [selectedCard.flag] : []))]))} copied={copyResult?.source === 'read' && !manualPrompt} /> : null}
        <details className={s.modalDetails}><summary>{Dashboard.checkDetails}<ChevronDown size={15} aria-hidden /></summary>
          <p className={s.scope}>{selectedCard.scope}</p>
          {selectedCard.connection ? <aside className={s.contextConnection}><Link href={selectedCard.connection.href as Route}>{selectedCard.connection.label}<ArrowRight size={14} aria-hidden /></Link><p>{selectedCard.connection.body}</p><small>{S.connections}</small></aside> : null}
        </details>
      </SampleFlagSelection> : null}
      {manualPrompt ? <div className={s.manualCopy}><label htmlFor="sample-guidance">{S.guidanceLabel}</label><InteractiveTextarea id="sample-guidance" readOnly value={manualPrompt} onFocus={event => event.currentTarget.select()} rows={6} /></div> : null}
    </ResponsiveDepth>
  </div>
}
