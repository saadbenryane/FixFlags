export class AdminActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'ADMIN_ACTION_REFUSED',
  ) {
    super(message)
    this.name = 'AdminActionError'
  }
}

export class AdminOutcomeUnknown extends AdminActionError {
  constructor(message: string) {
    super(message, 409, 'ADMIN_OUTCOME_UNKNOWN')
  }
}

export class AdminDeferredAction extends AdminActionError {
  constructor(
    message: string,
    readonly progress: Record<string, unknown>,
  ) {
    super(message, 202, 'ADMIN_WAITING_FOR_CLEANUP')
  }
}
