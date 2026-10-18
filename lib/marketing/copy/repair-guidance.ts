export const REPAIR_GUIDANCE_COPY = {
  inspection: (subject: string) => `Review ${subject}.`,
  confirmIntent: 'Confirm the intended behavior for this scope before making a change.',
  condition: (condition: string) => `Make a change only if ${condition}.`,
  confirmedChange: (change: string) => `If confirmed: ${change}.`,
  preserve: (subject: string) => `Keep ${subject} unchanged.`,
  noChange: 'If that condition is not established, keep the existing implementation.',
  noFindings: 'No change is prescribed from the recorded evidence.',
  observed: (evidence: string) => `Recorded evidence: ${evidence}`,
  supporting: (evidence: string) => `Supporting observation: ${evidence}`,
  verify: (rule: string) => `Independent verification: ${rule}`,
  verificationUnavailable: 'Independent verification conditions are not recorded.',
} as const
