import { BRAND } from './brand'

export const NOTIFICATION_EMAIL_COPY = {
  preferences: 'Manage email preferences',
  attention: 'Needs attention',
  recovery: 'Fixes confirmed',
  checked: (at: string) => `Checked ${at}.`,
  evidence: 'See what to do next',
  flags: 'Review this website',
  subject: (host: string, count: number) => count > 0
    ? `${host}: ${count} problem${count === 1 ? '' : 's'} to review` : `${host}: Fix confirmed`,
  lead: (host: string, count: number, recovered: number) => count > 0
    ? `${BRAND.name} found ${count} problem${count === 1 ? '' : 's'} that need${count === 1 ? 's' : ''} attention on ${host}.`
    : `We checked again and confirmed ${recovered === 1 ? 'a fix' : `${recovered} fixes`} on ${host}.`,
  nextStep: 'Open a problem to see what happened and how to fix it.',
  more: (count: number) => `${count} more updates are available on your website’s page.`,
  verification: {
    subject: `Verify your ${BRAND.name} email`,
    body: `Verify your email to activate your ${BRAND.name} account.`,
    action: 'Verify email',
  },
  passwordReset: {
    subject: `Reset your ${BRAND.name} password`,
    body: 'Click the link below to reset your password. This link expires in one hour.',
    action: 'Reset password',
    unrequested: 'If you did not request this, you can ignore this email.',
  },
  deletion: {
    subject: `Confirm ${BRAND.name} account deletion`,
    body: `This permanently deletes your ${BRAND.name} account, reports, screenshots, and API keys.`,
    action: 'Confirm account deletion',
  },
} as const
