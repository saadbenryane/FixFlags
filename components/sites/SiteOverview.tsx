import { SitePreviewCard, type SiteCapture } from '@/components/layout/SitePreviewCard'
import { BoardSummaryStrip, type BoardSummaryItem } from './BoardCard'
import { type ToolItem } from './SiteTooling'
import { DetectedToolsCard } from './DetectedToolsCard'
import styles from './SiteOverview.module.css'

export function SiteOverview({ host, captures, summaryItems, summaryLabel, notice, technologies, onSelectSummary, onSelectTechnology }: {
  host: string
  captures: readonly SiteCapture[]
  summaryItems: readonly BoardSummaryItem[]
  summaryLabel?: string
  notice?: string
  technologies: readonly ToolItem[]
  onSelectSummary?: (item: BoardSummaryItem) => void
  onSelectTechnology?: (item: ToolItem) => void
}) {
  return <div className={styles.overview}>
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    <div className={`${styles.layout} ${technologies.length ? styles.withTools : ''}`}>
      <SitePreviewCard host={host} captures={captures} />
      <div className={styles.summaries}>
        <section className={styles.findings} aria-label="Findings summary">
          <BoardSummaryStrip items={summaryItems} label={summaryLabel} onSelect={onSelectSummary} />
        </section>
        <DetectedToolsCard items={technologies} onSelect={onSelectTechnology} />
      </div>
    </div>
  </div>
}
