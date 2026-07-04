import type { DemoFixture } from '@/lib/demo/types'
import { DEMO_BRAND } from '@/lib/demo/brand'

/** Static HTML snapshot for offline deterministic checks against demo fixtures. */
export function renderFixtureHtml(fixture: DemoFixture, origin = 'https://fixflags.com'): string {
  const meta = fixture.metadata
  const title = typeof meta.title === 'string' ? meta.title : DEMO_BRAND.name
  const description = meta.description ?? ''
  const robots =
    meta.robots && typeof meta.robots === 'object' && 'index' in meta.robots
      ? meta.robots.index
        ? 'index, follow'
        : 'noindex, nofollow'
      : 'noindex, nofollow'
  const canonical =
    meta.alternates && typeof meta.alternates === 'object' && 'canonical' in meta.alternates
      ? String(meta.alternates.canonical)
      : ''
  const ogImage =
    meta.openGraph &&
    typeof meta.openGraph === 'object' &&
    'images' in meta.openGraph &&
    Array.isArray(meta.openGraph.images) &&
    meta.openGraph.images[0] &&
    typeof meta.openGraph.images[0] === 'object' &&
    'url' in meta.openGraph.images[0]
      ? String(meta.openGraph.images[0].url)
      : ''
  const ogDescription =
    meta.openGraph && typeof meta.openGraph === 'object' && 'description' in meta.openGraph
      ? String(meta.openGraph.description ?? '')
      : description

  const navClass = fixture.layout.compactMobileNav ? 'demo-nav-compact' : 'demo-nav-spacious'
  const heroGridClass = fixture.layout.ctaAboveFoldMobile
    ? 'demo-hero-grid-cta-first'
    : 'demo-hero-grid-cta-below-fold'

  const jsonLd = fixture.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(fixture.jsonLd)}</script>`
    : ''

  const analyticsScript = fixture.showCookieConsent
    ? '<script>/* googletagmanager */</script>'
    : ''

  const cookieBanner = fixture.showCookieConsent
    ? `<div id="cookie-consent" class="demo-cookie-banner" role="dialog">We use cookies to improve your experience. <button type="button">Accept cookies</button></div>`
    : ''

  const announcement =
    fixture.layout.showAnnouncement && fixture.announcement
      ? `<div class="demo-announcement">${fixture.announcement}</div>`
      : ''

  const navLinks = fixture.navLinks
    .map((l) => `<a href="${l.href}">${l.label}</a>`)
    .join('')
  const footerLinks = fixture.footerLinks
    .map((l) => `<a href="${l.href}">${l.label}</a>`)
    .join('')

  const secondaryCta = fixture.secondaryCta
    ? `<a href="${fixture.secondaryCta.href}" class="demo-cta-secondary">${fixture.secondaryCta.label}</a>`
    : ''

  const features = fixture.features
    .map(
      (f) =>
        `<article class="demo-feature-card"><h3>${f.title}</h3><p>${f.description}</p></article>`
    )
    .join('')

  const signupForm = fixture.form
    ? `<section id="signup"><h2>${escapeHtml(fixture.form.heading)}</h2><form>${fixture.form.fields
        .map(
          (f) =>
            `<div><label for="form-${f.name}">${escapeHtml(f.label)}</label>${
              f.type === 'select'
                ? `<select id="form-${f.name}" name="${f.name}"${f.required ? ' required' : ''}>${(f.options ?? [''])
                    .map((o) => `<option value="${escapeHtml(o.toLowerCase())}">${escapeHtml(o)}</option>`)
                    .join('')}</select>`
                : `<input id="form-${f.name}" name="${f.name}" type="${f.type}"${f.required ? ' required' : ''}/>`
            }</div>`
        )
        .join('')}<button type="submit">${escapeHtml(fixture.form.submitLabel)}</button></form></section>`
    : '<section id="signup" aria-hidden="true"></section>'

  const socialProof = fixture.socialProof
    ? `<section class="demo-social-proof">${
        fixture.socialProof.statLine
          ? `<p class="demo-social-proof-stat">${escapeHtml(fixture.socialProof.statLine)}</p>`
          : ''
      }${fixture.socialProof.testimonials
        .map(
          (t) =>
            `<blockquote class="demo-testimonial"><p>&ldquo;${escapeHtml(t.quote)}&rdquo;</p><footer>${escapeHtml(t.author)}${t.role ? `, ${escapeHtml(t.role)}` : ''}</footer></blockquote>`
        )
        .join('')}</section>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}"/>
  <meta name="robots" content="${robots}"/>
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}"/>` : ''}
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage.startsWith('http') ? ogImage : `${origin}${ogImage}`)}"/>` : ''}
  ${ogDescription ? `<meta property="og:description" content="${escapeHtml(ogDescription)}"/>` : ''}
  <meta property="og:title" content="${escapeHtml(title)}"/>
  <link rel="icon" href="/favicon.ico"/>
  ${jsonLd}
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to content</a>
  ${analyticsScript}
  ${cookieBanner}
  ${announcement}
  <header class="demo-header">
    <a href="#main-content" class="demo-logo">${DEMO_BRAND.name}</a>
    <nav class="${navClass}" aria-label="Main">${navLinks}</nav>
  </header>
  <main id="main-content">
    <section class="demo-hero">
      <div class="${heroGridClass}">
        <h1>${escapeHtml(fixture.headline)}</h1>
        <p>${escapeHtml(fixture.subhead)}</p>
        <a href="${fixture.primaryCta.href}" class="demo-cta-primary">${escapeHtml(fixture.primaryCta.label)}</a>
        ${secondaryCta}
        <img src="${fixture.heroImageSrc}" alt="${escapeHtml(fixture.heroImageAlt ?? '')}"/>
      </div>
    </section>
  <section id="features">${fixture.featuresSectionTitle ? `<h2>${escapeHtml(fixture.featuresSectionTitle)}</h2>` : ''}${features}</section>
  ${socialProof}
  ${signupForm}
  <section id="privacy" aria-hidden="true"></section>
  <section id="terms" aria-hidden="true"></section>
</main>
  <footer class="demo-footer">${footerLinks}</footer>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
