import {
  resolveReportChatGate,
  type AuditAccessContext,
} from '@/lib/audit/access-context'
import {
  resolveReportPromptProjection,
  type ReportPromptAudience,
  type ReportPromptProjection,
} from '@/lib/report/prompt-access'

export type { AuditAccessContext } from '@/lib/audit/access-context'
export type { ReportPromptAudience, ReportPromptProjection } from '@/lib/report/prompt-access'
export { resolveReportChatGate } from '@/lib/audit/access-context'
export { resolveReportPromptProjection } from '@/lib/report/prompt-access'

type SurfaceAccessContext = AuditAccessContext | 'repository_sample' | null

export function promptAudienceFromAccess(input: {
  accessContext: SurfaceAccessContext
  isRepositorySample: boolean
}): ReportPromptAudience {
  if (input.isRepositorySample || input.accessContext === 'repository_sample') {
    return 'curated-sample'
  }
  if (input.accessContext === 'owner') return 'owner'
  return 'live-anonymous'
}

export function resolveReportSurfaceCapabilities(input: {
  accessContext: SurfaceAccessContext
  isLoggedIn: boolean
  isRepositorySample?: boolean
}): {
  audience: ReportPromptAudience
  prompt: ReportPromptProjection
  chat: ReturnType<typeof resolveReportChatGate>
} {
  const audience = promptAudienceFromAccess({
    accessContext: input.accessContext,
    isRepositorySample: input.isRepositorySample === true,
  })
  return {
    audience,
    prompt: resolveReportPromptProjection(audience),
    chat: resolveReportChatGate({
      accessContext: input.accessContext,
      isLoggedIn: input.isLoggedIn,
    }),
  }
}
