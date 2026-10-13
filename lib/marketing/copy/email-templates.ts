import { BRAND, SITE_URL } from './brand'
import { brandLight } from '@/lib/design/brand-spec'
import { emailLayout as layout, emailButtonStyle as ctaStyle, escapeEmailHtml } from '@/lib/email/layout'

const p = brandLight

export const NURTURE_EMAILS = {
  welcome: {
    subject: `Welcome to ${BRAND.name}`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>Keep one website in your free account. Its Site board holds your Flags, evidence, and fix prompts for Cursor, Claude, Lovable, or Bolt.</p>
  <p>Paste the URL you are about to share. That is what this is for.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Check your first website</a></p>
  <p style="font-size: 13px; color: ${p.mutedForeground};">Common first checks: your landing page, a client site before handoff, a store that should still take orders.</p>
`),
  },
  firstAuditNudge: {
    subject: `Your first Site check is waiting`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>You signed up for ${BRAND.name} yesterday. Add the website you want to monitor.</p>
  <p>Paste any public URL. You will get Flags with evidence and a fix for each one.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Paste a URL</a></p>
`),
  },
  monitoring: {
    subject: `Did your agent actually fix it?`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>You ran a ${BRAND.name} Site check a few days ago. AI editors are fast but they do not always fix what you think they fixed. Mobile layout, share previews, and performance are the usual misses.</p>
  <p>Verify runs the same page and action again and shows whether the Flag passed, failed, or stayed inconclusive.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Open your Sites</a></p>
`),
  },
  launchChecklist: {
    subject: `5 things to confirm before you share the link`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${escapeEmailHtml(name)}` : ''},</p>
  <p>Before your next launch post, run through this:</p>
  <ul>
    <li>Primary CTA visible above the fold at 375px</li>
    <li>Social preview shows a branded image (not blank)</li>
    <li>LCP under 2.5s on mobile</li>
    <li>Social proof visible before the scroll</li>
    <li>Page job clear in the hero headline</li>
  </ul>
  <p>${BRAND.name} checks your website and keeps evidence with each finding. Confirm important results before you share the link.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Review before you publish</a></p>
`),
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
  <p>Paid monitoring is billed per website, verified every day.</p>
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
