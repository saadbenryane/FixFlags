/** A named consent control is presence evidence, never enforcement or legal compliance. */
export const CONSENT_CONTROL_PATTERN = /\bcookies?\s+(settings|preferences|choices|consent)\b|\b(manage|accept|reject|allow|decline|customi[sz]e)\b[^.]{0,50}\b(cookies?|analytics|tracking)\b/i
export function isConsentControlName(name: string): boolean {
  return CONSENT_CONTROL_PATTERN.test(name.replace(/\s+/g, ' '))
}

export const CONSENT_CONTEXT_SELECTOR = 'dialog,[role="dialog"],[role="alertdialog"],section,aside,[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i]'
export const CONSENT_CHOICE_PATTERN = /^(accept|reject|allow|decline|agree|disagree|customi[sz]e)(\s+(all|optional|selected|preferences|settings))?$/i
export type ConsentControlObservation = { name: string; context: string }
export function isConsentControl(control: ConsentControlObservation): boolean {
  return isConsentControlName(control.name) || (
    CONSENT_CHOICE_PATTERN.test(control.name.trim()) &&
    /\b(cookies?|analytics|tracking)\b/i.test(control.context)
  )
}
