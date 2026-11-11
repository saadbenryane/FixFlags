import type { ReactNode } from 'react'
import { SitePreviewCard, type SiteCapture } from '@/components/layout/SitePreviewCard'
import { BoardSummaryStrip, type BoardSummaryItem } from './BoardCard'
import { type ToolItem } from './SiteTooling'
import { DetectedToolsCard } from './DetectedToolsCard'
import styles from './SiteOverview.module.css'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { SiteCaptureAvailability, CaptureCollectionState } from '@/lib/sites/captures'

export function SiteOverview({ host, captures, captureAvailability, capturePriority = false, collectionState, summaryItems, summaryLabel, notice, technologies = [], lead, onSelectSummary, onSelectTechnology }: {
  host: string
  captures: readonly SiteCapture[]
  captureAvailability?: SiteCaptureAvailability
  capturePriority?: boolean
  collectionState?: CaptureCollectionState
  summaryItems: readonly BoardSummaryItem[]
  summaryLabel?: string
  notice?: string
  /** Shown under the row when the page does not already show them beside the website name. */
  technologies?: readonly ToolItem[]
  /** The one thing to do first, given the widest card in the row. */
  lead?: ReactNode
  onSelectSummary?: (item: BoardSummaryItem) => void
  onSelectTechnology?: (item: ToolItem) => void
}) {
  // One row: the page, the one thing to fix first, and two small figures. Detected tools follow on a line of their own,
  // so the fixes below start high on the page.
  return <div className={styles.overview}>
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    <div className={styles.layout} data-lead={lead ? true : undefined}>
      {lead ? <div className={styles.lead}>{lead}</div> : null}
      <div className={styles.preview}><SitePreviewCard host={host} captures={captures} availability={captureAvailability} priority={capturePriority} collectionState={collectionState} /></div>
      <section className={styles.findings} aria-label={SITE_BOARD_COPY.flagsSummary}>
        <BoardSummaryStrip items={summaryItems} label={summaryLabel} onSelect={onSelectSummary} />
      </section>
    </div>
    <DetectedToolsCard items={technologies} onSelect={onSelectTechnology} inline />
  </div>
}
