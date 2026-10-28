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
