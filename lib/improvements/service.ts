/** Stable application interface. Each module owns one part of the lifecycle. */
export { improvementFingerprint, materializeAttentionForAudit } from './occurrences'
export { createImprovementAttempt, recordFlagImprovementAttempt, recordOwnerFlagFeedbackDecision, recordRecommendedImprovements } from './attempts'
export { reconcileImprovementVerification } from './verification'
