/**
 * Public legal page copy. Customer-facing terms and privacy sections.
 */

export const LEGAL_PAGE_META = {
  termsUpdated: 'September 2026',
  privacyUpdated: 'September 2026',
} as const

export const ANALYTICS_CONSENT_COPY = {
  title: 'Choose your analytics settings',
  body:
    'FixFlags uses optional analytics to understand which product journeys work. We do not load advertising or analytics scripts until you allow them. Necessary cookies keep the product working.',
  allow: 'Allow analytics',
  necessaryOnly: 'Only necessary',
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
      'You can Analyze a public URL without an account. Signing in lets you save the Site, Verify fixes, and keep watching. Free includes one website with weekly Watch. Pro is listed at $49 per website per month with daily Watch, but new paid checkout is closed and joins a waitlist. Existing subscribers can manage their subscription in the Stripe portal.',
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
  automatedActions: {
    title: 'Automated checks and your responsibility',
    body:
      'FixFlags uses automated browsers and AI-assisted analysis. It may be incomplete or wrong, so review a Flag before acting. FixFlags does not routinely submit purchases, payments, lead forms, or account registrations. Verify is a fresh independent check, not a warranty or certification.',
  },
} as const

export const PRIVACY_SECTIONS = {
  collect: {
    title: 'What we collect',
    body:
      'When you Analyze a URL, we store that URL, the public pages our browser opened, screenshots and browser evidence from that session, and the Flags we raise. If you create an account, we store your email and the Sites you claim. Shopify is optional: if you connect it, we store the shop identity, authorization needed for background work, and purchase-path evidence. Privacy webhook receipts keep the request identity and processing result, not customer payloads we do not need. If you join a waitlist, we store the plan and email to notify.',
  },
  use: {
    title: 'How we use it',
    body:
      'We use this data to analyze the live website, raise Flags, Verify fixes, watch scheduled Sites, answer Site-scoped Agent questions, provide support, operate waitlists, measure reliability and cost, and improve the product. AI providers receive bounded context needed for the requested analysis or answer, not an unrestricted copy of your account. We do not sell your personal data.',
  },
  reportAccess: {
    title: 'Access and sharing',
    body:
      'Owned Sites, Flags, verification attempts, Agent threads, support context, and connections are private to the authenticated owner. Old public report URLs show a small sanitized evidence-compatibility page and never the private Site workspace. FixFlags does not currently offer public Flag sharing.',
  },
  thirdParties: {
    title: 'Third parties',
    body:
      'We use service providers for hosting, queues, email, evidence storage, payments, and bounded AI processing. Shopify provides shop identity and store access under your authorization. Optional analytics and advertising scripts load only after you allow analytics, and you can change that choice from Cookie settings in the footer. These providers process data on our behalf under their own terms.',
  },
  retentionAndDeletion: {
    title: 'Retention and deletion',
    body:
      'We retain Site history and evidence while it provides the service, subject to operational, security, billing, and legal retention needs. Deleting a Site stops its schedule and removes it from your account. Account deletion removes or schedules deletion of owned product data. Uninstalling Shopify revokes that connection; Shopify privacy requests are verified and processed separately.',
  },
  safeBrowsing: {
    title: 'What the browser does not do',
    body:
      'FixFlags normally observes public pages and safe customer journeys. It does not routinely complete payments, submit lead forms, create customer accounts, or send messages through the website being checked.',
  },
} as const
