import { AUDIT_ERRORS } from '@/lib/marketing/copy'
import { getUserFacingAuditError } from '@/lib/audit/user-facing-errors'

export type SiteCheckNotice = {
  title: string
  body: string
  retry: boolean
}

const SUMMARY_SKIPPED: Record<string, string> = {
  AI_PROVIDER_NOT_CONFIGURED: 'The written summary did not run. The Flags below come from the browser check.',
  AUDIT_TIMEOUT: 'The written summary ran out of time. The Flags below come from the browser check.',
  AUDIT_PIPELINE_FAILED: 'The written summary did not finish. The Flags below come from the browser check.',
}

/** Customer notice for a Site check that stopped. In-progress work is not a failure. */
export function siteCheckNotice(input: {
  status: string | null | undefined
  failureCode?: string | null
}): SiteCheckNotice | null {
  if (input.status !== 'FAILED') return null
  return {
    title: AUDIT_ERRORS.checkFailedTitle,
    body: getUserFacingAuditError(input.failureCode),
    retry: true,
  }
}

/** A completed check can still have skipped the written summary. That is not a failed check. */
export function siteSummaryNotice(input: {
  status: string | null | undefined
  failureCode?: string | null
}): { body: string } | null {
  if (input.status !== 'COMPLETED' || !input.failureCode) return null
  const body = SUMMARY_SKIPPED[input.failureCode]
  return body ? { body } : null
}
