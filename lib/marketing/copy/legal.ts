/**
 * Public legal page copy. Customer-facing terms and privacy sections.
 */

export const LEGAL_PAGE_META = {
  termsUpdated: 'August 2026',
  privacyUpdated: 'August 2026',
} as const

export const TERMS_SECTIONS = {
  service: {
    title: 'Service',
    body:
      'FixFlags provides Product QA reviews and fix prompts for AI-built products. The service is provided as-is. Report results are guidance for your own review, not guarantees of production readiness, compliance, accessibility certification, or legal advice.',
  },
  accountsAndBilling: {
    title: 'Accounts and billing',
    body:
      'Paid plans renew monthly unless you cancel through the Stripe billing portal. Product review limits apply per plan. New URLs, update reviews, and completed scheduled Watch reviews each use one product review from the monthly allowance. Unused allowance does not roll over. Downgrades and cancellations take effect at the end of the current billing period unless Stripe indicates otherwise.',
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
      'When you create an account, we store your email and name. When you run a check, we store the URL you submit, screenshots, automated check results, and AI-generated Flags. If you join a paid plan waitlist, we store your waitlist plan choice and related campaign metadata.',
  },
  use: {
    title: 'How we use it',
    body:
      'We use this data to generate reports, enforce plan limits, operate waitlists and promotional offers, and improve the product. We do not sell your personal data.',
  },
  reportAccess: {
    title: 'Report access',
    body:
      'Report evidence is public at its link. Agent chat, fix prompts, Product Memory, account history, and owner actions remain account-gated.',
  },
  thirdParties: {
    title: 'Third parties',
    body:
      'We use service providers for hosting, payments (Stripe), email (Resend), screenshot storage (Cloudflare R2), and AI analysis (OpenAI or Anthropic). Stripe may collect billing address and tax information at checkout. These providers process data on our behalf under their own terms.',
  },
} as const
