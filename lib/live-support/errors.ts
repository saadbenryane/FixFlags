export class SupportError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'SupportError'
  }
}

export function isSupportError(err: unknown): err is SupportError {
  return err instanceof SupportError
}
