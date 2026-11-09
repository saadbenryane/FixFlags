/** A Site run the customer cannot start. The message is safe to show. */
export class SiteRunRefusal extends Error {
  readonly status: number
  readonly code: string
  readonly action: 'prepare_new_prompt' | 'read_document_from_start' | undefined

  constructor(message: string, status: number, code = 'SITE_RUN_REFUSED') {
    super(message)
    this.name = 'SiteRunRefusal'
    this.status = status
    this.code = code
    this.action = code === 'REPAIR_CONTEXT_CHANGED' ? 'prepare_new_prompt'
      : code === 'REPAIR_DOCUMENT_CHANGED' ? 'read_document_from_start' : undefined
  }
}

export const RUN_AUDIT_SCOPE_CHANGED = {
  code: 'RUN_AUDIT_SCOPE_CHANGED',
  message: 'The previous run has no admitted execution.',
} as const
