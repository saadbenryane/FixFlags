import { canScanRepositories } from '@/lib/auth/entitlements'

type ScanAccessUser = Parameters<typeof canScanRepositories>[0]

/** Ephemeral scan access (request body / MCP / CLI) requires Agency. */
export function canUseEphemeralScanAccess(user: ScanAccessUser | null | undefined): boolean {
  if (!user) return false
  return canScanRepositories(user)
}
