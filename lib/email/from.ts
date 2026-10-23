import { BRAND } from '@/lib/marketing/copy-barrel'

/** Canonical sender address for all outgoing emails. */
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`
