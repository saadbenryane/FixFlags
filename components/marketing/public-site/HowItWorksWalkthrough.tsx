'use client'

import { InteractiveButton, InteractiveTextarea } from '@/components/ui/interactive-controls'
import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Activity, ArrowRight, Check, Copy, Flag, Gauge, Globe, MousePointer2, Radar, Search, ShieldCheck, Sparkles, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { SAMPLE_FLAGS, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import s from '@/app/(marketing)/how-it-works/HowItWorksPage.module.css'

const C = PUBLIC_SITE_COPY.howItWorks
const AREA_ICONS = { uptime: Activity, site: Globe, conversion: MousePointer2, performance: Gauge, search: Search, security: ShieldCheck, tracking: Radar, accessibility: Sparkles }

export function HowItWorksWalkthrough({ areas }: { areas: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<SampleFlagId>('availability')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const focusManualPrompt = useCallback((element: HTMLTextAreaElement | null) => {
    if (element) { element.focus(); element.select() }
  }, [])
  const copyGeneration = useRef(0)
  const example = SAMPLE_FLAGS[selected]
  const chooseExample = (id: SampleFlagId) => { copyGeneration.current++; setSelected(id); setCopyState('idle') }
  const copyPrompt = async () => {
    const generation = ++copyGeneration.current
    try {
      await navigator.clipboard.writeText(example.prompt)
      if (generation === copyGeneration.current) setCopyState('copied')
    } catch {
      if (generation === copyGeneration.current) setCopyState('manual')
    }
  }

  return <ol className={s.loop} aria-label={C.title}>
    <li className={s.step}>
      <div className={s.narrative}>
        <div className={s.stepLabel}><span className={s.icon}><Radar aria-hidden size={28} strokeWidth={1.5} /></span><span><small aria-hidden>01</small>{C.steps[0].label}</span></div>
        <h2>{C.steps[0].title}</h2><p className={s.body}>{C.steps[0].body}</p>
        <Link className={s.textLink} href="/coverage">{C.monitor.detail}<ArrowRight aria-hidden size={16} /></Link>
      </div>
      <div className={s.monitor}>
        <h3>{C.monitor.title}</h3><p>{C.monitor.body}</p>
        <div className={s.areas}>{areas.map(area => {
          const Icon = AREA_ICONS[area.id as keyof typeof AREA_ICONS]
          return <Link key={area.id} href={`/coverage#${area.id}`}><Icon aria-hidden size={22} strokeWidth={1.5} /><span>{area.name}</span><ArrowRight aria-hidden size={14} /></Link>
        })}</div>
      </div>
    </li>
    <li className={s.step}>
      <div className={s.narrative}>
        <div className={s.stepLabel}><span className={s.icon}><Flag aria-hidden size={28} strokeWidth={1.5} /></span><span><small aria-hidden>02</small>{C.steps[1].label}</span></div>
        <h2>{C.steps[1].title}</h2><p className={s.body}>{C.steps[1].body}</p>
        <div className={s.examplePicker} role="group" aria-label={C.walkthrough.label}>{C.walkthrough.examples.map(item => <InteractiveButton key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => chooseExample(item.id)}>{item.label}<ArrowRight aria-hidden size={16} /></InteractiveButton>)}</div>
      </div>
      <div className={s.flagPanel} aria-live="polite" aria-atomic="true">
        <div className={s.flagHeader}><span className={s.flagLabel}><Flag aria-hidden size={13} />{C.steps[1].label}</span><span className={s.pagePath}>{example.page}</span></div>
        <h3>{example.title}</h3>
        <dl className={s.facts}><div><dt>{C.walkthrough.observed}</dt><dd>{example.observed}</dd></div><div><dt>{C.walkthrough.expected}</dt><dd>{example.expected}</dd></div></dl>
        {selected === 'checkout' ? <figure className={s.cartEvidence}><Image src="/marketing/evidence/purchase-broken.png" alt={C.example.imageAlt} width={780} height={1520} sizes="(min-width: 640px) 260px, 70vw" /></figure> : selected === 'availability' ? <div className={s.response}><span>{C.walkthrough.response}</span><strong>404</strong><code>{example.page}</code></div> : <div className={s.loading}><Gauge aria-hidden size={32} strokeWidth={1.5} /><span>{C.walkthrough.performanceLabel}</span><strong>{C.walkthrough.performanceValue}</strong></div>}
        <p className={s.provenance}>{C.walkthrough.provenance}</p>
      </div>
    </li>
    <li className={s.step}>
      <div className={s.narrative}>
        <div className={s.stepLabel}><span className={s.icon}><Wrench aria-hidden size={28} strokeWidth={1.5} /></span><span><small aria-hidden>03</small>{C.steps[2].label}</span></div>
        <h2>{C.steps[2].title}</h2><p className={s.body}>{C.steps[2].body}</p>
        <Link className={s.textLink} href="/docs/fix-with-ai">{C.walkthrough.guidance}<ArrowRight aria-hidden size={16} /></Link>
      </div>
      <div className={s.fixPanel}>
        <div className={s.promptHeading}><span className={s.icon}><Copy aria-hidden size={22} strokeWidth={1.5} /></span><span className={s.pagePath}>{example.page}</span></div>
        <h3>{C.walkthrough.fixTitle}</h3><p>{C.walkthrough.fixBody}</p>
        <blockquote className={s.prompt}>{example.prompt}</blockquote>
        <Button variant="outline" onClick={() => void copyPrompt()}><Copy aria-hidden size={16} />{C.walkthrough.copy}</Button>
        {copyState === 'copied' ? <p className={s.copyStatus} role="status"><Check aria-hidden size={16} />{C.walkthrough.copied}</p> : null}
        {copyState === 'manual' ? <div className={s.manualCopy}><p role="status">{C.walkthrough.copyFallback}</p><InteractiveTextarea ref={focusManualPrompt} aria-label={C.walkthrough.promptLabel} readOnly value={example.prompt} rows={6} onFocus={event => event.currentTarget.select()} /></div> : null}
        <details className={s.comparison}>
          <summary>{C.walkthrough.recoveryDetail}</summary>
          <h4>{C.walkthrough.recoveryTitle}</h4><p>{C.walkthrough.recoveryBody}</p>
          <div className={s.screenshots}>
            <figure><figcaption>{C.walkthrough.before}</figcaption><Image src="/marketing/evidence/purchase-broken.png" alt={C.example.imageAlt} width={780} height={1520} sizes="(min-width: 640px) 240px, 70vw" /></figure>
            <figure><figcaption>{C.walkthrough.after}</figcaption><Image src="/marketing/evidence/purchase-verified.png" alt={C.example.recoveryAlt} width={780} height={1520} sizes="(min-width: 640px) 240px, 70vw" /></figure>
          </div>
          <p className={s.provenance}>{C.walkthrough.provenance}</p>
        </details>
      </div>
    </li>
  </ol>
}
