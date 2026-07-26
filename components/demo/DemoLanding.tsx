import Link from 'next/link'
import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { DEMO_FIXTURE_VERSIONS } from '@/lib/demo/resolve-fixture'

interface DemoVersionBadgeProps {
  versionLabel: string
  currentPath: string
}

export function DemoVersionBadge({ versionLabel, currentPath }: DemoVersionBadgeProps) {
  return (
    <div className="demo-version-links">
      <span className="demo-version-badge">Fixture · {versionLabel}</span>
      {DEMO_FIXTURE_VERSIONS.map((v) => (
        <Link
          key={v.path}
          href={v.path}
          data-active={v.path === currentPath ? 'true' : undefined}
        >
          {v.label}
        </Link>
      ))}
    </div>
  )
}

interface DemoLandingProps {
  fixture: DemoFixture
}

export function DemoLanding({ fixture }: DemoLandingProps) {
  const navClass = fixture.layout.compactMobileNav
    ? 'demo-nav demo-nav-compact'
    : 'demo-nav demo-nav-spacious'

  const heroGridClass = fixture.layout.ctaAboveFoldMobile
    ? 'demo-hero-grid demo-hero-grid-cta-first'
    : 'demo-hero-grid demo-hero-grid-cta-below-fold'

  const heroImageClass = fixture.layout.largeHeroImageMobile
    ? 'demo-hero-image-wrap demo-hero-image-large-mobile'
    : 'demo-hero-image-wrap'

  const brokenScroll = fixture.layout.brokenScrollReveal ?? false
  const slowBundle = fixture.layout.simulateSlowBundle ?? false
  const smallInputFont = fixture.signupDestination?.smallInputFont ?? false
  const inputFontSize = smallInputFont ? '14px' : '16px'

  return (
    <div className="demo-root">
      {slowBundle ? (
        <script
          dangerouslySetInnerHTML={{
            __html: 'var __ffStart=Date.now();while(Date.now()-__ffStart<4000){}',
          }}
        />
      ) : null}
      {brokenScroll ? (
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{new IntersectionObserver(function(){}).observe(document.body)}catch(e){}',
          }}
        />
      ) : null}
      {fixture.jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(fixture.jsonLd) }}
        />
      ) : null}
      {fixture.showCookieConsent ? (
        <div
          id="cookie-consent"
          className="demo-cookie-banner"
          role="dialog"
          aria-label="Cookie consent"
        >
          <p>We use cookies to improve your experience and measure site usage.</p>
          <button type="button">Accept cookies</button>
        </div>
      ) : null}
      {fixture.layout.showAnnouncement && fixture.announcement ? (
        <div className="demo-announcement" role="status">
          {fixture.announcement}
        </div>
      ) : null}

      <header className="demo-header">
        <div className="demo-header-inner">
          <a href="#main-content" className="demo-logo">
            {DEMO_BRAND.name}
          </a>
          <nav className={navClass} aria-label="Main">
            {fixture.navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="demo-hero">
          <div className="demo-hero-inner">
            <div className={heroGridClass}>
              <div className="demo-hero-copy">
                <h1>{fixture.headline}</h1>
                <p>{fixture.subhead}</p>
                <div className="demo-cta-row">
                  <a href={fixture.primaryCta.href} className="demo-cta-primary">
                    {fixture.primaryCta.label}
                  </a>
                  {fixture.secondaryCta ? (
                    <a href={fixture.secondaryCta.href} className="demo-cta-secondary">
                      {fixture.secondaryCta.label}
                    </a>
                  ) : null}
                </div>
              </div>
              <div className={heroImageClass}>
                {/* eslint-disable-next-line @next/next/no-img-element -- demo fixture uses plain img for audit realism */}
                <img
                  src={fixture.heroImageSrc}
                  alt={fixture.heroImageAlt}
                  width={1600}
                  height={900}
                />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="demo-features">
          {fixture.featuresSectionTitle ? <h2>{fixture.featuresSectionTitle}</h2> : null}
          <div className="demo-features-grid">
            {fixture.features.map((feature) => (
              <article
                key={feature.title}
                className="demo-feature-card"
                style={
                  brokenScroll
                    ? { opacity: 0, transform: 'translateY(40px)' }
                    : undefined
                }
              >
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {fixture.socialProof ? (
          <section className="demo-social-proof">
            {fixture.socialProof.statLine ? (
              <p className="demo-social-proof-stat">{fixture.socialProof.statLine}</p>
            ) : null}
            <div className="demo-testimonials">
              {fixture.socialProof.testimonials.map((item) => (
                <blockquote key={item.author} className="demo-testimonial">
                  <p>&ldquo;{item.quote}&rdquo;</p>
                  <footer>
                    {item.author}
                    {item.role ? `, ${item.role}` : ''}
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        ) : null}

        <section id="signup" className="demo-signup">
          {fixture.form ? (
            <>
              <h2>{fixture.form.heading}</h2>
              <form>
                {fixture.form.fields.map((field) => (
                  <div key={field.name}>
                    <label htmlFor={`form-${field.name}`}>{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        id={`form-${field.name}`}
                        name={field.name}
                        required={field.required ?? false}
                        style={{ fontSize: inputFontSize }}
                      >
                        {(field.options ?? ['']).map((opt) => (
                          <option key={opt} value={opt.toLowerCase()}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`form-${field.name}`}
                        name={field.name}
                        type={field.type}
                        required={field.required ?? false}
                        style={{ fontSize: inputFontSize }}
                      />
                    )}
                  </div>
                ))}
                <button type="submit">{fixture.form.submitLabel}</button>
              </form>
            </>
          ) : null}
        </section>
      </main>

      <footer className="demo-footer">
        <div className="demo-footer-inner">
          <span>
            © {new Date().getFullYear()} {DEMO_BRAND.name}
          </span>
          <div className="demo-footer-links">
            {fixture.footerLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <section id="privacy" className="demo-footer-anchor" aria-hidden="true" />
          <section id="terms" className="demo-footer-anchor" aria-hidden="true" />
          {process.env.NODE_ENV === 'development' ? (
            <DemoVersionBadge versionLabel={fixture.versionLabel} currentPath={fixture.path} />
          ) : null}
        </div>
      </footer>
    </div>
  )
}
