import { BRAND } from './brand'

export const NOTIFICATION_EMAIL_COPY = {
  attention: 'Needs attention',
  recovery: 'Recovery verified',
  checked: (at: string) => `Checked ${at}.`,
  evidence: 'See evidence and next steps',
  flags: 'Open this Site’s Flags',
  subject: (host: string, count: number) => count > 0
    ? `Needs attention on ${host}: ${count} Flag${count === 1 ? '' : 's'}` : `Recovery verified on ${host}`,
  lead: (host: string, count: number, recovered: number) => count > 0
    ? `${BRAND.name} found ${count} problem${count === 1 ? '' : 's'} that need${count === 1 ? 's' : ''} attention on ${host}.`
    : `An independent check verified ${recovered === 1 ? 'a recovery' : `${recovered} recoveries`} on ${host}.`,
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
