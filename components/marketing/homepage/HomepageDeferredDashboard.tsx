'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import type { HomepageDashboardPreview } from './HomepageDashboardPreview'
import s from './CareHomepage.module.css'

type PreviewProps = ComponentProps<typeof HomepageDashboardPreview>

function DashboardPlaceholder() {
  return <div className={s.boardPlaceholder} data-testid="dashboard-placeholder" aria-hidden="true" />
}

const LazyDashboardPreview = dynamic(
  () => import('./HomepageDashboardPreview').then(module => module.HomepageDashboardPreview),
  { ssr: false, loading: DashboardPlaceholder },
)

/**
 * The sample dashboard is most of the homepage's own JavaScript and sits below the hero.
 * Loading it as it nears the viewport keeps it from competing with the first view.
 * `eager` loads it immediately, for pages where the dashboard is the whole page.
 */
export function HomepageDeferredDashboard({ eager = false, ...preview }: PreviewProps & { eager?: boolean }) {
  const anchor = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(eager)

  useEffect(() => {
    if (near) return
    const element = anchor.current
    if (!element || typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      setNear(true)
    }, { rootMargin: '600px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [near])

  if (near) return <LazyDashboardPreview {...preview} />
  return <div ref={anchor}><DashboardPlaceholder /></div>
}
