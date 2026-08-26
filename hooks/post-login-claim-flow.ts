export type ClaimFlowResult = { claimedCount?: number } | null | undefined

function claimedCountOf(result: ClaimFlowResult): number | null {
  if (!result || typeof result !== 'object') return null
  if (!('claimedCount' in result)) return null
  const count = result.claimedCount
  return typeof count === 'number' && Number.isFinite(count) ? count : null
}

export async function runPostLoginClaimFlow(input: {
  claim: () => Promise<ClaimFlowResult>
  shouldEnroll: () => Promise<boolean>
  showEnrollment: () => void
  beforeNavigate: () => void
  navigate: () => Promise<void>
}): Promise<boolean> {
  const claimed = await input.claim()
  if (!claimed) return false
  const claimedCount = claimedCountOf(claimed)
  if (claimedCount === 0) return false
  if (await input.shouldEnroll()) {
    input.showEnrollment()
    return true
  }
  input.beforeNavigate()
  await input.navigate()
  return true
}
