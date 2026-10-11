import { CHECK_DEFINITIONS } from './check-registry'

export type CheckId = keyof typeof CHECK_DEFINITIONS
export const ALL_CHECK_IDS = Object.keys(CHECK_DEFINITIONS) as CheckId[]
export const CHECK_ID_COUNT = ALL_CHECK_IDS.length
