const STORAGE_KEY = 'ff_first_report_consumed'

export function isFirstReport(): boolean {
  if (typeof window === 'undefined') return false
  return !sessionStorage.getItem(STORAGE_KEY)
}

export function consumeFirstReport(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, '1')
}
