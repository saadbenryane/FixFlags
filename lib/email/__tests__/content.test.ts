import { expect, it } from 'vitest'
import { emailContent } from '../content'
import { emailLayout } from '../layout'

it('derives readable plain text and action URLs from the same escaped HTML', () => {
  const message = emailContent(emailLayout('<h1>R&amp;D update</h1><p>Here’s what changed.</p><ul><li>First item</li><li>Second item</li></ul><p><a href="https://fixflags.com/sites/site?a=1&amp;b=2">Review website</a></p>', { preview: 'Hidden preview' }))
  expect(message.text).toContain('R&D update')
  expect(message.text).toContain('- First item')
  expect(message.text).toContain('Review website: https://fixflags.com/sites/site?a=1&b=2')
  expect(message.text).not.toMatch(/Hidden preview|<html|charset|margin:/)
})

it('preserves literal markup in finding text instead of parsing it a second time', () => {
  const message = emailContent('<p><a href="https://example.com/?a=1&amp;b=2">The &lt;button&gt; in R&amp;D did not respond.</a></p>')
  expect(message.text).toBe('The <button> in R&D did not respond.: https://example.com/?a=1&b=2')
})
