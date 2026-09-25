import { verificationRuleForCheckId } from '@/lib/audit/verification-rules'
import { severityLabel } from '@/lib/marketing/copy'
import { CARD_CATALOG, type SiteCardArea } from '@/lib/sites/card-areas'

/** Area and severity as a customer reads them on a Flag. */
export function customerFlagContext(area: string, severity: string): string {
  const known = area in CARD_CATALOG ? CARD_CATALOG[area as SiteCardArea].name : area
  return `${known} · ${severityLabel(severity)}`
}

/** Current rule for this check, so an older stored procedure does not stay on the Flag. */
export function customerExpectedBehavior(checkId: string | null | undefined, stored: string | null | undefined): string {
  const current = checkId ? verificationRuleForCheckId(checkId) : null
  return current?.trim() || stored?.trim() || 'Check this same page again after the fix.'
}
