'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { Route } from 'next'
import { EditorMark } from '@/components/brand/EditorMarks'
import { HOMEPAGE_EDITOR_INTEGRATIONS, editorDocsHref } from '@/lib/integrations/editor-catalog'
import { INTEGRATIONS_PAGE } from '@/lib/marketing/copy/integrations'
import { ArrowRight, ArrowUpRight, Check, Copy } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S } from '@/lib/marketing/copy/care-homepage'
import { HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'
import t from './HomepageSections.module.css'

export type HomepageCopySource = 'read' | 'share' | 'ai'
export type HomepageCopyResult = { source: HomepageCopySource; message: string } | null

export function HomepageEditorTools() {
  return <div className={t.editorTools}><p>{C.actions.editorLabel}</p><ul aria-label={C.actions.editorGuidesLabel}>{HOMEPAGE_EDITOR_INTEGRATIONS.map(editor => <li key={editor.key}><Link href={editorDocsHref(editor)}><EditorMark name={editor.label} className={t.editorMark} />{editor.label}</Link></li>)}</ul></div>
}

export function HomepageHandoffSection({ onCopy, copyResult, manualPrompt }: {
  onCopy: (source: HomepageCopySource, prompt: string) => void
  copyResult: HomepageCopyResult
  manualPrompt: string | null
}) {
  return <section className={`${s.section} ${t.handoff}`} aria-labelledby="handoff-title">
      <div className={t.handoffGrid}>
        <div className={t.handoffIntro}>
          <p className={s.eyebrow}>{C.actions.label}</p>
          <h2 id="handoff-title">{C.story.guidanceTitle}</h2>
          <p>{C.story.guidance}</p>
          <Link href="/dashboard/mcp-setup" className={t.mcpAction}>{C.actions.mcpAction}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <article className={t.prompt} aria-labelledby="fix-prompt-title">
          <div className={t.promptHeading}><span>{C.actions.promptLabel}</span><Copy size={16} aria-hidden="true" /></div>
          <h3 id="fix-prompt-title">{C.actions.promptTitle}</h3>
          <dl>{C.actions.promptFacts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
          <p className={t.promptVerification}><Check size={15} aria-hidden="true" />{C.story.recoveryNote}</p>
          <button type="button" className={t.copyButton} onClick={() => onCopy('share', S.availabilityPrompt)}><Copy size={16} aria-hidden="true" />{C.story.copy}<ArrowRight size={16} aria-hidden="true" /></button>
          {copyResult?.source === 'share' ? <p className={t.copyStatus} role="status">{copyResult.message}</p> : null}
          {manualPrompt && copyResult?.source === 'share' ? <div className={t.manualCopy}><label htmlFor="handoff-guidance">{S.guidanceLabel}</label><textarea id="handoff-guidance" readOnly value={manualPrompt} onFocus={event => event.currentTarget.select()} rows={6} /></div> : null}
        </article>
      </div>
  </section>
}

export function HomepageIntegrationsSection() {
  return <section className={`${s.section} ${t.integrations}`} id="integrations" aria-labelledby="integrations-title">
    <div className={t.integrationPanel}>
      <div className={t.integrationCopy}><h2 id="integrations-title">{C.integrations.title}</h2><p>{C.integrations.body}</p><Link href="/integrations" className={t.integrationLink}>{C.integrations.action}<ArrowRight size={16} aria-hidden="true" /></Link></div>
      <ul className={t.integrationField} aria-label={C.integrations.label}>{INTEGRATIONS_PAGE.items.map(item => <li key={item.id} data-integration={item.id}>
        <Link href={`/integrations#${item.id}` as Route} className={t.integrationCard}>
          <ArrowUpRight className={t.cardArrow} size={15} aria-hidden="true" />
          <span className={t.integrationLogoPlate}><Image src={item.logo} alt="" width={40} height={40} className={t.integrationLogo} /></span>
          <strong>{item.title}</strong><span className={t.integrationPurpose}>{item.purpose}</span>
          <small className={t.integrationState}>{item.status === 'available' ? INTEGRATIONS_PAGE.availableLabel : INTEGRATIONS_PAGE.proposedLabel}</small>
        </Link>
      </li>)}</ul>
    </div>
  </section>
}

export function HomepageFinalSection() {
  return <section className={`${s.section} ${s.final}`} id="plans"><h2>{C.close.title}</h2><p>{C.close.body}</p><HomepageUrlEntry final /><Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link></section>
}
