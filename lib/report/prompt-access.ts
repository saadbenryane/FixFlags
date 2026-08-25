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
    // Live report data is server-redacted. A repository-owned sample is the
    // only anonymous surface allowed to demonstrate a fix prompt.
    return { explorer: 'none', workspace: 'none' }
  }

  return { explorer: 'all', workspace: 'all' }
}
