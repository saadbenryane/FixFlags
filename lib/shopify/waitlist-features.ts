export const INTEGRITY_WAITLIST_FEATURES = [
  {
    key: 'extra_paths',
    title: 'More purchase paths',
    body: 'Watch more than two products on the free plan.',
  },
  {
    key: 'faster_cadence',
    title: 'Faster walks',
    body: 'Check the path more often than every six hours.',
  },
  {
    key: 'funnel_analytics',
    title: 'Store funnel numbers',
    body: 'Overlay FixFlags incidents on real Shopify session counts when reports access is approved.',
  },
  {
    key: 'paid_traffic',
    title: 'Paid traffic paths',
    body: 'Watch the landing pages your ads send people to.',
  },
  {
    key: 'multi_store',
    title: 'Multiple stores',
    body: 'One FixFlags home for more than one Shopify store.',
  },
  {
    key: 'history_video',
    title: 'Longer video history',
    body: 'Keep verification video past the free retention window.',
  },
  {
    key: 'improve_full',
    title: 'Full Improve list',
    body: 'The ranked secondary list beyond the free cap.',
  },
] as const

export type IntegrityWaitlistKey = (typeof INTEGRITY_WAITLIST_FEATURES)[number]['key']
