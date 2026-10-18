export const NAVIGATION_OBSERVATION_COPY = {
  competingProblem: (count: number) => `Review ${count} similarly prominent actions in the captured viewport`,
  competingEvidence: (labels: readonly string[]) => `Recorded actions with similar visual weight: ${labels.slice(0, 4).map(label => `"${label}"`).join(', ')}. Intended priority, task completion and visitor understanding were not established.`,
  competingGuidance: 'Review the recorded actions against the intended task. If one action requires greater priority, distinguish it visually while preserving access to the other working actions. Keep equivalent actions unchanged when equal prominence is intentional.',
  navigationEvidence: (internal: number, anchors: number) => `${internal} same-site navigation link${internal === 1 ? '' : 's'} recorded among ${anchors} anchors in the captured DOM sample. Other controls, runtime actions and the need for further navigation were not established.`,
  navigationGuidance: 'Review whether the captured page supplies the navigation needed for its intended task. If a necessary destination cannot be reached through the existing links or working controls, add a clearly named route to that destination. Preserve completed-task pages and intentional navigation limits.',
} as const
