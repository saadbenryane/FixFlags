/** Compatibility entry point. Commands, queries and binding policy have separate owners. */
export { syncOutcomesFromAudit } from './application/outcome-sync'
export { confirmPageAvailability, confirmSiteOutcome, createSiteOutcome, renameSiteOutcome,
  setSiteOutcomeEnabled, OutcomeKindMismatchError, OutcomeFixtureRequiredError } from './application/outcome-commands'
export { listSiteOutcomes, loadSiteOutcomeDetail } from './application/outcome-queries'
export { bindingForConfirmedKind, outcomeKindWatchable } from './application/outcome-bindings'
export { CONFIRMABLE_OUTCOME_KINDS, nameForConfirmedOutcomeKind, type ConfirmableOutcomeKind } from './outcome-kinds'
export type { SiteOutcomeView } from './presentation/outcome-view'
export type { SiteOutcomeDetailView } from './presentation/outcome-detail-view'
