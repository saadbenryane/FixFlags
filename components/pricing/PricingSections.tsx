import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, X } from 'lucide-react'
import { MarketingSectionHeader } from '@/components/marketing/MarketingSectionHeader'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { PRICING_IMPACT as IMPACT, PRICING_STORY as STORY, PRICING_TOOL_COMPARISON as TOOLS } from '@/lib/marketing/copy/pricing-page'
import s from './PricingSections.module.css'

const AREA_ORDER = ['uptime', 'site', 'conversion', 'security', 'performance', 'search', 'tracking', 'accessibility'] as const

/** Check. Find. Fix.: what every plan does, and the eight areas it covers. */
export function PricingStory() {
  return <section className={s.story} aria-labelledby="pricing-story-heading">
    <div className={s.storyText}>
      <h2 id="pricing-story-heading">{STORY.title}</h2>
      <p>{STORY.body}</p>
      <Link prefetch={false} href={STORY.link.href}>{STORY.link.label}<ArrowRight aria-hidden size={16} /></Link>
    </div>
    <div>
      <p className={s.areasLabel}>{STORY.areasLabel}</p>
      <ul className={s.areas}>{AREA_ORDER.map(area => <li key={area}><Check aria-hidden size={15} />{CARD_CATALOG[area].name}</li>)}</ul>
    </div>
  </section>
}

type ToolCell = (typeof TOOLS.rows)[number]['cells'][number]

function ToolCellValue({ cell }: { cell: ToolCell }) {
  if (cell.kind === 'yes') return <span className={s.tool} data-kind="yes"><Check aria-hidden size={18} strokeWidth={2.6} /><span className="sr-only">Yes</span>{'note' in cell && cell.note ? <span className={s.toolNote}>{cell.note}</span> : null}</span>
  if (cell.kind === 'no') return <span className={s.tool} data-kind="no"><X aria-hidden size={16} /><span className="sr-only">No</span></span>
  return <span className={s.tool} data-kind="text">{cell.value}</span>
}

/** Competitor marks, copied exactly from the investor deck. */
export function PricingToolComparison() {
  return <section className={s.tools} aria-labelledby="pricing-tools-heading" id={TOOLS.id}>
    <MarketingSectionHeader id="pricing-tools-heading" label={TOOLS.label} lines={TOOLS.lines} align="center" />
    <div className={s.toolScroll}>
      <table className={s.toolTable}>
        <caption className="sr-only">{TOOLS.caption}</caption>
        <thead><tr><th scope="col"><span className="sr-only">Tool</span></th>{TOOLS.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{TOOLS.rows.map(row => <tr key={row.name} data-highlight={row.highlight ? 'true' : undefined}>
          <th scope="row">{row.highlight ? <Image src="/brand/logo-mark.svg" alt="" width={12} height={19} unoptimized className={s.mark} /> : null}{row.name}</th>
          {row.cells.map((cell, index) => <td key={TOOLS.columns[index]}><ToolCellValue cell={cell} /></td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <p className={s.scrollHint}>{TOOLS.scrollHint}</p>
    <p className={s.note}>{TOOLS.note}</p>
  </section>
}

/** Published findings only, quoted exactly and linked to the source. */
export function PricingImpact() {
  return <section className={s.impact} aria-labelledby="pricing-impact-heading" id={IMPACT.id}>
    <MarketingSectionHeader id="pricing-impact-heading" label={IMPACT.label} lines={IMPACT.lines} align="center" />
    <ul className={s.stats}>{IMPACT.stats.map(stat => <li key={stat.value}>
      <p className={s.statValue}>{stat.value}</p>
      <p className={s.statLabel}>{stat.label}</p>
      <blockquote cite={stat.href}>“{stat.quote}”</blockquote>
      <a className={s.statSource} href={stat.href} target="_blank" rel="noreferrer">{stat.source}<ArrowUpRight aria-hidden size={14} /></a>
    </li>)}</ul>
    <p className={s.tieIn}>{IMPACT.tieIn}</p>
  </section>
}
