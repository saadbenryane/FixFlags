'use client'

import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'

interface DemoSignupProps {
  fixture: DemoFixture
}

export function DemoSignup({ fixture }: DemoSignupProps) {
  const slowReveal = fixture.signupDestination?.slowReveal ?? false
  const missingTrust = fixture.signupDestination?.missingTrust ?? false
  const slowValidation = fixture.signupDestination?.slowValidation ?? false
  const smallInputFont = fixture.signupDestination?.smallInputFont ?? false

  const inputStyle = smallInputFont ? { fontSize: '14px' } : { fontSize: '16px' }

  return (
    <div className="demo-root">
      {slowReveal ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var main = document.querySelector('main');
                if (main) {
                  main.style.visibility = 'hidden';
                  setTimeout(function () { main.style.visibility = 'visible'; }, 3500);
                }
              })();
            `,
          }}
        />
      ) : null}
      {slowValidation ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('DOMContentLoaded', function () {
                var form = document.querySelector('main form');
                if (!form) return;
                form.addEventListener('submit', function (e) {
                  e.preventDefault();
                  setTimeout(function () {
                    var err = document.getElementById('demo-signup-error');
                    if (err) err.hidden = false;
                  }, 1500);
                });
              });
            `,
          }}
        />
      ) : null}

      <header className="demo-header">
        <div className="demo-header-inner">
          <a href={fixture.path} className="demo-logo">{DEMO_BRAND.name}</a>
        </div>
      </header>

      <main id="main-content">
        <section className="demo-signup">
          <h1>Create your account</h1>
          <p>Start building your landing page in minutes.</p>
          {fixture.form ? (
            <form>
              {fixture.form.fields.map((field) => (
                <div key={field.name}>
                  <label htmlFor={`signup-${field.name}`}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      id={`signup-${field.name}`}
                      name={field.name}
                      required
                      style={inputStyle}
                    >
                      {(field.options ?? ['']).map((opt) => (
                        <option key={opt} value={opt.toLowerCase()}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`signup-${field.name}`}
                      name={field.name}
                      type={field.type}
                      required
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
              <p id="demo-signup-error" className="demo-signup-error" hidden role="alert">
                Please fill in all required fields.
              </p>
              <button type="submit">{fixture.form.submitLabel}</button>
            </form>
          ) : null}
        </section>
      </main>

      {!missingTrust ? (
        <footer className="demo-footer">
          <div className="demo-footer-inner">
            <span>© {new Date().getFullYear()} {DEMO_BRAND.name}</span>
            <div className="demo-footer-links">
              <a href="#privacy">Privacy</a>
              <a href="#terms">Terms</a>
              <a href="mailto:hello@launchpad-demo.app">Contact</a>
            </div>
            <section id="privacy" className="demo-footer-anchor" aria-hidden="true" />
            <section id="terms" className="demo-footer-anchor" aria-hidden="true" />
          </div>
        </footer>
      ) : null}
    </div>
  )
}
