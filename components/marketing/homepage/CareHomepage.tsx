'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, Check, ChevronRight, Circle, Code2, Copy, ExternalLink, Flag, Globe2, LockKeyhole, MousePointer2, Plus, Search, ShieldCheck, ShoppingBag, Smartphone, TrendingUp, X } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Logo } from '@/components/brand/Logo'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import s from './CareHomepage.module.css'

type PreviewCard = { name: string; value: string; detail: string; status: string; tone: string; chart: string }
const icons = [MousePointer2, Activity, TrendingUp, Search, ShieldCheck, Code2, Globe2]

function Signal({ tone, label }: { tone: string; label: string }) {
  return <span className={`${s.signal} ${s[tone]}`}><i aria-hidden="true" />{label}</span>
}
function Chart({ bars, warn = false }: { bars?: boolean; warn?: boolean }) {
  return bars ? <div className={s.bars} aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} />)}</div> :
    <svg className={`${s.sparkline} ${warn ? s.warn : s.good}`} viewBox="0 0 240 40" fill="none" aria-hidden="true"><path d={warn ? 'M0 30L12 28L24 31L36 24L48 28L60 21L72 25L84 25L96 29L108 21L120 24L132 15L144 18L156 10L168 15L180 12L192 20L204 9L216 14L228 5L240 8' : 'M0 30L12 30L24 25L36 28L48 24L60 27L72 17L84 19L96 17L108 22L120 16L132 20L144 10L156 14L168 10L180 12L192 6L204 10L216 5L228 8L240 4'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}
function Card({ card, index = 0, onClick }: { card: PreviewCard; index?: number; onClick?: () => void }) {
  const Icon = icons[index % icons.length]
  const content = <><span className={s.cardTop}><span><Icon size={15} />{card.name}</span><span className={`${s.dot} ${s[card.tone]}`} aria-hidden="true" /></span><strong>{card.value}</strong><span className={s.cardDetail}>{card.detail}</span>{card.chart !== 'none' && <Chart bars={card.chart === 'bars'} warn={card.tone === 'warn'} />}<span className={s.cardStatus}>{card.status}{onClick && <ChevronRight size={12} />}</span></>
  return onClick ? <button className={s.card} onClick={onClick}>{content}</button> : <div className={s.card}>{content}</div>
}
function Intro({ label, title, body }: { label?: string; title: string; body?: string }) {
  return <div className={s.intro}>{label && <p className={s.eyebrow}>{label}</p>}<h2>{title}</h2>{body && <p>{body}</p>}</div>
}
function UrlEntry({ final = false }: { final?: boolean }) {
  return <div className={s.entry} id={final ? undefined : 'audit'}><AuditInput variant="landing" idSuffix={final ? '-care-final' : '-care-hero'} ctaPlacement={final ? 'final' : 'hero'} showLandingExtras={false} submitLabel={C.hero.cta} urlPlaceholder={C.hero.placeholder} /><p className={s.trust}>{C.hero.trust}</p></div>
}
function Board({ compact = false, onSelect, onAdd, extra }: { compact?: boolean; onSelect?: (card: PreviewCard) => void; onAdd?: () => void; extra?: string[] }) {
  const cards = compact ? C.cards.slice(0, 4) : C.cards
  return <div className={`${s.board} ${compact ? s.compact : ''}`}><div className={s.boardHeader}><div><span className={s.siteIcon}><Globe2 size={18} /></span><div><b>{C.site}</b><span>{C.siteMeta}</span></div></div><Signal tone="good" label={C.siteStatus} /></div><div className={s.boardGrid}>{cards.map((card, i) => <Card key={card.name} card={card} index={i} onClick={onSelect ? () => onSelect(card) : undefined} />)}{extra?.map(name => <Card key={name} card={{ name, value: '—', detail: C.added, status: C.context.note, tone: 'quiet', chart: 'none' }} />)}{!compact && <button className={s.addCard} onClick={onAdd}><Plus size={22} />{C.add}</button>}</div><div className={s.boardFooter}><span>{C.boardMeta}</span><span>{compact ? C.preview : C.boardHint}</span></div></div>
}

export function CareHomepage() {
  const [selected, setSelected] = useState<PreviewCard | null>(null)
  const [adding, setAdding] = useState(false)
  const [extra, setExtra] = useState<string[]>([])
  const [flagAction, setFlagAction] = useState<'fix' | 'verify' | 'share' | 'agent' | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const dialogOpener = useRef<HTMLElement | null>(null)
  const openCard = (card: PreviewCard) => {
    dialogOpener.current = document.activeElement as HTMLElement
    setSelected(card)
  }
  const openAdd = () => {
    dialogOpener.current = document.activeElement as HTMLElement
    setAdding(true)
  }
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    dialogOpener.current?.focus()
  }

  const add = (name: string) => { setExtra(current => current.includes(name) ? current : [...current, name]); setAdding(false) }
  const copy = async () => { setFlagAction('fix'); try { await navigator.clipboard.writeText(C.flag.instructions); setCopyStatus(C.agents.copied) } catch { setCopyStatus(C.agents.copyFailed) } }
  return <div className={s.home}>
    <section className={s.hero}>
      <Logo variant="mark" size="lg" />
      <h1>{C.headlineLines[0]}<br /><span>{C.headlineLines[1]}</span></h1>
      <p className={s.heroBody}>{C.hero.body}</p>
      <UrlEntry />
      <div className={s.heroBoard} id="product"><div className={s.previewLabel}><span>{C.preview}</span><span className={s.previewHint}>{C.boardHint}</span></div><Board onSelect={openCard} onAdd={openAdd} extra={extra} /><p className={s.boardCaption}>{C.boardTitle}</p><p className={s.previewNote}>{C.previewNote}</p></div>
    </section>

    <section className={`${s.section} ${s.states}`}><Intro {...C.states} /><div className={s.stateGrid}>{[C.cards[1], C.cards[2], C.cards[5]].map((card, i) => <div key={card.name}><Signal tone={card.tone} label={card.status} /><Card card={{ ...card, detail: C.states.details[i] }} index={i + 1} onClick={() => openCard(card)} /></div>)}</div></section>

    <section className={`${s.section} ${s.customSection}`}><div className={s.split}><Intro {...C.customize} /><div className={s.customVisual}><div className={s.miniGrid}>{[C.cards[0], C.cards[3]].map((card, i) => <Card key={card.name} card={card} index={i} onClick={() => openCard(card)} />)}<button className={s.addCard} onClick={openAdd}><Plus size={20} />{C.add}</button></div><div className={s.recommendations}><p>{C.customize.drawer}</p>{C.customize.options.slice(0, 3).map(item => <button key={item.name} onClick={() => add(item.name)}><span><b>{item.name}</b><small>{item.detail}</small></span>{extra.includes(item.name) ? <Check size={17} /> : <Plus size={17} />}</button>)}</div></div></div><p className={s.sectionFoot}>{C.customize.foot}</p></section>

    <section className={s.section}><Intro {...C.context} /><div className={s.evolution}>{C.context.stages.map((stage, i) => <div key={stage.label}><p className={s.stageLabel}><span>0{i + 1}</span>{stage.label}</p><Card card={{ name: C.cards[0].name, value: stage.value, detail: stage.detail, status: C.cards[0].status, tone: 'good', chart: 'none' }} />{i < 2 && <ArrowRight className={s.stageArrow} size={18} />}</div>)}</div><p className={s.previewNote}>{C.context.note}</p></section>

    <section className={`${s.section} ${s.flagSection}`} id="flag-example"><div className={s.split}><Intro {...C.flag} /><div className={s.flag}><p className={s.eyebrow}><Flag size={14} />{C.flag.eyebrow}</p><Signal tone="bad" label={C.cards[5].status} /><h3>{C.flag.headline}</h3><p>{C.flag.meta}</p><small>{C.flag.time}</small><div className={s.impact}>{C.flag.contexts.map(([name, value]) => <div key={name}><span>{name}</span><b>{value}</b></div>)}</div><div className={s.evidence}><span><Smartphone size={15} />{C.flag.evidence}</span><div className={s.journey}>{C.flag.steps.map((step, i) => <div key={step}>{i === 2 ? <X size={16} /> : <Check size={16} />}<span>{step}</span></div>)}</div><p>{C.flag.evidenceBody}</p><small>{C.flag.evidenceNote}</small></div><div className={s.actions}><button className={s.darkButton} onClick={() => setFlagAction('fix')}>{C.flag.fix}<ArrowRight size={15} /></button><button className={s.outlineButton} onClick={() => setFlagAction('verify')}>{C.flag.verify}</button></div>{flagAction && <div className={s.actionDetail} aria-live="polite"><b>{flagAction === 'fix' || flagAction === 'agent' ? C.flag.fixTitle : flagAction === 'verify' ? C.flag.verify : C.agents.actions[1]}</b><p>{flagAction === 'fix' || flagAction === 'agent' ? C.flag.instructions : flagAction === 'verify' ? C.flag.verifyMessage : C.agents.shareNote}</p>{flagAction === 'verify' && <a href="#audit" className={s.textLink}>{C.hero.cta}<ArrowRight size={15} /></a>}</div>}</div></div></section>

    <section className={`${s.section} ${s.loop}`}><div>{C.loop.steps.map(([title, body], i) => <div key={title}><span className={s.loopNumber}>0{i + 1}</span><h3>{title}{i < 3 && <ArrowRight size={17} />}</h3><p>{body}</p></div>)}</div><p className={s.loopClose}>{C.loop.close}<br /><strong>{C.loop.emphasis}</strong></p></section>

    <section className={`${s.section} ${s.checkSection}`}><Intro {...C.checks} /><div className={s.checks}>{C.checks.items.map(([title, body], i) => { const Icon = [...icons, Circle][i]; return <div key={title}><Icon size={20} strokeWidth={1.5} /><h3>{title}</h3><p>{body}</p></div> })}</div><p className={s.sectionFoot}>{C.checks.close}</p></section>

    <section className={s.section}><div className={s.split}><div><Intro {...C.connections} /><p className={s.connectionClose}>{C.connections.close}</p><span className={s.roadmap}>{C.connections.note}</span></div><div className={s.connections}>{C.connections.items.map(([name, body], i) => <div key={name}><span className={s.connectionIcon}>{i === 0 ? <ShoppingBag size={20} /> : i === 4 ? <Code2 size={20} /> : i === 3 ? <Search size={20} /> : i === 2 ? <Activity size={20} /> : <Globe2 size={20} />}</span><div><h3>{name}</h3><p>{body}</p></div><Plus size={16} /></div>)}</div></div></section>

    <section className={`${s.section} ${s.agents}`}><Intro {...C.agents} /><div className={s.agentActions}><button onClick={copy}><Copy size={17} />{C.agents.actions[0]}</button><a href="#flag-example" onClick={() => setFlagAction('share')}><ExternalLink size={17} />{C.agents.actions[1]}</a><a href="#flag-example" onClick={() => setFlagAction('agent')}><Code2 size={17} />{C.agents.actions[2]}</a></div><p role="status" className={s.previewNote}>{copyStatus}</p>{copyStatus && <p className={s.copiedInstructions}>{C.flag.instructions}</p>}</section>

    <section className={`${s.section} ${s.quiet}`}><div className={s.split}><div className={s.notifications}><p className={s.eyebrow}>{C.quiet.note}</p>{C.quiet.notifications.map(([title, body], i) => <div key={title}><Logo variant="mark" size="sm" /><div><b>{C.brand}</b><strong>{title}</strong><p>{body}</p></div><span className={`${s.dot} ${i ? s.good : s.bad}`} /></div>)}</div><div><Intro {...C.quiet} /><p className={s.quietClose}>{C.quiet.close}</p></div></div></section>

    <section className={`${s.section} ${s.mobileSection}`}><div className={s.split}><Intro {...C.mobile} /><div className={s.phone}><div className={s.phoneTop}><Logo size="sm" /><span><LockKeyhole size={12} />{C.site}</span></div><Board compact /></div></div></section>

    <section className={`${s.section} ${s.shopify}`}><ShoppingBag size={30} strokeWidth={1.5} /><div><h2>{C.shopify.title}</h2><p>{C.shopify.body}</p></div><Link href="/install" className={s.textLink}>{C.shopify.cta}<ArrowRight size={16} /></Link></section>

    <section className={`${s.section} ${s.pricing}`} id="plans"><Intro {...C.pricing} /><div className={s.pricingGrid}><div><Globe2 size={23} /><h3>{C.pricing.free}</h3><p>{C.pricing.freeBody}</p><a href="#audit" className={s.textLink}>{C.hero.cta}<ArrowRight size={16} /></a></div><div><ShieldCheck size={23} /><h3>{C.pricing.paid}</h3><p>{C.pricing.paidBody}</p><Link href="/pricing" className={s.textLink}>{C.pricing.cta}<ArrowRight size={16} /></Link></div></div><p className={s.previewNote}>{C.pricing.note}</p></section>

    <section className={`${s.section} ${s.final}`}><Logo variant="mark" size="lg" /><p>{C.close.prelude}</p><h2>{C.close.title}</h2><UrlEntry final /></section>

    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className={s.dialog} onCloseAutoFocus={restoreFocus}><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{C.flag.coverageBody}</DialogDescription>{selected && <Card card={selected} index={C.cards.findIndex(card => card.name === selected.name)} />}{selected?.tone === 'bad' && <a href="#flag-example" className={s.textLink} onClick={() => { dialogOpener.current = null; setSelected(null) }}>{C.flag.view}<ArrowRight size={16} /></a>}</DialogContent></Dialog>
    <Dialog open={adding} onOpenChange={setAdding}><DialogContent className={s.dialog} onCloseAutoFocus={restoreFocus}><DialogTitle>{C.add}</DialogTitle><DialogDescription>{C.customize.drawer}</DialogDescription><div className={s.recommendations}>{C.customize.options.map(item => <button key={item.name} onClick={() => add(item.name)} disabled={extra.includes(item.name)}><span><b>{item.name}</b><small>{extra.includes(item.name) ? C.added : item.detail}</small></span>{extra.includes(item.name) ? <Check size={18} /> : <Plus size={18} />}</button>)}</div><p className={s.previewNote}>{C.previewNote}</p></DialogContent></Dialog>
  </div>
}
