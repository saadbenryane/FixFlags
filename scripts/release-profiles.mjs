export const RELEASE_PROFILES = ['free-launch', 'paid-opening']

export function releaseProfile(env = process.env) {
  const profile = env.RELEASE_PROFILE ?? 'free-launch'
  if (!RELEASE_PROFILES.includes(profile)) throw new Error(`Unknown release profile: ${profile}`)
  return profile
}

export function requiredReleaseStages(profile = 'free-launch') {
  if (!RELEASE_PROFILES.includes(profile)) throw new Error(`Unknown release profile: ${profile}`)
  return [
    'foundation', 'fixture-binding', 'credentialed-core',
    ...(profile === 'paid-opening' ? ['billing-open'] : []),
    'billing-closed', 'external', 'deployed',
  ]
}
