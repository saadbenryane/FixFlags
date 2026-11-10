'use client'

import { useState } from 'react'
import { Copy } from 'lucide-react'
import { InteractiveButton, InteractiveTextarea } from '@/components/ui/interactive-controls'
import { AI_BUILDERS_PAGE as C } from '@/lib/marketing/copy/ai-builders'
import s from './AiBuilders.module.css'

/** A sample Flag's fix instructions, framed for one tool, with a copy action and a readable fallback. */
export function AiBuilderExample({ toolName, flag, prompt }: { toolName: string; flag: string; prompt: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setStatus('copied') } catch { setStatus('manual') }
  }
  return <section className={s.example} aria-labelledby="tool-example-title">
    <h2 id="tool-example-title" className={s.heading}>{C.tool.exampleTitle}</h2>
    <figure className={s.window}>
      <figcaption className={s.windowBar}><span>{toolName}</span><small>{flag}</small></figcaption>
      <pre className={s.prompt}>{prompt}</pre>
    </figure>
    <p className={s.note}>{C.tool.exampleNote}</p>
    <InteractiveButton type="button" className={s.copy} onClick={() => void copy()}><Copy size={16} aria-hidden="true" />{C.tool.copy}</InteractiveButton>
    {status === 'copied' ? <p role="status" className={s.note}>{C.tool.copied}</p> : null}
    {status === 'manual' ? <InteractiveTextarea aria-label={C.tool.exampleTitle} readOnly value={prompt} rows={7} onFocus={event => event.currentTarget.select()} className={s.manual} /> : null}
  </section>
}
