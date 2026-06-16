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
    subject: 'Your audit found issues, here\u2019s how to fix them in one prompt',
    html: (name: string) =>
      layout(`
  <p>Hi ${name || 'there'},</p>
  <p>Welcome to ${BRAND.name}. You just joined builders who ship with AI and audit before they launch.</p>
  <p>Here\u2019s the fastest workflow:</p>
  <ol>
    <li>Run an audit on your site</li>
    <li>Open any finding and copy the fix prompt</li>
    <li>Paste it into Cursor, Claude Code, Lovable, or Bolt</li>
    <li>Re-check after fixes (Pro plan)</li>
  </ol>
  <p><a href="${SITE_URL}/dashboard" style="${ctaStyle}">Go to dashboard</a></p>
`),
  },
  recheck: {
    subject: 'Re-check: did your agent actually fix it?',
    html: (name: string) =>
      layout(`
  <p>Hi ${name || 'there'},</p>
  <p>You ran a ${BRAND.name} audit a few days ago. Did your agent apply the fixes?</p>
  <p>Most AI-built sites look fixed in the editor but still fail on mobile, SEO previews, or performance. A re-check proves what actually changed.</p>
  <p>Registered free users get one free re-check to compare before/after scores. Paid plans include unlimited re-checks that do not count against your monthly new-URL audit limit.</p>
  <p><a href="${SITE_URL}/pricing" style="${ctaStyle}">Upgrade to Pro</a></p>
`),
  },
  launchChecklist: {
    subject: 'Launch week checklist',
    html: (name: string) =>
      layout(`
  <p>Hi ${name || 'there'},</p>
  <p>Launching soon? Run through this 5-minute checklist before you ship:</p>
  <ul>
    <li>Mobile: is the primary CTA above the fold at 375px?</li>
    <li>SEO: does your link preview show an image and description?</li>
    <li>Performance: is LCP under 2.5s?</li>
    <li>Trust: do you have social proof above the fold?</li>
    <li>Conversion: is your page job obvious in the hero?</li>
  </ul>
  <p>${BRAND.name} checks all of this automatically and writes fix prompts for anything that fails.</p>
  <p><a href="${SITE_URL}" style="${ctaStyle}">Audit my site</a></p>
`),
  },
} as const

export type NurtureEmailType = keyof typeof NURTURE_EMAILS
