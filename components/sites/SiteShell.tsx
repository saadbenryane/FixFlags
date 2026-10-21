'use client'

import { useState, type ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SiteAccountRail } from '@/components/layout/SiteAccountRail'
import { AnalysisDetails, LiveSiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { MobileSidebar } from '@/components/layout/sidebar'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { Logo } from '@/components/brand/Logo'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'
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
import { nextCheckLabel } from '@/lib/sites/monitoring-schedule'
import { siteContinuationHref, type SiteViewerActions } from '@/lib/sites/viewer-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

import { SiteWorkspaceNavigation, SITE_ROUTES as routes, type SiteRoute } from './SiteWorkspaceNavigation'

function routeHref(siteId: string, route: SiteRoute): Route {
  if (route === 'home') return `/sites/${siteId}` as Route
  if (route === 'timeline' || route === 'integrations') return `/sites/${siteId}?view=${route}#${route}` as Route
  return `/sites/${siteId}/${route}` as Route
}

export function SiteShell(props: Parameters<typeof SiteShellContent>[0]) {
  return <SupportProvider><SiteShellContent {...props} /></SupportProvider>
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
  children,
}: {
  siteId: string
  ownerId?: string | null
  actions: SiteViewerActions
  activeRoute: SiteRoute
  title: string
  description: string
  presentation?: SitePresentation
  watch: SiteHomeView['watch']
  checking?: boolean
  statusMessage?: string | null
  headerAction?: ReactNode
  analysisView?: SiteHomeView
  analysisStatus?: ReactNode
  chatFlag?: { id: string; title: string }
  children: ReactNode
}) {
  const { user } = useMe()
  useSiteNavigationContinuity(siteId)
  const signedIn = Boolean(user)
  const ownsSite = actions.ownership === 'owner'
  const showSettings = true
  const navigationHref = (route: SiteRoute) => route === 'settings' && !ownsSite
    ? siteContinuationHref(actions.monitoring as 'sign_in' | 'claim', `/sites/${siteId}/settings`) as Route
    : routeHref(siteId, route)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const identity = presentation?.identity
  const host = identity?.host ?? title
  const viewTitle = activeRoute === 'home' && title !== host ? title : routes.find(([id]) => id === activeRoute)?.[1] ?? title
  const navigation = (label: string, close?: () => void) => <SiteWorkspaceNavigation activeRoute={activeRoute} label={label} showSettings={showSettings}
    renderItem={({ id, selected, className, content }) => <Link key={id} href={navigationHref(id)} onClick={close} aria-current={selected ? 'page' : undefined} className={className}>{content}</Link>} />

  const analyzing = presentation?.run.state === 'queued' || presentation?.run.state === 'running'

  return <div className={cn(styles.workspace, signedIn && styles.withAccount)}>
    <SiteAccountRail />
    <header className={styles.mobileAccount} aria-label={SITE_WORKSPACE_COPY.accountMenu}><Logo variant="lockup" size="sm" href={signedIn ? '/dashboard' : '/'} />
      {signedIn ? <MobileSidebar showAdmin={user?.isAdmin} /> : <SiteChromeAuth />}
    </header>
    <aside className={styles.websiteSidebar} aria-label={SITE_WORKSPACE_COPY.siteMenu}>
      {!signedIn ? <div className={styles.anonymousBrand}><Logo variant="lockup" size="sm" /></div> : null}
      <div className={styles.identity}>
        <Link href={routeHref(siteId, 'home')} className={styles.domain}>{host}</Link>
        {analysisStatus ?? (analysisView ? <LiveSiteAnalysisDetails siteId={siteId} initial={analysisView} /> : <AnalysisDetails host={host} statusLabel={presentation?.run.label ?? watch.label}
          active={Boolean(analyzing)} disconnected={false} />)}
      </div>
      <div className={styles.desktopNavigation}>{navigation('Site')}</div>
      <div className={styles.tabletNavigation}>
        <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
          <SheetTrigger asChild><Button variant="outline" size="sm"><Menu size={16} aria-hidden />{SITE_WORKSPACE_COPY.siteMenu}</Button></SheetTrigger>
          <SheetContent side="left" className="flex h-full w-60 flex-col md:left-16"><SheetHeader><SheetTitle className="break-all">{host}</SheetTitle><SheetDescription>{SITE_WORKSPACE_COPY.siteMenu}</SheetDescription></SheetHeader>
            {navigation('Website drawer', () => setNavigationOpen(false))}
          </SheetContent>
        </Sheet>
      </div>
    </aside>
    <div className={styles.canvas} data-site-content>
      <CustomerMain className="space-y-5">
        <header className={styles.header}><div className="min-w-0"><h1>{viewTitle}</h1>
          {title !== host && description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>
          <div className={styles.actions}><SiteMonitoringMenu label={watch.label}
            state={watch.state === 'watching' ? 'healthy' : watch.state === 'delayed' || watch.state === 'quota' ? 'attention' : 'unknown'}
            nextCheck={() => nextCheckLabel(watch.nextRunAt, Date.now())}
            manageLabel={ownsSite ? undefined : SITE_ACTION_COPY.access.monitoring}
            manageHref={ownsSite ? `/sites/${siteId}/settings#watch` as Route : siteContinuationHref(actions.monitoring as 'sign_in' | 'claim', `/sites/${siteId}/settings#watch`) as Route} />{headerAction}
            <LazySiteChat key={`${siteId}:${chatFlag?.id ?? 'site'}:${ownsSite}`} siteId={siteId}
              host={host} ownsSite={ownsSite} flagId={chatFlag?.id} flagTitle={chatFlag?.title} />
          </div>
        </header>
        {statusMessage ? <p role="status" className="text-sm">{statusMessage}</p> : null}
        {children}
      </CustomerMain>
    </div>
    <SiteWorkspaceNavigation activeRoute={activeRoute} label="Mobile Site" showSettings={showSettings} mobile className={cn(customerMobileBarClass, 'md:hidden')}
      renderItem={({ id, selected, className, content }) => <Link key={id} href={navigationHref(id)} aria-current={selected ? 'page' : undefined} className={className}>{content}</Link>} />
  </div>
}
