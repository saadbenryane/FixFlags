export type ClaimFlowAccount = { id: string; email: string }
export type ClaimFlowResult = { claimedCount?: number; user?: ClaimFlowAccount | null } | null | undefined

export async function runPostLoginClaimFlow(input: {
  claim: () => Promise<ClaimFlowResult>
  shouldEnroll: (signal?: AbortSignal) => Promise<boolean>
  showEnrollment: (claimed: NonNullable<ClaimFlowResult>) => void
  beforeNavigate: (claimed: NonNullable<ClaimFlowResult>) => void
  navigate: () => Promise<void>
  skipEnrollment?: boolean
  signal?: AbortSignal
}): Promise<boolean> {
  if (input.signal?.aborted) return false
  const claimed = await input.claim()
  // null/undefined = HTTP or client failure. claimedCount 0 is success with
  // nothing to attach (plain login, no anon cookie).
  if (!claimed || input.signal?.aborted) return false
  if (!input.skipEnrollment) {
    const enroll = await input.shouldEnroll(input.signal)
    if (input.signal?.aborted) return false
    if (enroll) { input.showEnrollment(claimed); return true }
  }
  input.beforeNavigate(claimed)
  if (input.signal?.aborted) return false
  await input.navigate()
  return true
}
