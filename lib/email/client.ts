import { Resend } from 'resend'

/**
 * Shared Resend client. Instantiate once here and import everywhere.
 * Avoids triple-instantiation in auth.ts, email/send.ts, live-support/notify.ts.
 */
export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null
