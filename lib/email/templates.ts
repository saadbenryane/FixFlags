import { BRAND, SITE_URL } from '@/lib/marketing/copy'
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
    subject: `Your first check is ready`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>You have 3 AI reports. Each one gives you Flags across Message, Experience, and Reach, plus a fix prompt ready to paste into Cursor, Claude, Lovable, or Bolt.</p>
  <p>Paste the URL you are about to share. That is what this is for.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Run your first check</a></p>
  <p style="font-size: 13px; color: hsl(212 10% 46%);">Common first checks: your Product Hunt page, your demo day landing page, a client site before handoff.</p>
`),
  },
  firstAuditNudge: {
    subject: `Your 3 AI reports are waiting`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>You signed up for ${BRAND.name} yesterday. Your 3 AI reports are still waiting.</p>
  <p>Paste any public URL. You will get Flags with evidence and a fix prompt for each one. The whole thing takes about 60 seconds.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Paste a URL</a></p>
`),
  },
  monitoring: {
    subject: `Did your agent actually fix it?`,
    html: (name: string) =>
      layout(`
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>You ran a ${BRAND.name} check a few days ago. AI editors are fast but they do not always fix what you think they fixed. Mobile layout, share previews, and performance are the usual misses.</p>
  <p>A re-check runs the same URL again and shows exactly what cleared and what is still open.</p>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Re-check your site</a></p>
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
  <p>${BRAND.name} checks all of this automatically and writes the fix prompt for anything that fails.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Check before you ship</a></p>
`),
  },
} as const

export const NEWSLETTER_EMAIL = {
  subject: 'You\u2019re on the FixFlags list',
  html: () =>
    layout(`
  <p>Thanks for subscribing.</p>
  <p>We send product updates and practical shipping tips. No spam.</p>
  <p><a href="${SITE_URL}/changelog" style="${ctaStyle}">See what shipped recently</a></p>
`),
} as const

export type NurtureEmailType = keyof typeof NURTURE_EMAILS
