'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Activity, ArrowRight, ArrowUpRight, Check, CircleAlert, Code2, FileText, Fingerprint, Gauge, LockKeyhole, MousePointer2, Search, ShieldCheck } from 'lucide-react'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import s from './CareHomepage.module.css'
import t from './HomepageCheckCoverage.module.css'

type CheckArea = typeof C.checks.areas[number]['id']
const AREA_ICONS = { site: FileText, conversion: MousePointer2, security: ShieldCheck, performance: Gauge, search: Search, tracking: Code2, accessibility: Fingerprint, uptime: Activity }

/** Small, readable illustrations of public checks, not captured customer results. */
function CheckPreview({ area }: { area: CheckArea }) {
  const preview = C.checks.previews
  switch (area) {
    case 'site': return <div className={t.pageList}>{preview.pages.map(row => <div key={row.page} data-flagged={row.flagged}><FileText size={15} aria-hidden="true" /><span>{row.page}</span><strong>{row.status}</strong>{row.flagged ? <span className={t.problemDot} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}</div>)}</div>
    case 'conversion': return <div className={t.cart}><div className={t.cartProduct}><Image src={preview.conversion.image} alt={preview.conversion.imageAlt} width={32} height={38} /><strong>{preview.conversion.product}</strong></div><span className={t.cartAction}>{preview.conversion.action}<MousePointer2 size={15} aria-hidden="true" /></span><div className={t.cartResult}><CircleAlert size={14} aria-hidden="true" /><strong>{preview.conversion.result}</strong></div></div>
    case 'security': return <div className={t.protection}><div className={t.secureUrl}><LockKeyhole size={13} aria-hidden="true" /><span>{preview.security.url}</span></div><ShieldCheck size={38} strokeWidth={1.25} aria-hidden="true" /><strong>{preview.security.label}</strong><span>{preview.security.status}</span></div>
    case 'performance': return <div className={t.speed}>{preview.performance.map(row => <div key={row.device} data-device={row.device}><div><span>{row.device}</span><strong>{row.value}</strong></div><i aria-hidden="true"><span /></i></div>)}</div>
    case 'search': return <div className={t.linkPreview}><Image src={preview.search.image} alt={preview.search.imageAlt} width={640} height={360} sizes="(max-width: 1023px) 40vw, 240px" className={t.linkPreviewImage} /><div className={t.linkPreviewCopy}><strong>{preview.search.title}</strong><p>{preview.search.body}</p><span>{preview.search.url}</span></div></div>
    case 'tracking': return <div className={t.tracking}><div className={t.trackingHeading}><Code2 size={15} aria-hidden="true" /><strong>{preview.tracking.label}</strong></div><div className={t.trackingPages}>{preview.tracking.pages.map(row => <div key={row.page} data-flagged={row.flagged}><span>{row.page}</span><span>{row.status}{row.flagged ? <span className={t.problemDot} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}</span></div>)}</div></div>
    case 'accessibility': return <div className={t.contrastComparison} role="img" aria-label={preview.accessibility.description}><div aria-hidden="true"><span className={t.lowContrast}>{preview.accessibility.sample}</span><strong>{preview.accessibility.before}</strong></div><ArrowRight size={14} aria-hidden="true" /><div aria-hidden="true"><span className={t.clearContrast}>{preview.accessibility.sample}</span><strong>{preview.accessibility.after}</strong></div></div>
    case 'uptime': return <div className={t.uptimeHistory} role="img" aria-label={preview.uptime.description}><div className={t.uptimeMarks} aria-hidden="true">{preview.uptime.periods.flatMap(period => Array.from({ length: period.checks }, (_, index) => <i key={`${period.label}-${index}`} data-state={period.state} />))}</div><div className={t.uptimeLabels} aria-hidden="true">{preview.uptime.periods.map(period => <strong key={period.label}>{period.label}</strong>)}</div></div>
  }
}

export function HomepageCheckCoverage() {
  const [selected, setSelected] = useState<CheckArea | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const area = C.checks.areas.find(item => item.id === selected)
  return <><section className={`${s.section} ${t.coverage}`} id="flag-example" aria-labelledby="check-coverage-title">
    <div className={t.intro}><h2 id="check-coverage-title">{C.checks.title}</h2><p>{C.checks.body}</p></div>
    <div className={t.checkGrid}>{C.checks.areas.map(area => {
      const Icon = AREA_ICONS[area.id]
      return <article className={t.checkCard} data-area={area.id} key={area.id}>
        <h3><button type="button" aria-label={C.checks.explore(area.name)} onClick={event => { opener.current = event.currentTarget; setSelected(area.id) }}><Icon size={19} strokeWidth={1.6} aria-hidden="true" /><span>{area.name}</span><ArrowUpRight size={16} aria-hidden="true" /></button></h3>
        <p className={t.benefit}>{area.benefit}</p>
        <div className={t.preview}><CheckPreview area={area.id} /></div>
      </article>
    })}</div>
  </section>
  <ResponsiveDepth open={area !== undefined} onOpenChange={open => { if (!open) setSelected(null) }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }} className={t.coverageDialog}>
    <DialogTitle className={t.detailTitle}>{area ? C.checks.detailTitle(area.name) : ''}</DialogTitle>
    <DialogDescription>{area?.benefit}</DialogDescription>
    {area ? <div className={t.checkGroups}>{area.groups.map(group => <section key={group.title}><h3>{group.title}</h3><ul>{group.checks.map(check => <li key={check}>{check}</li>)}</ul></section>)}</div> : null}
    <a href="#analyze" className={t.detailAction} onClick={() => { opener.current = document.getElementById('audit-url-care-hero'); setSelected(null) }}>{C.checks.detailAction}<ArrowRight size={16} aria-hidden="true" /></a>
  </ResponsiveDepth></>
}
