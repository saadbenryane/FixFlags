/** Stored AI observation identities take precedence over diagnostic check IDs. */
export function flagKeyForRow(flag: { checkId: string | null; fingerprint: string | null }): string {
  if (flag.fingerprint?.startsWith('ai-observation:v1::') || flag.fingerprint?.startsWith('ai-observation:v2::')) return flag.fingerprint
  return flag.checkId ?? flag.fingerprint ?? ''
}
