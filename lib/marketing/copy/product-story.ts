/** Shared public promise for the homepage, metadata, and social artwork. */
export const PRODUCT_STORY = {
  headline: ['Your AI built it.', 'We make sure it works.'],
  description: 'Paste your URL. FixFlags checks your live site in a real browser, flags what’s broken with evidence, hands your AI the fix, and rechecks to prove it worked.',
  lede: 'We check your live site like a real visitor, hand your AI the fix, and prove it worked.',
  summary: 'Find what’s broken. Hand your AI the fix. Prove it worked.',
  action: 'Check your website',
  setup: 'No install. Free account, free during open beta.',
  /** The one product loop. Every surface that names its steps uses these words in this order. */
  loop: ['Check', 'Flag', 'Fix', 'Verify'],
} as const
