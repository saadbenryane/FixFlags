import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { PRICING_COPY } from '@/lib/marketing/copy/terminology'
import { brandLight } from '@/lib/design/brand-spec'

const p = brandLight

const ctaStyle = `display: inline-block; background: ${p.foreground}; color: ${p.background}; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 500;`

function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: ${p.foreground}; max-width: 560px; margin: 0 auto; padding: 24px; background: ${p.background};">
  <p style="font-weight: 700; font-size: 18px; font-family: Georgia, serif;">${BRAND.name}</p>
  ${content}
  <hr style="border: none; border-top: 1px solid ${p.border}; margin: 32px 0;" />
  <p style="font-size: 12px; color: ${p.mutedForeground};">
    ${BRAND.name} - ${BRAND.category}<br />
    <a href="${SITE_URL}" style="color: ${p.link};">${SITE_URL}</a>
  </p>
</body>
</html>`
}

export const NURTURE_EMAILS = {
  welcome: {
    subject: `Your first product review is ready`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>You have ${PRICING_COPY.freeProductReviewsLifetime} product reviews (lifetime). Each one gives you Flags across Message, Experience, and Reach, plus a fix prompt you can paste into Cursor, Claude, Lovable, or Bolt.</p>
  <p>Paste the URL you are about to share. That is what this is for.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Run your first product review</a></p>
  <p style="font-size: 13px; color: hsl(212 10% 46%);">Common first reviews: your Product Hunt page, your demo day landing page, a client site before handoff.</p>
`),
  },
  firstAuditNudge: {
    subject: `Your ${PRICING_COPY.freeProductReviewsLifetime} product reviews are waiting`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>You signed up for ${BRAND.name} yesterday. Your ${PRICING_COPY.freeProductReviewsLifetime} product reviews are still waiting.</p>
  <p>Paste any public URL. You will get Flags with evidence and a fix prompt for each one. The whole thing takes about 60 seconds.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Paste a URL</a></p>
`),
  },
  monitoring: {
    subject: `Did your agent actually fix it?`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>You ran a ${BRAND.name} product review a few days ago. AI editors are fast but they do not always fix what you think they fixed. Mobile layout, share previews, and performance are the usual misses.</p>
  <p>An update review runs the same URL again and shows exactly what cleared and what is still open.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Run an update review</a></p>
`),
  },
  launchChecklist: {
    subject: `5 things to confirm before you share the link`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>Before your next launch post, run through this:</p>
  <ul>
    <li>Primary CTA visible above the fold at 375px</li>
    <li>Social preview shows a branded image (not blank)</li>
    <li>LCP under 2.5s on mobile</li>
    <li>Social proof visible before the scroll</li>
    <li>Page job clear in the hero headline</li>
  </ul>
  <p>${BRAND.name} reviews all of this automatically and writes the fix prompt for anything that fails.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Review before you publish</a></p>
`),
  },
} as const

export const BILLING_EMAILS = {
  paymentFailed: {
    subject: `Action needed: update your ${BRAND.name} payment method`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>We could not process your latest subscription payment. Paid features are paused until the payment succeeds.</p>
  <p>Update your card in Billing. Product reviews resume when payment succeeds.</p>
  <p><a href="${SITE_URL}/billing" style="${ctaStyle}">Update payment method</a></p>
  <p style="font-size: 13px; color: hsl(212 10% 46%);">Need a walkthrough? <a href="${SITE_URL}/help/billing-and-plans/payment-past-due" style="color: ${p.link};">Payment past due help</a> or reply to this email.</p>
`),
  },
} as const

export const WAITLIST_EMAILS = {
  joined: (planLabel: string) => ({
    subject: `You're on the ${planLabel} waitlist`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
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
  <p>Hi${name ? ` ${name}` : ''},</p>
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

export type NurtureEmailType = keyof typeof NURTURE_EMAILS
