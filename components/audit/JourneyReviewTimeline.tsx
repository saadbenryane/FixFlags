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
