'use client'

import { useEffect } from 'react'
import { AuditInput } from '@/components/audit/AuditInput'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import s from './CareHomepage.module.css'

export const HOMEPAGE_EVIDENCE = {
  failed: '/marketing/evidence/purchase-broken.png',
  passed: '/marketing/evidence/purchase-verified.png',
  site: '/marketing/evidence/site-home.png',
} as const

export function HomepageIntro({ label, title, body }: { label?: string; title: string; body?: React.ReactNode }) {
  return <div className={s.intro}>{label && <p className={s.eyebrow}>{label}</p>}<h2>{title}</h2>{body && <p>{body}</p>}</div>
}

export function HomepageUrlEntry({ final = false }: { final?: boolean }) {
  useEffect(() => {
    if (final) return
    const focusField = () => {
      const field = document.getElementById('audit-url-care-hero') as HTMLInputElement | null
      if (!field) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      field.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
      window.requestAnimationFrame(() => field.focus({ preventScroll: true }))
    }
    const focusFromHash = () => {
      if (['#analyze', '#audit'].includes(window.location.hash)) focusField()
    }
    const focusFromLink = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
      if (!link) return
      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || !['#analyze', '#audit'].includes(destination.hash)) return
      window.requestAnimationFrame(focusField)
    }
    focusFromHash()
    window.addEventListener('hashchange', focusFromHash)
    document.addEventListener('click', focusFromLink)
    return () => {
      window.removeEventListener('hashchange', focusFromHash)
      document.removeEventListener('click', focusFromLink)
    }
  }, [final])

  return <div className={s.entry} id={final ? undefined : 'analyze'}>
    {final ? null : <span id="audit" aria-hidden />}
    <AuditInput variant="landing" idSuffix={final ? '-care-final' : '-care-hero'} ctaPlacement={final ? 'final' : 'hero'} showLandingExtras={false} submitLabel={C.hero.cta} urlPlaceholder={C.hero.placeholder} />
  </div>
}
