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

  return (
    <div className="demo-root">
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
                <img src={fixture.heroImageSrc} alt={fixture.heroImageAlt} />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="demo-features">
          <h2>{fixture.featuresSectionTitle}</h2>
          <div className="demo-features-grid">
            {fixture.features.map((feature) => (
              <article key={feature.title} className="demo-feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
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
          {process.env.NODE_ENV === 'development' ? (
            <DemoVersionBadge versionLabel={fixture.versionLabel} currentPath={fixture.path} />
          ) : null}
        </div>
      </footer>
    </div>
  )
}
