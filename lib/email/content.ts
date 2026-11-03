import { load } from 'cheerio'
import { randomUUID } from 'node:crypto'

/** Derive the text alternative from the same authored copy and preserve every
 * action URL. No second copy deck can drift from the HTML message. */
export function emailContent(html: string): { html: string; text: string } {
  const $ = load(html)
  $('head, script, style, [data-email-preview]').remove()
  $('a[href]').each((_, element) => {
    const link = $(element), href = link.attr('href')!, label = link.text().trim()
    link.text(label === href ? label : `${label}: ${href}`)
    link.replaceWith(link.contents())
  })
  $('br').replaceWith('\n')
  const verbatim = new Map<string, string>()
  $('pre').each((_, element) => {
    const token = `FIXFLAGS-PROMPT-${randomUUID()}`
    verbatim.set(token, $(element).text())
    $(element).replaceWith(`${token}\n\n`)
  })
  $('li').prepend('- ')
  $('p, h1, h2, h3, li, tr').append('\n\n')
  let text = $('body').text().replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  for (const [token, prompt] of verbatim) text = text.replaceAll(token, () => prompt)
  return { html, text }
}
