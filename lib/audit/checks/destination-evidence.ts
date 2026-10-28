import { createHash } from 'node:crypto'
import type { CheckAssertion } from './assertion'
import type { openCheckDestination, OpenCheckObservation } from '../open-check'
import type { PreviewImageResponse } from './preview-image-response'

export const DESTINATION_VERIFICATION_RULE = 'Public destination: repeat GET for every originally failed destination under the same page scope.'
export const PUBLIC_LINK_VERIFICATION_RULE = 'Public link response v2: repeat GET for every originally failed destination under the same page scope and active-document missing-page interpretation.'
export type DestinationCheckOptions = {
  deadline?: number
  record?: (assertion: CheckAssertion) => void
  scope?: { complete?: boolean; limitation?: string; collectedAt?: string }
  collectedAt?: () => string
  openDestination?: (...args: Parameters<typeof openCheckDestination>) => Promise<OpenCheckObservation>
  observeImage?: (url: string, init: { timeoutMs: number; deadline?: number; maxBytes: number; accept: string }) => Promise<PreviewImageResponse>
  /** Tests supply a collected document. Production uses the public fetcher. */
  fetchDocument?: (url: string, init: { timeoutMs: number; deadline?: number; maxBytes: number; accept: string }) => Promise<{ statusCode: number; headers: Record<string, string>; body: string | Buffer; complete: boolean }>
}

/** Retain query-dependent destination identity without persisting signed values. */
export function destinationContext(pageUrl: string, destination: string, criterion?: string): string {
  const identity = (value: string) => {
    try { const url = new URL(value); url.hash = ''; return url.toString() } catch { return value }
  }
  return 'destination:' + createHash('sha256').update(JSON.stringify([identity(pageUrl), identity(destination), ...(criterion ? [criterion] : [])])).digest('hex')
}

/** Historical raw-text soft-404 observations cannot borrow corrected parsing
 * as proof that a customer repaired the destination. */
export function publicLinkContext(pageUrl: string, destination: string) {
  return destinationContext(pageUrl, destination, 'public-link-active-document-v2')
}

export function displayDestination(value: string): string {
  try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString().slice(0, 500) }
  catch { return 'Invalid destination URL' }
}

export function destinationScope(options: DestinationCheckOptions, complete: boolean, limitation: string) {
  if (options.scope) Object.assign(options.scope, { complete, limitation, collectedAt: options.collectedAt?.() ?? new Date().toISOString() })
}
