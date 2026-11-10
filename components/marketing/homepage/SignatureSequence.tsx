'use client'

import Image from 'next/image'
import { useEffect, useId, useState } from 'react'
import { Check, Flag, Pause, Play, RotateCcw, Terminal } from 'lucide-react'
import { SIGNATURE_SEQUENCE as C, type SignatureStepId } from '@/lib/marketing/copy/signature-sequence'
import s from './SignatureSequence.module.css'

/** Each scene holds long enough to read; the whole story runs about 16 seconds. */
export const SIGNATURE_STEP_MS = 4000

const STEPS = C.steps

/** The page the visitor sees: the real capture, with the cursor, the Flag marker, or the recheck. */
function PageView({ step }: { step: SignatureStepId }) {
  if (step === 'verify') return <div className={s.page} data-step={step}>
    <Image src={C.browser.after} alt={C.browser.afterAlt} width={780} height={1520} sizes="(max-width: 899px) 92vw, 600px" className={s.after} />
    <p className={s.pageLabel}><i aria-hidden="true" />{C.browser.afterLabel}</p>
  </div>
  return <div className={s.page} data-step={step}>
    <div className={s.frame}>
      <Image src={C.browser.capture} alt={C.browser.captureAlt} width={720} height={440} priority sizes="(max-width: 899px) 92vw, 700px" className={s.capture} />
      <span className={s.target} data-state={step} aria-hidden="true" />
      {step === 'check' ? <span className={s.cursor} aria-hidden="true" /> : null}
      {step !== 'check' ? <span className={s.marker} aria-hidden="true"><Flag size={13} strokeWidth={2.5} /></span> : null}
    </div>
  </div>
}

/** What FixFlags shows beside the page at each step. */
function Panel({ step }: { step: SignatureStepId }) {
  switch (step) {
    case 'check': return <div className={s.card}>
      <p className={s.cardHead}><span className={s.live} aria-hidden="true" />{C.browser.logTitle}<small>{C.browser.logState}</small></p>
      <ol className={s.log}>{C.browser.log.map((entry, index) => <li key={entry} style={{ '--entry': index } as React.CSSProperties} data-pending={index === C.browser.log.length - 1 || undefined}>
        {index === C.browser.log.length - 1 ? <span className={s.spinner} aria-hidden="true" /> : <Check size={13} strokeWidth={2.5} aria-hidden="true" />}{entry}
      </li>)}</ol>
    </div>
    case 'flag': return <article className={s.card} aria-label={C.flag.label}>
      <p className={s.flagLabel}><Flag size={13} aria-hidden="true" />{C.flag.label}</p>
      <h3>{C.flag.title}</h3>
      <dl>{C.flag.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
    </article>
    case 'fix': return <div className={s.terminal}>
      <p className={s.terminalBar}><Terminal size={13} aria-hidden="true" />{C.fix.tool}</p>
      <div className={s.terminalBody}>
        <p className={s.command}><span aria-hidden="true">&gt;</span> {C.fix.command}</p>
        <ul>{C.fix.lines.map((line, index) => <li key={line} style={{ '--line': index } as React.CSSProperties}>{line}</li>)}</ul>
        <p className={s.copyState} aria-hidden="true"><span>{C.fix.copy}</span><span className={s.copied}><Check size={13} />{C.fix.copied}</span></p>
      </div>
    </div>
    case 'verify': return <article className={s.card} aria-label={C.receipt.stamp}>
      <p className={s.stamp}><Check size={14} strokeWidth={3} aria-hidden="true" />{C.receipt.stamp}</p>
      <h3>{C.receipt.title}</h3>
      <dl className={s.receiptRows}>{C.receipt.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      <p className={s.note}>{C.receipt.note}</p>
    </article>
  }
}

export function SignatureSequence() {
  const id = useId()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)

  // Motion starts only when the visitor has not asked for reduced motion.
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true)
  }, [])

  useEffect(() => {
    if (!playing) return
    if (index === STEPS.length - 1) { setPlaying(false); return }
    const timer = window.setTimeout(() => setIndex(current => current + 1), SIGNATURE_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index, run])

  const step = STEPS[index]
  const finished = !playing && index === STEPS.length - 1
  const select = (next: number) => { setPlaying(false); setIndex(next) }
  const replay = () => { setIndex(0); setRun(current => current + 1); setPlaying(true) }
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + STEPS.length) % STEPS.length
    select(next)
    document.getElementById(`${id}-tab-${next}`)?.focus()
  }

  return <figure className={s.sequence} aria-label={C.label} data-playing={playing || undefined}>
    <div className={s.rail} role="tablist" aria-label={C.controls.steps}>
      {STEPS.map((item, itemIndex) => <button key={item.id} id={`${id}-tab-${itemIndex}`} type="button" role="tab"
        aria-selected={itemIndex === index} aria-controls={`${id}-panel`} tabIndex={itemIndex === index ? 0 : -1}
        className={s.step} data-state={itemIndex < index ? 'done' : itemIndex === index ? 'active' : 'next'} onClick={() => select(itemIndex)} onKeyDown={onKeyDown}>
        <span className={s.stepIndex} aria-hidden="true">{String(itemIndex + 1).padStart(2, '0')}</span>
        <span className={s.stepTitle}>{item.tab}.</span>
        <span className={s.stepLine}>{item.caption}</span>
        {itemIndex === index && playing ? <span key={`${run}-${index}`} className={s.progress} aria-hidden="true" style={{ animationDuration: `${SIGNATURE_STEP_MS}ms` }} /> : null}
      </button>)}
    </div>
    <p className={s.mobileCaption} aria-hidden="true">{step.caption}</p>
    <div className={s.window}>
      <div className={s.chrome}>
        <span className={s.dots} aria-hidden="true"><i /><i /><i /></span>
        <p className={s.url}>{C.browser.url}</p>
        <span className={s.sample}>{C.sampleNote}</span>
        {finished
          ? <button type="button" className={s.control} onClick={replay}><RotateCcw size={14} aria-hidden="true" />{C.controls.replay}</button>
          : <button type="button" className={s.control} onClick={() => setPlaying(current => !current)}>
              {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{playing ? C.controls.pause : C.controls.play}
            </button>}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} className={s.body} data-step={step.id} key={`${run}-${step.id}`}>
        <PageView step={step.id} />
        <div className={s.side}><Panel step={step.id} /></div>
      </div>
    </div>
  </figure>
}
