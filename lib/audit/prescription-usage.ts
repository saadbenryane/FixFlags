import { beginProviderUsage, sumProviderResponses } from './provider-usage'
import type { ProviderRequestBound } from './provider-request-bound'

/** Historical prescription imports retain their exact phase and receipt format. */
export { providerUsageSchema as prescriptionUsageSchema } from './provider-usage'
export function beginPrescriptionUsage(auditId: string, model: string, bound: ProviderRequestBound) {
  return beginProviderUsage(auditId, 'prescription', model, bound)
}
export function sumPrescriptionResponses(events: readonly { event?: string; detail: unknown }[]) {
  return sumProviderResponses(events, 'prescription')
}
