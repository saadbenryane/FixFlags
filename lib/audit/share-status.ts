export function shareStatusMessage(
  shareStatus: string,
  criticalCount: number,
  totalFlags?: number
): string {
  if (shareStatus === 'good_to_share') {
    return 'No critical Flags found. Good to share.'
  }
  if (criticalCount === 1) {
    return totalFlags != null && totalFlags > 1
      ? `1 critical of ${totalFlags} Flags. Fix this before sharing.`
      : '1 critical. Fix this before sharing.'
  }
  return totalFlags != null && totalFlags > criticalCount
    ? `${criticalCount} critical of ${totalFlags} Flags. Fix critical before sharing.`
    : `${criticalCount} critical. Fix these before sharing.`
}
