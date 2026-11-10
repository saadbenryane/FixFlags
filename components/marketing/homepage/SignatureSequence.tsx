'use client'

import Image from 'next/image'
import { useEffect, useId, useState } from 'react'
import { Check, Flag, Pause, Play, RotateCcw, Terminal } from 'lucide-react'
import { SIGNATURE_SEQUENCE as C, type SignatureStepId } from '@/lib/marketing/copy/signature-sequence'
import s from './SignatureSequence.module.css'

/** Each scene holds long enough to read its caption; the whole story runs about 15 seconds. */
export const SIGNATURE_STEP_MS = 3800

const STEPS = C.steps

function BrowserScene({ step }: { step: SignatureStepId }) {
  return <div className={s.browser}>
    <div className={s.chrome} aria-hidden="true"><span /><span /><span /><p>{C.browser.url}</p></div>
    <div className={s.page}>
      <Image src={C.browser.capture} alt={C.browser.captureAlt} width={720} height={440} priority sizes="(max-width: 639px) 92vw, (max-width: 1179px) 80vw, 640px" className={s.capture} />
      <span className={s.target} data-state={step} aria-hidden="true" />
      {step === 'check' ? <span className={s.cursor} aria-hidden="true" /> : null}
      {step === 'flag' ? <span className={s.marker} aria-hidden="true"><Flag size={14} strokeWidth={2.5} /></span> : null}
    </div>
    {step === 'check' ? <ol className={s.log}>{C.browser.log.map((entry, index) => <li key={entry} style={{ '--entry': index } as React.CSSProperties}>{entry}</li>)}</ol> : null}
  </div>
}

function FlagCard() {
  return <article className={s.flagCard} aria-label={C.flag.label}>
    <p className={s.flagLabel}><Flag size={13} aria-hidden="true" />{C.flag.label}</p>
    <h3>{C.flag.title}</h3>
    <dl>{C.flag.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
  </article>
}

function FixScene() {
  return <div className={s.terminal}>
    <div className={s.terminalBar}><Terminal size={14} aria-hidden="true" /><span>{C.fix.tool}</span></div>
    <div className={s.terminalBody}>
      <p className={s.command}><span aria-hidden="true">&gt;</span> {C.fix.command}</p>
      <ul>{C.fix.lines.map((line, index) => <li key={line} style={{ '--line': index } as React.CSSProperties}>{line}</li>)}</ul>
      <p className={s.copyState} aria-hidden="true"><span className={s.copyLabel}>{C.fix.copy}</span><span className={s.copiedLabel}><Check size={13} />{C.fix.copied}</span></p>
    </div>
  </div>
}

function ReceiptScene() {
  return <article className={s.receipt} aria-label={C.receipt.stamp}>
    <p className={s.stamp}><Check size={16} strokeWidth={3} aria-hidden="true" />{C.receipt.stamp}</p>
    <h3>{C.receipt.title}</h3>
    <dl>{C.receipt.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    <p className={s.receiptNote}>{C.receipt.note}</p>
  </article>
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

  return <figure className={s.stage} aria-label={C.label} data-playing={playing || undefined}>
    <div className={s.tabs} role="tablist" aria-label={C.controls.steps}>
      {STEPS.map((item, itemIndex) => <button key={item.id} id={`${id}-tab-${itemIndex}`} type="button" role="tab"
        aria-selected={itemIndex === index} aria-controls={`${id}-panel`} tabIndex={itemIndex === index ? 0 : -1}
        className={s.tab} data-done={itemIndex < index || undefined} onClick={() => select(itemIndex)} onKeyDown={onKeyDown}>
        <span className={s.tabIndex} aria-hidden="true">{itemIndex + 1}</span>{item.tab}
        {itemIndex === index && playing ? <span key={`${run}-${index}`} className={s.progress} aria-hidden="true" style={{ animationDuration: `${SIGNATURE_STEP_MS}ms` }} /> : null}
      </button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} className={s.scene} data-step={step.id} key={`${run}-${step.id}`}>
      {step.id === 'check' || step.id === 'flag' ? <BrowserScene step={step.id} /> : null}
      {step.id === 'flag' ? <FlagCard /> : null}
      {step.id === 'fix' ? <FixScene /> : null}
      {step.id === 'verify' ? <ReceiptScene /> : null}
    </div>
    <figcaption className={s.footer}>
      <p className={s.caption}>{step.caption}</p>
      <div className={s.controls}>
        <span className={s.sample}>{C.sampleNote}</span>
        {finished
          ? <button type="button" className={s.control} onClick={replay}><RotateCcw size={15} aria-hidden="true" />{C.controls.replay}</button>
          : <button type="button" className={s.control} onClick={() => setPlaying(current => !current)}>
              {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}{playing ? C.controls.pause : C.controls.play}
            </button>}
      </div>
    </figcaption>
  </figure>
}
