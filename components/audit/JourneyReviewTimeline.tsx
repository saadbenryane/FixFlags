import { Card } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import { ArrowRight } from 'lucide-react'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export interface JourneyReviewSummary {
  id: string
  journeyType: string
  status: string
  goalAchieved: boolean | null
  completedSteps: number
  findingsCount: number
  steps: Array<{
    stepNumber: number
    actionType: string
    url: string
    screenshotAfterUrl: string | null
    reasoning: string | null
  }>
}

interface Props {
  reviews: JourneyReviewSummary[]
}

const TYPE_LABELS: Record<string, string> = {
  'first-visit': 'First visit',
  'pricing-evaluation': 'Pricing',
  signup: 'Signup',
  'contact-support': 'Contact',
}

export function JourneyReviewTimeline({ reviews }: Props) {
  if (reviews.length === 0) return null

  return (
    <section
      className="scroll-mt-[var(--header-offset)] space-y-4"
      aria-labelledby="journey-review-heading"
    >
      <div>
        <SectionTitle id="journey-review-heading">{REPORT_COPY.sectionTitles.journey}</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          FixFlags walked key visitor paths and flagged friction along the way.
        </p>
      </div>
      <div className="grid gap-4">
        {reviews.map((review) => (
          <Card key={review.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {TYPE_LABELS[review.journeyType] ?? review.journeyType}
              </p>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  review.goalAchieved ? 'bg-success/10 text-success' : 'bg-muted text-foreground'
                )}
              >
                {review.goalAchieved
                  ? 'Goal reached'
                  : review.findingsCount > 0
                    ? `${review.findingsCount} ${review.findingsCount === 1 ? 'Flag' : 'Flags'}`
                    : review.status}
              </span>
            </div>
            {review.steps.length > 0 ? (
              <div className="flex flex-wrap items-stretch gap-2">
                {review.steps.map((step, index) => (
                  <div key={step.stepNumber} className="flex items-center gap-2">
                    <div className="w-28 shrink-0 space-y-1 sm:w-36">
                      {step.screenshotAfterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={normalizeInternalScreenshotUrl(step.screenshotAfterUrl) ?? step.screenshotAfterUrl}
                          alt=""
                          width={1280}
                          height={720}
                          className="aspect-video w-full rounded-md bg-muted object-cover"
                        />
                      ) : (
                        <div className="aspect-video w-full rounded-md bg-muted" />
                      )}
                      <p className="truncate text-2xs text-muted-foreground">
                        {step.actionType}
                        {step.reasoning ? `: ${step.reasoning.slice(0, 40)}` : ''}
                      </p>
                    </div>
                    {index < review.steps.length - 1 ? (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </section>
  )
}
