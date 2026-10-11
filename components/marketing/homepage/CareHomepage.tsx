'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft, ArrowRight, Copy, RefreshCw } from 'lucide-react'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { BoardStatus } from '@/components/sites/BoardCard'
import { showFixPromptCopied } from '@/components/sites/FixPromptToast'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import { HomepageHero, type HomepageDetailCard } from './HomepageHero'
import { HomepageCheckCoverage } from './HomepageCheckCoverage'
import { HomepageFinalSection, HomepageHandoffSection, HomepageIntegrationsSection, type HomepageCopyResult, type HomepageCopySource } from './HomepageSections'
import s from './CareHomepage.module.css'

export function CareHomepage() {
  const [selected, setSelected] = useState<HomepageDetailCard | null>(null)
  const [flag, setFlag] = useState<SampleFlagId | null>(null)
  const [copyResult, setCopyResult] = useState<HomepageCopyResult>(null)
  const [manualPrompt, setManualPrompt] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const selectedCard = S.categories.find(card => card.id === selected)
  const selectedFlag = flag ? SAMPLE_FLAGS[flag] : null
  const prompt = selectedFlag?.prompt ?? C.workflow.instructions
  const openCard = (card: HomepageDetailCard) => {
    opener.current = document.activeElement as HTMLElement
    setSelected(card); setFlag(null); setManualPrompt(null); setCopyResult(null)
  }
  const openFlag = (id: SampleFlagId) => {
    setFlag(id); setCopyResult(null)
    requestAnimationFrame(() => heading.current?.focus())
  }
  const openSampleFlag = (card: typeof S.categories[number], id: SampleFlagId) => {
    opener.current = document.activeElement as HTMLElement
    setSelected(card.id); setFlag(id); setManualPrompt(null); setCopyResult(null)
  }
  const copyFlag = async (source: HomepageCopySource, text: string = C.workflow.instructions, card?: typeof S.categories[number], id?: SampleFlagId) => {
    try {
      await navigator.clipboard.writeText(text)
      setManualPrompt(null)
      showFixPromptCopied()
      setCopyResult({ source, message: source === 'share' ? C.story.copied : S.guidanceCopied })
    } catch {
      if (selected === null && source !== 'share') {
        if (card && id) openSampleFlag(card, id)
        else { openCard('conversion'); setFlag('checkout') }
      }
      setManualPrompt(text)
      setCopyResult({ source, message: S.copyFailed })
    }
  }
  const restoreFocus = (event: Event) => { event.preventDefault(); opener.current?.focus() }
  const title = selectedFlag?.title ?? selectedCard?.name ?? ''

  return <div className={s.home}>
    <HomepageHero onOpen={openCard} onOpenFlag={openSampleFlag} onCopyFlag={(card, id) => void copyFlag('read', SAMPLE_FLAGS[id].prompt, card, id)} />
    <HomepageCheckCoverage />
    <HomepageHandoffSection onCopy={(source, prompt) => void copyFlag(source, prompt)} copyResult={copyResult} manualPrompt={selected === null ? manualPrompt : null} />
    <HomepageIntegrationsSection />
    <HomepageFinalSection />
    <ResponsiveDepth open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }} onCloseAutoFocus={restoreFocus} className={s.dialog}>
      {flag ? <button type="button" className={s.backButton} onClick={() => { setFlag(null); setManualPrompt(null); setCopyResult(null); requestAnimationFrame(() => heading.current?.focus()) }}><ArrowLeft size={16} aria-hidden="true" />Back to {selectedCard?.name ?? 'area'}</button> : null}
      <DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle>
      <DialogDescription>{selectedFlag?.scope ?? selectedCard?.context ?? ''}</DialogDescription>
      {!flag && selectedCard ? <a className={s.categoryRecheck} href="#analyze" onClick={() => { opener.current = document.getElementById('audit-url-care-hero'); setSelected(null) }}><RefreshCw size={15} aria-hidden="true" />Recheck {selectedCard.name}</a> : null}
      {selectedFlag ? <>
        <dl className={s.flagFacts}>
          <div><dt>{S.observedLabel}</dt><dd>{selectedFlag.observed}</dd></div>
          <div><dt>{S.expectedLabel}</dt><dd>{selectedFlag.expected}</dd></div>
        </dl>
        <section className={s.flagSource} aria-label="Affected page">
          {selectedFlag.image ? <Image src={selectedFlag.image} alt={selectedFlag.imageAlt ?? ''} width={1280} height={720} /> : null}
          <a href={selectedFlag.url}>{selectedFlag.page}</a>
        </section>
        <section className={s.fixGuidance}><h3>{S.fixTitle}</h3><p>{S.fixBody}</p><p className={s.promptSummary}>{selectedFlag.fix}</p>
          <button type="button" onClick={() => void copyFlag('read', prompt)}><Copy size={16} aria-hidden="true" />{S.sampleCopy}</button>
          <Link href="/dashboard/mcp-setup">{S.mcpAction}<ArrowRight size={16} aria-hidden="true" /></Link>
          {manualPrompt ? <p className={s.copyStatus} role="status">{copyResult?.source === 'read' ? copyResult.message : ''}</p> : null}
        </section>
      </> : selectedCard ? <>
        <div className={s.depthAnswer}><strong>{selectedCard.answer}</strong><BoardStatus state={selectedCard.state} label={selectedCard.status} showText /></div>
        <h3 className={s.resultsTitle}>{S.resultsTitle}</h3>
        <ul className={s.resultList}>{selectedCard.results.map(result => <li key={result.label}>
          <div><strong>{result.label}</strong><span data-result={result.status}>{result.status}</span></div><p>{result.detail}</p>
          {result.status === 'Flag' && (result.flag ?? selectedCard.flag) ? <button type="button" aria-label={`View Flag for ${result.label}`} onClick={() => openFlag((result.flag ?? selectedCard.flag)!)}>{S.detailAction}<ArrowRight size={16} aria-hidden="true" /></button> : null}
        </li>)}</ul>
        <p className={s.scope}>{selectedCard.scope}</p>
        {selectedCard.connection ? <aside className={s.contextConnection}><Link href={selectedCard.connection.href as Route}>{selectedCard.connection.label}<ArrowRight size={14} aria-hidden="true" /></Link><p>{selectedCard.connection.body}</p><small>{S.connections}</small></aside> : null}
      </> : null}
      {manualPrompt ? <div className={s.manualCopy}><label htmlFor="sample-guidance">{S.guidanceLabel}</label><textarea id="sample-guidance" readOnly value={manualPrompt} onFocus={event => event.currentTarget.select()} rows={6} /></div> : null}
      <a className={s.textLink} href="#analyze" onClick={() => { opener.current = document.getElementById('audit-url-care-hero'); setSelected(null) }}>{S.analyzeAction}<ArrowRight size={16} aria-hidden="true" /></a>
    </ResponsiveDepth>
  </div>
}
