/** The customer-facing state of an Outcome. One vocabulary, so a card, a
 * contract, and a stored result cannot drift apart. */
export const CUSTOMER_OUTCOME_STATES = ['CLEAR', 'FLAG', 'COULD_NOT_VERIFY', 'STALE'] as const
export type CustomerOutcomeState = (typeof CUSTOMER_OUTCOME_STATES)[number]

/** The state a recorded assessment can carry. A run that did not finish records
 * FAILED, which is an internal record and never a customer-facing Outcome
 * state. */
export const ASSESSMENT_RESULT_STATES = ['CLEAR', 'FLAG', 'COULD_NOT_VERIFY', 'STALE', 'FAILED'] as const
export type AssessmentResultState = (typeof ASSESSMENT_RESULT_STATES)[number]
