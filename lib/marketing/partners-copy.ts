export const PARTNERS_COPY = {
  eyebrow: 'Expert program',
  title: 'FixFlags Expert Program',
  subtitle: 'For Lovable, Bolt, and MVP studios delivering client work.',
  body: 'Use FixFlags as your delivery check: catch issues before handoff, share a credible Finish Plan, and prove fixes with re-check.',
  perksTitle: 'What experts get',
  perks: [
    'Referral revenue on paying clients you introduce',
    'Verified Delivery report template for handoffs',
    'Studio preview scan access and Railway deploy Launch Checks',
  ],
  cta: 'Apply for the expert program',
  email: 'hello@fixflags.com',
} as const

export function inferBuilderToolFromUrl(url: string): 'lovable' | 'bolt' | null {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('lovable') || host.endsWith('lovable.app')) return 'lovable'
    if (host.includes('bolt') || host === 'bolt.new' || host.endsWith('.bolt.new')) return 'bolt'
  } catch {
    return null
  }
  return null
}
