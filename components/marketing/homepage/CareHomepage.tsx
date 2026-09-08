'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Activity, ArrowRight, Check, ChevronRight, CircleCheck, Copy, Eye,
  Gauge, GitBranch, Globe2, MousePointer2, Plus, Search,
  Share2, ShieldCheck, ShoppingBag, Sparkles, Users,
} from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Logo } from '@/components/brand/Logo'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import s from './CareHomepage.module.css'

type PreviewCard = (typeof C.cards)[number]
type ExtraCard = (typeof C.addCards.options)[number]
type CopySource = 'read' | 'share' | 'ai' | 'mcp' | 'connect'
const cardIcons = {
  security: ShieldCheck, search: Search, performance: Gauge, tracking: Activity,
}
const extraIcons = {
  availability: Globe2, accessibility: Users, changes: GitBranch, commerce: ShoppingBag,
}
const actionIcons = { read: Eye, share: Share2, ai: Sparkles }
const failedEvidencePath = '/marketing/evidence/contact-no-confirmation.png'
const passedEvidencePath = '/marketing/evidence/contact-confirmed.png'
const siteImagePath = '/marketing/evidence/site-home.png'

function Signal({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  return <span className={`${s.signal} ${s[tone]}`}><i aria-hidden="true" />{children}</span>
}

function Card({ card, onClick }: { card: PreviewCard; onClick: () => void }) {
  const Icon = cardIcons[card.id]
  return <button className={s.card} onClick={onClick}>
    <span className={s.cardTop}><Icon size={17} aria-hidden="true" />{card.name}<Signal tone={card.tone}>{card.status}</Signal></span>
    <strong>{card.value}</strong>
    <span className={s.cardDetail}>{card.detail}</span>
    {card.chart === 'bars' && <span className={s.bars} aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</span>}
  </button>
}

function AddedCard({ card }: { card: ExtraCard }) {
  const Icon = extraIcons[card.id]
  return <article className={`${s.card} ${s.addedCard}`}>
    <span className={s.cardTop}><Icon size={17} aria-hidden="true" />{card.name}</span>
    <strong>{C.addCards.added}</strong>
    <span className={s.cardDetail}>{card.detail}</span>
  </article>
}

function ExperienceCard() {
  return <article className={s.siteSummary} aria-label={C.experience.label}>
    <div className={s.siteSummaryHeader}><span><Globe2 size={16} aria-hidden="true" />{C.experience.label}</span><Signal tone="good">{C.experience.status}</Signal></div>
    <div className={s.siteSummaryBody}>
      <div className={s.siteCapture}>
        <Image src={siteImagePath} alt={C.experience.imageAlt} fill sizes="(max-width: 767px) calc(100vw - 88px), (max-width: 1023px) calc(50vw - 64px), 360px" style={{ objectFit: 'cover', objectPosition: 'center top' }} />
      </div>
      <div className={s.siteSummaryCopy}>
        <div className={s.siteFacts}><span>{C.experience.pages}</span><span>{C.experience.flags}</span></div>
      </div>
    </div>
  </article>
}

function ConversionFlag() {
  return <a className={s.primaryFlag} href="#flag-example">
    <span className={s.flagTop}><span><MousePointer2 size={17} aria-hidden="true" />{C.flag.name}</span><Signal tone="warn">{C.flag.status}</Signal></span>
    <strong>{C.flag.title}</strong>
    <p>{C.flag.body}</p>
    <span className={s.flagOutcome}>{C.flag.outcome}</span>
    <span className={s.flagCrop}>
      <Image src={failedEvidencePath} alt={C.flag.cropAlt} fill sizes="(max-width: 767px) calc(100vw - 88px), 280px" style={{ objectFit: 'cover', objectPosition: 'center 70%' }} />
    </span>
    <span className={s.flagLink}>{C.flag.action}<ArrowRight size={18} aria-hidden="true" /></span>
  </a>
}

function Intro({ label, title, body }: { label?: string; title: string; body?: string }) {
  return <div className={s.intro}>{label && <p className={s.eyebrow}>{label}</p>}<h2>{title}</h2>{body && <p>{body}</p>}</div>
}

function UrlEntry({ final = false }: { final?: boolean }) {
  return <div className={s.entry} id={final ? undefined : 'audit'}>
    <AuditInput variant="landing" idSuffix={final ? '-care-final' : '-care-hero'} ctaPlacement={final ? 'final' : 'hero'} showLandingExtras={false} submitLabel={C.hero.cta} urlPlaceholder={C.hero.placeholder} />
    <p className={s.trust}>{C.hero.trust}</p>
  </div>
}

export function CareHomepage() {
  const [selected, setSelected] = useState<PreviewCard | null>(null)
  const [adding, setAdding] = useState(false)
  const [extra, setExtra] = useState<ExtraCard['id'][]>([])
  const [outcome, setOutcome] = useState<(typeof C.outcomes.options)[number]['id']>('lead')
  const [showInstructions, setShowInstructions] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [copyResult, setCopyResult] = useState<{ source: CopySource; message: string } | null>(null)
  const dialogOpener = useRef<HTMLElement | null>(null)
  const activeOutcome = C.outcomes.options.find(item => item.id === outcome)!

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
  const copyFix = async (source: CopySource) => {
    const text = source === 'connect' ? C.mcp.connectBody : C.workflow.instructions
    try {
      await navigator.clipboard.writeText(text)
      setCopyResult({ source, message: source === 'connect' ? C.mcp.copiedConnect : C.actions.copied })
    } catch {
      setCopyResult({ source, message: C.actions.copyFailed })
      if (source === 'connect') setShowConnect(true)
      else setShowInstructions(true)
    }
  }

  return <div className={s.home}>
    <section className={s.hero}>
      <div className={s.heroContent}>
        <Logo variant="mark" size="md" />
        <h1>{C.headlineLines[0]}<br /><span>{C.headlineLines[1]}</span></h1>
        <p className={s.heroBody}>{C.hero.body}</p>
        <UrlEntry />
      </div>
      <div className={s.heroBoard} id="product">
        <div className={s.board} role="region" aria-label={C.boardAria}>
          <span className={s.boardScan} aria-hidden="true" />
          <div className={s.boardHeader}><span><Globe2 size={16} aria-hidden="true" />{C.boardHost}</span><span className={s.boardMeta}>{C.boardMeta}</span></div>
          <div className={s.boardGrid}>
            <ExperienceCard />
            <ConversionFlag />
            {C.cards.map(card => <Card key={card.id} card={card} onClick={() => openCard(card)} />)}
            {extra.map(id => <AddedCard key={id} card={C.addCards.options.find(item => item.id === id)!} />)}
            <button className={s.previewAdd} aria-label={C.boardAdd.title} onClick={openAdd}><Plus size={20} aria-hidden="true" /><span><b>{C.boardAdd.title}</b><small>{C.boardAdd.body}</small></span></button>
          </div>
          <p className={s.boardFooter}>{C.previewNote}</p>
        </div>
      </div>
    </section>

    <section className={`${s.section} ${s.workflow}`} id="flag-example">
      <div className={s.workflowIntro}><Intro {...C.workflow} /><a href="#audit" className={s.textLink}>{C.hero.cta}<ArrowRight size={17} aria-hidden="true" /></a></div>
      <div className={s.workflowGrid}>
        <ol className={s.workflowSteps}>
          {C.workflow.steps.map((item, index) => <li key={item.id}>
            <span className={s.stepNumber}>0{index + 1}</span>
            <div><p>{item.label}</p><h3>{item.title}</h3><span>{item.body}</span></div>
          </li>)}
        </ol>
        <div className={s.evidenceStory}>
          <figure className={`${s.evidenceCard} ${s.failedEvidence}`}>
            <div className={s.evidenceHeader}><Signal tone="warn">{C.workflow.failedLabel}</Signal><span>{C.flag.outcome}</span></div>
            <a href={failedEvidencePath} target="_blank" rel="noopener noreferrer" aria-label={C.workflow.failedLink}>
              <Image src={failedEvidencePath} alt={C.workflow.failedAlt} width={720} height={440} sizes="(max-width: 767px) calc(100vw - 72px), 560px" />
            </a>
            <figcaption><b>{C.workflow.failedTitle}</b><span>{C.workflow.source}</span></figcaption>
          </figure>
          <div className={s.evidenceConnector}><ArrowRight size={18} aria-hidden="true" /><span>{C.workflow.steps[3].label}</span></div>
          <figure className={`${s.evidenceCard} ${s.passedEvidence}`}>
            <div className={s.evidenceHeader}><Signal tone="good">{C.workflow.passedLabel}</Signal><span>{C.flag.outcome}</span></div>
            <a href={passedEvidencePath} target="_blank" rel="noopener noreferrer" aria-label={C.workflow.passedLink}>
              <Image src={passedEvidencePath} alt={C.workflow.passedAlt} width={720} height={440} sizes="(max-width: 767px) calc(100vw - 72px), 560px" />
            </a>
            <figcaption><b>{C.workflow.passedTitle}</b><span>{C.workflow.source}</span></figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section className={`${s.section} ${s.coverage}`}>
      <div className={s.sectionHeading}><Intro {...C.checks} /><p className={s.scope}>{C.checks.note}</p></div>
      <div className={s.checkGroups}>{C.checks.groups.map(group => <article key={group.id}><h3>{group.title}</h3><ul>{group.items.map(item => <li key={item}><Check size={15} aria-hidden="true" />{item}</li>)}</ul></article>)}</div>
    </section>

    <section className={`${s.section} ${s.outcomeSection}`}>
      <Intro {...C.outcomes} />
      <div className={s.outcomeDemo}>
        <div className={s.outcomeChoices}>{C.outcomes.options.map(item => <button key={item.id} aria-pressed={outcome === item.id} onClick={() => setOutcome(item.id)}>{item.label}</button>)}</div>
        <div className={s.outcomePath} aria-live="polite">
          <p>{activeOutcome.result}</p>
          <ol>{activeOutcome.path.map((item, index) => <li key={item}><span>{index + 1}</span>{item}{index < activeOutcome.path.length - 1 && <ArrowRight size={16} aria-hidden="true" />}</li>)}</ol>
        </div>
      </div>
    </section>

    <section className={`${s.section} ${s.actions}`}>
      <Intro label={C.actions.label} title={C.actions.title} body={C.actions.body} />
      <div className={s.actionGrid}>{C.actions.choices.map(choice => {
        const Icon = actionIcons[choice.id]
        const source = choice.id as CopySource
        return <article key={choice.id}>
          <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
          <h3>{choice.title}</h3><p>{choice.body}</p>
          {choice.id === 'read'
            ? <button aria-expanded={showInstructions} aria-controls="fix-instructions" onClick={() => setShowInstructions(value => !value)}>{showInstructions ? C.actions.hide : choice.action}<ChevronRight size={16} aria-hidden="true" /></button>
            : <button onClick={() => void copyFix(source)}><Copy size={15} aria-hidden="true" />{choice.action}</button>}
          <p className={s.copyStatus} role="status">{copyResult?.source === source ? copyResult.message : ''}</p>
        </article>
      })}</div>
      <div id="fix-instructions" hidden={!showInstructions} className={s.expandedInstructions}><p>{C.workflow.instructions}</p></div>
      <p className={s.verifyLine}><CircleCheck size={18} aria-hidden="true" />{C.actions.verify}</p>
    </section>

    <section className={`${s.section} ${s.mcp}`}>
      <div className={s.mcpCopy}>
        <Intro label={C.mcp.label} title={C.mcp.title} body={C.mcp.body} />
        <div className={s.mcpActions}>
          <button className={s.darkButton} onClick={() => void copyFix('mcp')}><Copy size={16} aria-hidden="true" />{C.mcp.copy}</button>
          <button className={s.outlineButton} aria-expanded={showConnect} aria-controls="mcp-connect" onClick={() => { setShowConnect(true); void copyFix('connect') }}>{C.mcp.connect}</button>
        </div>
        <p className={s.copyStatus} role="status">{copyResult?.source === 'mcp' || copyResult?.source === 'connect' ? copyResult.message : ''}</p>
        <div id="mcp-connect" hidden={!showConnect} className={s.expandedInstructions}><p>{C.mcp.connectBody}</p></div>
        <p className={s.scope}>{C.mcp.note}</p>
      </div>
      <ol className={s.mcpFlow}>
        {C.mcp.flow.map((item, index) => {
          const tone = index === 0 ? 'warn' : index === 2 ? 'good' : undefined
          return <li key={item.title} className={`${s.mcpStep} ${index === 0 ? s.mcpFlag : index === 1 ? s.mcpAi : s.mcpVerify}`}>
            <span>{index === 1 ? <Sparkles size={20} aria-hidden="true" /> : <Logo variant="mark" size="sm" />}</span>
            <div>
              {tone ? <Signal tone={tone}>{index === 0 ? C.workflow.failedLabel : C.workflow.passedLabel}</Signal> : <p className={s.mcpMeta}>{C.mcp.aiLabel}</p>}
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
            {index < C.mcp.flow.length - 1 && <ArrowRight className={s.mcpArrow} size={18} aria-hidden="true" />}
          </li>
        })}
      </ol>
    </section>

    <section className={`${s.section} ${s.quiet}`}>
      <Intro title={C.quiet.title} body={C.quiet.body} />
      <div className={s.notificationStack}>
        {C.quiet.notifications.map((item, index) => <article key={item.title} className={`${s.notification} ${s[`notification${index}`]}`}>
          <div className={s.notificationTop}><Logo variant="mark" size="sm" /><b>{C.brand}</b><span>{item.time}</span></div>
          <Signal tone={item.tone}>{item.status}</Signal><h3>{item.title}</h3><p>{item.detail}</p>
        </article>)}
      </div>
    </section>

    <section className={`${s.section} ${s.shopify}`}><ShoppingBag size={30} strokeWidth={1.5} aria-hidden="true" /><div><h2>{C.shopify.title}</h2><p>{C.shopify.body}</p></div><Link href="/install" className={s.textLink}>{C.shopify.cta}<ArrowRight size={17} aria-hidden="true" /></Link></section>
    <section className={`${s.section} ${s.final}`} id="plans"><h2>{C.close.title}</h2><p>{C.close.body}</p><UrlEntry final /><Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link></section>

    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className={s.dialog} onCloseAutoFocus={restoreFocus}>
      <DialogTitle>{selected?.name}</DialogTitle>
      <DialogDescription>{selected?.question}</DialogDescription>
      {selected && <>
        <p className={s.detailAnswer}>{selected.answer}</p>
        <ul className={s.detailFacts}>{selected.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>
        <p className={s.scope}>{selected.coverage}</p>
      </>}
    </DialogContent></Dialog>
    <Dialog open={adding} onOpenChange={setAdding}><DialogContent className={s.dialog} onCloseAutoFocus={restoreFocus}>
      <DialogTitle>{C.addCards.title}</DialogTitle><DialogDescription>{C.addCards.drawer}</DialogDescription>
      <div className={s.recommendations}>{C.addCards.options.map(item => { const Icon = extraIcons[item.id]; return <button key={item.id} disabled={extra.includes(item.id)} onClick={() => { setExtra(values => values.includes(item.id) ? values : [...values, item.id]); setAdding(false) }}><Icon size={20} aria-hidden="true" /><span><b>{item.name}</b><small>{extra.includes(item.id) ? C.addCards.added : item.detail}</small></span>{extra.includes(item.id) ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}</button> })}</div>
    </DialogContent></Dialog>
  </div>
}
