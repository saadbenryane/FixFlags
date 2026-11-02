import { BRAND } from './brand'

export const NOTIFICATION_EMAIL_COPY = {
  preferences: 'Manage email preferences',
  attention: 'Needs attention',
  recovery: 'What improved',
  before: 'Before',
  now: 'Now',
  missingProblem: 'A problem needs your attention.',
  previousProblem: 'A problem was found in an earlier check.',
  recoveredResult: 'We checked again and did not find this problem.',
  checked: (at: string) => `Checked ${at}.`,
  evidence: 'View details',
  flags: 'View website',
  greeting: (name: string | null) => `Hi${name ? ` ${name}` : ''},`,
  heading: (count: number, recovered: number) => count > 0
    ? `${count} problem${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`
    : recovered > 0 ? `${recovered} problem${recovered === 1 ? '' : 's'} resolved` : 'Your website update',
  subject: (host: string, count: number, recovered = 0) => count > 0
    ? `${host}: ${count} problem${count === 1 ? '' : 's'} to review`
    : recovered > 0 ? `${host}: ${recovered} problem${recovered === 1 ? '' : 's'} resolved` : `${host}: Website update`,
  more: (count: number) => `${count} more updates on your website’s page.`,
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
