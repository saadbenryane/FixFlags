import type { HelpArticle, HelpCategory } from './types'

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  { id: 'getting-started', title: 'Getting started', description: 'Analyze a website and save its Site.', icon: 'rocket' },
  { id: 'sites-and-coverage', title: 'Sites and coverage', description: 'Understand what was checked, when, and where.', icon: 'flag' },
  { id: 'flags-fix-verify', title: 'Flags, Fix, Verify', description: 'Read evidence, make the change, and prove it worked.', icon: 'flag' },
  { id: 'watch-and-notifications', title: 'Watch and notifications', description: 'Weekly care, alerts, recovery, and preferences.', icon: 'rocket' },
  { id: 'shopify', title: 'Shopify', description: 'Connect one store safely to its FixFlags Site.', icon: 'creditCard' },
  { id: 'account-and-billing', title: 'Account and billing', description: 'Sign-in, the Free plan, and paid access.', icon: 'creditCard' },
  { id: 'privacy-and-security', title: 'Privacy and security', description: 'Evidence handling, access, retention, and deletion.', icon: 'user' },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'Recover from blocked, delayed, or failed checks.', icon: 'terminal' },
] as const

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'analyze-a-website', categoryId: 'getting-started', title: 'Analyze a website',
    excerpt: 'Enter a public URL and open its Site board.', popular: true,
    searchTokens: ['start', 'url', 'scan', 'audit', 'site'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Enter a public website URL on the homepage or Add website. FixFlags creates one Site and begins checking the pages and customer journeys it can reach.' },
      { type: 'steps', items: ['Enter the public URL.', 'Wait while the Site cards move from learning to evidenced states.', 'Open a meaningful Flag, make the change, then Verify it.'] },
      { type: 'callout', text: 'Unknown means FixFlags does not have enough evidence yet. It does not mean healthy.' },
    ], related: ['save-your-site', 'read-site-coverage', 'verify-a-flag'], relatedDocs: ['getting-started'],
  },
  {
    slug: 'save-your-site', categoryId: 'getting-started', title: 'Save a Site to your account',
    excerpt: 'Sign in without losing the Site you just analyzed.', popular: true,
    searchTokens: ['claim', 'sign up', 'sign in', 'anonymous'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'After an anonymous analysis, create an account or sign in. FixFlags claims the exact provisional Site, including its pages, journeys, evidence, and Flags.' },
      { type: 'p', text: 'Claiming is idempotent. Refreshing or returning through sign-in does not create another Site or consume another analysis.' },
    ], related: ['analyze-a-website', 'sign-in-and-account-security'], relatedDocs: ['getting-started'],
  },
  {
    slug: 'read-site-coverage', categoryId: 'sites-and-coverage', title: 'Read Site coverage',
    excerpt: 'Coverage says what ran, what succeeded, and how fresh the evidence is.', popular: true,
    searchTokens: ['coverage', 'cards', 'freshness', 'unknown', 'partial'], updatedAt: '2026-09-20', estimatedReadMinutes: 3,
    body: [
      { type: 'p', text: 'The Site board groups responsibility into Pages, Conversion, Security, Search, Performance, and Tracking. Shopify adds Commerce context to the same Site.' },
      { type: 'ul', items: ['Healthy means the required scope was checked successfully and is still fresh.', 'Partial means some expected evidence is missing or unsupported.', 'Unknown means the area has not been evidenced.', 'Stale means the last successful evidence is too old to represent current behavior.'] },
    ], related: ['coverage-limitations', 'read-a-flag'], relatedDocs: ['site-care'],
  },
  {
    slug: 'coverage-limitations', categoryId: 'sites-and-coverage', title: 'Coverage limitations',
    excerpt: 'Protected pages and blocked behavior remain explicit.',
    searchTokens: ['password', 'bot', 'protected', 'unsupported', 'excluded'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'FixFlags checks public behavior. Password gates, bot challenges, authentication, consent barriers, and unsupported flows can limit what it proves.' },
      { type: 'p', text: 'A limitation stays visible in coverage. FixFlags does not turn missing evidence into a healthy result.' },
    ], related: ['read-site-coverage', 'check-failed-or-stuck'], relatedDocs: ['site-care', 'troubleshooting'],
  },
  {
    slug: 'read-a-flag', categoryId: 'flags-fix-verify', title: 'Read a Flag',
    excerpt: 'See the evidence, customer impact, certainty, and success condition.', popular: true,
    searchTokens: ['flag', 'evidence', 'severity', 'certainty', 'recommendation'], updatedAt: '2026-09-20', estimatedReadMinutes: 3,
    body: [
      { type: 'p', text: 'A Flag is a meaningful problem supported by evidence. Its page or Journey, observation time, limitation, proposed change, and success condition should be clear before you act.' },
      { type: 'p', text: 'Recommendations can help inside a card, but they do not badge the Site, trigger alerts, or count as customer Flags.' },
    ], related: ['send-a-fix-to-your-ai', 'verify-a-flag'], relatedDocs: ['site-care'],
  },
  {
    slug: 'send-a-fix-to-your-ai', categoryId: 'flags-fix-verify', title: 'Send a Flag to your coding AI',
    excerpt: 'Copy a bounded handoff without granting FixFlags repository access.',
    searchTokens: ['fix', 'prompt', 'coding ai', 'handoff'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Fix this prepares a focused handoff containing the observed problem, evidence, scope, and success condition. You choose where to paste it and what code to change.' },
      { type: 'p', text: 'FixFlags does not write to your repository or deploy changes. Publish your change, then return to the Flag and Verify it.' },
    ], related: ['read-a-flag', 'verify-a-flag'], relatedDocs: ['site-care'],
  },
  {
    slug: 'verify-a-flag', categoryId: 'flags-fix-verify', title: 'Verify a Flag',
    excerpt: 'Run a fresh, comparable check against the Flag success condition.', popular: true,
    searchTokens: ['verify', 'recheck', 'fixed', 'regressed', 'inconclusive'], updatedAt: '2026-09-20', estimatedReadMinutes: 3,
    body: [
      { type: 'p', text: 'Verify re-runs the page or Journey relevant to that Flag. It records one durable attempt and compares fresh evidence with the source occurrence.' },
      { type: 'ul', items: ['Verified: comparable evidence proves the success condition.', 'Still open: the problem remains.', 'Regressed: the behavior became worse.', 'Could not verify: the evidence was blocked, missing, skipped, removed, or incomparable.'] },
      { type: 'callout', text: 'Missing evidence never resolves a Flag.' },
    ], related: ['read-a-flag', 'check-failed-or-stuck'], relatedDocs: ['site-care'],
  },
  {
    slug: 'weekly-watch', categoryId: 'watch-and-notifications', title: 'Weekly Watch on Free',
    excerpt: 'Free looks after one website with one full weekly Watch.', popular: true,
    searchTokens: ['watch', 'weekly', 'schedule', 'monitoring', 'free'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Free includes one Site and one full weekly Watch. Watch is active only after FixFlags has saved a durable schedule.' },
      { type: 'p', text: 'Healthy runs stay quiet. Delays or failures remain visible on Site settings with a retry path.' },
    ], related: ['notification-preferences', 'free-and-pro'], relatedDocs: ['site-care'],
  },
  {
    slug: 'notification-preferences', categoryId: 'watch-and-notifications', title: 'Choose notification preferences',
    excerpt: 'Receive all Flags, critical Flags only, or no Flag email.',
    searchTokens: ['email', 'alert', 'critical', 'recovery', 'off'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Each Site can email you for all new customer Flags, critical Flags only, or none. Verified recovery is an independent preference.' },
      { type: 'p', text: 'Notifications link to the exact owned Flag. Repeated delivery of the same observation is deduplicated.' },
    ], related: ['weekly-watch', 'contact-support'], relatedDocs: ['site-care'],
  },
  {
    slug: 'connect-shopify', categoryId: 'shopify', title: 'Connect Shopify to a Site',
    excerpt: 'Authorize the store, then link it to an owned Site.', popular: true,
    searchTokens: ['shopify', 'install', 'connect', 'store'], updatedAt: '2026-09-20', estimatedReadMinutes: 3,
    body: [
      { type: 'p', text: 'Shopify is a connection to the same Site, not a separate FixFlags product. Start from Site settings so the signed, single-use account link binds the installed shop to the Site you own.' },
      { type: 'p', text: 'The embedded app verifies a Shopify ID token before it loads private shop data. A shop already linked to another account cannot be claimed.' },
    ], related: ['shopify-access-and-removal', 'read-site-coverage'], relatedDocs: ['getting-started'],
  },
  {
    slug: 'shopify-access-and-removal', categoryId: 'shopify', title: 'Shopify access and removal',
    excerpt: 'Understand permissions, uninstall, redaction, and relinking.',
    searchTokens: ['shopify', 'uninstall', 'privacy', 'redaction', 'revoke'], updatedAt: '2026-09-20', estimatedReadMinutes: 3,
    body: [
      { type: 'p', text: 'FixFlags uses the minimum store data needed to walk and explain the purchase path. Background work uses the authorized offline token; embedded requests require a verified session.' },
      { type: 'p', text: 'Uninstall revokes the connection. Privacy webhooks are signature-verified and store the request identity and processing result, not customer payloads FixFlags does not need.' },
    ], related: ['connect-shopify', 'privacy-and-evidence', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'free-and-pro', categoryId: 'account-and-billing', title: 'Free and Pro',
    excerpt: 'Free is available now. Pro is $49 per website per month and joins the waitlist.', popular: true,
    searchTokens: ['price', 'pricing', 'free', 'pro', '49', 'waitlist'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'ul', items: ['Free: one website with weekly Watch.', 'Pro: $49 per website per month with daily Watch. New paid checkout is not open yet.', 'Studio: quoted per website for teams that need a tailored rollout.'] },
      { type: 'p', text: 'Existing legitimate subscribers can still manage their subscription. New Pro and Studio customers join the waitlist while operating cost is measured.' },
    ], related: ['manage-an-existing-subscription', 'weekly-watch'], relatedDocs: ['getting-started'],
  },
  {
    slug: 'manage-an-existing-subscription', categoryId: 'account-and-billing', title: 'Manage an existing subscription',
    excerpt: 'Open the billing portal for invoices, payment methods, or cancellation.',
    searchTokens: ['billing', 'invoice', 'payment', 'cancel', 'portal'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Existing subscribers can use Billing to open the secure customer portal. The subscription remains licensed per website.' },
      { type: 'p', text: 'A failed payment changes paid access but never deletes your Site or evidence. Contact support if the portal cannot recover the subscription.' },
    ], related: ['free-and-pro', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'sign-in-and-account-security', categoryId: 'account-and-billing', title: 'Sign-in and account security',
    excerpt: 'Sessions, passkeys, and account ownership.',
    searchTokens: ['sign in', 'passkey', 'security', 'session'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'FixFlags uses your authenticated account as the ownership boundary for Sites, Flags, verification attempts, Agent threads, support context, and connections.' },
      { type: 'p', text: 'If sign-in fails, retry from the same browser so the pending Site claim can resume. Support will never ask for your password or passkey.' },
    ], related: ['save-your-site', 'delete-your-account', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'privacy-and-evidence', categoryId: 'privacy-and-security', title: 'Privacy and evidence',
    excerpt: 'How FixFlags handles public pages, screenshots, AI processing, and access.', popular: true,
    searchTokens: ['privacy', 'screenshot', 'evidence', 'ai', 'retention'], updatedAt: '2026-09-20', estimatedReadMinutes: 3,
    body: [
      { type: 'p', text: 'FixFlags visits public URLs and may retain screenshots, browser observations, and minimized summaries so you can understand and verify a Flag.' },
      { type: 'p', text: 'Owned Site data is tenant-scoped. Internal IDs, signed grants, and verified connection principals authorize access; hostnames and opaque record IDs do not.' },
      { type: 'link', text: 'Read the Privacy Policy', href: '/privacy' },
    ], related: ['shopify-access-and-removal', 'delete-your-account'], relatedDocs: ['site-care'],
  },
  {
    slug: 'delete-your-account', categoryId: 'privacy-and-security', title: 'Delete your account',
    excerpt: 'Remove your account, Sites, schedules, and owned product data.',
    searchTokens: ['delete', 'account', 'data', 'retention'], updatedAt: '2026-09-20', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Use account settings to request deletion. FixFlags stops Watch, removes owned connections, and deletes or schedules deletion of account data subject to legal and operational retention requirements.' },
      { type: 'p', text: 'Uninstall Shopify separately if it is still installed in Shopify admin.' },
    ], related: ['privacy-and-evidence', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'check-failed-or-stuck', categoryId: 'troubleshooting', title: 'A check failed or is stuck',
    excerpt: 'Retry safely after access, capture, queue, or analysis failures.', popular: true,
    searchTokens: ['failed', 'stuck', 'timeout', 'retry', 'blocked', 'unreachable'], updatedAt: '2026-09-20', estimatedReadMinutes: 3,
    body: [
      { type: 'p', text: 'FixFlags shows a customer-safe reason and retry action when a check cannot finish. Common causes include an unreachable page, password or bot challenge, timeout, or unavailable worker.' },
      { type: 'ol', items: ['Confirm the URL is public and opens in a signed-out browser.', 'Remove temporary password or bot restrictions if appropriate.', 'Retry from the Site. A pending Verify is deduplicated, so retrying does not create duplicate attempts.', 'Contact support with the Site and Flag if the failure repeats.'] },
    ], related: ['coverage-limitations', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'contact-support', categoryId: 'troubleshooting', title: 'Contact support',
    excerpt: 'Escalate from a Site or contact the FixFlags team directly.',
    searchTokens: ['support', 'help', 'email', 'agent', 'human'], updatedAt: '2026-09-20', estimatedReadMinutes: 1,
    body: [
      { type: 'p', text: 'From an owned Site, open the FixFlags Agent and choose Talk to support. The escalation can include the Site, optional Flag, current route, and a minimized conversation summary.' },
      { type: 'p', text: 'You can also email hello@fixflags.com. Do not send passwords, private keys, payment details, or customer data.' },
    ], related: ['check-failed-or-stuck', 'sign-in-and-account-security'], relatedDocs: ['troubleshooting'],
  },
] as const
