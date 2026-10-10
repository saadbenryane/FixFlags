'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'

export function SiteCheckLibrary({ siteId, view, owner, onRefresh, onOpenCard, onCheck, open: controlledOpen, onOpenChange }: {
  open?: boolean; onOpenChange?: (open: boolean) => void
  siteId: string; view: SiteHomeView; owner: boolean; onRefresh: () => Promise<unknown>
  onOpenCard?: (id: keyof typeof CARD_CATALOG) => void; onCheck?: () => Promise<void>
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value) }
  const [tab, setTab] = useState<'Visitor actions' | 'Website checks' | 'Connections'>('Visitor actions')
  const [target, setTarget] = useState(view.site.url)
  const [fixtures, setFixtures] = useState<OutcomeFixtureView[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !owner) return
    let active = true
    void fetch(`/api/sites/${siteId}/outcome-fixtures`).then(async response => {
      if (!response.ok) throw new Error('Signup setup could not be loaded. Try again.')
      const body = await response.json() as { fixtures: OutcomeFixtureView[] }
      if (active) setFixtures(body.fixtures)
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Could not load setup.') })
    return () => { active = false }
  }, [open, owner, siteId])
  async function add(body: object) {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/outcomes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json() as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Could not add this check.')
      await onRefresh()
      setMessage('Card added. Verify it for fresh evidence. Your Watch schedule is unchanged.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection interrupted. Please try again.') }
    finally { setBusy(false) }
  }
  const checkout = view.outcomes.filter((outcome) => outcome.kind === 'CHECKOUT')
  const authorized = fixtures.filter((fixture) => fixture.enabled && fixture.authorizedAt && fixture.lastDryRunVersion === fixture.version)
  return <>
    <button
      type="button"
      ref={trigger}
      onClick={() => setOpen(true)}
      aria-label={SITE_BOARD_COPY.addCard}
      className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Plus className="h-4 w-4" aria-hidden />
      <span>Add</span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] max-w-xl overflow-auto" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
      <DialogTitle>{SITE_BOARD_COPY.addCard}</DialogTitle><DialogDescription>Keep a visitor action working, inspect website health, or connect useful context. Every card explains what was checked.</DialogDescription>
      <div className="flex flex-wrap gap-2" aria-label="Card categories">{(['Visitor actions', 'Website checks', 'Connections'] as const).map((item) => <Button key={item} variant={tab === item ? 'secondary' : 'ghost'} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</Button>)}</div>
      {!owner ? <div className="space-y-3"><p>Sign in and claim this website to configure Outcomes or connections.</p><Button asChild><Link href={`/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}`}>Sign in to configure</Link></Button></div> : null}
      {tab === 'Visitor actions' ? <div className="space-y-4">
        <section className="rounded-card border border-border p-4"><h3 className="font-medium">Page availability</h3><p className="mt-1 text-sm text-muted-foreground">Verify that a public page responds successfully.</p>
          <label htmlFor="new-outcome-page" className="mt-3 block text-sm">Page URL</label><Input id="new-outcome-page" className="mt-1" type="url" value={target} onChange={(event) => setTarget(event.target.value)} />
          <Button className="mt-3" disabled={!owner || busy} onClick={() => void add({ action: 'create', kind: 'AVAILABILITY', targetUrl: target })}>Add page availability</Button>
        </section>
        <section className="rounded-card border border-border p-4"><h3 className="font-medium">Checkout</h3>
          {checkout.length ? checkout.map((outcome) => <div key={outcome.id} className="mt-2"><span className="text-sm">{outcome.name}</span><Button className="ml-2" variant="outline" disabled={!owner || busy || Boolean(outcome.confirmedAt)} onClick={() => void add({ outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' })}>{outcome.confirmedAt ? 'Already added' : 'Confirm checkout'}</Button></div>) : <p className="mt-1 text-sm text-muted-foreground">Requires a discovered product and a safe route to checkout. Run a website check to discover it.</p>}
        </section>
        <section className="rounded-card border border-border p-4"><h3 className="font-medium">Safe Signup</h3><p className="mt-1 text-sm text-muted-foreground">Requires a tested, authorized setup that removes the synthetic account after each verification.</p>
          {authorized.map((fixture) => <Button key={fixture.id} className="mt-3 mr-2" disabled={!owner || busy} onClick={() => void add({ action: 'create', kind: 'SIGNUP', targetUrl: fixture.targetUrl, fixtureId: fixture.id })}>Use {fixture.name}</Button>)}
          <Button className="mt-3" variant="outline" asChild><Link href={`/sites/${siteId}/settings#signup-setup`} onClick={() => setOpen(false)}>Configure Signup test</Link></Button>
        </section>
      </div> : tab === 'Website checks' ? <div className="space-y-2">{view.cards.map((card) => <section key={card.id} className="flex items-center justify-between gap-3 rounded-card border border-border p-3"><div><h3 className="text-sm font-medium">{card.name}</h3><p className="text-xs text-muted-foreground">{card.evidenced ? 'Evidence available' : 'Requires a fresh analysis'}</p></div>
        <Button variant="outline" disabled={busy || (!card.evidenced && !owner)} onClick={async () => { if (card.evidenced && onOpenCard) { setOpen(false); onOpenCard(card.id) } else if (onCheck) { await onCheck(); setOpen(false) } }}>{card.evidenced ? 'View check' : 'Check website'}</Button>
      </section>)}</div> : <div className="space-y-3">{[
        ['Shopify', view.settings.shopify.state === 'connected', true],
        ['Search Console', view.settings.searchConsole.status === 'connected', view.settings.searchConsole.configured],
        ['Analytics', view.settings.analytics.status === 'connected', view.settings.analytics.configured],
      ].filter(([, connected, configured]) => Boolean(connected || configured)).map(([name, connected]) => <section key={String(name)} className="rounded-card border border-border p-4"><h3 className="font-medium">{name}</h3><p className="mt-1 text-sm text-muted-foreground">{connected ? 'Connected' : 'Ready to connect'}</p><Button className="mt-3" variant="outline" asChild><Link href={`/sites/${siteId}/settings#connections`}>{connected ? 'Manage' : 'Connect'}</Link></Button></section>)}</div>}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </DialogContent></Dialog>
  </>
}
