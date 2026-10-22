import { Resend } from 'resend'
import { waitForEmailProviderCapacity } from './provider-admission'

/**
 * Shared Resend client. Instantiate once here and import everywhere.
 * All SDK channels share the same team-wide web and worker capacity boundary.
 */
class SharedResend extends Resend {
  override async fetchRequest<T>(path: string, options: Parameters<Resend['fetchRequest']>[1] = {}) {
    await waitForEmailProviderCapacity((options as RequestInit).signal)
    return super.fetchRequest<T>(path, options)
  }
}

export const resend = process.env.RESEND_API_KEY
  ? new SharedResend(process.env.RESEND_API_KEY)
  : null
