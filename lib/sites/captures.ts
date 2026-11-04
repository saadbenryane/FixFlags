import type { SitePresentation } from './presentation'

export type SiteCapture = NonNullable<SitePresentation['identity']['preview']> & {
  auditId: string; device: 'desktop' | 'mobile'; previous: boolean;
}

export type CaptureCollectionState = 'pending' | 'not_recorded' | 'unavailable'

/** Missing media is pending only while its admitted collection can still run. */
export function captureCollectionState(auditStatus: string | null, states: readonly string[]): CaptureCollectionState {
  if (auditStatus !== 'COMPLETED' && auditStatus !== 'FAILED' && states.some(state => ['WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'].includes(state))) return 'pending'
  return states.some(state => ['EXHAUSTED', 'BLOCKED', 'CANCELLED'].includes(state)) ? 'unavailable' : 'not_recorded'
}
export type SiteCaptureAvailability = Record<'desktop' | 'mobile', 'available' | 'pending' | 'not_recorded' | 'unavailable'>

/** Pending requires the unfinished primary media task, never a DOM collector or running report. */
export function siteCaptureAvailability(captures: readonly SiteCapture[], audit: {
  url: string; status?: string | null; verifierExecutions: Array<{ targetKey: string; pageUrl: string | null; workKind: string | null;
    workState?: string | null; status: string }>
} | null): SiteCaptureAvailability {
  const tasks = audit?.verifierExecutions.filter(row => row.workKind === 'captures' &&
    (row.pageUrl === audit.url || row.targetKey === 'task:p0:captures')) ?? []
  const disposition = captureCollectionState(audit?.status ?? null, tasks.map(row => row.status === 'NOT_APPLICABLE'
    ? 'NOT_APPLICABLE' : ['INCOMPLETE', 'FAILED'].includes(row.status) && !['WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'].includes(row.workState ?? '')
      ? 'EXHAUSTED' : row.workState ?? 'UNKNOWN'))
  const state = (device: 'desktop' | 'mobile'): SiteCaptureAvailability['desktop'] =>
    captures.some(capture => capture.device === device && !capture.previous) ? 'available' : disposition
  return { desktop: state('desktop'), mobile: state('mobile') }
}
