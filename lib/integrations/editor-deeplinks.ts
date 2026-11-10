/**
 * Verified tool handoffs (cursor.com/docs/integrations/deeplinks, checked 2026-11-10).
 * The cursor:// scheme opens locally, so the instructions never pass through a web server,
 * and Cursor asks the person to confirm before anything runs. Links over 10,000 characters
 * after encoding are not supported, so longer instructions stay copy-only.
 */
export const CURSOR_DEEPLINK_MAX_LENGTH = 10_000

export function cursorPromptDeeplink(prompt: string): string | null {
  const text = prompt.trim()
  if (!text) return null
  const link = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(text)}`
  return link.length <= CURSOR_DEEPLINK_MAX_LENGTH ? link : null
}
