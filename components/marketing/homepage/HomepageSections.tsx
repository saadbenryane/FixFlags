'use client'

import { useRef, useState } from 'react'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Copy, Sparkles } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { CARE_HOME as C, INTEGRATIONS_PAGE } from '@/lib/marketing/copy'
import { HOMEPAGE_EVIDENCE, HomepageIntro, HomepageUrlEntry, Signal } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export type HomepageCopySource = 'read' | 'share' | 'ai'
export type HomepageCopyResult = { source: HomepageCopySource; message: string } | null

export function HomepageWorkflowSection({
  onViewFlag,
  onCopy,
  copyResult,
}: {
  onViewFlag: () => void
  onCopy: (source: HomepageCopySource) => void
  copyResult: HomepageCopyResult
}) {
  const dragging = useRef(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const [reveal, setReveal] = useState(18)
  const verified = reveal >= 55
  const revealFromClientX = (clientX: number) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    const next = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100
    setReveal(Math.round(Math.min(100, Math.max(0, next))))
  }

  return <section
    className={`${s.section} ${s.workflow}`}
    id="flag-example"
    style={{ ['--workflow-reveal' as string]: `${reveal}%` }}
  >
    <HomepageIntro {...C.workflow} />
    <div className={s.workflowGrid}>
      <ol className={s.workflowSteps}>
        {C.workflow.steps.map((item, index) => <li key={item.id} data-step={item.id}>
          <span className={s.stepNumber}>0{index + 1}</span>
          <div><p>{item.label}</p><h3>{item.title}</h3><span>{item.body}</span>
            {item.id === 'fix' ? <div className={s.workflowActions}>
              <button type="button" onClick={() => onCopy('share')}><Copy size={15} aria-hidden="true" />{C.actions.choices[1].action}</button>
              <button type="button" onClick={() => onCopy('ai')}><Sparkles size={15} aria-hidden="true" />{C.actions.choices[2].action}</button>
              <span role="status">{copyResult?.source === 'share' || copyResult?.source === 'ai' ? copyResult.message : ''}</span>
            </div> : null}
          </div>
        </li>)}
      </ol>
      <div className={s.evidenceStage}>
        <figure className={s.evidenceCompare}>
          <div className={s.evidenceHeader}>
            <span className={s.evidenceBrand}><Logo variant="mark" size="sm" />{C.workflow.proofLabel}</span>
            <span className={s.evidencePage}>{C.workflow.page}</span>
          </div>
          <div className={s.compareFrame} ref={frameRef} data-compare-frame="true">
            <Image className={s.compareBefore} src={HOMEPAGE_EVIDENCE.failed} alt={C.workflow.failedAlt} fill sizes="(max-width: 767px) 100vw, 380px" />
            <span className={s.compareAfter}>
              <Image src={HOMEPAGE_EVIDENCE.passed} alt={C.workflow.passedAlt} fill sizes="(max-width: 767px) 100vw, 380px" />
            </span>
            <button
              type="button"
              className={s.compareLine}
              role="slider"
              aria-label={C.workflow.compareLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={reveal}
              aria-valuetext={verified ? C.workflow.passedTitle : C.workflow.failedTitle}
              onPointerDown={event => {
                dragging.current = true
                event.currentTarget.setPointerCapture?.(event.pointerId)
                revealFromClientX(event.clientX)
              }}
              onPointerMove={event => { if (dragging.current) revealFromClientX(event.clientX) }}
              onPointerUp={() => { dragging.current = false }}
              onPointerCancel={() => { dragging.current = false }}
              onKeyDown={event => {
                const next = event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : event.key === 'Home' ? -100 : event.key === 'End' ? 100 : 0
                if (!next && event.key !== 'Home' && event.key !== 'End') return
                event.preventDefault()
                setReveal(value => Math.min(100, Math.max(0, event.key === 'Home' ? 0 : event.key === 'End' ? 100 : value + next)))
              }}
            ><i /></button>
            <div className={s.flagDock}>
              <Signal tone={verified ? 'good' : 'bad'}>{verified ? C.workflow.passedLabel : C.workflow.failedLabel}</Signal>
              <strong>{verified ? C.workflow.passedTitle : C.workflow.failedTitle}</strong>
              <button type="button" onClick={onViewFlag}>{C.workflow.viewFlag}</button>
            </div>
          </div>
        </figure>
        <p className={s.evidenceNote}>{C.workflow.source}</p>
        <a className={s.textLink} href={HOMEPAGE_EVIDENCE.passed} target="_blank" rel="noopener noreferrer">{C.workflow.passedLink}</a>
      </div>
    </div>
  </section>
}

export function HomepageCoverageSection() {
  return <section className={`${s.section} ${s.coverage}`}>
    <HomepageIntro {...C.coverage} />
    <div className={s.coverageGrid}>
      {C.coverage.audiences.map(item => <article key={item.id} className={s.coverageCard}>
          <p className={s.coverageType}>{item.label}</p>
          <h3>{item.question}</h3>
          <p className={s.coverageOutcome}>{item.monitored}</p>
        </article>)}
    </div>
    <div className={s.coverageShared}>
      <p><span>{C.coverage.analysisLabel}</span>{C.coverage.analysis.join(' · ')}</p>
      <p className={s.coverageBoundary}>{C.coverage.boundary}</p>
    </div>
  </section>
}

export function HomepageMonitoringSection() {
  return <section className={`${s.section} ${s.monitoring}`} id="monitoring">
    <div>
      <HomepageIntro label={C.monitoring.label} title={C.monitoring.title} body={C.monitoring.body} />
    </div>
    <div className={s.notificationStack} aria-label="Illustrative monitoring notifications">
      {C.monitoring.notifications.map((item, index) => <article key={item.title} className={`${s.notification} ${s[`notification${index}`]}`}>
        <div className={s.notificationTop}><Signal tone={item.tone}>{item.status}</Signal><span>{item.time}</span></div>
        <h3>{item.title}</h3><p>{item.detail}</p>
      </article>)}
    </div>
  </section>
}

export function HomepageIntegrationsSection() {
  return <section className={`${s.section} ${s.integrations}`}>
    <HomepageIntro label={C.integrations.label} title={C.integrations.title} body={C.integrations.body} />
    <div className={s.orbitalField}>
      <Image src="/marketing/visuals/integrations-orbital-field-v1.webp" alt="" fill sizes="(max-width: 767px) 100vw, 1120px" className={s.orbitalBackdrop} />
      <div className={s.orbitalCenter}><Logo variant="mark" size="lg" /><span>FixFlags</span><small>Live Site outcomes</small></div>
      <div className={s.integrationOrbit}>
        {INTEGRATIONS_PAGE.items.map(item => <Link key={item.id} href={item.href as Route} className={s.integrationNode} data-integration={item.id}>
          <span className={s.integrationLogo}><Image src={item.logo} alt={`${item.title} logo`} width={28} height={28} /></span>
          <span><strong>{item.title}</strong><small>{item.purpose}</small></span>
        </Link>)}
      </div>
    </div>
    <Link href={'/integrations' as Route} className={s.integrationLink}>{C.integrations.action}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>
}

export function HomepageFinalSection() {
  return <section className={`${s.section} ${s.final}`} id="plans"><h2>{C.close.title}</h2><p>{C.close.body}</p><HomepageUrlEntry final /><Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link></section>
}
