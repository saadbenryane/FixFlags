import { load } from 'cheerio'

/** Derive the text alternative from the same authored copy and preserve every
 * action URL. No second copy deck can drift from the HTML message. */
export function emailContent(html: string): { html: string; text: string } {
  const $ = load(html)
  $('head, script, style, [data-email-preview]').remove()
  $('a[href]').each((_, element) => {
    const link = $(element), href = link.attr('href')!, label = link.text().trim()
    link.replaceWith(label === href ? label : `${label}: ${href}`)
  })
  $('br').replaceWith('\n')
  $('li').prepend('- ')
  $('p, h1, h2, h3, li, tr').append('\n\n')
  return { html, text: $('body').text().replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim() }
}
