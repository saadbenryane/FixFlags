/**
 * Column geometry for the living review editor. The live report shell and the
 * curated marketing emulations import these exact strings so /samples and the
 * homepage cannot drift from the geometry a real review renders.
 */

/** Agent column and product column tracks on the desktop split. */
export const WORKSPACE_SPLIT_GRID_CLASS =
  'lg:grid-cols-[minmax(280px,32%)_minmax(0,1fr)]'

/** Product pane header: flush pane, divider only, no inner card. */
export const WORKSPACE_PANEL_HEADER_CLASS =
  'flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 sm:px-4'

/** Agent pane header: product identity row above the transcript. */
export const WORKSPACE_AGENT_HEADER_CLASS =
  'flex min-h-16 shrink-0 items-center gap-3 border-b border-border/40 px-3'

/**
 * Product stage: fills the pane between the header and the docked transport.
 * The floor keeps the stage usable when the pane is stacked on small screens.
 * It is a flex column so the capture stretches to the stage even where the
 * height comes from that floor rather than from a definite parent height;
 * the capture always letterboxes inside it and never sizes it.
 */
export const WORKSPACE_STAGE_CLASS =
  'relative flex min-h-[18rem] min-w-0 flex-1 flex-col overflow-hidden lg:min-h-0'

/** Scrolling transcript body shared by the Agent panel and curated emulations. */
export const WORKSPACE_TRANSCRIPT_CLASS =
  'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 text-sm'

/**
 * Report body: the pane is the query container, so every surface inside it
 * measures the pane instead of the viewport. A report rendered in a 700px pane
 * on a 1280px screen must lay out like a 700px surface.
 */
export const WORKSPACE_PANE_SCROLL_CLASS =
  '@container/pane flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4'

/** Pane width at which the Report list and detail sit side by side. */
export const WORKSPACE_REPORT_SPLIT_CONTAINER = '40rem'

/**
 * Report frame: the fix explorer occupies exactly one pane height beneath the
 * fixed Score/history header, so the list is always reachable without
 * scrolling. Review context follows the frame as a sibling and scrolls the
 * pane. Below the split width the frame releases its height and the pane
 * scrolls as one column.
 */
export const WORKSPACE_REPORT_FRAME_CLASS =
  'flex min-h-[26rem] flex-col gap-3 @[40rem]/pane:h-full @[40rem]/pane:min-h-[24rem]'

/** Anchor offset for report sections addressed by id. */
export const REPORT_SECTION_SCROLL_MT = 'scroll-mt-[var(--report-chrome-offset)]'
