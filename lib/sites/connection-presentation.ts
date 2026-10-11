import { SITE_CONNECTION_COPY as C } from '@/lib/marketing/copy/site-connections'

export function connectionPresentation(status: string, configured: boolean) {
  const state = configured ? status : 'unavailable'
  return {
    label: state === 'connected' ? C.states.connected : state === 'mismatch' ? C.states.mismatch
      : state === 'needs_reauth' ? C.states.needs_reauth : state === 'revoked' ? C.states.revoked
        : state === 'unavailable' ? C.states.unavailable : C.states.not_connected,
    action: state === 'connected' ? C.settings : state === 'mismatch' ? C.review
      : state === 'needs_reauth' || state === 'revoked' ? C.reconnect : state === 'unavailable' ? C.review : C.connect,
    healthy: state === 'connected',
    disabled: !configured,
  }
}
