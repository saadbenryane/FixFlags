import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { GuideActions } from '@/components/marketing/guides/GuideActions'
import { guideMetadata, guideSchema } from '@/components/marketing/guides/guide-seo'
import { GUIDE_REVIEWED_AT, GUIDES_PAGE, WEBSITE_GUIDES, getWebsiteGuide } from '@/lib/marketing/copy/guides'
import s from '@/components/marketing/guides/Guide.module.css'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return WEBSITE_GUIDES.map(guide => ({ slug: guide.slug }))
}

export async function generateMetadata({ params }: Props) {
  const guide = getWebsiteGuide((await params).slug)
  if (!guide) notFound()
  return guideMetadata(guide)
}

export default async function GuidePage({ params }: Props) {
  const guide = getWebsiteGuide((await params).slug)
  if (!guide) notFound()

  return <div className={s.page}>
    <MarketingPageViewTracker page={`/guides/${guide.slug}`} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema(guide)).replace(/</g, '\\u003c') }} />
    <Container variant="marketing">
      <nav aria-label={GUIDES_PAGE.back}><Link className={s.link} href={'/guides' as Route}>{GUIDES_PAGE.back}</Link></nav>
      <header className={s.header}>
        <h1 className={s.title}>{guide.title}</h1>
        <p className={s.description}>{guide.description}</p>
        <p className={s.date}>{GUIDES_PAGE.reviewed}: <time dateTime={GUIDE_REVIEWED_AT}>{GUIDE_REVIEWED_AT}</time></p>
        <p className={s.decision}>{guide.decision}</p>
      </header>
      <div className={s.layout}>
        <nav className={s.contents} aria-label={GUIDES_PAGE.contents}>
          <p>{GUIDES_PAGE.contents}</p>
          <ul>{guide.sections.map(section => <li key={section.id}><a className={s.link} href={`#${section.id}`}>{section.title}</a></li>)}</ul>
        </nav>
        <article className={s.article}>
          {guide.sections.map(section => <section className={s.section} id={section.id} key={section.id}>
            <h2>{section.title}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {section.sourceIds ? <div className={s.sourceLinks}>{section.sourceIds.map(id => {
              const source = guide.sources[id]
              return <a className={s.link} href={source.href} key={id}>{source.title}</a>
            })}</div> : null}
          </section>)}
          <section className={s.example} aria-labelledby="controlled-example">
            <p className={s.label}>{GUIDES_PAGE.exampleLabel}</p>
            <h2 id="controlled-example">{guide.example.title}</h2>
            {guide.example.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>
          <section className={s.sources} aria-labelledby="sources">
            <h2 id="sources">{GUIDES_PAGE.sources}</h2>
            <p>{GUIDES_PAGE.sourceNote}</p>
            <ul>{guide.sources.map(source => <li key={source.href}>
              <a className={s.link} href={source.href}>{source.title}</a>
              <p>{source.supports}</p>
            </li>)}</ul>
          </section>
          <section className={s.related} aria-labelledby="related">
            <h2 id="related">{GUIDES_PAGE.related}</h2>
            <ul>{guide.related.map(slug => {
              const related = getWebsiteGuide(slug)!
              return <li key={slug}><Link className={s.link} href={`/guides/${slug}` as Route}>{related.title}</Link></li>
            })}
              <li><Link className={s.link} href="/coverage">{GUIDES_PAGE.coverageLink}</Link></li>
              <li><Link className={s.link} href="/docs/fix-with-ai">{GUIDES_PAGE.docsLink}</Link></li>
            </ul>
          </section>
          <section className={s.cta} aria-labelledby="next-step">
            <h2 id="next-step">{GUIDES_PAGE.nextTitle}</h2>
            <p className={s.offer}>{GUIDES_PAGE.offer}</p>
            <p className={s.offer}>{GUIDES_PAGE.offerLimits}</p>
            <GuideActions page={`/guides/${guide.slug}`} />
          </section>
        </article>
      </div>
    </Container>
  </div>
}
