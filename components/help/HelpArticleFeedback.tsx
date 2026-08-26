'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics/events'
import type { HelpArticleSlug } from '@/lib/help/types'

export function HelpArticleFeedback({ articleSlug }: { articleSlug: HelpArticleSlug }) {
  const [submitted, setSubmitted] = useState<'yes' | 'no' | null>(null)

  function submit(helpful: boolean) {
    setSubmitted(helpful ? 'yes' : 'no')
    trackEvent('help_article_feedback', {
      article_slug: articleSlug,
      helpful,
    })
  }

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        {submitted === 'yes' ? 'Thanks for the feedback.' : 'Thanks. We will improve this article.'}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-6">
      <p className="text-sm font-medium text-foreground">Was this helpful?</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => submit(true)}>
          Yes
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => submit(false)}>
          No
        </Button>
      </div>
    </div>
  )
}
