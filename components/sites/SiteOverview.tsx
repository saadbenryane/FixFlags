import { SitePreviewCard, type SiteCapture } from '@/components/layout/SitePreviewCard'
import { BoardSummaryStrip, type BoardSummaryItem } from './BoardCard'
import { type ToolItem } from './SiteTooling'
import { DetectedToolsCard } from './DetectedToolsCard'
import styles from './SiteOverview.module.css'
import type { CaptureCollectionState } from '@/lib/sites/captures'

export function SiteOverview({ host, captures, capturePriority = false, collectionState, summaryItems, summaryLabel, notice, technologies, onSelectSummary, onSelectTechnology }: {
  host: string
  captures: readonly SiteCapture[]
  capturePriority?: boolean
  collectionState?: CaptureCollectionState
  summaryItems: readonly BoardSummaryItem[]
  summaryLabel?: string
  notice?: string
  technologies: readonly ToolItem[]
  onSelectSummary?: (item: BoardSummaryItem) => void
  onSelectTechnology?: (item: ToolItem) => void
}) {
  return <div className={styles.overview}>
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    <div className={styles.layout}>
      <SitePreviewCard host={host} captures={captures} priority={capturePriority} collectionState={collectionState} />
      <div className={styles.summaries}>
        <section className={styles.findings} aria-label="Findings summary">
          <BoardSummaryStrip items={summaryItems} label={summaryLabel} onSelect={onSelectSummary} />
        </section>
        <DetectedToolsCard items={technologies} onSelect={onSelectTechnology} />
      </div>
    </div>
  </div>
}
