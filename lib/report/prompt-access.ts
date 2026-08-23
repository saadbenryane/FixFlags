import type { ReportPromptAccess } from '@/lib/report/workspace-model'

export type ReportPromptAudience = 'owner' | 'live-anonymous' | 'curated-sample'

export interface ReportPromptProjection {
  explorer: 'all' | 'one' | 'none'
  workspace: ReportPromptAccess
}

export function resolveReportPromptProjection(
  audience: ReportPromptAudience
): ReportPromptProjection {
  if (audience === 'curated-sample') {
    return { explorer: 'one', workspace: 'demonstrated' }
  }

  if (audience === 'live-anonymous') {
    // Logged-out live viewers may copy the demonstrated top/category agent prompt.
    return { explorer: 'one', workspace: 'demonstrated' }
  }

  return { explorer: 'all', workspace: 'all' }
}
