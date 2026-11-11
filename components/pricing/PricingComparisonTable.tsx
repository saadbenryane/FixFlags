import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, Check, Clock3, Flag, Minus, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketingSectionHeader } from '@/components/marketing/MarketingSectionHeader'
import { PRICING_ADD_ONS as ADD_ONS, PRICING_PLAN_TABLE as T, PRICING_TIERS, type PlanFeature, type PricingTier } from '@/lib/marketing/copy/pricing-page'
import { PricingCTAButton } from './PricingCTAButton'
import { PlanPrice } from './PlanPrice'
import s from './PricingComparisonTable.module.css'

const TIER_ICONS = { free: ShieldCheck, pro: Flag, team: Users, agency: Building2 } as const

function FeatureList({ features }: { features: readonly PlanFeature[] }) {
  return <ul className={s.features}>{features.map(feature => <li key={feature.label} data-planned={feature.planned ? 'true' : undefined}>
    {feature.planned ? <Clock3 aria-hidden size={16} /> : <Check aria-hidden size={16} />}
    <span>{feature.label}</span>
    {feature.planned ? <span className={s.planned}>Planned</span> : null}
  </li>)}</ul>
}

function TierHeading({ tier }: { tier: PricingTier }) {
  const Icon = TIER_ICONS[tier.id]
  return <header className={s.planHeading}>
    <div className={s.top}><h3 id={`pricing-${tier.id}`}><Icon aria-hidden size={22} strokeWidth={1.5} />{tier.name}</h3>{tier.available ? null : <span className={s.status}>{tier.status}</span>}</div>
    <div className={s.price}><PlanPrice price={tier.price} />{tier.period ? <span>{tier.period}</span> : null}</div>
    <p className={s.priceLabel}>{tier.priceLabel}</p>
  </header>
}

function TierAction({ tier }: { tier: PricingTier }) {
  if (tier.id === 'free') return <PricingCTAButton plan="FREE" cta={tier.cta.label} signUpHref={tier.cta.href as Route} variant="brand" showHint={false} />
  return <Button asChild variant="outline" className="w-full"><Link prefetch={false} href={tier.cta.href as Route}>{tier.cta.label}</Link></Button>
}

function PlanCellValue({ cell }: { cell: (typeof T.rows)[number]['cells'][number] }) {
  if (cell.kind === 'yes') return <span className={s.mark} data-kind="yes"><Check aria-hidden size={17} /><span className="sr-only">Included</span></span>
  if (cell.kind === 'no') return <span className={s.mark} data-kind="no"><Minus aria-hidden size={16} /><span className="sr-only">{T.notIncluded}</span></span>
  if (cell.kind === 'planned') return <span className={s.mark} data-kind="planned"><Clock3 aria-hidden size={14} />Planned</span>
  return <span className={s.mark} data-kind="text">{cell.value}</span>
}

export function PricingComparisonTable() {
  const cards = PRICING_TIERS.filter(tier => tier.id !== 'agency')
  const agency = PRICING_TIERS.find(tier => tier.id === 'agency')!
  return <div className={s.comparison}>
    <div className={s.columns}>{cards.map(tier => <article key={tier.id} aria-labelledby={`pricing-${tier.id}`} className={s.plan} data-featured={tier.available}>
      <TierHeading tier={tier} />
      <p className={s.summary}>{tier.summary}</p>
      <FeatureList features={tier.features} />
      <div className={s.action}><TierAction tier={tier} /></div>
    </article>)}</div>

    <article aria-labelledby="pricing-agency" className={s.agency}>
      <TierHeading tier={agency} />
      <div className={s.agencyBody}><p className={s.summary}>{agency.summary}</p><FeatureList features={agency.features} /></div>
      <div className={s.agencyAction}><TierAction tier={agency} /></div>
    </article>

    <section className={s.addOns} aria-labelledby="pricing-add-ons">
      <div><h3 id="pricing-add-ons">{ADD_ONS.title}</h3><p>{ADD_ONS.note}</p></div>
      <ul>{ADD_ONS.items.map(item => <li key={item.id}><span className={s.addOnName}>{item.name}</span><span className={s.addOnPrice}><PlanPrice price={item.price} size="md" /><span>{item.unit}</span></span></li>)}</ul>
    </section>

    <section className={s.planTable} aria-labelledby="pricing-comparison-heading" id={T.id}>
      <MarketingSectionHeader id="pricing-comparison-heading" lines={T.lines} align="center" />
      <div className={s.tableScroll}>
        <table className={s.table}>
          <caption className="sr-only">{T.caption}</caption>
          <thead><tr><th scope="col"><span className="sr-only">Feature</span></th>{PRICING_TIERS.map(tier => <th key={tier.id} scope="col"><span className={s.colName}>{tier.name}</span><span className={s.colPrice}>{tier.price}{tier.period ? <small>{tier.period}</small> : null}</span></th>)}</tr></thead>
          <tbody>{T.rows.map(row => <tr key={row.feature}><th scope="row">{row.feature}</th>{row.cells.map((cell, index) => <td key={PRICING_TIERS[index].id}><PlanCellValue cell={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className={s.tableNote}>{T.note}</p>
      <p className={s.tableLink}><Link prefetch={false} href={T.monitoringLink.href as Route}>{T.monitoringLink.label}<ArrowRight aria-hidden size={16} /></Link></p>
    </section>
  </div>
}
