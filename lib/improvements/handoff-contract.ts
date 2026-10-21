/** The website acknowledges this protocol only after a completed clipboard write. */
export const COPIED_HANDOFF_CLIENT = 'website-clipboard-v2'

/** A confirmed copy must not relabel an older request or inherit its timestamp. */
export function handoffProtocolSuffix(client?: string | null): string {
  return client === COPIED_HANDOFF_CLIENT ? ':clipboard-v2' : ''
}
