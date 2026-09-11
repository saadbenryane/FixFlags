/**
 * Public legal page copy. Customer-facing terms and privacy sections.
 */

export const LEGAL_PAGE_META = {
  termsUpdated: 'August 2026',
  privacyUpdated: 'September 2026',
} as const

export const TERMS_SECTIONS = {
  service: {
    title: 'Service',
    body:
      'FixFlags analyzes a public website URL you submit. Our browser opens the live pages, records what it sees, and raises Flags when something important enough to act on is wrong. Optional connections such as Shopify add store context to the same Site. Results are guidance for your own operations, not a guarantee that every visitor can complete every action.',
  },
  accountsAndBilling: {
    title: 'Accounts and billing',
    body:
      'You can Analyze a public URL without an account. Signing in lets you save the Site, Verify fixes, and keep watching. The Shopify app is optional. Pro extras are waitlisted and are not charged today. If paid billing opens later, those terms will be shown before you subscribe.',
  },
  discountTiers: {
    title: 'Launch discount tiers',
    body:
      'From time to time we offer launch discounts on Pro or Studio subscriptions. The first 500 waitlisters per plan receive 25% off for twelve months from plan release. The next 500 waitlisters per plan receive 15% off for twelve months from plan release. Discounts are limited, non-transferable, tied to the waitlist position recorded at join time, and expire twelve months after plan release even if you subscribe later. After the discount period, subscriptions renew at the standard list price unless you cancel.',
  },
  waitlist: {
    title: 'Waitlist',
    body:
      'If paid checkout is not yet open, you may join a Pro or Studio waitlist with a signed-in account. We record the email you enter at join time and use it to notify you when checkout opens. Joining the waitlist does not guarantee a specific opening date or discount eligibility beyond the published terms. Discount tiers are assigned by join order: the first 500 waitlisters per plan receive 25% off and the next 500 receive 15% off, each for twelve months from plan release.',
  },
  creditPacks: {
    title: 'Credit packs',
    body:
      'Legacy credit packs, when purchased, added additional product review credits. Credits do not expire and do not change your subscription tier.',
  },
  refunds: {
    title: 'Refunds and cancellation',
    body:
      'You may cancel anytime via the Stripe billing portal and keep access through the end of the paid period. We do not provide cash refunds for unused subscription time. Chargebacks or payment disputes may result in immediate suspension of paid usage allowances.',
  },
  acceptableUse: {
    title: 'Acceptable use',
    body:
      'Do not use FixFlags to check sites you do not have permission to test, to abuse rate limits, or to reverse-engineer the service.',
  },
} as const

export const PRIVACY_SECTIONS = {
  collect: {
    title: 'What we collect',
    body:
      'When you Analyze a URL, we store that URL, the pages our browser opened, screenshots and network evidence from that session, and the Flags we raise. If you create an account, we store your email and the Sites you claim. Shopify is optional: if you install the app, we also store the shop domain, store name, store owner email, and purchase-path verification artifacts. We do not sell your data. If you join a waitlist, we store the feature you asked for and the email we should notify.',
  },
  use: {
    title: 'How we use it',
    body:
      'We use this data to analyze the live website, raise Flags, Verify fixes, watch scheduled Sites, operate waitlists, and improve the product. We do not sell your personal data. Uninstalling the Shopify app stops purchase-path walks. Deleting a Site removes that website from your account.',
  },
  reportAccess: {
    title: 'Report access',
    body:
      'Public report URLs show evidence from an analysis. Signed-in owners are taken to their Site. Shopify verification video belongs to the installed store and is shown in the Shopify app. We do not sell report or walk data.',
  },
  thirdParties: {
    title: 'Third parties',
    body:
      'We use service providers for hosting, email (Resend), and verification storage (Cloudflare R2). Shopify provides shop identity and product catalog access under your install. These providers process data on our behalf under their own terms.',
  },
} as const
