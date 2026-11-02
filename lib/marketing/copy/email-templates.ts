import { BRAND, SITE_URL } from './brand'
import { NOTIFICATIONS_COPY } from './notifications'
import { brandLight } from '@/lib/design/brand-spec'
import { emailLayout as layout, emailButtonStyle as ctaStyle, escapeEmailHtml } from '@/lib/email/layout'

const p = brandLight

export const NURTURE_EMAILS = {
  welcome: {
    subject: `Welcome to ${BRAND.name}`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>Keep one website in your free account. See what needs attention, why it matters, and what to do next.</p>
  <p>Add your website to get started.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Check your first website</a></p>
  <p style="font-size: 13px; color: ${p.mutedForeground};">Common first checks: your landing page, a client site before handoff, a store that should still take orders.</p>
`),
  },
  firstAuditNudge: {
    subject: `Your first Site check is waiting`,
    html: (name: string, unsubscribeUrl?: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>You signed up for ${BRAND.name} yesterday. Add the website you want to monitor.</p>
  <p>Paste your website address. We’ll show you any problems we find, with details and steps to help you fix them.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Paste a URL</a></p>
`, { preferencesUrl: unsubscribeUrl, preferencesLabel: NOTIFICATIONS_COPY.unsubscribe.action }),
  },
  monitoring: {
    subject: `Check that your fixes worked`,
    html: (name: string, unsubscribeUrl?: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>Made changes since your last website check? Open a problem and choose Verify to check it again.</p>
  <p>We’ll show whether the fix worked, still needs attention, or needs another check.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Open your Sites</a></p>
`, { preferencesUrl: unsubscribeUrl, preferencesLabel: NOTIFICATIONS_COPY.unsubscribe.action }),
  },
  launchChecklist: {
    subject: `5 things to confirm before you share the link`,
    html: (name: string, unsubscribeUrl?: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>Before your next launch post, run through this:</p>
  <ul>
    <li>The main button is easy to find on a phone</li>
    <li>The shared-link title and image match the page you intend to share</li>
    <li>The main content loads quickly on a phone</li>
    <li>Any proof you show is accurate and supports its claim</li>
    <li>The opening copy explains what the page is for</li>
  </ul>
  <p>${BRAND.name} checks your website and keeps evidence with each finding. Confirm important results before you share the link.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Review before you publish</a></p>
`, { preferencesUrl: unsubscribeUrl, preferencesLabel: NOTIFICATIONS_COPY.unsubscribe.action }),
  },
} as const

export const BILLING_EMAILS = {
  paymentFailed: {
    subject: `Action needed: update your ${BRAND.name} payment method`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>We could not process your latest subscription payment. Paid features are paused until the payment succeeds.</p>
  <p>Update your card in Billing. Your saved Sites and evidence remain available.</p>
  <p><a href="${SITE_URL}/billing" style="${ctaStyle}">Update payment method</a></p>
  <p style="font-size: 13px; color: ${p.mutedForeground};">Need a walkthrough? <a href="${SITE_URL}/help/account-and-billing/manage-an-existing-subscription" style="color: ${p.link};">Billing help</a> or reply to this email.</p>
`),
  },
} as const

export const WAITLIST_EMAILS = {
  joined: (planLabel: string) => ({
    subject: `You're on the ${planLabel} waitlist`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>You're on the ${planLabel} waitlist. Your free account stays active while paid checkout is closed.</p>
  <p>Launch discounts are assigned by join order: the first 500 waitlisters per plan get <strong>25% off for 12 months</strong> from launch, and the next 500 get <strong>15% off</strong>. Your spot is locked in from the moment you joined.</p>
  <p>We'll email you when checkout opens.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Back to your dashboard</a></p>
`),
  }),
  invited: (planLabel: string) => ({
    subject: `${planLabel} checkout is open for you`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p><strong>${planLabel} checkout is open.</strong> You can upgrade now from pricing or your dashboard.</p>
  <p>Your launch discount is applied automatically at checkout: <strong>25% off for 12 months</strong> for the first 500 waitlisters, <strong>15% off</strong> for the next 500. Everyone else pays list price.</p>
  <p><a href="${SITE_URL}/pricing" style="${ctaStyle}">Open pricing</a></p>
`),
  }),
} as const

export const NEWSLETTER_EMAIL = {
  subject: 'You\u2019re on the FixFlags list',
  html: () =>
    layout(`
  <p>Thanks for subscribing.</p>
  <p>We send product updates and practical shipping tips. No spam.</p>
  <p><a href="${SITE_URL}/changelog" style="${ctaStyle}">See what's new recently</a></p>
`),
} as const

export const DEMO_EMAILS = {
  confirm: {
    subject: 'We received your FixFlags demo request',
    html: (name: string, planLabel: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>Thanks for requesting a ${planLabel} demo. We will email you to set a time. We are not charging yet.</p>
  <p>We’ll discuss the websites you want to monitor and the next steps.</p>
  <p><a href="${SITE_URL}/pricing" style="${ctaStyle}">Back to pricing</a></p>
`),
  },
  notify: {
    subject: (planLabel: string) => `[${BRAND.name}] Demo request: ${planLabel}`,
    html: (input: {
      name: string
      email: string
      website: string
      planLabel: string
      siteCount?: number | null
      note?: string | null
    }) =>
      layout(`
  <p>New demo request for <strong>${input.planLabel}</strong>.</p>
  <p>Name: ${escapeEmailHtml(input.name)}<br />Email: ${escapeEmailHtml(input.email)}<br />Website: ${escapeEmailHtml(input.website)}${
        input.siteCount != null ? `<br />Websites: ${input.siteCount}` : ''
      }</p>
  ${input.note ? `<p>Note: ${escapeEmailHtml(input.note)}</p>` : ''}
`),
  },
} as const

export const KEEP_REPORT_EMAIL = {
  subject: 'Your FixFlags Site',
  html: (reportUrl: string) =>
    layout(`
  <p>Here is the Site board you asked us to email.</p>
  <p><a href="${escapeEmailHtml(reportUrl)}" style="${ctaStyle}">Open your Site</a></p>
`),
} as const

export type NurtureEmailType = keyof typeof NURTURE_EMAILS
