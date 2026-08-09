export async function runPostLoginClaimFlow(input: {
  claim: () => Promise<unknown | null>
  shouldEnroll: () => Promise<boolean>
  showEnrollment: () => void
  beforeNavigate: () => void
  navigate: () => Promise<void>
}): Promise<boolean> {
  const claimed = await input.claim()
  if (!claimed) return false
  if (await input.shouldEnroll()) {
    input.showEnrollment()
    return true
  }
  input.beforeNavigate()
  await input.navigate()
  return true
}
