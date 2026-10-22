import { PUBLIC_OFFER } from '@/lib/marketing/copy/public-offer'
import type { HelpArticle, HelpCategory } from './types'

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  { id: 'getting-started', title: 'Getting started', description: 'Check your website and save the results.', icon: 'rocket' },
  { id: 'sites-and-coverage', title: 'Sites and coverage', description: 'Understand what was checked, when, and where.', icon: 'flag' },
  { id: 'flags-fix-verify', title: 'Flags, Fix, Verify', description: 'Read a problem, make a change, and check the fix.', icon: 'flag' },
  { id: 'watch-and-notifications', title: 'Watch and notifications', description: 'Set a check schedule and choose your emails.', icon: 'rocket' },
  { id: 'shopify', title: 'Shopify', description: 'Connection status and removal.', icon: 'creditCard' },
  { id: 'account-and-billing', title: 'Account and billing', description: 'Sign in and manage your plan.', icon: 'creditCard' },
  { id: 'privacy-and-security', title: 'Privacy and security', description: 'Understand saved data and account deletion.', icon: 'user' },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'Get help when a check does not finish.', icon: 'terminal' },
] as const

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'analyze-a-website', categoryId: 'getting-started', title: 'Analyze a website',
    excerpt: "Enter your website address and see what needs attention.", popular: true,
    searchTokens: ['start', 'url', 'scan', 'audit', 'site'], updatedAt: '2026-10-16', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: "You can try your first check before creating an account. Use a live webpage that visitors can open without signing in." },
      { type: "p", text: "No installation needed for public-page analysis." },
      { type: "steps", items: ["Open Add website or use the address field on the homepage.", "Paste your website address and select Check your website.", "Open a Flag to read the observed problem, supporting evidence, and suggested next step. If FixFlags could not inspect an area, read the reason beside that result."] },
      { type: "callout", text: "A Flag is a problem that needs attention. Not checked yet means results are not available for that area." },
    ], related: ['save-your-site', 'read-site-coverage', 'verify-a-flag'], relatedDocs: ['getting-started'],
  },
  {
    slug: 'save-your-site', categoryId: 'getting-started', title: 'Save a Site to your account',
    excerpt: "Keep your website and results in your account.", popular: true,
    searchTokens: ['claim', 'sign up', 'sign in', 'anonymous'], updatedAt: '2026-10-19', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: "From your website’s results page, sign in or create an account to save it. FixFlags calls your saved website a Site." },
      { type: "p", text: "Your original results stay with the website you checked. Open it from Websites in your account. Saving a Site schedules monitoring. Its next check and cadence are shown in Settings." },
    ], related: ['analyze-a-website', 'sign-in-and-account-security'], relatedDocs: ['getting-started'],
  },
  {
    slug: 'read-site-coverage', categoryId: 'sites-and-coverage', title: 'Read Site coverage',
    excerpt: "See what FixFlags checked and how recent the results are.", popular: true,
    searchTokens: ['coverage', 'cards', 'freshness', 'unknown', 'partial'], updatedAt: '2026-10-13', estimatedReadMinutes: 3,
    body: [
      { type: "p", text: "Overview groups results into Pages, Conversion, Security, Search, Performance, and Tracking. Open an area to see the pages checked, the date, and anything FixFlags could not check." },
      { type: "ul", items: ["Healthy: the checks for that area passed and the results are recent.", "Partial: some checks finished, but others could not.", "Unknown or Not checked yet: there is not enough information yet.", "Stale: the last result is too old to describe the website now."] },
      { type: "callout", text: "No Flags does not mean every page or action has been checked." },
    ], related: ['coverage-limitations', 'read-a-flag'], relatedDocs: ['site-care'],
  },
  {
    slug: 'coverage-limitations', categoryId: 'sites-and-coverage', title: 'Coverage limitations',
    excerpt: "Understand why some pages or actions could not be checked.",
    searchTokens: ['password', 'bot', 'protected', 'unsupported', 'excluded'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: "The first website check visits pages available to the public. A password screen, sign-in requirement, cookie consent screen, or “prove you’re human” challenge can stop it from reaching a page." },
      { type: "p", text: "FixFlags shows these limits beside the results. Open the address in a signed-out browser to see whether visitors can reach it. Some customer actions are not supported yet." },
      { type: "callout", text: "A page FixFlags could not check does not count as passing. It cannot confirm that a fix worked." },
    ], related: ['read-site-coverage', 'check-failed-or-stuck'], relatedDocs: ['site-care', 'troubleshooting'],
  },
  {
    slug: 'read-a-flag', categoryId: 'flags-fix-verify', title: 'Read a Flag',
    excerpt: "Understand the problem and suggested fix.", popular: true,
    searchTokens: ['flag', 'evidence', 'severity', 'certainty', 'recommendation'], updatedAt: '2026-10-13', estimatedReadMinutes: 3,
    body: [
      { type: "p", text: "A Flag is a problem FixFlags found that needs attention. Open it to see the affected page, what happened, when it was checked, why it matters, and how to fix it." },
      { type: "p", text: "Read the screenshots and details before making a change. Any limits explain what FixFlags could not confirm." },
      { type: "p", text: "Recommendations are suggestions for improvements. They do not count as Flags or trigger Flag emails." },
    ], related: ['send-a-fix-to-your-ai', 'verify-a-flag'], relatedDocs: ['site-care'],
  },
  {
    slug: 'send-a-fix-to-your-ai', categoryId: 'flags-fix-verify', title: 'Send a Flag to your coding AI',
    excerpt: "Copy a suggested fix into the tool you use to build your website.",
    searchTokens: ['fix', 'prompt', 'coding ai', 'handoff'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: "steps", items: ["Open the Flag and copy its fix prompt.", "Paste the prompt into your AI tool or send it to your developer.", "Review the change and publish it to your live website.", "Return to the same Flag and select Check now."] },
      { type: "p", text: "The prompt describes the problem and what the fix should achieve. FixFlags does not edit your code or publish changes for you." },
    ], related: ['read-a-flag', 'verify-a-flag'], relatedDocs: ['site-care'],
  },
  {
    slug: 'verify-a-flag', categoryId: 'flags-fix-verify', title: 'Verify a Flag',
    excerpt: "Check whether a published fix worked.", popular: true,
    searchTokens: ['verify', 'recheck', 'fixed', 'regressed', 'inconclusive'], updatedAt: '2026-10-13', estimatedReadMinutes: 3,
    body: [
      { type: "p", text: "After publishing your change, open the same Flag and select Check now. FixFlags checks the affected page or action again and saves the result with the original problem." },
      { type: "ul", items: ["Verified: the new check confirms the fix worked.", "Still open: the problem remains.", "Regressed: the result got worse.", "Could not verify: FixFlags could not confirm the result, for example because the page was blocked."] },
      { type: "callout", text: "Copying a prompt or changing code does not close the Flag. A fresh check must confirm the fix." },
    ], related: ['read-a-flag', 'check-failed-or-stuck'], relatedDocs: ['site-care'],
  },
  {
    slug: 'weekly-watch', categoryId: 'watch-and-notifications', title: 'Monitoring during open beta',
    excerpt: "See your check schedule or change its interval.", popular: true,
    searchTokens: ['watch', 'weekly', 'schedule', 'monitoring', 'free'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: PUBLIC_OFFER.free },
      { type: "steps", items: ["Save the website to your account. FixFlags sets a default monitoring schedule for new websites.", "Open Settings to see the interval and next check time.", "To change the interval, choose a schedule and save it."] },
      { type: "p", text: "You can pause or restart monitoring in Settings. A website you previously paused stays paused. Check again starts a check now without changing your schedule." },
      { type: "p", text: "Monitoring checks the supported areas for your website. Read any limits beside the results. Routine successful checks stay quiet; Settings shows delayed or failed scheduled checks." },
    ], related: ['notification-preferences', 'free-and-pro'], relatedDocs: ['site-care'],
  },
  {
    slug: 'notification-preferences', categoryId: 'watch-and-notifications', title: 'Choose notification preferences',
    excerpt: "Choose which Flag emails you receive.",
    searchTokens: ['email', 'alert', 'critical', 'recovery', 'off'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: "Open your website’s Settings to choose emails for all new and regressed Flags, critical Flags only, or no Flag emails." },
      { type: "p", text: "You can separately choose emails when a previously flagged problem is confirmed fixed. Each notification opens the relevant Flag in your account. The same result does not trigger repeated emails." },
    ], related: ['weekly-watch', 'contact-support'], relatedDocs: ['site-care'],
  },
  {
    slug: 'connect-shopify', categoryId: 'shopify', title: 'Shopify integration, coming soon',
    excerpt: 'Planned store context. Existing connection cleanup remains available.', popular: true,
    searchTokens: ['shopify', 'install', 'connect', 'store'], updatedAt: '2026-10-14', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Shopify is coming soon until its connection and execution are tested and validated. GitHub account authorization is available. Website analysis and monitoring work independently.' },
      { type: 'p', text: 'New setup, refresh, and reconnection are unavailable. A previously saved connection can still be disconnected from the Site’s Integrations. Uninstall any existing FixFlags Shopify app separately to revoke its external access.' },
      { type: 'link', text: 'Read the Shopify integration status', href: '/docs/integrations/shopify' },
    ], related: ['shopify-access-and-removal', 'read-site-coverage'], relatedDocs: ['shopify'],
  },
  {
    slug: 'connect-google-data', categoryId: 'getting-started', title: 'Google integrations, coming soon',
    excerpt: 'Planned traffic and Search Console context. Independent website checks work now.',
    searchTokens: ['analytics', 'google', 'search console', 'queries', 'sessions', 'connection'], updatedAt: '2026-10-14', estimatedReadMinutes: 2,
    body: [
      { type: 'p', text: 'Google Analytics and Search Console integrations are coming soon. New setup and refresh remain unavailable until tested and validated.' },
      { type: 'p', text: 'Previously recorded context retains its source and date. Existing saved connections can still be disconnected from the Site’s Integrations.' },
      { type: 'callout', text: 'Public Search inspection and website checks work independently. Provider traffic and search reports cannot prove that a visitor action or fix works.' },
      { type: 'link', text: 'Read the integration status', href: '/docs/integrations' },
    ], related: ['read-site-coverage', 'connect-shopify'], relatedDocs: ['google-analytics', 'google-search-console'],
  },
  {
    slug: 'shopify-access-and-removal', categoryId: 'shopify', title: 'Shopify access and removal',
    excerpt: "Disconnect your store or uninstall the Shopify app.",
    searchTokens: ['shopify', 'uninstall', 'privacy', 'redaction', 'revoke'], updatedAt: '2026-10-13', estimatedReadMinutes: 3,
    body: [
      { type: "p", text: "FixFlags reads product information to select shopping paths. It does not request order or customer access, edit products, or place orders." },
      { type: "steps", items: ["To unlink the store from your saved website, select Disconnect in FixFlags Integrations.", "To remove Shopify access and stop the app’s separate shopping-path checks, also uninstall FixFlags in Shopify admin."] },
      { type: "p", text: "Uninstalling does not delete your FixFlags account. Private store data requires a verified Shopify session. Shopify privacy requests are checked before they are processed." },
    ], related: ['connect-shopify', 'privacy-and-evidence', 'contact-support'], relatedDocs: ['shopify'],
  },
  {
    slug: 'free-and-pro', categoryId: 'account-and-billing', title: 'Free, Pro, and Studio',
    excerpt: PUBLIC_OFFER.availability, popular: true,
    searchTokens: ['price', 'pricing', 'free', 'pro', '49', 'waitlist'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: 'ul', items: [PUBLIC_OFFER.free, PUBLIC_OFFER.pro, PUBLIC_OFFER.studio, PUBLIC_OFFER.availability, PUBLIC_OFFER.usage] },
      { type: 'p', text: 'Existing subscribers can manage their subscription in Billing. Pricing lists the current allowance for each plan; new paid access remains waitlisted.' },
    ], related: ['manage-an-existing-subscription', 'weekly-watch'], relatedDocs: ['getting-started'],
  },
  {
    slug: 'manage-an-existing-subscription', categoryId: 'account-and-billing', title: 'Manage an existing subscription',
    excerpt: "Find invoices, update payment details, or cancel.",
    searchTokens: ['billing', 'invoice', 'payment', 'cancel', 'portal'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: "If you have an existing subscription, open Billing and use the customer portal to manage invoices, payment details, or cancellation. Your subscription keeps its existing billing terms." },
      { type: "p", text: "A failed payment can affect paid access but does not delete your website or saved results. Contact support if you cannot open or use the portal." },
    ], related: ['free-and-pro', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'sign-in-and-account-security', categoryId: 'account-and-billing', title: 'Sign-in and account security',
    excerpt: "Sign in and return to your saved websites.",
    searchTokens: ['sign in', 'passkey', 'security', 'session'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: "Sign in to the account you used to save the website. That account controls access to its private results, Flags, connections, and support conversations." },
      { type: "p", text: "If sign-in fails while saving a website, try again in the same browser so FixFlags can continue saving it. Support will never ask for your password or passkey." },
    ], related: ['save-your-site', 'delete-your-account', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'privacy-and-evidence', categoryId: 'privacy-and-security', title: 'Privacy and evidence',
    excerpt: "Understand access to saved pages, screenshots, and results.", popular: true,
    searchTokens: ['privacy', 'screenshot', 'evidence', 'ai', 'retention'], updatedAt: '2026-10-13', estimatedReadMinutes: 3,
    body: [
      { type: "p", text: "FixFlags visits public webpages and may save screenshots, browser observations, and short summaries to help explain a Flag and check a fix." },
      { type: "p", text: "Private results for your saved website require account access. Knowing a website address or private record link does not grant access." },
      { type: "link", text: "Read the Privacy Policy", href: "/privacy" },
    ], related: ['shopify-access-and-removal', 'delete-your-account'], relatedDocs: ['site-care'],
  },
  {
    slug: 'delete-your-account', categoryId: 'privacy-and-security', title: 'Delete your account',
    excerpt: "Request deletion of your account and saved websites.",
    searchTokens: ['delete', 'account', 'data', 'retention'], updatedAt: '2026-10-13', estimatedReadMinutes: 2,
    body: [
      { type: "p", text: "Use account settings to request deletion. FixFlags stops monitoring, removes your connections, and deletes or schedules deletion of your account data. Some records may need to be kept for legal or operational reasons." },
      { type: "p", text: "If FixFlags is still installed in Shopify, uninstall it separately in Shopify admin." },
    ], related: ['privacy-and-evidence', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'check-failed-or-stuck', categoryId: 'troubleshooting', title: 'A check failed or is stuck',
    excerpt: "Find the reason a check did not finish and try again.", popular: true,
    searchTokens: ['failed', 'stuck', 'timeout', 'retry', 'blocked', 'unreachable'], updatedAt: '2026-10-13', estimatedReadMinutes: 3,
    body: [
      { type: "p", text: "Open the website in FixFlags and read the message beside the results. A page may be unreachable, ask for a password or human check, or take too long to load. The checking service may also be temporarily unavailable." },
      { type: "steps", items: ["Open the website in a signed-out browser and confirm the address works.", "Read any access restriction or failure message in FixFlags.", "Use the retry action shown on the website or Flag page. A pending verification does not start twice.", "Contact support if it fails again. Include the website and the message you saw."] },
    ], related: ['coverage-limitations', 'contact-support'], relatedDocs: ['troubleshooting'],
  },
  {
    slug: 'contact-support', categoryId: 'troubleshooting', title: 'Contact support',
    excerpt: "Ask the FixFlags team for help.",
    searchTokens: ['support', 'help', 'email', 'agent', 'human'], updatedAt: '2026-10-13', estimatedReadMinutes: 1,
    body: [
      { type: "p", text: "Open the FixFlags Agent on your saved website and choose Talk to support. Your request can include the website, Flag, and a short summary of the conversation." },
      { type: "p", text: "You can also email hello@fixflags.com. Include what you were trying to do and the message you saw. Do not send passwords, private keys, payment details, or customer data." },
    ], related: ['check-failed-or-stuck', 'sign-in-and-account-security'], relatedDocs: ['troubleshooting'],
  },
] as const
