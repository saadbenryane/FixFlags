/** Shared presentation data. Domain projections do not depend on UI modules. */
export type BoardSummaryItem = {
  id?: string
  label: string
  value: number | string
  detail?: string
  accessibleDetail?: string
  state: 'attention' | 'healthy' | 'unknown'
}

export type ToolState = 'healthy' | 'attention'
export type ToolItem = {
  name: string
  detail?: string
  state: ToolState
  status: string
  suggested?: boolean
  actionLabel?: string
  actionHref?: string
  actionDisabled?: boolean
}
