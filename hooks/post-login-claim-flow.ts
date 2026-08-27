export type ClaimFlowResult = { claimedCount?: number } | null | undefined

export async function runPostLoginClaimFlow(input: {
  claim: () => Promise<ClaimFlowResult>
  shouldEnroll: () => Promise<boolean>
  showEnrollment: () => void
  beforeNavigate: () => void
  navigate: () => Promise<void>
}): Promise<boolean> {
  const claimed = await input.claim()
  // null/undefined = HTTP or client failure. claimedCount 0 is success with
  // nothing to attach (plain login, no anon cookie).
  if (!claimed) return false
  if (await input.shouldEnroll()) {
    input.showEnrollment()
    return true
  }
  input.beforeNavigate()
  await input.navigate()
  return true
}
