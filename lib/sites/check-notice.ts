import { AUDIT_ERRORS } from '@/lib/marketing/copy-barrel'
import { getUserFacingAuditError } from '@/lib/audit/user-facing-errors'

export type SiteCheckNotice = {
  title: string
  body: string
  retry: boolean
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
