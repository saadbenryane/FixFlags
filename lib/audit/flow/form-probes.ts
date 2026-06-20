import type { Page } from 'puppeteer'
import type { ProbeOutcome } from './nav-probes'

export interface FormProbeResult {
  formValidation: ProbeOutcome
  formLabel?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Submit an empty conversion form and expect inline validation feedback. */
export async function probeFormValidation(page: Page): Promise<FormProbeResult> {
  const formMeta = await page.evaluate(() => {
    const forms = Array.from(
      document.querySelectorAll('main form, [role="main"] form, form:not(header form):not(nav form)')
    )

    for (let fi = 0; fi < forms.length; fi++) {
      const form = forms[fi] as HTMLFormElement
      if (form.closest('header, nav, [role="navigation"], [role="search"]')) continue

      const searchInput = form.querySelector('input[type="search"], [role="searchbox"]')
      if (searchInput && !form.querySelector('input[type="email"], input[required], textarea[required]')) {
        continue
      }

      const fields = Array.from(
        form.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="search"]), textarea, select'
        )
      )
      if (fields.length === 0) continue

      const hasRequiredField = fields.some((field) => {
        const el = field as HTMLInputElement
        return el.required || el.getAttribute('aria-required') === 'true'
      })
      if (!hasRequiredField) continue

      const submit =
        form.querySelector('button[type="submit"], input[type="submit"]') ??
        Array.from(form.querySelectorAll('button')).find(
          (btn) => !btn.getAttribute('type') || btn.getAttribute('type') === 'submit'
        )
      if (!submit) continue

      form.setAttribute('data-fixflags-form-probe', String(fi))
      submit.setAttribute('data-fixflags-form-submit', '1')

      const label =
        form.getAttribute('aria-label') ||
        form.querySelector('legend')?.textContent?.trim() ||
        submit.textContent?.trim() ||
        'signup form'

      return { index: fi, label: label.slice(0, 60) }
    }
    return null
  })

  if (!formMeta) {
    return { formValidation: 'skipped' }
  }

  const formSelector = `form[data-fixflags-form-probe="${formMeta.index}"]`
  const submitSelector = `${formSelector} [data-fixflags-form-submit="1"]`
  const urlBefore = page.url()

  try {
    await page.click(submitSelector)
    await sleep(500)

    const feedback = await page.evaluate((sel) => {
      const form = document.querySelector(sel) as HTMLFormElement | null
      if (!form) return { hasFeedback: false, reason: 'form missing' }

      function isVisible(el: Element): boolean {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        )
      }

      for (const input of form.querySelectorAll('input, textarea, select')) {
        const el = input as HTMLInputElement
        if (!isVisible(el)) continue
        if (el.validity && !el.validity.valid) return { hasFeedback: true, reason: 'native invalid' }
        if (el.getAttribute('aria-invalid') === 'true') return { hasFeedback: true, reason: 'aria-invalid' }
      }

      const errorNodes = form.querySelectorAll(
        '[role="alert"], [aria-live="assertive"], [class*="error" i], [id*="error" i], .invalid-feedback'
      )
      for (const node of errorNodes) {
        const text = (node.textContent ?? '').trim()
        if (text.length > 0 && isVisible(node)) {
          return { hasFeedback: true, reason: 'error message' }
        }
      }

      return { hasFeedback: false, reason: 'no feedback' }
    }, formSelector)

    const navigatedAway = page.url() !== urlBefore
    if (feedback.hasFeedback) {
      return { formValidation: 'ok', formLabel: formMeta.label }
    }
    if (navigatedAway) {
      return { formValidation: 'broken', formLabel: formMeta.label }
    }
    return { formValidation: 'broken', formLabel: formMeta.label }
  } catch {
    return { formValidation: 'broken', formLabel: formMeta.label }
  }
}
