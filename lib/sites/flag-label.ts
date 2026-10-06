import { verificationRuleForCheckId } from '@/lib/audit/verification-rules'
import { severityLabel } from '@/lib/marketing/copy'
import { CARD_CATALOG, type SiteCardArea } from '@/lib/sites/card-areas'

/** Area and severity as a customer reads them on a Flag. */
export function customerFlagContext(area: string, severity: string): string {
  const known = area in CARD_CATALOG ? CARD_CATALOG[area as SiteCardArea].name : area
  return `${known} · ${severityLabel(severity)}`
}

const ATTEMPT_SOURCES: Record<string, string> = {
  site: 'From this Site',
  web: 'From this Site',
  copy: 'Copied instructions',
  'user-decision': 'Your decision',
  mcp: 'MCP',
  codex: 'Codex',
  cursor: 'Cursor',
  claude: 'Claude Code',
  'claude-code': 'Claude Code',
  windsurf: 'Windsurf',
  lovable: 'Lovable',
  bolt: 'Bolt',
  replit: 'Replit',
  devin: 'Devin',
}

/** How a verification attempt was recorded. Internal builder tokens stay off the Flag. */
export function customerAttemptSource(builder: string): string {
  const key = builder.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
  return ATTEMPT_SOURCES[key] ?? 'Recorded attempt'
}

/** Current rule for this check, so an older stored procedure does not stay on the Flag. */
export function customerExpectedBehavior(checkId: string | null | undefined, stored: string | null | undefined): string {
  const current = checkId ? verificationRuleForCheckId(checkId) : null
  return current?.trim() || stored?.trim() || 'Check this same page again after the fix.'
}
