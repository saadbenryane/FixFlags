'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Check, CircleAlert, Code2, FileText, LockKeyhole, MousePointer2 } from 'lucide-react'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { CHECK_ARTWORK } from '@/lib/marketing/check-artwork'
import { MarketingSectionHeader } from '../MarketingSectionHeader'
import { AREA_ICONS } from './check-area-icons'
import s from './CareHomepage.module.css'
import t from './HomepageCheckCoverage.module.css'

type CheckArea = typeof C.checks.areas[number]['id']

function CheckArtwork({ area }: { area: keyof typeof CHECK_ARTWORK }) {
  return <div className={t.artwork} aria-hidden="true"><Image src={CHECK_ARTWORK[area]} alt="" width={1254} height={1254} quality={82} sizes={area === 'conversion' ? '(max-width: 639px) 160px, 288px' : '(max-width: 639px) 128px, 176px'} /></div>
}

function CheckExample({ area }: { area: CheckArea }) {
  const preview = C.checks.previews
  switch (area) {
    case 'site': return <div className={t.pagesScene}><div className={t.pageList}>{preview.pages.map(row => <div key={row.page} data-flagged={row.flagged}><FileText size={15} aria-hidden="true" /><span>{row.page}</span><strong>{row.status}</strong>{row.flagged ? <span className={t.problemDot} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}</div>)}</div></div>
    case 'conversion': return <div className={t.purchaseScene}><div className={t.cart}><div className={t.cartProduct}><Image src={preview.conversion.image} alt={preview.conversion.imageAlt} width={48} height={56} quality={82} /><strong>{preview.conversion.product}</strong></div><span className={t.cartAction}>{preview.conversion.action}<MousePointer2 size={15} aria-hidden="true" /></span><div className={t.cartResult}><CircleAlert size={14} aria-hidden="true" /><strong>{preview.conversion.result}</strong></div></div></div>
    case 'security': return <div className={t.protection}><div className={t.secureUrl}><LockKeyhole size={13} aria-hidden="true" /><span>{preview.security.url}</span></div><strong>{preview.security.label}</strong><span>{preview.security.status}</span></div>
    case 'performance': return <div className={t.speed}>{preview.performance.map(row => <div key={row.device} data-device={row.device}><div><span>{row.device}</span><strong>{row.value}</strong></div><i aria-hidden="true"><span /></i></div>)}</div>
    case 'search': return <div className={t.searchScene}><div className={t.linkPreview}><div className={t.linkPreviewCopy}><strong>{preview.search.title}</strong><p>{preview.search.body}</p><span>{preview.search.url}</span></div></div></div>
    case 'tracking': return <div className={t.tracking}><div className={t.trackingHeading}><Code2 size={15} aria-hidden="true" /><strong>{preview.tracking.label}</strong></div><div className={t.trackingPages}>{preview.tracking.pages.map(row => <div key={row.page} data-flagged={row.flagged}><span>{row.page}</span><span>{row.status}{row.flagged ? <span className={t.problemDot} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}</span></div>)}</div></div>
    case 'accessibility': return <div className={t.contrastComparison} role="img" aria-label={preview.accessibility.description}><div aria-hidden="true"><span className={t.lowContrast}><svg width="80" height="60" viewBox="0 0 80 60" aria-hidden="true"><text x="40" y="30" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="1em">{preview.accessibility.sample}</text></svg></span><strong>{preview.accessibility.before}</strong></div><ArrowRight size={14} aria-hidden="true" /><div aria-hidden="true"><span className={t.clearContrast}><svg width="80" height="60" viewBox="0 0 80 60" aria-hidden="true"><text x="40" y="30" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="1em">{preview.accessibility.sample}</text></svg></span><strong>{preview.accessibility.after}</strong></div></div>
    case 'uptime': return <div className={t.uptimeHistory} role="img" aria-label={preview.uptime.description}><div className={t.uptimeMarks} aria-hidden="true">{preview.uptime.periods.flatMap(period => Array.from({ length: period.checks }, (_, index) => <i key={`${period.label}-${index}`} data-state={period.state} />))}</div><div className={t.uptimeLabels} aria-hidden="true">{preview.uptime.periods.map(period => <strong key={period.label}>{period.label}</strong>)}</div></div>
  }
}

/** Decorative glass and readable examples share one composition on every public surface. */
export function CheckPreview({ area }: { area: CheckArea }) {
  return <div className={t.checkScene} data-check-area={area}>
    <div className={t.composition}>
      <CheckArtwork area={area} />
      <div className={t.example}><CheckExample area={area} /></div>
    </div>
  </div>
}

export function HomepageCheckCoverage() {
  const [selected, setSelected] = useState<CheckArea | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const area = C.checks.areas.find(item => item.id === selected)
  return <><section className={`${s.section} ${t.coverage}`} id="flag-example" aria-labelledby="check-coverage-title">
    <MarketingSectionHeader id="check-coverage-title" label={C.checks.label} lines={C.checks.titleLines} lede={C.checks.body} align="center" />
    <div className={t.checkGrid}>{C.checks.areas.map(area => {
      const Icon = AREA_ICONS[area.id]
      return <article className={t.checkCard} data-area={area.id} key={area.id}>
        <h3><InteractiveButton type="button" aria-label={C.checks.explore(area.name)} onClick={event => { opener.current = event.currentTarget; setSelected(area.id) }}><Icon size={19} strokeWidth={1.6} aria-hidden="true" /><span>{area.name}</span><ArrowUpRight size={16} aria-hidden="true" /></InteractiveButton></h3>
        <p className={t.benefit}>{area.benefit}</p>
        <div className={t.preview}><CheckPreview area={area.id} /></div>
      </article>
    })}</div>
  </section>
  <ResponsiveDepth header={<DialogTitle className={t.detailTitle}>{area ? C.checks.detailTitle(area.name) : ''}</DialogTitle>} open={area !== undefined} onOpenChange={open => { if (!open) setSelected(null) }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }} className={t.coverageDialog}>
    <DialogDescription>{area?.benefit}</DialogDescription>
    {area ? <div className={t.checkGroups}><section><h3>{C.checks.examplesLabel}</h3><ul>{area.examples.map(example => <li key={example.id}>{example.label}</li>)}</ul></section></div> : null}
    <a href="#analyze" className={t.detailAction} onClick={() => { opener.current = document.getElementById('audit-url-care-hero'); setSelected(null) }}>{C.checks.detailAction}<ArrowRight size={16} aria-hidden="true" /></a>
  </ResponsiveDepth></>
}
