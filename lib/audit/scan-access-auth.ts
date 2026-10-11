import { canUseAuthenticatedScanAccess } from '@/lib/auth/entitlements'

type ScanAccessUser = Parameters<typeof canUseAuthenticatedScanAccess>[0]

/** Temporary credentials require a resolved account with scan-access permission. */
export function canUseEphemeralScanAccess(user: ScanAccessUser | null | undefined): boolean {
  if (!user) return false
  return canUseAuthenticatedScanAccess(user)
}
