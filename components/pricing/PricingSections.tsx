import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react'
import { MarketingSectionHeader } from '@/components/marketing/MarketingSectionHeader'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { PRICING_IMPACT as IMPACT, PRICING_STORY as STORY } from '@/lib/marketing/copy/pricing-page'
import s from './PricingSections.module.css'

const AREA_ORDER = ['uptime', 'site', 'conversion', 'security', 'performance', 'search', 'tracking', 'accessibility'] as const

/** The product loop: what every plan does, and the eight areas it covers. */
export function PricingStory() {
  return <section className={s.story} aria-labelledby="pricing-story-heading">
    <div className={s.storyText}>
      <h2 id="pricing-story-heading">{STORY.title}</h2>
      <p>{STORY.body}</p>
      <div className={s.storyLinks}>
        <Link prefetch={false} href={STORY.link.href}>{STORY.link.label}<ArrowRight aria-hidden size={16} /></Link>
        <Link prefetch={false} href={STORY.compareLink.href}>{STORY.compareLink.label}<ArrowRight aria-hidden size={16} /></Link>
      </div>
    </div>
    <div>
      <p className={s.areasLabel}>{STORY.areasLabel}</p>
      <ul className={s.areas}>{AREA_ORDER.map(area => <li key={area}><Check aria-hidden size={15} />{CARD_CATALOG[area].name}</li>)}</ul>
    </div>
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
  </section>
}
