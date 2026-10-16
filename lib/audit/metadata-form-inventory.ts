import type { CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import { isInertHtmlNode } from './html-document'

const fields = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="search"]), textarea, select'
const validation = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="search"]):not([type="email"]):not([type="url"]):not([type="number"]):not([type="tel"]):not([type="date"]):not([type="time"]):not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="color"]):not([type="file"]):not([required]):not([aria-required]), textarea:not([required]):not([aria-required]), select:not([required]):not([aria-required])'
const conversion = /\b(sign\s*up|start\s*free|get\s*started|try\s*free|book\s*demo|register|join|subscribe|buy|purchase)\b/i

/** Form ownership follows the first matching document ID, including non-form
 * collisions. An explicit empty or unresolved form attribute has no owner. */
export function collectFormInventory($: CheerioAPI, ids: ReadonlyMap<string, Element>) {
  const forms = new Map<Element, Element[]>($('form').toArray().filter(form => !isInertHtmlNode(form)).map(form => [form, []]))
  if (!forms.size) return { totalFormInputs: 0, formInputsMissingValidation: 0, maxConversionFormInputs: 0 }
  $('input,textarea,select,button').each((_, control) => {
    if (isInertHtmlNode(control)) return
    const explicit = $(control).attr('form')
    const owner = (explicit !== undefined ? explicit ? ids.get(explicit) : undefined : $(control).closest('form')[0]) as Element | undefined
    if (owner) forms.get(owner)?.push(control)
  })
  let totalFormInputs = 0, formInputsMissingValidation = 0, maxConversionFormInputs = 0
  for (const [form, controls] of forms) {
    const inputs = controls.filter(control => $(control).is(fields))
    // Preserve the existing exclusion of forms whose fields are all disabled.
    if (inputs.every(input => $(input).attr('disabled') !== undefined)) continue
    totalFormInputs += inputs.length
    const hasCta = conversion.test($(form).text()) || controls.some(control => $(control).is('button,input[type="submit"],input[type="image"]') &&
      conversion.test($(control).text() || $(control).attr('value') || $(control).attr('alt') || ''))
    if (hasCta) maxConversionFormInputs = Math.max(maxConversionFormInputs, inputs.length)
    for (const control of inputs.filter(control => $(control).is(validation))) {
      const field = $(control)
      if (!['pattern', 'min', 'max', 'minlength', 'maxlength'].some(attribute => field.attr(attribute) !== undefined)) formInputsMissingValidation++
    }
  }
  return { totalFormInputs, formInputsMissingValidation, maxConversionFormInputs }
}
