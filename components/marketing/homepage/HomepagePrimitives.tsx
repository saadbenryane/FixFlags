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

export function Signal({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  return <span className={`${s.signal} ${s[tone]}`}><i aria-hidden="true" />{children}</span>
}

export function HomepageIntro({ label, title, body }: { label?: string; title: string; body?: string }) {
  return <div className={s.intro}>{label && <p className={s.eyebrow}>{label}</p>}<h2>{title}</h2>{body && <p>{body}</p>}</div>
}

export function HomepageUrlEntry({ final = false }: { final?: boolean }) {
  useEffect(() => {
    if (final) return
    const focusFromHash = () => {
      if (window.location.hash !== '#analyze') return
      const field = document.getElementById('audit-url-care-hero') as HTMLInputElement | null
      if (!field) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      field.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
      window.requestAnimationFrame(() => field.focus({ preventScroll: true }))
    }
    focusFromHash()
    window.addEventListener('hashchange', focusFromHash)
    return () => window.removeEventListener('hashchange', focusFromHash)
  }, [final])

  return <div className={s.entry} id={final ? undefined : 'analyze'}>
    <AuditInput variant="landing" idSuffix={final ? '-care-final' : '-care-hero'} ctaPlacement={final ? 'final' : 'hero'} showLandingExtras={false} submitLabel={C.hero.cta} urlPlaceholder={C.hero.placeholder} />
    <p className={s.trust}>{C.hero.trust}</p>
  </div>
}
