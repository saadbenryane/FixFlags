'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, ChevronRight, CircleCheck, Copy, Eye,
  Globe2, Share2, ShoppingBag, Sparkles,
} from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Logo } from '@/components/brand/Logo'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AddBoardCard, AddCardLibrary, BoardCard, BoardGrid, BoardStatus, BOARD_CARD_ICONS } from '@/components/sites/BoardCard'
import { CARE_HOME as C, SITE_BOARD_COPY } from '@/lib/marketing/copy'
import { BoardDetails } from '@/components/sites/BoardDetails'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import s from './CareHomepage.module.css'
import Image from 'next/image'

type PreviewCard = (typeof C.cards)[number] | (typeof C.library)[keyof typeof C.library]
type DetailCard = PreviewCard | 'site' | 'conversion'
type ExtraCardId = 'uptime' | 'accessibility'
type CopySource = 'read' | 'share' | 'ai' | 'mcp'
const actionIcons = { read: Eye, share: Share2, ai: Sparkles }
const failedEvidencePath = '/marketing/evidence/contact-no-confirmation.png'
const passedEvidencePath = '/marketing/evidence/contact-confirmed.png'
const siteImagePath = '/marketing/evidence/site-home.png'

function Signal({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  return <span className={`${s.signal} ${s[tone]}`}><i aria-hidden="true" />{children}</span>
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

function useScrollStep<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [activeStep, setActiveStep] = useState('check')

  useEffect(() => {
    const node = ref.current
    if (!node) return
    let frame = 0
    const update = () => {
      frame = 0
      const steps = Array.from(node.querySelectorAll<HTMLElement>('[data-step]'))
      const readingLine = window.innerHeight * .45
      let current = steps[0]
      for (const step of steps) {
        if (step.getBoundingClientRect().top <= readingLine) current = step
      }
      if (current?.dataset.step) setActiveStep(current.dataset.step)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return { ref, activeStep }
}

export function CareHomepage() {
  const [selected, setSelected] = useState<DetailCard | null>(null)
  const [outcome, setOutcome] = useState<(typeof C.outcomes.options)[number]['id']>('lead')
  const [showInstructions, setShowInstructions] = useState(false)
  const [copyResult, setCopyResult] = useState<{ source: CopySource; message: string } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [extraCards, setExtraCards] = useState<ExtraCardId[]>([])
  const dialogOpener = useRef<HTMLElement | null>(null)
  const workflow = useScrollStep<HTMLElement>()
  const activeOutcome = C.outcomes.options.find(item => item.id === outcome)!
  const selectedPreview = selected && selected !== 'site' && selected !== 'conversion' ? selected : null
  const extraCardViews = extraCards.map(id => C.library[id])

  const openCard = (card: DetailCard) => {
    dialogOpener.current = document.activeElement as HTMLElement
    setSelected(card)
  }
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    dialogOpener.current?.focus()
  }
  const copyFix = async (source: CopySource) => {
    try {
      await navigator.clipboard.writeText(C.workflow.instructions)
      setCopyResult({ source, message: C.actions.copied })
    } catch {
      setCopyResult({ source, message: C.actions.copyFailed })
      setShowInstructions(true)
    }
  }

  return <div className={s.home}>
    <section className={s.hero}>
      <div className={s.heroContent}>
        <span className={s.heroMark}><Logo variant="mark" size="md" /></span>
        <h1>
          <span className={s.headlineLead}>{C.headlineLines[0]}</span>
          <br />
          <span className={s.headlineAccent}>{C.headlineLines[1]}</span>
        </h1>
        <p className={s.heroBody}>{C.hero.body}</p>
        <UrlEntry />
      </div>
      <div className={s.heroBoard} id="product">
        <div className={s.board} role="region" aria-label={C.boardAria}>
          <span className={s.boardScan} aria-hidden="true" data-hero-scan="">
            <span className={s.scanVeil}><span className={s.scanEdge} /></span>
          </span>
          <div className={s.boardHeader}>
            <span><Globe2 size={16} aria-hidden="true" />{C.boardHost}</span>
            <BoardStatus state="attention" label={C.boardSummary} count={4} onOpen={() => openCard('site')} />
          </div>
          <div className={s.boardStage}>
            <BoardGrid>
            <BoardCard
              name={C.site.label}
              status={C.site.status}
              state="healthy"
              answer={C.site.answer}
              visual={{ src: siteImagePath, alt: C.site.imageAlt }}
              wide
              icon={BOARD_CARD_ICONS.site}
              sources={[SITE_BOARD_COPY.browserSource]}
              onOpen={() => openCard('site')}
            />
            <BoardCard
              name={C.flag.name}
              status={C.flag.status}
              state="problem"
              answer={C.flag.title}
              detail={C.flag.body}
              outcome={C.flag.outcome}
              action={C.flag.action}
              crop={{ src: failedEvidencePath, alt: C.flag.cropAlt }}
              icon={BOARD_CARD_ICONS.conversion}
              flags={[{ id: 'conversion-flag', title: C.flag.title, href: '#flag-example' }]}
              sources={[SITE_BOARD_COPY.browserSource]}
              onOpen={() => openCard('conversion')}
            />
            {C.cards.map(card => (
              <BoardCard
                key={card.id}
                name={card.name}
                status={card.status}
                state={card.tone === 'attention' ? 'attention' : 'healthy'}
                answer={card.value}
                detail={card.detail}
                chart={card.chart}
                metric
                icon={BOARD_CARD_ICONS[card.id]}
                flags={card.id === 'performance' ? [...C.performanceFlags] : undefined}
                sources={card.id === 'tracking' ? ['Google Analytics'] : [SITE_BOARD_COPY.browserSource]}
                onOpen={() => openCard(card)}
              />
            ))}
            {extraCardViews.map(card => (
              <BoardCard
                key={card.id}
                name={card.name}
                status={card.status}
                state="healthy"
                answer={card.value}
                detail={card.detail}
                metric
                icon={BOARD_CARD_ICONS[card.id as SiteCardArea]}
                sources={[SITE_BOARD_COPY.browserSource]}
                onOpen={() => openCard(card)}
              />
            ))}
            <AddBoardCard onOpen={() => setLibraryOpen(true)} />
          </BoardGrid>
          </div>
          <p className={s.boardFooter}>{C.previewNote}</p>
        </div>
      </div>
    </section>

    <section ref={workflow.ref} className={`${s.section} ${s.workflow}`} id="flag-example" data-active-step={workflow.activeStep}>
      <Intro {...C.workflow} />
      <div className={s.workflowGrid}>
        <ol className={s.workflowSteps}>
          {C.workflow.steps.map((item, index) => <li key={item.id} data-step={item.id} aria-current={workflow.activeStep === item.id ? 'step' : undefined}>
            <span className={s.stepNumber}>0{index + 1}</span>
            <div><p>{item.label}</p><h3>{item.title}</h3><span>{item.body}</span></div>
          </li>)}
        </ol>
        <div className={s.evidenceStage}>
          <div className={s.evidenceStory}>
            <figure className={`${s.evidenceCard} ${s.failedEvidence}`}>
              <div className={s.evidenceHeader}><Signal tone="bad">{C.workflow.failedLabel}</Signal><span className={s.evidencePage}>{C.workflow.page}</span></div>
              <a href={failedEvidencePath} target="_blank" rel="noopener noreferrer" aria-label={C.workflow.failedLink}>
                <span className={s.loopScan} aria-hidden="true"><span className={s.loopScanVeil}><span className={s.loopScanEdge} /></span></span>
                <Image src={failedEvidencePath} alt={C.workflow.failedAlt} width={720} height={440} sizes="(max-width: 767px) calc(100vw - 72px), 560px" />
              </a>
              <figcaption>{C.workflow.failedTitle}</figcaption>
            </figure>
            <div className={s.evidenceConnector}><ArrowRight size={18} aria-hidden="true" /><span>{C.workflow.steps[3].label}</span></div>
            <figure className={`${s.evidenceCard} ${s.passedEvidence}`}>
              <div className={s.evidenceHeader}><Signal tone="good">{C.workflow.passedLabel}</Signal><span className={s.evidencePage}>{C.workflow.page}</span></div>
              <a href={passedEvidencePath} target="_blank" rel="noopener noreferrer" aria-label={C.workflow.passedLink}>
                <Image src={passedEvidencePath} alt={C.workflow.passedAlt} width={720} height={440} sizes="(max-width: 767px) calc(100vw - 72px), 560px" />
              </a>
              <figcaption>{C.workflow.passedTitle}</figcaption>
            </figure>
          </div>
          <p className={s.evidenceNote}>{C.workflow.source}</p>
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
        </div>
        <p className={s.copyStatus} role="status">{copyResult?.source === 'mcp' ? copyResult.message : ''}</p>
        <p className={s.scope}>{C.mcp.note}</p>
      </div>
      <ol className={s.mcpFlow}>
        {C.mcp.flow.map((item, index) => {
          const tone = index === 0 ? 'bad' : index === 2 ? 'good' : undefined
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
      <div>
        <p className={s.exampleNote}>{C.quiet.exampleNote}</p>
        <div className={s.notificationStack}>
          {C.quiet.notifications.map((item, index) => <article key={item.title} className={`${s.notification} ${s[`notification${index}`]}`}>
            <div className={s.notificationTop}><Logo variant="mark" size="sm" /><b>{C.brand}</b><span>{item.time}</span></div>
            <Signal tone={item.tone}>{item.status}</Signal><h3>{item.title}</h3><p>{item.detail}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section className={`${s.section} ${s.shopify}`}><ShoppingBag size={30} strokeWidth={1.5} aria-hidden="true" /><div><h2>{C.shopify.title}</h2><p>{C.shopify.body}</p></div><Link href="/install" className={s.textLink}>{C.shopify.cta}<ArrowRight size={17} aria-hidden="true" /></Link></section>
    <section className={`${s.section} ${s.final}`} id="plans"><h2>{C.close.title}</h2><p>{C.close.body}</p><UrlEntry final /><Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link></section>

    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className={s.dialog} onCloseAutoFocus={restoreFocus}>
      <DialogTitle>{selected === 'site' ? C.site.label : selected === 'conversion' ? C.flag.name : selectedPreview?.name}</DialogTitle>
      <DialogDescription>{selected === 'site' ? C.site.question : selected === 'conversion' ? C.flag.question : selectedPreview?.question}</DialogDescription>
      {selected === 'site' ? <>
        <p className={s.detailAnswer}>{C.site.answer}</p>
        <BoardDetails image={{ src: siteImagePath, alt: C.site.imageAlt }} checkedAt={C.exampleCheckedAt} sources={[SITE_BOARD_COPY.browserSource]} facts={C.site.facts} coverage={C.site.coverage} />
      </> : selected === 'conversion' ? <>
        <p className={s.detailAnswer}>{C.flag.title}</p>
        <p className={s.scope}>{C.flag.body}</p>
        <BoardDetails image={{ src: failedEvidencePath, alt: C.flag.cropAlt }} checkedAt={C.exampleCheckedAt} sources={[SITE_BOARD_COPY.browserSource]} facts={C.flag.facts} coverage={C.workflow.source} />
        <div className={s.mcpActions}>
          <button type="button" onClick={() => void copyFix('ai')}><Copy size={15} aria-hidden="true" />{SITE_BOARD_COPY.copyPrompt}</button>
          <button type="button" onClick={() => void copyFix('share')}><Copy size={15} aria-hidden="true" />{SITE_BOARD_COPY.share}</button>
        </div>
        <p className={s.copyStatus} role="status">{copyResult?.source === 'ai' || copyResult?.source === 'share' ? copyResult.message : ''}</p>
        <a href="#flag-example" className={s.textLink} onClick={() => { dialogOpener.current = null; setSelected(null) }}>{C.flag.action}<ArrowRight size={17} aria-hidden="true" /></a>
      </> : selectedPreview ? <>
        <p className={s.detailAnswer}>{selectedPreview.answer}</p>
        <BoardDetails checkedAt={C.exampleCheckedAt} sources={[selectedPreview.id === 'tracking' ? 'Google Analytics' : SITE_BOARD_COPY.browserSource]} facts={selectedPreview.facts} coverage={selectedPreview.coverage} />
      </> : null}
    </DialogContent></Dialog>
    <AddCardLibrary
      open={libraryOpen}
      onOpenChange={setLibraryOpen}
      present={['site', 'conversion', 'security', 'search', 'performance', 'tracking', ...extraCards]}
      exampleNote={C.add.note}
      onAdd={id => {
        if (id === 'uptime' || id === 'accessibility') {
          setExtraCards(current => current.includes(id) ? current : [...current, id])
        }
        setLibraryOpen(false)
      }}
    />
  </div>
}
