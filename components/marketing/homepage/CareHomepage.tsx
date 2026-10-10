'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft, ArrowRight, Copy } from 'lucide-react'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { BoardStatus } from '@/components/sites/BoardCard'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S } from '@/lib/marketing/copy/care-homepage'
import { HomepageHero, type HomepageDetailCard } from './HomepageHero'
import { HomepageFinalSection, HomepageWorkflowSection, type HomepageCopyResult, type HomepageCopySource } from './HomepageSections'
import { HOMEPAGE_EVIDENCE } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export function CareHomepage() {
  const [selected, setSelected] = useState<HomepageDetailCard | null>(null)
  const [flag, setFlag] = useState<'availability' | 'checkout' | null>(null)
  const [proof, setProof] = useState(false)
  const [copyResult, setCopyResult] = useState<HomepageCopyResult>(null)
  const [manualPrompt, setManualPrompt] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const selectedCard = S.categories.find(card => card.id === selected)
  const prompt = flag === 'availability' ? S.availabilityPrompt : C.workflow.instructions
  const openCard = (card: HomepageDetailCard) => {
    opener.current = document.activeElement as HTMLElement
    setSelected(card); setFlag(null); setProof(false); setManualPrompt(null); setCopyResult(null)
  }
  const openFlag = () => {
    if (!selectedCard?.flag) return
    setFlag(selectedCard.flag); setProof(false); setCopyResult(null)
    requestAnimationFrame(() => heading.current?.focus())
  }
  const copyFlag = async (source: HomepageCopySource, text: string = C.workflow.instructions) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyResult({ source, message: S.guidanceCopied })
    } catch {
      if (selected === null) { openCard('conversion'); setFlag('checkout') }
      setManualPrompt(text)
      setCopyResult({ source, message: S.copyFailed })
    }
  }
  const restoreFocus = (event: Event) => { event.preventDefault(); opener.current?.focus() }
  const title = flag ? flag === 'availability' ? S.availabilityTitle : C.flag.title : selectedCard?.name ?? (selected === 'monitoring' ? C.monitoring.detailTitle : selected === 'coverage' ? S.coverageTitle : S.overviewTitle)

  return <div className={s.home}>
    <HomepageHero onOpen={openCard} />
    <HomepageWorkflowSection onViewFlag={() => { openCard('conversion'); setFlag('checkout') }} onCopy={source => void copyFlag(source)} copyResult={copyResult} />
    <HomepageFinalSection />
    <ResponsiveDepth open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }} onCloseAutoFocus={restoreFocus} className={s.dialog}>
      {flag ? <button type="button" className={s.backButton} onClick={() => { setFlag(null); setManualPrompt(null); setCopyResult(null); requestAnimationFrame(() => heading.current?.focus()) }}><ArrowLeft size={16} aria-hidden="true" />{S.backAction}</button> : null}
      <p className={s.depthSample}>{S.sampleLabel}</p>
      <DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle>
      <DialogDescription>{flag ? flag === 'availability' ? S.availabilityScope : C.flag.outcome : selectedCard?.scope ?? (selected === 'monitoring' ? C.monitoring.summary : selected === 'coverage' ? S.coverageBody : S.overviewBody)}</DialogDescription>
      {selected === 'monitoring' ? <>
        <div className={s.monitoringTiming}><strong>{C.monitoring.cadence}</strong><p>{C.monitoring.next}<span>{C.monitoring.nextValue}</span></p></div>
        <p className={s.scope}>{C.monitoring.sample}</p>
        <ul className={s.monitoringChecks}>{C.monitoring.rows.map(row => <li key={row.name}>
          <div><h3>{row.name}</h3><BoardStatus state={row.state} label={row.status} showText /></div>
          <p>{row.scope}</p><dl><dt>{C.monitoring.last}</dt><dd>{row.last}</dd></dl>
        </li>)}</ul>
        <div className={s.monitoringGap}><h3>{C.monitoring.unconfiguredTitle}</h3><p>{C.monitoring.unconfiguredBody}</p><span>{C.monitoring.notScheduled}</span></div>
        <p className={s.scope}>{C.monitoring.note}</p><p className={s.scope}>{C.monitoring.setup}</p>
      </> : flag ? <>
        <dl className={s.flagFacts}>
          <div><dt>{S.observedLabel}</dt><dd>{flag === 'availability' ? S.availabilityObserved : C.flag.body}</dd></div>
          <div><dt>{S.expectedLabel}</dt><dd>{flag === 'availability' ? S.availabilityExpected : S.checkoutExpected}</dd></div>
        </dl>
        <BoardDetails image={{ src: flag === 'availability' ? '/marketing/evidence/pricing-unavailable.png' : HOMEPAGE_EVIDENCE.failed, alt: flag === 'availability' ? S.availabilityAlt : C.flag.cropAlt }} sources={[flag === 'availability' ? S.sources.http : S.sources.browser]} checkedAt={C.exampleCheckedAt} />
        <section className={s.fixGuidance}><h3>{S.fixTitle}</h3><p>{flag === 'availability' ? S.availabilityFix : C.workflow.instructions}</p>
          <button type="button" onClick={() => void copyFlag('read', prompt)}><Copy size={16} aria-hidden="true" />{S.sampleCopy}</button>
          <p className={s.copyStatus} role="status">{copyResult?.source === 'read' ? copyResult.message : ''}</p>
        </section>
        {flag === 'checkout' ? <section className={s.recoveryProof}>
          <button type="button" aria-expanded={proof} onClick={() => setProof(value => !value)}>{S.recoveryAction}<ArrowRight size={16} aria-hidden="true" /></button>
          {proof ? <><h3>{S.proofTitle}</h3><p>{S.proofBody}</p><BoardDetails image={{ src: HOMEPAGE_EVIDENCE.passed, alt: S.proofAlt }} sources={[S.sources.browser]} checkedAt="2026-09-14T09:15:00Z" /></> : null}
        </section> : <p className={s.scope}>{S.unresolved}</p>}
      </> : selectedCard ? <>
        <div className={s.depthAnswer}><strong>{selectedCard.answer}</strong><BoardStatus state={selectedCard.state} label={selectedCard.status} showText /></div>
        <h3 className={s.resultsTitle}>{S.resultsTitle}</h3>
        <ul className={s.resultList}>{selectedCard.results.map(result => <li key={result.label}>
          <div><strong>{result.label}</strong><span data-result={result.status}>{result.status}</span></div><p>{result.detail}</p>
          {result.status === 'Flag' ? <button type="button" onClick={openFlag}>{S.detailAction}<ArrowRight size={16} aria-hidden="true" /></button> : null}
        </li>)}</ul>
        <BoardDetails checkedAt={selectedCard.checkedAt} sources={[selectedCard.flag ? selectedCard.flag === 'availability' ? S.sources.http : S.sources.browser : S.sources.diagnostics]} coverage={selectedCard.scope} />
        {selectedCard.connection ? <aside className={s.contextConnection}><Link href={selectedCard.connection.href as Route}>{selectedCard.connection.label}<ArrowRight size={14} aria-hidden="true" /></Link><p>{selectedCard.connection.body}</p><small>{S.connections}</small></aside> : null}
      </> : <ul className={s.coverageList}>{S.categories.map(card => <li key={card.id}>
        <button type="button" onClick={() => { setSelected(card.id); requestAnimationFrame(() => heading.current?.focus()) }}><strong>{card.name}</strong><BoardStatus state={card.state} label={card.status} showText /><ArrowRight size={16} aria-hidden="true" /></button><p>{card.scope}</p>
      </li>)}</ul>}
      {selected === 'coverage' ? <section className={s.supportedCoverage}><h3>{C.coverage.title}</h3><ul>{C.coverage.audiences.map(item => <li key={item.id}><strong>{item.question}</strong><p>{item.monitored}</p></li>)}</ul><p>{C.coverage.boundary}</p></section> : null}
      {manualPrompt ? <div className={s.manualCopy}><label htmlFor="sample-guidance">{S.guidanceLabel}</label><textarea id="sample-guidance" readOnly value={manualPrompt} onFocus={event => event.currentTarget.select()} rows={6} /></div> : null}
      <p className={s.sampleNote}>{S.note}</p>
      <a className={s.textLink} href="#analyze" onClick={() => { opener.current = document.getElementById('audit-url-care-hero'); setSelected(null) }}>{S.analyzeAction}<ArrowRight size={16} aria-hidden="true" /></a>
    </ResponsiveDepth>
  </div>
}
