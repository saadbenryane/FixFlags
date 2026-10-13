import { type TechnologyProfileStatus,type VisibleTechnology } from '@/lib/audit/technology-profile'
import { type WatchAlertDeliveryState } from '@/lib/audit/watch-notification'
import { type SiteActivity } from '@/lib/sites/activity'
import { type BoardCardView } from '@/lib/sites/board-card'
import type { SiteCapture } from '@/lib/sites/captures'
import { type SiteCheckResult } from '@/lib/sites/check-results'
import type { PublicConnection } from '@/lib/sites/connections/match'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { MonitoringHistoryEntry } from '@/lib/sites/monitoring-history'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import {
type SitePresentation
} from '@/lib/sites/presentation'
import type { SiteRecord } from '@/lib/sites/types'
import type { WatchInterval } from '@/lib/sites/watch-schedule'
import {
type WatchBoardState
} from '@/lib/sites/watch-state'
import type { UptimeIncidentView,UptimeSummary } from '@/lib/uptime/domain'
import type { AccountChecksView } from './accounts/contracts'
import { type ExecutionProgress } from './application/execution-progress'
import { type ActiveSiteRun } from './application/site-execution'

export type SiteHomeView = {
  schemaVersion: 2
  captures?: SiteCapture[]
  uptime?: UptimeSummary | null
  uptimeEvents?: UptimeIncidentView[]
  inventoryPageCount: number
  activeRuns: ActiveSiteRun[]
  monitoringTrend: MonitoringHistoryEntry[]
  site: SiteRecord
  presentation: SitePresentation
  activity?: SiteActivity
  recoveryUnavailable?: boolean
  executionProgress?: ExecutionProgress | null
  audit: {
    id: string | null
    status: string | null
    progress: number
    walkFinished: boolean
    failureCode: string | null
  }
  cards: BoardCardView[]
  flags: SiteFlagSeed[]
  recommendations: SiteFlagSeed[]
  resolvedFlags: SiteFlagSeed[]
  outcomes: SiteOutcomeView[]
  checkResults?: SiteCheckResult[]
  checkResultsNextCursor?: string | null
  technology?: {
    status: TechnologyProfileStatus
    detectedAt: string | null
    items: Array<Pick<VisibleTechnology, 'slug' | 'name' | 'category' | 'confidenceBand'>>
  }
  monitoringHistory: MonitoringHistoryEntry[]
  watch: {
    state: WatchBoardState
    interval: WatchInterval | null
    everyMinutes?: number | null
    nextRunAt: string | null
    lastRunAt: string | null
    lastError: string | null
    covered: boolean
    label: string
    /** Provider acceptance is separate from confirmed inbox delivery. */
    alert: {
      state: WatchAlertDeliveryState
      status: 'NOT_APPLICABLE' | 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | null
      attempts: number
      leaseUntil?: string | null
      at: string | null
    }
  }
  checkedPages?: Array<{ url: string; title: string | null; status: string; checkedAt: string; capture?: { url: string; viewport: string; recordedAt: string | null } | null }>
  settings: {
    accountChecks?: AccountChecksView
    notificationLevel: 'FLAGS' | 'CRITICAL_ONLY' | 'OFF' | null
    notifyOnRecovery: boolean | null
    shopify: { configured: boolean; state: 'connected' | 'unavailable' | 'not_connected'; domain: string | null }
    searchConsole: PublicConnection
    analytics: PublicConnection
  }
}
