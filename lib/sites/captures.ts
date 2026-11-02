import type { SitePresentation } from './presentation'

export type SiteCapture = NonNullable<SitePresentation['identity']['preview']> & {
  auditId: string; device: 'desktop' | 'mobile'; previous: boolean;
}

export type SiteCaptureAvailability = Record<'desktop' | 'mobile', 'available' | 'pending' | 'not_recorded' | 'unavailable'>

/** Pending requires the unfinished primary media task, never a DOM collector or running report. */
export function siteCaptureAvailability(captures: readonly SiteCapture[], audit: {
  url: string; status?: string | null; verifierExecutions: Array<{ targetKey: string; pageUrl: string | null; workKind: string | null;
    workState?: string | null; status: string }>
} | null): SiteCaptureAvailability {
  const tasks = audit?.verifierExecutions.filter(row => row.workKind === 'captures' &&
    (row.pageUrl === audit.url || row.targetKey === 'task:p0:captures')) ?? []
  const pending = !['COMPLETED', 'FAILED'].includes(audit?.status ?? '') && tasks.some(row => ['WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'].includes(row.workState ?? ''))
  const failed = tasks.some(row => ['EXHAUSTED', 'BLOCKED', 'CANCELLED'].includes(row.workState ?? '') || ['INCOMPLETE', 'FAILED'].includes(row.status))
  const state = (device: 'desktop' | 'mobile'): SiteCaptureAvailability['desktop'] =>
    captures.some(capture => capture.device === device && !capture.previous) ? 'available' : pending ? 'pending' : failed ? 'unavailable' : 'not_recorded'
  return { desktop: state('desktop'), mobile: state('mobile') }
}
