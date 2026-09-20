'use client'

import { useEffect, useRef, useState } from 'react'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, ChevronRight, CircleCheck, Copy, Eye, Share2, Sparkles } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { CARE_HOME as C, type HomepageAudienceKey } from '@/lib/marketing/copy'
import { HOMEPAGE_EVIDENCE, HomepageIntro, HomepageUrlEntry, Signal } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export type HomepageCopySource = 'read' | 'share' | 'ai'
export type HomepageCopyResult = { source: HomepageCopySource; message: string } | null

const actionIcons = { read: Eye, share: Share2, ai: Sparkles }

function useScrollStep<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [activeStep, setActiveStep] = useState('flag')

  useEffect(() => {
    const node = ref.current
    if (!node) return
    let frame = 0
    const update = () => {
      frame = 0
      const steps = Array.from(node.querySelectorAll<HTMLElement>('[data-step]'))
      const readingLine = window.innerHeight * .45
      let current = steps[0]
      for (const step of steps) if (step.getBoundingClientRect().top <= readingLine) current = step
      if (current?.dataset.step) setActiveStep(previous => previous === current?.dataset.step ? previous : current!.dataset.step!)

      const first = steps[0]?.getBoundingClientRect()
      const last = steps.at(-1)?.getBoundingClientRect()
      if (first && last) {
        const progress = Math.min(1, Math.max(0, (readingLine - first.top) / Math.max(last.bottom - first.top, 1)))
        node.style.setProperty('--workflow-reveal', `${Math.round(progress * 1000) / 10}%`)
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return { ref, activeStep }
}

export function HomepageWorkflowSection() {
  const workflow = useScrollStep<HTMLElement>()
  return <section ref={workflow.ref} className={`${s.section} ${s.workflow}`} id="flag-example" data-active-step={workflow.activeStep}>
    <HomepageIntro {...C.workflow} />
    <div className={s.workflowGrid}>
      <ol className={s.workflowSteps}>
        {C.workflow.steps.map((item, index) => <li key={item.id} data-step={item.id} aria-current={workflow.activeStep === item.id ? 'step' : undefined}>
          <span className={s.stepNumber}>0{index + 1}</span>
          <div><p>{item.label}</p><h3>{item.title}</h3><span>{item.body}</span></div>
        </li>)}
      </ol>
      <div className={s.evidenceStage}>
        <figure className={s.evidenceCompare}>
          <div className={s.evidenceHeader}>
            <Signal tone="bad">{C.workflow.failedLabel}</Signal>
            <span className={s.evidencePage}>{C.workflow.page}</span>
            <Signal tone="good">{C.workflow.passedLabel}</Signal>
          </div>
          <a href={HOMEPAGE_EVIDENCE.passed} target="_blank" rel="noopener noreferrer" aria-label={C.workflow.passedLink}>
            <span className={s.compareFrame}>
              <Image className={s.compareBefore} src={HOMEPAGE_EVIDENCE.failed} alt={C.workflow.failedAlt} fill sizes="(max-width: 767px) calc(100vw - 48px), 650px" />
              <span className={s.compareAfter}>
                <Image src={HOMEPAGE_EVIDENCE.passed} alt={C.workflow.passedAlt} fill sizes="(max-width: 767px) calc(100vw - 48px), 650px" />
              </span>
              <span className={s.compareLine} aria-hidden="true"><i /></span>
            </span>
          </a>
          <figcaption><span>{C.workflow.failedTitle}</span><span>{C.workflow.passedTitle}</span></figcaption>
        </figure>
        <p className={s.evidenceNote}>{C.workflow.source}</p>
      </div>
    </div>
  </section>
}

export function HomepageCoverageSection() {
  const [audience, setAudience] = useState<HomepageAudienceKey>('website')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const active = C.coverage.audiences.find(item => item.id === audience) ?? C.coverage.audiences[0]

  const selectFromKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const last = C.coverage.audiences.length - 1
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowRight' ? (index + 1) % (last + 1) : (index - 1 + last + 1) % (last + 1)
    const nextAudience = C.coverage.audiences[next]
    setAudience(nextAudience.id)
    tabRefs.current[next]?.focus()
  }

  return <section className={`${s.section} ${s.coverage}`}>
    <HomepageIntro {...C.coverage} />
    <div className={s.coverageCard}>
      <div className={s.audienceTabs} role="tablist" aria-label={C.coverage.label}>
        {C.coverage.audiences.map((item, index) => <button
          key={item.id}
          ref={node => { tabRefs.current[index] = node }}
          id={`coverage-tab-${item.id}`}
          type="button"
          role="tab"
          aria-selected={audience === item.id}
          aria-controls={`coverage-panel-${item.id}`}
          tabIndex={audience === item.id ? 0 : -1}
          onClick={() => setAudience(item.id)}
          onKeyDown={event => selectFromKeyboard(event, index)}
        >{item.label}</button>)}
      </div>
      <div className={s.coveragePanel} id={`coverage-panel-${active.id}`} role="tabpanel" aria-labelledby={`coverage-tab-${active.id}`}>
        <p>{active.summary}</p>
        <ul>{active.items.map(item => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
      </div>
    </div>
  </section>
}

export function HomepageHandoffSection({
  showInstructions,
  copyResult,
  onToggleDetails,
  onCopy,
}: {
  showInstructions: boolean
  copyResult: HomepageCopyResult
  onToggleDetails: () => void
  onCopy: (source: HomepageCopySource) => void
}) {
  return <section className={`${s.section} ${s.actions}`}>
    <HomepageIntro label={C.actions.label} title={C.actions.title} body={C.actions.body} />
    <div className={s.actionWorkbench}>
      <article className={s.fixPacket}>
        <div className={s.fixPacketTop}><Signal tone="bad">{C.workflow.failedLabel}</Signal><span>{C.workflow.page}</span></div>
        <h3>{C.flag.title}</h3>
        <p>{C.flag.body}</p>
        <dl>{C.actions.packet.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
      </article>
      <div className={s.actionRoutes}>{C.actions.choices.map(choice => {
        const Icon = actionIcons[choice.id]
        const source = choice.id as HomepageCopySource
        return <article key={choice.id}>
          <span className={s.actionIcon}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <div><h3>{choice.title}</h3><p>{choice.body}</p></div>
          {choice.id === 'read'
            ? <button aria-expanded={showInstructions} aria-controls="flag-details" onClick={onToggleDetails}>{showInstructions ? C.actions.hide : choice.action}<ChevronRight size={16} aria-hidden="true" /></button>
            : <button onClick={() => onCopy(source)}><Copy size={15} aria-hidden="true" />{choice.action}</button>}
          <p className={s.copyStatus} role="status">{copyResult?.source === source ? copyResult.message : ''}</p>
        </article>
      })}</div>
    </div>
    <div id="flag-details" hidden={!showInstructions} className={s.expandedInstructions}><p>{C.workflow.instructions}</p></div>
    <p className={s.verifyLine}><CircleCheck size={18} aria-hidden="true" />{C.actions.verify}</p>
  </section>
}

export function HomepageMonitoringSection() {
  return <section className={`${s.section} ${s.quiet}`}>
    <HomepageIntro title={C.quiet.title} body={C.quiet.body} />
    <div className={s.notificationStack}>
      {C.quiet.notifications.map((item, index) => <article key={item.title} className={`${s.notification} ${s[`notification${index}`]}`}>
        <div className={s.notificationTop}><Logo variant="mark" size="sm" /><b>{C.brand}</b><span>{item.time}</span></div>
        <Signal tone={item.tone}>{item.status}</Signal><h3>{item.title}</h3><p>{item.detail}</p>
      </article>)}
    </div>
  </section>
}

export function HomepageIntegrationsSection() {
  return <section className={`${s.section} ${s.integrations}`}>
    <HomepageIntro label={C.integrations.label} title={C.integrations.title} body={C.integrations.body} />
    <div className={s.integrationLayout}>
      <article className={s.availableIntegration}>
        <p>{C.integrations.availableLabel}</p>
        <h3>{C.integrations.availableTitle}</h3>
        <span>{C.integrations.availableBody}</span>
        <Link href="/install">{C.integrations.availableAction}<ArrowRight size={16} aria-hidden="true" /></Link>
      </article>
      <div className={s.futureIntegrations}>
        <p>{C.integrations.futureLabel}</p>
        <ul>{C.integrations.future.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
    <Link href={'/integrations' as Route} className={s.integrationLink}>{C.integrations.action}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>
}

export function HomepageFinalSection() {
  return <section className={`${s.section} ${s.final}`} id="plans"><h2>{C.close.title}</h2><p>{C.close.body}</p><HomepageUrlEntry final /><Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link></section>
}
