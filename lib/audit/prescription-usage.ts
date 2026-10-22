import { beginProviderUsage, sumProviderResponses } from './provider-usage'

/** Historical prescription imports retain their exact phase and receipt format. */
export { providerUsageSchema as prescriptionUsageSchema } from './provider-usage'
export function beginPrescriptionUsage(auditId: string, model: string) {
  return beginProviderUsage(auditId, 'prescription', model)
}
export function sumPrescriptionResponses(events: readonly { event?: string; detail: unknown }[]) {
  return sumProviderResponses(events, 'prescription')
}
