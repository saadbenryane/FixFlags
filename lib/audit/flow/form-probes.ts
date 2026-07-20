import type { Page } from 'playwright'
import { detectOverlayAtPoint, type OverlayBlockerInfo } from '@/lib/audit/browser/overlay-probe'
import type { ProbeOutcome } from './nav-probes'

export interface FormProbeResult {
  formValidation: ProbeOutcome
  formLabel?: string
  feedbackMs?: number | null
  formOverlay?: OverlayBlockerInfo | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Submit an empty conversion form and expect inline validation feedback. */
export async function probeFormValidation(page: Page): Promise<FormProbeResult> {
  const formMeta = await page.evaluate(() => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const forms = Array.from(
      document.querySelectorAll('main form, [role="main"] form, form:not(header form):not(nav form)')
    )

    for (let fi = 0; fi < forms.length; fi++) {
      const form = forms[fi] as HTMLFormElement
      if (form.closest('header, nav, [role="navigation"], [role="search"]')) continue
      if (form.hasAttribute('novalidate')) continue

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

  const nativeCheck = await page.evaluate((sel) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const form = document.querySelector(sel) as HTMLFormElement | null
    if (!form) return { hasValidation: false }
    // Empty required fields should fail constraint validation when rules exist.
    if (!form.checkValidity()) {
      return { hasValidation: true }
    }
    return { hasValidation: false }
  }, formSelector)

  if (nativeCheck.hasValidation) {
    return { formValidation: 'ok', formLabel: formMeta.label, feedbackMs: 0 }
  }

  const submitSelector = `${formSelector} button[type="submit"], ${formSelector} input[type="submit"], ${formSelector} button:not([type="button"])`
  const urlBefore = page.url()

  try {
    const submit = await page.$(submitSelector)
    if (!submit) {
      return { formValidation: 'broken', formLabel: formMeta.label }
    }

    const clickStart = await page.evaluate(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      return performance.now()
    })
    await submit.click()

    let feedbackMs: number | null = null
    let hasFeedback = false
    const deadline = 2_000
  const pollInterval = 50

    while (feedbackMs === null || !hasFeedback) {
      const elapsed = await page.evaluate((start) => {
        ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
        return performance.now() - start
      }, clickStart)
      if (elapsed > deadline) break

      hasFeedback = await page.evaluate((sel) => {
        ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
        const form = document.querySelector(sel) as HTMLFormElement | null
        if (!form) return false

        for (const input of form.querySelectorAll('input, textarea, select')) {
          const el = input as HTMLInputElement
          const rect = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0'
          if (!visible) continue
          if (el.validity && !el.validity.valid) return true
          if (el.getAttribute('aria-invalid') === 'true') return true
        }

        for (const node of form.querySelectorAll(
          '[role="alert"], [aria-live="assertive"], [class*="error" i], [id*="error" i], .invalid-feedback'
        )) {
          const text = (node.textContent ?? '').trim()
          const rect = node.getBoundingClientRect()
          if (text.length > 0 && rect.width > 0 && rect.height > 0) return true
        }

        return false
      }, formSelector)

      if (hasFeedback) {
        feedbackMs = Math.round(elapsed)
        break
      }

      await sleep(pollInterval)
    }

    if (hasFeedback) {
      return { formValidation: 'ok', formLabel: formMeta.label, feedbackMs }
    }
    if (page.url() !== urlBefore) {
      return { formValidation: 'broken', formLabel: formMeta.label }
    }
    return { formValidation: 'broken', formLabel: formMeta.label }
  } catch {
    const overlay = await detectOverlayAtPoint(page, submitSelector)
    return { formValidation: 'broken', formLabel: formMeta.label, formOverlay: overlay }
  }
}
