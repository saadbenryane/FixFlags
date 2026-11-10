import { describe, expect, it } from 'vitest'
import { CURSOR_DEEPLINK_MAX_LENGTH, cursorPromptDeeplink } from '../editor-deeplinks'

describe('Cursor prompt deeplink', () => {
  it('uses the local cursor:// scheme with encoded text', () => {
    expect(cursorPromptDeeplink(' Fix /pricing & check it ')).toBe('cursor://anysphere.cursor-deeplink/prompt?text=Fix%20%2Fpricing%20%26%20check%20it')
  })
  it('refuses empty and over-length instructions', () => {
    expect(cursorPromptDeeplink('  ')).toBeNull()
    expect(cursorPromptDeeplink('x'.repeat(CURSOR_DEEPLINK_MAX_LENGTH))).toBeNull()
    expect(cursorPromptDeeplink('x'.repeat(9_000))).not.toBeNull()
  })
})
