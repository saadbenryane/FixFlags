/**
 * Shared constants for page text truncation limits.
 *
 * Data flow:
 * 1. Raw page text parsed from HTML: MAX_RAW_TEXT (8000 chars)
 * 2. Stored in database after metadata extraction: MAX_STORED_TEXT (5000 chars)
 * 3. Triage prompt (Phase 1, anonymous): TRIAGE_TEXT (2500 chars)
 * 4. Prescription prompt (Phase 2, post-signup): PRESCRIPTION_TEXT (5000 chars)
 *
 * INVARIANT: TRIAGE_TEXT <= MAX_STORED_TEXT <= MAX_RAW_TEXT
 * INVARIANT: PRESCRIPTION_TEXT <= MAX_STORED_TEXT <= MAX_RAW_TEXT
 *
 * If you need to increase AI pageText, change BOTH:
 * - This file (storage limit)
 * - buildPrescriptionPrompt in lib/prompts/system-prompt.ts (prompt slice)
 */
export const MAX_RAW_TEXT = 8000
export const MAX_STORED_TEXT = 5000
export const TRIAGE_TEXT = 2500
export const PRESCRIPTION_TEXT = 5000

/**
 * Truncation limit used by check modules when analyzing page text.
 * Set to MAX_STORED_TEXT so check modules see exactly what was stored.
 * All check modules must import this constant: never hardcode a slice length.
 */
export const CHECK_TEXT_LIMIT = MAX_STORED_TEXT

/**
 * Validates the invariant relationships between text limits.
 * Called in tests to catch configuration drift.
 */
export function validateTextLimits(): void {
  if (TRIAGE_TEXT > MAX_STORED_TEXT) {
    throw new Error(
      `TRIAGE_TEXT (${TRIAGE_TEXT}) must not exceed MAX_STORED_TEXT (${MAX_STORED_TEXT})`
    )
  }
  if (PRESCRIPTION_TEXT > MAX_STORED_TEXT) {
    throw new Error(
      `PRESCRIPTION_TEXT (${PRESCRIPTION_TEXT}) must not exceed MAX_STORED_TEXT (${MAX_STORED_TEXT})`
    )
  }
  if (MAX_STORED_TEXT > MAX_RAW_TEXT) {
    throw new Error(
      `MAX_STORED_TEXT (${MAX_STORED_TEXT}) must not exceed MAX_RAW_TEXT (${MAX_RAW_TEXT})`
    )
  }
}