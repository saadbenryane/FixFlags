'use client'

import { type MouseEvent, type ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { SiteAccountRail } from '@/components/layout/SiteAccountRail'
import { AnalysisDetails, LiveSiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { Logo } from '@/components/brand/Logo'
import { useMe } from '@/hooks/useMe'
import { useSiteNavigationContinuity } from '@/hooks/useSiteNavigationContinuity'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { cn } from '@/lib/utils'
import { CustomerMain, customerMobileBarClass } from '@/components/layout/customer-frame'
import { type SitePresentation } from '@/lib/sites/presentation'
import styles from './SiteShell.module.css'
import { SupportProvider } from '@/components/live-support/SupportProvider'
import { LazySiteChat } from './LazySiteChat'
import { SiteMonitoringMenu } from './SiteMonitoringMenu'
import { SiteResourceBoundary } from './SiteResourceBoundary'
import { nextCheckLabel } from '@/lib/sites/monitoring-schedule'
import { siteContinuationHref, type SiteViewerActions } from '@/lib/sites/viewer-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { ReportAuthGateProvider, useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { ReportMobileNav } from '@/components/layout/ReportAppRail'
import { helpArticlePath } from '@/lib/help/types'

import { SiteWorkspaceNavigation, SITE_ROUTES as routes, type SiteRoute } from './SiteWorkspaceNavigation'
import { siteWorkspaceHref } from '@/lib/sites/workspace-location'
import { SiteWorkspaceHeader } from './SiteWorkspaceHeader'
const coverageHelpHref = helpArticlePath('sites-and-coverage', 'read-site-coverage')

function routeHref(siteId: string, route: SiteRoute): Route {
  return siteWorkspaceHref(siteId, route) as Route
}

export function SiteShell(props: Parameters<typeof SiteShellContent>[0]) {
  const content = <ReportAuthGateProvider auditId={props.auditId ?? props.analysisView?.audit.id ?? undefined}><SupportProvider><SiteShellContent {...props} /></SupportProvider></ReportAuthGateProvider>
  return props.analysisView ? <SiteResourceBoundary siteId={props.siteId} initial={props.analysisView}>{content}</SiteResourceBoundary> : content
}

function SiteShellContent({
  siteId,
  actions,
  activeRoute,
  title,
  description,
  presentation,
  watch,
  statusMessage,
  headerAction,
  analysisStatus,
  analysisView,
  chatFlag,
  onWorkspaceNavigate,
  children,
}: {
  siteId: string
  auditId?: string
  actions: SiteViewerActions
  activeRoute: SiteRoute
  title: string
  description: string
  presentation: SitePresentation
  watch: SiteHomeView['watch']
  statusMessage?: string | null
  headerAction?: ReactNode
  analysisView?: SiteHomeView
  analysisStatus?: ReactNode
  chatFlag?: { id: string; title: string }
  onWorkspaceNavigate?: (route: 'home' | 'pages' | 'timeline' | 'integrations') => void
  children: ReactNode
}) {
  const { user } = useMe()
  const gate = useReportAuthGate()
  useSiteNavigationContinuity(siteId)
  const signedIn = Boolean(user)
  const ownsSite = actions.ownership === 'owner'
  const showSettings = true
  const navigationHref = (route: SiteRoute) => route === 'settings' && !ownsSite
    ? siteContinuationHref(actions.monitoring as 'sign_in' | 'claim', `/sites/${siteId}/settings`) as Route
    : routeHref(siteId, route)
  const host = presentation.identity.host
  const routeTitle = routes.find(([id]) => id === activeRoute)?.[1] ?? title
  const canvasTitle = activeRoute === 'home' ? (title === host ? null : title) : routeTitle
  function openWorkspace(event: MouseEvent<HTMLAnchorElement>, route: SiteRoute, close?: () => void) {
    close?.()
    if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return
    if (route === 'settings' && actions.monitoring === 'sign_in' && gate) {
      event.preventDefault()
      gate.open({ nextPath: `/sites/${siteId}/settings`, trigger: event.currentTarget })
      return
    }
    if (!onWorkspaceNavigate || route === 'settings') return
    event.preventDefault()
    onWorkspaceNavigate(route)
  }
  const navigation = (label: string, close?: () => void) => <SiteWorkspaceNavigation activeRoute={activeRoute} label={label} showSettings={showSettings} helpHref={coverageHelpHref}
    renderItem={({ id, selected, className, content }) => <Link key={id} href={navigationHref(id)} prefetch={onWorkspaceNavigate && id !== 'settings' ? false : undefined} onClick={event => openWorkspace(event, id, close)} aria-current={selected ? 'page' : undefined} className={className}>{content}</Link>} />

  const analyzing = presentation.run.state === 'queued' || presentation.run.state === 'running'

  return <div className={cn(styles.workspace, styles.withAccount)}>
    <SiteAccountRail />
    <header className={styles.mobileAccount} aria-label={SITE_WORKSPACE_COPY.accountMenu}><Logo variant="lockup" size="sm" href={signedIn ? '/dashboard' : '/'} />
      <ReportMobileNav showAdmin={user?.isAdmin} />
    </header>
    <div className={styles.canvas} data-site-content>
      <CustomerMain className="space-y-5">
        <SiteWorkspaceHeader identity={<>
        {canvasTitle == null ? <h1 className={styles.siteTitle}><Link href={routeHref(siteId, 'home')} prefetch={onWorkspaceNavigate ? false : undefined} onClick={event => openWorkspace(event, 'home')} className={styles.domain}>{host}</Link></h1>
          : <Link href={routeHref(siteId, 'home')} prefetch={onWorkspaceNavigate ? false : undefined} onClick={event => openWorkspace(event, 'home')} className={styles.domain}>{host}</Link>}
        {analysisStatus ?? (analysisView ? <LiveSiteAnalysisDetails siteId={siteId} /> : analyzing ? <AnalysisDetails statusLabel={presentation.run.label} active disconnected={false} /> : null)}
        </>} navigation={<div className={styles.desktopNavigation}>{navigation('Site')}</div>}
          heading={canvasTitle ? <><h1>{canvasTitle}</h1>{description ? <p>{description}</p> : null}</> : null}
          actions={<><SiteMonitoringMenu label={watch.label}
            state={watch.state === 'watching' ? 'healthy' : watch.state === 'delayed' || watch.state === 'quota' ? 'attention' : 'unknown'}
            nextCheck={() => nextCheckLabel(watch.nextRunAt, Date.now())}
            manageLabel={ownsSite ? undefined : SITE_ACTION_COPY.access.monitoring}
            manageHref={ownsSite ? `/sites/${siteId}/settings#watch` as Route : siteContinuationHref(actions.monitoring as 'sign_in' | 'claim', `/sites/${siteId}/settings#watch`) as Route} />{headerAction}
          </>} />
        {statusMessage ? <p role="status" className="text-sm">{statusMessage}</p> : null}
        {children}
      </CustomerMain>
    </div>
    <SiteWorkspaceNavigation activeRoute={activeRoute} label="Mobile Site" showSettings={showSettings} helpHref={coverageHelpHref} mobile className={cn(customerMobileBarClass, 'md:hidden')}
      renderItem={({ id, selected, className, content }) => <Link key={id} href={navigationHref(id)} prefetch={onWorkspaceNavigate && id !== 'settings' ? false : undefined} onClick={event => openWorkspace(event, id)} aria-current={selected ? 'page' : undefined} className={className}>{content}</Link>} />
    <LazySiteChat key={`${siteId}:${chatFlag?.id ?? 'site'}:${ownsSite}`} siteId={siteId}
      host={host} ownsSite={ownsSite} flagId={chatFlag?.id} flagTitle={chatFlag?.title} />
  </div>
}
